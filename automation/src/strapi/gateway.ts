// ============================================================
// gateway.ts — שער ה-Strapi של האוטומציה
// ============================================================
//
// הכתובת קבועה בקוד (כמו ב-strapiClient.ts של האתר) — env.STRAPI_URL
// בפריסה מצביע להיסטוריה מתה. קריאות עובדות בלי טוקן; כתיבות דורשות
// STRAPI_TOKEN. מוסכמות זהות ל-db.ts של האתר: אוסף items משותף,
// category='gemachim', תת-קטגוריה ב-extra_fields.gmach_type,
// status1 הוא שדה הסטטוס, ומיזוג extra_fields בכל עדכון.

import type { Candidate, DiscoveryJob, ExistingEntry } from '../core/types.ts';
import type { Logger } from '../core/logger.ts';
import { sleep } from '../core/rateLimiter.ts';

const STRAPI_URL = 'https://api.gofreeil.com';
const GEMACH_CATEGORY = 'gemachim';
const JOB_CATEGORY = '__ng_discovery_job';
const PAGE_SIZE = 100;

// status1 ב-Strapi הוא enumeration סגור:
//   active | inactive | deleted | resolved | pending | rejected | frozen
// ולכן 'draft'/'queued'/'running' אינם ניתנים לכתיבה. מתרגמים כאן, בגבול
// ה-Strapi בלבד (זהה ל-toItemStatus ב-src/lib/server/db.ts — שני הצדדים
// חייבים להסכים על הערך הזה).
const DRAFT_ITEM_STATUS = 'pending';

/** מצב ה-job האמיתי נשמר ב-extra_fields.job_status; status1 מקבל את הערך
 *  החוקי הקרוב ביותר, כדי שאפשר יהיה גם לסנן ב-Strapi. */
const JOB_ITEM_STATUS: Record<string, string> = {
	queued:    'pending',
	running:   'pending',
	done:      'resolved',
	failed:    'rejected',
	cancelled: 'inactive',
};

// משימה 'running' שלא דיווחה התקדמות זמן רב — ה-worker שלה מת (נפילת
// חשמל/סגירת חלון). worker חדש משחזר אותה במקום שתיתקע לנצח.
const STALE_RUNNING_MS = 20 * 60 * 1000;

const REQUEST_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 1_500;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/** קוד הסטטוס מתוך הודעת שגיאה בפורמט "Strapi GET /path → 503: ..." */
function statusOf(err: Error): number {
	const m = /→ (\d{3}):/.exec(err.message);
	return m ? Number(m[1]) : 0;
}

/** כשל רשת (ניתוק/timeout/DNS) — להבדיל מתשובת HTTP תקינה עם שגיאה */
function isRetryableNetworkError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	const code = (err as { cause?: { code?: string } }).cause?.code ?? '';
	return (
		err.name === 'TimeoutError' ||
		/fetch failed|network|socket|terminated/i.test(err.message) ||
		/^(UND_ERR_|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)/.test(code)
	);
}

/** הופך כשל רשת גולמי להסבר בעברית — סטאק של undici לא אומר כלום למשתמש */
function describeConnectionError(err: unknown, what: string): Error {
	if (isRetryableNetworkError(err)) {
		return new Error(
			`אין תקשורת ל-Strapi (${what}) אחרי ${REQUEST_ATTEMPTS} ניסיונות. ` +
			'בדקו חיבור לאינטרנט ונסו שוב — ייתכן שהשרת עמוס זמנית.',
		);
	}
	return err instanceof Error ? err : new Error(String(err));
}

interface StrapiItemLight {
	documentId: string;
	label: string | null;
	city: string | null;
	phone: string | null;
	status1: string | null;
}

interface StrapiJobItem {
	documentId: string;
	label: string | null;
	description: string | null;
	status1: string | null;
	extra_fields: Record<string, unknown> | null;
	createdAt: string;
}

export class StrapiGateway {
	constructor(
		private readonly token: string | undefined,
		private readonly logger: Logger,
	) {}

