// ============================================================
// types.ts — טיפוסי הליבה של צינור הגילוי
// ============================================================

/** הגדרת סריקה אחת — נבנית מדגלי ה-CLI או מרשומת job שהאדמין יצר בפאנל */
export interface ScanSpec {
	/** שמות המקורות להרצה (google-search / google-local). ריק = כולם */
	sources: string[];
	/** מפתחות תת-קטגוריה למיקוד (ברירת מחדל: כל הקטגוריות) */
	categories?: CategoryRef[];
	/** ערים למיקוד (ברירת מחדל: סבב על הערים המרכזיות) */
	cities?: string[];
	/** תקרת שאילתות לריצה — הסבב ממשיך מאותה נקודה בריצה הבאה (cursor) */
	maxQueries: number;
	/** תקרת ייבוא טיוטות לריצה (בלם בטיחות) */
	maxImports: number;
	/** ביקור בעמוד המועמד לחילוץ טלפון/כתובת כשחסרים */
	enrich: boolean;
	headful: boolean;
	/** false = ריצה יבשה: איתור והשוואה בלבד, ללא כתיבה ל-Strapi */
	apply: boolean;
	/** documentId של רשומת ה-job בפאנל (__ng_discovery_job) אם הריצה נולדה משם */
	triggerJobId?: string;
	requestedBy?: string;
}

/** קטגוריה כפי שהיא מגיעה מהאתר (או מרשומת ה-job — הרשימה החיה מהפאנל) */
export interface CategoryRef {
	key: string;
	label: string;
	icon?: string;
}

/** תוצאה גולמית ממקור גילוי — לפני נירמול */
export interface RawResult {
	source: string;
	query: string;
	url: string;
	title: string;
	snippet: string;
	/** שדות שהמקור כבר חילץ בעצמו (תוצאות מקומיות מכילות טלפון/כתובת) */
	phone?: string;
	address?: string;
	city?: string;
}

/** מועמד מנורמל — מוכן להשוואה מול הקיים ולייבוא */
export interface Candidate {
	name: string;
	city: string;
	phone?: string;
	link?: string;
	address?: string;
	description: string;
	/** מפתח תת-קטגוריה משוער (extra_fields.gmach_type) */
	category: string;
	tags: string[];
	/** 0..1 — ניקוד איכות ההתאמה */
	confidence: number;
	/** טביעות אצבע לזיהוי כפילויות (phone: / name+city: / url:) */
	fingerprints: string[];
	source: string;
	sourceUrl: string;
	query: string;
}

export type CandidateDecision = 'imported' | 'duplicate' | 'dry_run' | 'skipped_cap' | 'error';

export interface CandidateRecord extends Candidate {
	decision: CandidateDecision;
	/** מזהה הפריט הקיים שאליו זוהתה כפילות */
	duplicateOf?: string;
	strapiDocumentId?: string;
	error?: string;
}

export interface RunStats {
	queries: number;
	rawResults: number;
	candidates: number;
	imported: number;
	duplicates: number;
	lowQuality: number;
	errors: number;
	/** הריצה נקטעה לפני שסיימה את השאילתות (אימות Google וכו') */
	blocked?: boolean;
	/** ההסבר שיוצג לאדמין בפאנל */
	blockedReason?: string;
}

export function emptyStats(): RunStats {
	return { queries: 0, rawResults: 0, candidates: 0, imported: 0, duplicates: 0, lowQuality: 0, errors: 0 };
}

/** רשומת job מ-Strapi (קטגוריה __ng_discovery_job) */
export interface DiscoveryJob {
	documentId: string;
	status: string;
	note: string;
	extra: Record<string, unknown>;
	createdAt: string;
}

/** פריט קיים (מ-Strapi / מהרשימה הסטטית) בצורתו הרזה — לבניית אינדקס הכפילויות */
export interface ExistingEntry {
	ref: string;
	kind: 'strapi' | 'static' | 'memory';
	name?: string;
	city?: string;
	phone?: string;
	link?: string;
}
