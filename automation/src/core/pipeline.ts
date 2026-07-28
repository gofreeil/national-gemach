// ============================================================
// pipeline.ts — צינור הגילוי המלא: תכנון → איסוף → נירמול →
//               השוואה לקיים → ייבוא טיוטות → תיעוד
// ============================================================

import { staticGemachim } from '../../../src/lib/staticGemachim.ts';
import type { CandidateRecord, CategoryRef, RunStats, ScanSpec } from './types.ts';
import { emptyStats } from './types.ts';
import type { Logger } from './logger.ts';
import type { StateStore } from './stateStore.ts';
import type { StrapiGateway } from '../strapi/gateway.ts';
import type { BrowserContext } from 'playwright';
import type { DiscoverySource, SourceContext } from './source.ts';
import { BrowserFactory } from './browser.ts';
import { CandidateNormalizer } from './normalizer.ts';
import { CityDetector } from './text.ts';
import { Deduper } from './deduper.ts';
import { PageEnricher } from './enricher.ts';
import { QueryPlanner } from './queryPlanner.ts';
import { RateLimiter } from './rateLimiter.ts';

const CURSOR_KEY = 'query_cursor:v1';
/** השהיה מנומסת בין שאילתות Google */
const QUERY_DELAY_MS: [number, number] = [4_000, 9_000];
/** בדיקת ביטול ה-job לכל היותר פעם ב-15 שניות */
const ABORT_POLL_MS = 15_000;

export interface PipelineDeps {
	gateway: StrapiGateway;
	store: StateStore;
	logger: Logger;
	sources: DiscoverySource[];
	cities: string[];
	defaultCategories: CategoryRef[];
}

export class DiscoveryPipeline {
	constructor(private readonly deps: PipelineDeps) {}

