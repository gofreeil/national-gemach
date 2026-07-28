// ============================================================
// fileStateStore.ts — אחסון תפעולי בקובץ JSON (פיתוח בלי Postgres)
// ============================================================
//
// עומד באותו חוזה כמו PostgresStateStore, עם ויתורים מודעים:
// תוצאות גולמיות לא נשמרות (רק נספרות), ורשימת המועמדים/הריצות קצוצה —
// כדי שהקובץ יישאר קטן. הזיכרון החשוב (known fingerprints, cursors)
// נשמר במלואו.

import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StateStore, type FingerprintOrigin, type StoreSummary } from '../core/stateStore.ts';
import type { CandidateRecord, RawResult, RunStats, ScanSpec } from '../core/types.ts';
import type { Logger } from '../core/logger.ts';

const MAX_RUNS = 100;
const MAX_CANDIDATES = 1000;

interface FileState {
	version: 1;
	nextRunId: number;
	runs: Array<{
		id: string;
		startedAt: string;
		finishedAt?: string;
		status: string;
		triggerJob?: string;
		spec: unknown;
		stats?: RunStats;
		error?: string;
	}>;
	candidates: Array<Record<string, unknown>>;
	fingerprints: Record<string, { origin: FingerprintOrigin; docId?: string; firstSeen: string }>;
	cursors: Record<string, number>;
}

const DEFAULT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'state', 'discovery-state.json');

export class FileStateStore extends StateStore {
	private state: FileState | null = null;

	constructor(
		private readonly logger: Logger,
		private readonly path: string = DEFAULT_PATH,
	) {
		super();
	}

	async init(): Promise<void> {
		this.load();
	}

	private load(): FileState {
		if (this.state) return this.state;
		if (existsSync(this.path)) {
			try {
				this.state = JSON.parse(readFileSync(this.path, 'utf8')) as FileState;
				return this.state;
			} catch (e) {
				this.logger.warn(`קובץ המצב פגום (${this.path}) — מתחיל מצב חדש`, e);
			}
		}
		this.state = { version: 1, nextRunId: 1, runs: [], candidates: [], fingerprints: {}, cursors: {} };
		return this.state;
	}

	/** כתיבה אטומית: קובץ זמני ואז rename */
	private save(): void {
		if (!this.state) return;
		mkdirSync(dirname(this.path), { recursive: true });
		const tmp = this.path + '.tmp';
		writeFileSync(tmp, JSON.stringify(this.state, null, '\t'), 'utf8');
		renameSync(tmp, this.path);
	}

	async beginRun(spec: ScanSpec): Promise<string> {
		const s = this.load();
		const id = String(s.nextRunId++);
		s.runs.push({ id, startedAt: new Date().toISOString(), status: 'running', triggerJob: spec.triggerJobId, spec });
		if (s.runs.length > MAX_RUNS) s.runs.splice(0, s.runs.length - MAX_RUNS);
		this.save();
		return id;
	}

	async finishRun(runId: string, status: 'done' | 'failed', stats: RunStats, error?: string): Promise<void> {
		const s = this.load();
		const run = s.runs.find((r) => r.id === runId);
		if (run) {
			run.finishedAt = new Date().toISOString();
			run.status = status;
			run.stats = stats;
			if (error) run.error = error;
		}
		this.save();
	}

	async recordRaw(_runId: string, _raw: RawResult): Promise<void> {
		// לא נשמר בקובץ (רק נספר בסטטיסטיקות הריצה) — חוסך נפח
	}

	async recordCandidate(runId: string, r: CandidateRecord): Promise<void> {
		const s = this.load();
		s.candidates.push({
			runId,
			name: r.name,
			city: r.city,
			phone: r.phone,
			url: r.link,
			category: r.category,
			confidence: r.confidence,
			decision: r.decision,
			duplicateOf: r.duplicateOf,
			strapiDocumentId: r.strapiDocumentId,
			source: r.source,
			query: r.query,
			at: new Date().toISOString(),
		});
		if (s.candidates.length > MAX_CANDIDATES) s.candidates.splice(0, s.candidates.length - MAX_CANDIDATES);
		this.save();
	}

	async knownFingerprints(): Promise<Set<string>> {
		return new Set(Object.keys(this.load().fingerprints));
	}

	async rememberFingerprints(fps: string[], origin: FingerprintOrigin, strapiDocumentId?: string): Promise<void> {
		const s = this.load();
		for (const fp of fps) {
			if (!s.fingerprints[fp]) {
				s.fingerprints[fp] = { origin, docId: strapiDocumentId, firstSeen: new Date().toISOString() };
			}
		}
		this.save();
	}

	async getCursor(key: string): Promise<number> {
		return this.load().cursors[key] ?? 0;
	}

	async setCursor(key: string, value: number): Promise<void> {
		const s = this.load();
		s.cursors[key] = value;
		this.save();
	}

	async summary(): Promise<StoreSummary> {
		const s = this.load();
		const byDecision: Record<string, number> = {};
		for (const c of s.candidates) {
			const d = String(c.decision ?? '?');
			byDecision[d] = (byDecision[d] ?? 0) + 1;
		}
		return {
			backend: `file (${this.path})`,
			runs: s.runs.length,
			lastRunAt: s.runs[s.runs.length - 1]?.startedAt,
			fingerprints: Object.keys(s.fingerprints).length,
			candidatesByDecision: byDecision,
		};
	}

	async close(): Promise<void> {
		this.save();
	}
}