	/** ודא שאפשר לכתוב באמת. טוקן אמיתי של Strapi הוא מחרוזת hex ארוכה
	 *  (100+ תווים), ולכן כל ערך קצר/עברי/עם מילת-מציין נתפס כאן — אחרת
	 *  הריצה הייתה נראית תקינה וכל ייבוא היה נכשל ב-403 בשקט. */
	assertWritable(): void {
		const t = this.token;
		if (!t) throw new Error('STRAPI_TOKEN חסר — כתיבה ל-Strapi דורשת טוקן (הוסיפו אותו ל-.env בשורש הפרויקט)');
		if (/[^\x20-\x7E]/.test(t)) {
			throw new Error('STRAPI_TOKEN מכיל תווים לא-ASCII — כנראה הודבק טקסט עברי במקום הטוקן');
		}
		if (/^(paste|your|xxx|token|changeme|<)/i.test(t) || t.includes('_YOUR_') || t.length < 40) {
			throw new Error(
				`STRAPI_TOKEN נראה כמו מציין-מקום ולא כמו טוקן אמיתי (אורך ${t.length}). ` +
				'העתיקו את הטוקן מ-Vercel (Settings → Environment Variables) או מ-Strapi ' +
				'(Settings → API Tokens) אל .env בשורש הפרויקט.',
			);
		}
	}

	private headers(withAuth: boolean): Record<string, string> {
		return {
			'Content-Type': 'application/json',
			...(withAuth && this.token ? { Authorization: `Bearer ${this.token}` } : {}),
		};
	}

