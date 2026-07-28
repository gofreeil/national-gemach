// ============================================================
// discoveryStore.ts — מסך "גילוי חכם": טיוטות מהאוטומציה + תור סריקות
// ============================================================
//
// הצד השני של automation/ (ראו automation/README.md):
//   - האוטומציה מייבאת גמ"חים חדשים כ-status1='draft' עם מטא-גילוי
//     ב-extra_fields.discovery — הם לא מופיעים באתר (הפילטר הציבורי
//     מציג רק 'active') אבל כן במסך /admin/discovery.
//   - לחיצה על "הפעל סריקה" יוצרת משימה בתור: item בקטגוריה פנימית
//     __ng_discovery_job (כמו __ng_ad של הפרסומות — בלי שינוי סכמה).
//     ה-worker של האוטומציה מושך משימות queued, מריץ ומעדכן סטטוס.

import { strapiGet, strapiPost, strapiPut, StrapiContentTypeError } from './strapiClient.js';
import { getRawGemachimByStatus, mapItemToGemach, setGemachStatus } from './db.js';
import { getCategories } from './adminStore.js';
import type { Gemach } from '$lib/gemachData';

const JOB_CATEGORY = '__ng_discovery_job';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface DiscoveryMeta {
	source: string;
	sourceUrl: string;
	query: string;
	confidence: number;
	foundAt: string;
	rejectionReason: string;
}

/** טיוטה/נדחה למסך הסקירה — הגמ"ח + מטא-הגילוי שלו */
export interface ReviewGemach {
	gemach: Gemach;
	discovery: DiscoveryMeta | null;
	createdAt: string;
}

export interface DiscoveryJobView {
	id: string;
	status: JobStatus;
	note: string;
	requestedBy: string;
	createdAt: string;
	startedAt: string;
	finishedAt: string;
	claimedBy: string;
	error: string;
	stats: {
		queries?: number; rawResults?: number; candidates?: number;
		imported?: number; duplicates?: number; errors?: number;
		/** הסריקה נעצרה באמצע (אימות Google) — מוצג כאזהרה ולא כהצלחה מלאה */
		blocked?: boolean; blockedReason?: string;
	} | null;
}

interface StrapiJobItem {
	documentId: string;
	label: string | null;
	description: string | null;
	status1: string | null;
	extra_fields: Record<string, unknown> | null;
	createdAt: string;
}

// ---------- טיוטות ----------

function readDiscovery(extra: Record<string, unknown> | null): DiscoveryMeta | null {
	const d = extra?.discovery;
	if (typeof d !== 'object' || d === null) return null;
	const x = d as Record<string, unknown>;
	return {
		source: String(x.source ?? ''),
		sourceUrl: String(x.source_url ?? ''),
		query: String(x.query ?? ''),
		confidence: typeof x.confidence === 'number' ? x.confidence : 0,
		foundAt: String(x.found_at ?? ''),
		rejectionReason: String(x.rejection_reason ?? ''),
	};
}

/** רשימת גמ"חים לסקירה לפי סטטוס ('draft' / 'rejected') */
export async function listGemachimForReview(status: 'draft' | 'rejected'): Promise<ReviewGemach[]> {
	const rows = await getRawGemachimByStatus(status);
	return rows.map((row) => ({
		gemach: mapItemToGemach(row),
		discovery: readDiscovery(row.extra_fields),
		createdAt: row.createdAt,
	}));
}

/** ספירת הטיוטות הממתינות — לכרטיס בדשבורד */
export async function countDraftGemachim(): Promise<number> {
	return (await getRawGemachimByStatus('draft')).length;
}

/** אישור טיוטה: עולה לאתר מיד (status1='active') ונעלמת מהטיוטות */
export async function approveDraft(id: string, decidedBy: string): Promise<void> {
	await setGemachStatus(id, 'active', {
		approved_at: new Date().toISOString(),
		approved_by: decidedBy,
		rejection_reason: '',
	});
}