	async run(spec: ScanSpec): Promise<RunStats> {
		const { gateway, store, logger, cities, defaultCategories } = this.deps;
		const stats = emptyStats();
		if (spec.apply) gateway.assertWritable();

		await store.init();
		const runId = await store.beginRun(spec);
		logger.info(`ריצה #${runId} התחילה (${spec.apply ? 'apply — ייבוא אמיתי' : 'ריצה יבשה'})`);

		let closeBrowser: (() => Promise<void>) | null = null;
		try {
			// --- שלב 1: אינדקס הכפילויות ---
			const deduper = new Deduper();
			const existing = await gateway.listGemachimLight();
			deduper.addExisting(existing);
			deduper.addExisting(
				staticGemachim.map((g) => ({
					ref: `static:${g.id}`,
					kind: 'static' as const,
					name: g.name,
					city: g.city,
					phone: g.phone,
					link: g.link,
				})),
			);
			const memory = await store.knownFingerprints();
			deduper.addFingerprints(memory, 'memory', 'memory');
			logger.info(`אינדקס כפילויות: ${existing.length} מ-Strapi, ${staticGemachim.length} סטטיים, ${memory.size} מהזיכרון (${deduper.size} טביעות)`);

			// --- שלב 2: תכנון שאילתות (סבב מתגלגל) ---
			const planner = new QueryPlanner(defaultCategories);
			const universe = planner.buildUniverse(spec);
			const cursor = await store.getCursor(CURSOR_KEY);
			const { queries, nextCursor } = planner.select(universe, cursor, spec.maxQueries);
			stats.queries = queries.length;
			logger.info(`נבחרו ${queries.length} שאילתות מתוך מרחב של ${universe.length} (cursor ${cursor} → ${nextCursor})`);

			// --- שלב 3: הקשר משותף למקורות. הדפדפן עולה רק אם מישהו מבקש
			// אותו (מקור מבוסס-דפדפן או העשרה) — ריצת DuckDuckGo טהורה לא
			// פותחת Chromium כלל.
			const limiter = new RateLimiter(...QUERY_DELAY_MS);
			const cityDetector = new CityDetector(cities);
			const normalizer = new CandidateNormalizer(cities);
			let enricher: PageEnricher | null = null;
			const shouldAbort = this.makeAbortCheck(spec);
			const markBlocked = (reason: string) => {
				stats.blocked = true;
				stats.blockedReason = reason;
			};

			let browserContext: BrowserContext | null = null;
			const getBrowser = async (): Promise<BrowserContext> => {
				if (!browserContext) {
					const { context, close } = await new BrowserFactory(logger).launch({ headful: spec.headful });
					browserContext = context;
					closeBrowser = close;
				}
				return browserContext;
			};

			const ctx: SourceContext = {
				getBrowser, logger, limiter, shouldAbort, headful: spec.headful, markBlocked,
			};

			const catIcons = new Map((spec.categories?.length ? spec.categories : defaultCategories).map((c) => [c.key, c.icon ?? '🤝']));
			const activeSources = this.deps.sources.filter(
				(s) => spec.sources.length === 0 || spec.sources.includes(s.name),
			);
			if (activeSources.length === 0) throw new Error(`אף מקור לא תואם ל-${spec.sources.join(',')}`);

			// --- שלב 4: איסוף → נירמול → השוואה → ייבוא ---
			for (const source of activeSources) {
				logger.info(`מקור: ${source.label}`);
				for await (const raw of source.discover(queries, ctx)) {
					stats.rawResults++;
					await store.recordRaw(runId, raw);

					const outcome = normalizer.normalize(raw);
					if (!outcome.ok) {
						stats.lowQuality++;
						continue;
					}
					let candidate = outcome.candidate;
					if (spec.enrich && !candidate.phone) {
						// ההעשרה גולשת לעמוד המועמד ולכן דורשת דפדפן — נוצר כאן בפעם הראשונה
						enricher ??= new PageEnricher(await getBrowser(), limiter, cityDetector, logger.child('enrich'));
						candidate = await enricher.enrich(candidate);
					}
					stats.candidates++;

					const dup = deduper.check(candidate);
					if (dup) {
						stats.duplicates++;
						await store.recordCandidate(runId, { ...candidate, decision: 'duplicate', duplicateOf: dup.ref });
						continue;
					}

					const record: CandidateRecord = { ...candidate, decision: 'dry_run' };
					if (!spec.apply) {
						stats.imported++; // בריצה יבשה: "היה מיובא"
						logger.info(`✚ חדש (יבש): ${candidate.name} | ${candidate.city || '-'} | ${candidate.phone ?? '-'} | ${Math.round(candidate.confidence * 100)}%`);
					} else if (stats.imported >= spec.maxImports) {
						record.decision = 'skipped_cap';
						logger.warn(`תקרת הייבוא (${spec.maxImports}) הושגה — מדלג על ${candidate.name}`);
					} else {
						try {
							const docId = await gateway.createDraftGemach(candidate, {
								icon: catIcons.get(candidate.category),
								runRef: runId,
								requestedBy: spec.requestedBy,
							});
							record.decision = 'imported';
							record.strapiDocumentId = docId;
							stats.imported++;
							await store.rememberFingerprints(candidate.fingerprints, 'imported', docId);
							logger.info(`✔ יובא כטיוטה: ${candidate.name} (${docId})`);
						} catch (e) {
							record.decision = 'error';
							record.error = e instanceof Error ? e.message : String(e);
							stats.errors++;
							logger.error(`ייבוא נכשל: ${candidate.name}`, e);
						}
					}
					await store.recordCandidate(runId, record);
					deduper.register(candidate, record.strapiDocumentId ?? 'run');

					// עדכון התקדמות ל-job בפאנל (לא בכל תוצאה — חוסך כתיבות)
					if (spec.triggerJobId && stats.rawResults % 25 === 0) {
						await gateway.updateJobProgress(spec.triggerJobId, stats);
					}
				}
			}

			// ריצה שנקטעה לא כיסתה את כל הפרוסה — משאירים את ה-cursor במקומו
			// כדי שהשאילתות שלא רצו ייבדקו בריצה הבאה ולא ידולגו לתמיד.
			// (ייבוא כפול לא מסוכן: אינדקס הכפילויות חוסם אותו.)
			if (stats.blocked) {
				logger.warn('הריצה נקטעה — ה-cursor נשאר במקומו והשאילתות שלא רצו יחזרו בריצה הבאה.');
			} else {
				await store.setCursor(CURSOR_KEY, nextCursor);
			}
			await store.finishRun(runId, 'done', stats);
			logger.info(
				`ריצה #${runId} הסתיימה${stats.blocked ? ' (נקטעה)' : ''}: ${stats.rawResults} תוצאות, ${stats.candidates} מועמדים, ` +
				`${stats.imported} ${spec.apply ? 'יובאו' : 'היו מיובאים'}, ${stats.duplicates} כפולים, ${stats.errors} שגיאות`,
			);
			return stats;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			await store.finishRun(runId, 'failed', stats, msg).catch(() => {});
			throw e;
		} finally {
			if (closeBrowser) await closeBrowser();
		}
	}

	/** בדיקת ביטול מה-job בפאנל — עם cache כדי לא להציף את Strapi */
	private makeAbortCheck(spec: ScanSpec): () => Promise<boolean> {
		if (!spec.triggerJobId) return async () => false;
		const jobId = spec.triggerJobId;
		let lastCheck = 0;
		let cached = false;
		return async () => {
			const now = Date.now();
			if (now - lastCheck < ABORT_POLL_MS) return cached;
			lastCheck = now;
			const status = await this.deps.gateway.getJobStatus(jobId);
			cached = status === 'cancelled';
			return cached;
		};
	}
}
