// ============================================================
// postgresStateStore.ts — אחסון תפעולי ב-Postgres (המימוש המועדף)
// ============================================================

import pg from 'pg';
import { StateStore, type FingerprintOrigin, type StoreSummary } from '../core/stateStore.ts';
import type { CandidateRecord, RawResult, RunStats, ScanSpec } from '../core/types.ts';
import type { Logger } from '../core/logger.ts';

const { Pool } = pg;

/** מיגרציות סדורות — כל אחת רצה פעם אחת ונרשמת ב-schema_migrations */
const MIGRATIONS: Array<{ id: string; sql: string }> = [
	{
		id: '001_init',
		sql: `
			CREATE TABLE IF NOT EXISTS discovery_runs (
				id           BIGSERIAL PRIMARY KEY,
				started_at   timestamptz NOT NULL DEFAULT now(),
				finished_at  timestamptz,
				status       text NOT NULL DEFAULT 'running',
				trigger_job  text,
				spec         jsonb NOT NULL DEFAULT '{}'::jsonb,
				stats        jsonb NOT NULL DEFAULT '{}'::jsonb,
				error        text
			);

			CREATE TABLE IF NOT EXISTS raw_results (
				id         BIGSERIAL PRIMARY KEY,
				run_id     bigint NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
				source     text NOT NULL,
				query      text NOT NULL,
				url        text,
				title      text,
				snippet    text,
				scraped_at timestamptz NOT NULL DEFAULT now()
			);
			CREATE INDEX IF NOT EXISTS raw_results_run_idx ON raw_results(run_id);

			CREATE TABLE IF NOT EXISTS candidates (
				id                  BIGSERIAL PRIMARY KEY,
				run_id              bigint NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
				fingerprint         text NOT NULL,
				name                text NOT NULL,
				city                text,
				phone               text,
				url                 text,
				category_guess      text,
				confidence          real NOT NULL DEFAULT 0,
				decision            text NOT NULL,
				duplicate_of        text,
				strapi_document_id  text,
				data                jsonb NOT NULL DEFAULT '{}'::jsonb,
				created_at          timestamptz NOT NULL DEFAULT now()
			);
			CREATE INDEX IF NOT EXISTS candidates_fingerprint_idx ON candidates(fingerprint);
			CREATE INDEX IF NOT EXISTS candidates_run_idx ON candidates(run_id);

			CREATE TABLE IF NOT EXISTS known_fingerprints (
				fingerprint         text PRIMARY KEY,
				origin              text NOT NULL,
				strapi_document_id  text,
				first_seen          timestamptz NOT NULL DEFAULT now()
			);

			CREATE TABLE IF NOT EXISTS kv_state (
				key   text PRIMARY KEY,
				value jsonb NOT NULL
			);
		`,
	},
];

export class PostgresStateStore extends StateStore {
	private readonly pool: InstanceType<typeof Pool>;

	constructor(connectionString: string, private readonly logger: Logger) {
		super();
		this.pool = new Pool({
			connectionString,
			max: 3,
			// ספקי Postgres מנוהלים (Neon/Supabase/Railway) דורשים SSL; מקומי לא
			ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
		});
	}