/** דחיית טיוטה: נשארת ברשומות (וגם בזיכרון האוטומציה) כדי שלא תיובא שוב */
export async function rejectDraft(id: string, decidedBy: string, reason: string): Promise<void> {
	await setGemachStatus(id, 'rejected', {
		rejected_at: new Date().toISOString(),
		rejected_by: decidedBy,
		rejection_reason: reason,
	});
}

/** החזרת פריט נדחה לטיוטות */
export async function restoreDraft(id: string, decidedBy: string): Promise<void> {
	await setGemachStatus(id, 'draft', {
		restored_at: new Date().toISOString(),
		restored_by: decidedBy,
	});
}

// ---------- תור המשימות ----------

function mapJob(row: StrapiJobItem): DiscoveryJobView {
	const x = (row.extra_fields ?? {}) as Record<string, unknown>;
	const rawStatus = row.status1 ?? '';
	const status: JobStatus = ['queued', 'running', 'done', 'failed', 'cancelled'].includes(rawStatus)
		? (rawStatus as JobStatus)
		: 'queued';
	return {
		id: row.documentId,
		status,
		note: row.description ?? '',
		requestedBy: String(x.requested_by ?? ''),
		createdAt: row.createdAt,
		startedAt: String(x.started_at ?? ''),
		finishedAt: String(x.finished_at ?? ''),
		claimedBy: String(x.claimed_by ?? ''),
		error: String(x.error ?? ''),
		stats: typeof x.stats === 'object' && x.stats !== null ? (x.stats as DiscoveryJobView['stats']) : null,
	};
}

/** המשימות האחרונות (חדשה→ישנה) */
export async function listDiscoveryJobs(limit = 12): Promise<DiscoveryJobView[]> {
	try {
		const res = await strapiGet<{ data: StrapiJobItem[] }>('/api/items', {
			'filters[category][$eq]': JOB_CATEGORY,
			'sort': 'createdAt:desc',
			'pagination[limit]': String(limit),
		});
		return (res.data ?? []).map(mapJob);
	} catch (e) {
		if (e instanceof StrapiContentTypeError) return [];
		console.error('[discovery] listDiscoveryJobs failed:', e);
		return [];
	}
}

export function hasActiveJob(jobs: DiscoveryJobView[]): boolean {
	return jobs.some((j) => j.status === 'queued' || j.status === 'running');
}

/** יצירת משימת סריקה בתור. הקטגוריות החיות מהפאנל מוטמעות במשימה כדי
 *  שה-worker יחפש לפי הרשימה העדכנית (כולל קטגוריות שנוספו בפאנל). */
export async function enqueueScan(opts: {
	requestedBy: string;
	note?: string;
	maxQueries?: number;
}): Promise<string> {
	const categories = await getCategories().catch(() => []);
	const res = await strapiPost<{ data: { documentId: string } }>('/api/items', {
		data: {
			label: `סריקת גילוי — ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`,
			category: JOB_CATEGORY,
			description: opts.note ?? '',
			icon: '🛰️',
			status1: 'queued',
			extra_fields: {
				requested_by: opts.requestedBy,
				requested_at: new Date().toISOString(),
				sources: ['google-search', 'google-local'],
				...(opts.maxQueries ? { max_queries: opts.maxQueries } : {}),
				...(categories.length > 0
					? { categories: categories.map((c) => ({ key: c.key, label: c.label, icon: c.icon })) }
					: {}),
			},
			publishedAt: new Date().toISOString(),
		},
	});
	return res.data.documentId;
}

/** ביטול משימה שעדיין בתור/רצה. הצינור בודק את הסטטוס בין שאילתות ונעצר. */
export async function cancelJob(id: string, cancelledBy: string): Promise<boolean> {
	const res = await strapiGet<{ data: StrapiJobItem | null }>(`/api/items/${id}`);
	const row = res.data;
	if (!row || (row.status1 !== 'queued' && row.status1 !== 'running')) return false;
	const existing = (row.extra_fields ?? {}) as Record<string, unknown>;
	await strapiPut(`/api/items/${id}`, {
		data: {
			status1: 'cancelled',
			extra_fields: {
				...existing,
				cancelled_at: new Date().toISOString(),
				cancelled_by: cancelledBy,
			},
		},
	});
	return true;
}