	/**
	 * בקשה ל-Strapi עם ניסיונות חוזרים. השרת נוטה לאיטיות התחברות רגעית,
	 * ותקרת ה-connect של undici היא 10 שניות — בלי retry ניתוק אחד מפיל
	 * ריצה שלמה (למשל בבניית אינדקס הכפילויות, עוד לפני שהדפדפן נפתח).
	 * חוזרים רק על כשלי רשת ועל סטטוסים חולפים; 4xx נכשל מיד.
	 */
	private async request<T>(method: string, path: string, body?: unknown, auth = false): Promise<T> {
		let lastError: unknown;
		for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt++) {
			try {
				const res = await fetch(`${STRAPI_URL}${path}`, {
					method,
					headers: this.headers(auth),
					...(body !== undefined ? { body: JSON.stringify(body) } : {}),
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				});
				if (!res.ok) {
					const text = await res.text().catch(() => '');
					const err = new Error(`Strapi ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
					if (!RETRYABLE_STATUS.has(res.status) || attempt === REQUEST_ATTEMPTS) throw err;
					lastError = err;
				} else {
					return (await res.json()) as T;
				}
			} catch (e) {
				// שגיאת HTTP לא-חוזרת (403/404/...) כבר נזרקה למעלה
				if (e instanceof Error && e.message.startsWith('Strapi ') && !isRetryableNetworkError(e)) {
					if (!RETRYABLE_STATUS.has(statusOf(e)) || attempt === REQUEST_ATTEMPTS) throw e;
				}
				lastError = e;
				if (attempt === REQUEST_ATTEMPTS) break;
			}
			const wait = RETRY_DELAY_MS * attempt;
			this.logger.warn(`Strapi ${method} ${path} נכשל (ניסיון ${attempt}/${REQUEST_ATTEMPTS}) — מנסה שוב בעוד ${wait}ms`);
			await sleep(wait);
		}
		throw describeConnectionError(lastError, `${method} ${path}`);
	}

	// ---------- גמ"חים ----------

	/** כל הגמ"חים בכל הסטטוסים (כולל טיוטות ונדחים — כדי שלא ייובאו שוב),
	 *  בצורה רזה: בלי extra_fields, שם יושבות תמונות data-URI במשקל מאות KB
	 *  לפריט. המחיר: אין טביעת url: לפריטי Strapi (הקישור חי ב-extra_fields.link),
	 *  ולכן ההשוואה נשענת על טלפון ועל שם+עיר. פריט קיים בלי טלפון ובשם שונה
	 *  מהותית עלול להתקבל כטיוטה כפולה — האדמין דוחה אותה פעם אחת, והיא נכנסת
	 *  לאינדקס (הנדחים נשלפים כאן) כך שלא תחזור. */
	async listGemachimLight(): Promise<ExistingEntry[]> {
		const out: ExistingEntry[] = [];
		for (let start = 0; ; start += PAGE_SIZE) {
			const params = new URLSearchParams({
				'filters[category][$eq]': GEMACH_CATEGORY,
				'fields[0]': 'label',
				'fields[1]': 'city',
				'fields[2]': 'phone',
				'fields[3]': 'status1',
				'pagination[start]': String(start),
				'pagination[limit]': String(PAGE_SIZE),
			});
			const res = await this.request<{ data: StrapiItemLight[] }>('GET', `/api/items?${params}`);
			const rows = res.data ?? [];
			for (const row of rows) {
				out.push({
					ref: row.documentId,
					kind: 'strapi',
					name: row.label ?? undefined,
					city: row.city ?? undefined,
					phone: row.phone ?? undefined,
				});
			}
			if (rows.length < PAGE_SIZE) break;
		}
		return out;
	}

	/** יוצר טיוטת גמ"ח (status1='pending') — לא מופיעה באתר, שהמסנן הציבורי
	 *  שלו מציג רק 'active', עד שאדמין מאשר אותה.
	 *  שים לב: לא כותבים extra_fields.source_id (שמור לייבוא מהרשימה
	 *  הסטטית ומשמש לסינון שלה) — מטא-הגילוי חי תחת extra_fields.discovery. */
	async createDraftGemach(c: Candidate, opts: { icon?: string; runRef: string; requestedBy?: string }): Promise<string> {
		this.assertWritable();
		const res = await this.request<{ data: { documentId: string } }>(
			'POST',
			'/api/items',
			{
				data: {
					label: c.name,
					category: GEMACH_CATEGORY,
					description: c.description,
					contact: '',
					phone: c.phone ?? '',
					address: c.address ?? '',
					icon: opts.icon || '🤝',
					color: 'amber',
					neighborhood: '',
					city: c.city,
					lat: null,
					lng: null,
					extra_fields: {
						gmach_type: c.category,
						...(c.link ? { link: c.link } : {}),
						...(c.tags.length > 0 ? { tags: c.tags } : {}),
						discovery: {
							source: c.source,
							source_url: c.sourceUrl,
							query: c.query,
							confidence: c.confidence,
							fingerprint: c.fingerprints[0] ?? '',
							found_at: new Date().toISOString(),
							run: opts.runRef,
							...(opts.requestedBy ? { requested_by: opts.requestedBy } : {}),
						},
					},
					status1: DRAFT_ITEM_STATUS,
					user_id: `discovery:${c.source}`,
					publishedAt: new Date().toISOString(),
				},
			},
			true,
		);
		return res.data.documentId;
	}

	// ---------- תור המשימות (__ng_discovery_job) ----------

	/** מצב ה-job האמיתי חי ב-extra_fields.job_status; ל-status1 יש רק את
	 *  הערך החוקי הקרוב, ולכן לא ניתן לגזור ממנו queued מול running. */
	private mapJob(row: StrapiJobItem): DiscoveryJob {
		const extra = (row.extra_fields ?? {}) as Record<string, unknown>;
		const jobStatus = typeof extra.job_status === 'string' && extra.job_status
			? extra.job_status
			: (row.status1 === 'resolved' ? 'done' : row.status1 === 'rejected' ? 'failed' : 'queued');
		return {
			documentId: row.documentId,
			status: jobStatus,
			note: row.description ?? '',
			extra,
			createdAt: row.createdAt,
		};
	}

	/** האם משימה שסומנה כרצה נתקעה (ה-worker שלה מת) */
	private isStale(job: DiscoveryJob): boolean {
		if (job.status !== 'running') return false;
		const last = Date.parse(String(job.extra.progress_at ?? job.extra.started_at ?? job.createdAt ?? ''));
		return Number.isFinite(last) && Date.now() - last > STALE_RUNNING_MS;
	}

	/** ה-job הישן ביותר שממתין בתור (FIFO). ב-Strapi מסננים לפי status1
	 *  ('pending' = פתוח), ואת ההבחנה queued/running עושים על job_status. */
	async fetchQueuedJob(): Promise<DiscoveryJob | null> {
		const params = new URLSearchParams({
			'filters[category][$eq]': JOB_CATEGORY,
			'filters[status1][$eq]': JOB_ITEM_STATUS.queued,
			sort: 'createdAt:asc',
			'pagination[limit]': '10',
		});
		try {
			const res = await this.request<{ data: StrapiJobItem[] }>('GET', `/api/items?${params}`);
			const jobs = (res.data ?? []).map((r) => this.mapJob(r));
			// עדיפות לתור הרגיל; אחריו משימה שנתקעה אחרי קריסת worker
			const fresh = jobs.find((j) => j.status === 'queued');
			if (fresh) return fresh;
			const stale = jobs.find((j) => this.isStale(j));
			if (stale) this.logger.warn(`משימה ${stale.documentId} נתקעה (ה-worker הקודם כנראה נפל) — משחזר אותה`);
			return stale ?? null;
		} catch (e) {
			this.logger.warn('שליפת תור המשימות נכשלה', e);
			return null;
		}
	}

	/** מצב ה-job האפליקטיבי (queued/running/done/failed/cancelled) */
	async getJobStatus(documentId: string): Promise<string | null> {
		try {
			const res = await this.request<{ data: StrapiJobItem | null }>('GET', `/api/items/${documentId}`);
			return res.data ? this.mapJob(res.data).status : null;
		} catch {
			return null;
		}
	}

	/** מיזוג extra_fields (קריאה-מיזוג-כתיבה — PUT מחליף את כל ה-JSON).
	 *  status הוא המצב האפליקטיבי; הוא נשמר גם ב-job_status וגם מתורגם ל-status1. */
	private async mergeJob(documentId: string, patch: Record<string, unknown>, status?: string): Promise<void> {
		this.assertWritable();
		const cur = await this.request<{ data: StrapiJobItem | null }>('GET', `/api/items/${documentId}`);
		const existing = (cur.data?.extra_fields ?? {}) as Record<string, unknown>;
		await this.request('PUT', `/api/items/${documentId}`, {
			data: {
				...(status ? { status1: JOB_ITEM_STATUS[status] ?? 'pending' } : {}),
				extra_fields: { ...existing, ...patch, ...(status ? { job_status: status } : {}) },
			},
		}, true);
	}

	/** תפיסת job: רק אם הוא עדיין queued. מחזיר false אם מישהו אחר הקדים.
	 *  ל-Strapi אין עדכון-מותנה אטומי, ולכן אחרי הכתיבה קוראים שוב ומוודאים
	 *  ש-claimed_by הוא שלנו — שני עובדים במקביל לא ירוצו על אותה משימה. */
	async claimJob(documentId: string, workerId: string): Promise<boolean> {
		const res0 = await this.request<{ data: StrapiJobItem | null }>('GET', `/api/items/${documentId}`);
		if (!res0.data) return false;
		const current = this.mapJob(res0.data);
		if (current.status !== 'queued' && !this.isStale(current)) return false;
		await this.mergeJob(documentId, { claimed_by: workerId, started_at: new Date().toISOString() }, 'running');

		const res = await this.request<{ data: StrapiJobItem | null }>('GET', `/api/items/${documentId}`);
		const row = res.data;
		const claimedBy = (row?.extra_fields as Record<string, unknown> | undefined)?.claimed_by;
		if (!row || this.mapJob(row).status !== 'running' || claimedBy !== workerId) {
			this.logger.info(`המשימה ${documentId} נתפסה ע"י ${String(claimedBy ?? '?')} — מדלג`);
			return false;
		}
		return true;
	}

	async updateJobProgress(documentId: string, stats: unknown): Promise<void> {
		try {
			await this.mergeJob(documentId, { stats, progress_at: new Date().toISOString() });
		} catch (e) {
			this.logger.warn('עדכון התקדמות ה-job נכשל (ממשיכים)', e);
		}
	}

	async finishJob(documentId: string, status: 'done' | 'failed', stats: unknown, error?: string): Promise<void> {
		await this.mergeJob(
			documentId,
			{ stats, finished_at: new Date().toISOString(), ...(error ? { error } : {}) },
			status,
		);
	}
}
