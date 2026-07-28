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

const STRAPI_URL = 'https://api.gofreeil.com';
const GEMACH_CATEGORY = 'gemachim';
const JOB_CATEGORY = '__ng_discovery_job';
const PAGE_SIZE = 100;

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

	/** ודא שאפשר לכתוב: יש טוקן והוא ASCII (הדבקה של placeholder עברי נתפסת כאן) */
	assertWritable(): void {
		if (!this.token) throw new Error('STRAPI_TOKEN חסר — כתיבה ל-Strapi דורשת טוקן (vercel env pull או .env)');
		if (/[^\x20-\x7E]/.test(this.token)) throw new Error('STRAPI_TOKEN מכיל תווים לא-ASCII — כנראה placeholder ולא טוקן אמיתי');
	}

	private headers(withAuth: boolean): Record<string, string> {
		return {
			'Content-Type': 'application/json',
			...(withAuth && this.token ? { Authorization: `Bearer ${this.token}` } : {}),
		};
	}

	private async request<T>(method: string, path: string, body?: unknown, auth = false): Promise<T> {
		const res = await fetch(`${STRAPI_URL}${path}`, {
			method,
			headers: this.headers(auth),
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new Error(`Strapi ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
		}
		return (await res.json()) as T;
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

	/** יוצר טיוטת גמ"ח (status1='draft') — לא מופיעה באתר עד אישור אדמין.
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
					status1: 'draft',
					user_id: `discovery:${c.source}`,
					publishedAt: new Date().toISOString(),
				},
			},
			true,
		);
		return res.data.documentId;
	}

	// ---------- תור המשימות (__ng_discovery_job) ----------

	private mapJob(row: StrapiJobItem): DiscoveryJob {
		return {
			documentId: row.documentId,
			status: row.status1 ?? '',
			note: row.description ?? '',
			extra: (row.extra_fields ?? {}) as Record<string, unknown>,
			createdAt: row.createdAt,
		};
	}

	/** ה-job הישן ביותר שממתין בתור (FIFO) */
	async fetchQueuedJob(): Promise<DiscoveryJob | null> {
		const params = new URLSearchParams({
			'filters[category][$eq]': JOB_CATEGORY,
			'filters[status1][$eq]': 'queued',
			sort: 'createdAt:asc',
			'pagination[limit]': '1',
		});
		try {
			const res = await this.request<{ data: StrapiJobItem[] }>('GET', `/api/items?${params}`);
			const row = res.data?.[0];
			return row ? this.mapJob(row) : null;
		} catch (e) {
			this.logger.warn('שליפת תור המשימות נכשלה', e);
			return null;
		}
	}

	async getJobStatus(documentId: string): Promise<string | null> {
		try {
			const res = await this.request<{ data: { status1: string | null } | null }>(
				'GET',
				`/api/items/${documentId}?fields[0]=status1`,
			);
			return res.data?.status1 ?? null;
		} catch {
			return null;
		}
	}

	/** מיזוג extra_fields (קריאה-מיזוג-כתיבה — PUT מחליף את כל ה-JSON) */
	private async mergeJob(documentId: string, patch: Record<string, unknown>, status?: string): Promise<void> {
		this.assertWritable();
		const cur = await this.request<{ data: StrapiJobItem | null }>('GET', `/api/items/${documentId}`);
		const existing = (cur.data?.extra_fields ?? {}) as Record<string, unknown>;
		await this.request('PUT', `/api/items/${documentId}`, {
			data: {
				...(status ? { status1: status } : {}),
				extra_fields: { ...existing, ...patch },
			},
		}, true);
	}

	/** תפיסת job: רק אם הוא עדיין queued. מחזיר false אם מישהו אחר הקדים.
	 *  ל-Strapi אין עדכון-מותנה אטומי, ולכן אחרי הכתיבה קוראים שוב ומוודאים
	 *  ש-claimed_by הוא שלנו — שני עובדים במקביל לא ירוצו על אותה משימה. */
	async claimJob(documentId: string, workerId: string): Promise<boolean> {
		const status = await this.getJobStatus(documentId);
		if (status !== 'queued') return false;
		await this.mergeJob(documentId, { claimed_by: workerId, started_at: new Date().toISOString() }, 'running');

		const res = await this.request<{ data: StrapiJobItem | null }>('GET', `/api/items/${documentId}`);
		const row = res.data;
		const claimedBy = (row?.extra_fields as Record<string, unknown> | undefined)?.claimed_by;
		if (row?.status1 !== 'running' || claimedBy !== workerId) {
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
