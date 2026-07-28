// ============================================================
// stateStore.ts — חוזה האחסון התפעולי של האוטומציה + בחירת מימוש
// ============================================================
//
// האחסון התפעולי (ריצות, מועמדים, זיכרון טביעות אצבע, cursors) נפרד
// מ-Strapi: Strapi מחזיק את התוכן (טיוטות/פריטים), וה-StateStore מחזיק
// את ההיסטוריה והזיכרון של האוטומציה עצמה.
//
// מימושים: PostgresStateStore (מועדף, DATABASE_URL) או FileStateStore
// (קובץ JSON מקומי — לפיתוח בלי DB). שניהם עומדים באותו חוזה, והצינור
// לא יודע באיזה מהם הוא רץ.

import type { CandidateRecord, RawResult, RunStats, ScanSpec } from './types.ts';
import type { Logger } from './logger.ts';
import { readEnv } from './env.ts';

export type FingerprintOrigin = 'imported' | 'rejected' | 'manual';

export interface StoreSummary {
	backend: string;
	runs: number;
	lastRunAt?: string;
	fingerprints: number;
	candidatesByDecision: Record<string, number>;
}

export abstract class StateStore {
	/** הכנת הסכמה (מיגרציות ב-Postgres / יצירת הקובץ) */
	abstract init(): Promise<void>;

	abstract beginRun(spec: ScanSpec): Promise<string>;
	abstract finishRun(runId: string, status: 'done' | 'failed', stats: RunStats, error?: string): Promise<void>;

	abstract recordRaw(runId: string, raw: RawResult): Promise<void>;
	abstract recordCandidate(runId: string, record: CandidateRecord): Promise<void>;

	/** זיכרון הכפילויות המצטבר של האוטומציה */
	abstract knownFingerprints(): Promise<Set<string>>;
	abstract rememberFingerprints(fps: string[], origin: FingerprintOrigin, strapiDocumentId?: string): Promise<void>;

	/** מיקום הסבב במרחב השאילתות (queryPlanner) */
	abstract getCursor(key: string): Promise<number>;
	abstract setCursor(key: string, value: number): Promise<void>;

	abstract summary(): Promise<StoreSummary>;
	abstract close(): Promise<void>;
}

/** בחירת מימוש: DATABASE_URL → Postgres · CI/בקשה מפורשת → Strapi · אחרת קובץ.
 *  ב-CI אין דיסק מתמיד, ולכן אחסון-קובץ היה מאפס את ה-cursor בכל ריצה. */
export async function createStateStore(logger: Logger, gateway?: unknown): Promise<StateStore> {
	const url = readEnv('DATABASE_URL')?.trim();
	if (url) {
		const { PostgresStateStore } = await import('../db/postgresStateStore.ts');
		return new PostgresStateStore(url, logger.child('pg'));
	}
	const wantStrapi = (readEnv('DISCOVERY_STATE') ?? '').toLowerCase() === 'strapi'
		|| (!!readEnv('CI') && !!gateway);
	if (wantStrapi && gateway) {
		const { StrapiStateStore } = await import('../db/strapiStateStore.ts');
		logger.info('אחסון המצב: Strapi (ריצה ללא דיסק מתמיד)');
		return new StrapiStateStore(gateway as never, logger.child('strapi-state'));
	}
	logger.warn('DATABASE_URL לא מוגדר — משתמש באחסון קובץ מקומי (automation/state). ל-scale מומלץ Postgres, ראו README.');
	const { FileStateStore } = await import('../db/fileStateStore.ts');
	return new FileStateStore(logger.child('file'));
}
