// ============================================================
// strapiStateStore.ts — אחסון תפעולי בתוך Strapi (לריצה ב-CI)
// ============================================================
//
// GitHub Actions מתחיל כל ריצה ממכונה נקייה, ולכן אחסון-קובץ מאבד את
// ה-cursor וכל ריצה הייתה סורקת שוב את אותן שאילתות ראשונות. כאן המצב
// נשמר בפריט Strapi יחיד (קטגוריה __ng_discovery_state), כמו שהפאנל
// שומר את הקונפיגורציה שלו — בלי להצריך Postgres.
//
// מה נשמר: ה-cursor וזיכרון טביעות האצבע. היסטוריית ריצות/מועמדים
// מפורטת לא נשמרת (לזה יש Postgres) — היא לא נדרשת לנכונות הסריקה.

import { StateStore, type FingerprintOrigin, type StoreSummary } from '../core/stateStore.ts';
import type { CandidateRecord, RawResult, RunStats, ScanSpec } from '../core/types.ts';
import type { Logger } from '../core/logger.ts';
import type { StrapiGateway } from '../strapi/gateway.ts';
import { gzipSync, gunzipSync } from 'node:zlib';
import { ScanMemory } from '../core/scanMemory.ts';

/** תקרת טביעות שנשמרות. הן רק שכבת-הגנה נוספת: הגמ"חים עצמם (כולל
 *  טיוטות ונדחים) ממילא באינדקס הכפילויות, ולכן אין צורך בהיסטוריה
 *  אינסופית — ומגבילים כדי לא לנפח את הפריט מעבר לתקרת ה-1MB של Strapi. */
const MAX_FINGERPRINTS = 5000;

interface StateShape {
	cursors: Record<string, number>;
	/** גרסה ישנה: רשימה גלויה. נקראת פעם אחת ומומרת ל-fp הדחוס */
	fingerprints?: string[];
	/** טביעות האצבע, דחוסות (gzip+base64) — פי ~8 קטן מהרשימה הגלויה */
	fp?: string;
	/** זיכרון הסריקות (כתובות שטופלו, שאילתות עקרות), דחוס — ראו scanMemory.ts */
	memory?: string;
	runs: number;
	lastRunAt?: string;
}

function packList(list: string[]): string {
	return gzipSync(Buffer.from(JSON.stringify(list), 'utf8')).toString('base64');
}

function unpackList(packed: string | undefined): string[] | null {
	if (!packed) return null;
	try {
		const arr = JSON.parse(gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'));
		return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : null;
	} catch {
		return null;
	}
}

export class StrapiStateStore extends StateStore {
	private state: StateShape | null = null;
	private fingerprints: string[] = [];
	private dirty = false;

	constructor(
		private readonly gateway: StrapiGateway,
		private readonly logger: Logger,
	) {
		super();
	}

	async init(): Promise<void> {
		this.state = await this.gateway.loadDiscoveryState<StateShape>() ?? { cursors: {}, runs: 0 };
		// דחוס אם יש; אחרת הרשימה הגלויה מהגרסה הישנה (תומר בשמירה הבאה)
		this.fingerprints = unpackList(this.state.fp) ?? this.state.fingerprints ?? [];
		if (!this.state.fp && this.fingerprints.length > 0) this.dirty = true;
		const mem = ScanMemory.unpack(this.state.memory).size;
		this.logger.info(`מצב נטען מ-Strapi: cursor=${JSON.stringify(this.state.cursors)}, ${this.fingerprints.length} טביעות, זיכרון: ${mem.urls} כתובות, ${mem.queries} שאילתות (${mem.staleQueries} בהשהיה)`);
	}

	private get s(): StateShape {
		if (!this.state) throw new Error('StrapiStateStore.init לא נקרא');
		return this.state;
	}

	async beginRun(_spec: ScanSpec): Promise<string> {
		this.s.runs++;
		this.s.lastRunAt = new Date().toISOString();
		this.dirty = true;
		return String(this.s.runs);
	}

	async finishRun(_runId: string, _status: 'done' | 'failed', _stats: RunStats): Promise<void> {
		await this.flush();
	}

	// היסטוריה מפורטת לא נשמרת כאן (ראו הערת הכותרת)
	async recordRaw(_runId: string, _raw: RawResult): Promise<void> {}
	async recordCandidate(_runId: string, _record: CandidateRecord): Promise<void> {}

	async knownFingerprints(): Promise<Set<string>> {
		return new Set(this.fingerprints);
	}

	async rememberFingerprints(fps: string[], _origin: FingerprintOrigin): Promise<void> {
		const set = new Set(this.fingerprints);
		for (const fp of fps) set.add(fp);
		// שומרים את החדשות ביותר בתוך התקרה
		this.fingerprints = [...set].slice(-MAX_FINGERPRINTS);
		this.dirty = true;
	}

	async loadScanMemory(): Promise<ScanMemory> {
		return ScanMemory.unpack(this.s.memory);
	}

	async saveScanMemory(memory: ScanMemory): Promise<void> {
		this.s.memory = memory.pack();
		this.dirty = true;
	}

	async getCursor(key: string): Promise<number> {
		return this.s.cursors[key] ?? 0;
	}

	async setCursor(key: string, value: number): Promise<void> {
		this.s.cursors[key] = value;
		this.dirty = true;
	}

	async summary(): Promise<StoreSummary> {
		return {
			backend: 'strapi (__ng_discovery_state)',
			runs: this.s.runs,
			lastRunAt: this.s.lastRunAt,
			fingerprints: this.fingerprints.length,
			candidatesByDecision: {},
		};
	}

	private async flush(): Promise<void> {
		if (!this.dirty || !this.state) return;
		// נשמר דחוס בלבד; הרשימה הגלויה מהגרסה הישנה לא נכתבת חזרה
		const { fingerprints: _legacy, ...rest } = this.state;
		const toSave: StateShape = { ...rest, fp: packList(this.fingerprints) };
		await this.gateway.saveDiscoveryState(toSave);
		this.state = toSave;
		this.dirty = false;
	}

	async close(): Promise<void> {
		await this.flush().catch((e) => this.logger.warn('שמירת המצב ל-Strapi נכשלה', e));
	}
}