	async init(): Promise<void> {
		await this.pool.query(`
			CREATE TABLE IF NOT EXISTS schema_migrations (
				id         text PRIMARY KEY,
				applied_at timestamptz NOT NULL DEFAULT now()
			);
		`);
		const { rows } = await this.pool.query<{ id: string }>('SELECT id FROM schema_migrations');
		const applied = new Set(rows.map((r) => r.id));
		for (const m of MIGRATIONS) {
			if (applied.has(m.id)) continue;
			this.logger.info(`מריץ מיגרציה ${m.id}...`);
			const client = await this.pool.connect();
			try {
				await client.query('BEGIN');
				await client.query(m.sql);
				await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [m.id]);
				await client.query('COMMIT');
			} catch (e) {
				await client.query('ROLLBACK');
				throw e;
			} finally {
				client.release();
			}
		}
	}

	async beginRun(spec: ScanSpec): Promise<string> {
		const { rows } = await this.pool.query<{ id: string }>(
			'INSERT INTO discovery_runs (trigger_job, spec) VALUES ($1, $2) RETURNING id',
			[spec.triggerJobId ?? null, JSON.stringify(spec)],
		);
		return String(rows[0].id);
	}

	async finishRun(runId: string, status: 'done' | 'failed', stats: RunStats, error?: string): Promise<void> {
		await this.pool.query(
			'UPDATE discovery_runs SET finished_at = now(), status = $2, stats = $3, error = $4 WHERE id = $1',
			[runId, status, JSON.stringify(stats), error ?? null],
		);
	}

	async recordRaw(runId: string, raw: RawResult): Promise<void> {
		await this.pool.query(
			'INSERT INTO raw_results (run_id, source, query, url, title, snippet) VALUES ($1,$2,$3,$4,$5,$6)',
			[runId, raw.source, raw.query, raw.url || null, raw.title, raw.snippet],
		);
	}

	async recordCandidate(runId: string, r: CandidateRecord): Promise<void> {
		await this.pool.query(
			`INSERT INTO candidates
				(run_id, fingerprint, name, city, phone, url, category_guess, confidence, decision, duplicate_of, strapi_document_id, data)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
			[
				runId,
				r.fingerprints[0] ?? '',
				r.name,
				r.city || null,
				r.phone ?? null,
				r.link ?? null,
				r.category,
				r.confidence,
				r.decision,
				r.duplicateOf ?? null,
				r.strapiDocumentId ?? null,
				JSON.stringify({ description: r.description, tags: r.tags, source: r.source, sourceUrl: r.sourceUrl, query: r.query, error: r.error }),
			],
		);
	}

	async knownFingerprints(): Promise<Set<string>> {
		const { rows } = await this.pool.query<{ fingerprint: string }>('SELECT fingerprint FROM known_fingerprints');
		return new Set(rows.map((r) => r.fingerprint));
	}

	async rememberFingerprints(fps: string[], origin: FingerprintOrigin, strapiDocumentId?: string): Promise<void> {
		for (const fp of fps) {
			await this.pool.query(
				`INSERT INTO known_fingerprints (fingerprint, origin, strapi_document_id)
				 VALUES ($1,$2,$3) ON CONFLICT (fingerprint) DO NOTHING`,
				[fp, origin, strapiDocumentId ?? null],
			);
		}
	}

	async getCursor(key: string): Promise<number> {
		const { rows } = await this.pool.query<{ value: unknown }>('SELECT value FROM kv_state WHERE key = $1', [key]);
		const v = rows[0]?.value;
		return typeof v === 'number' ? v : 0;
	}

	async setCursor(key: string, value: number): Promise<void> {
		await this.pool.query(
			`INSERT INTO kv_state (key, value) VALUES ($1, $2::jsonb)
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
			[key, JSON.stringify(value)],
		);
	}

	async summary(): Promise<StoreSummary> {
		const runs = await this.pool.query<{ n: string; last: string | null }>(
			'SELECT COUNT(*)::text AS n, MAX(started_at)::text AS last FROM discovery_runs',
		);
		const fps = await this.pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM known_fingerprints');
		const dec = await this.pool.query<{ decision: string; n: string }>(
			'SELECT decision, COUNT(*)::text AS n FROM candidates GROUP BY decision',
		);
		return {
			backend: 'postgres',
			runs: Number(runs.rows[0]?.n ?? 0),
			lastRunAt: runs.rows[0]?.last ?? undefined,
			fingerprints: Number(fps.rows[0]?.n ?? 0),
			candidatesByDecision: Object.fromEntries(dec.rows.map((r) => [r.decision, Number(r.n)])),
		};
	}

	async close(): Promise<void> {
		await this.pool.end();
	}
}
