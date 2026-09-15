// ============================================================
// pipeline.ts — צינור הגילוי המלא: תכנון → איסוף → נירמול →
//               השוואה לקיים → ייבוא טיוטות → תיעוד
// ============================================================

import { staticGemachim } from '../../../src/lib/staticGemachim.ts';
import { resolveGemachCoords } from '../../../src/lib/server/geocode.ts';
import type { Candidate, CandidateRecord, CategoryRef, RunStats, ScanSpec } from './types.ts';
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
import { RateLimiter, sleep } from './rateLimiter.ts';

const CURSOR_KEY = 'query_cursor:v1';
/** השהיה מנומסת בין שאילתות Google */
const QUERY_DELAY_MS: [number, number] = [4_000, 9_000];
/** השהיה בין הורדות עמודי מועמדים (העשרה) — אתרים שונים, אפשר קצר */
const ENRICH_DELAY_MS: [number, number] = [800, 1_800];
/** בדיקת ביטול ה-job לכל היותר פעם ב-15 שניות */
const ABORT_POLL_MS = 15_000;
/** מדיניות Nominatim: לא יותר מבקשה בשנייה */
const GEOCODE_GAP_MS = 1_100;
let lastGeocodeAt = 0;

/** משלים lat/lng למועמד (best-effort): כתובת+שכונה+עיר, ואם אין — מרכז העיר */
async function withCoords(c: Candidate, logger: Logger): Promise<Candidate> {
	if (c.lat !== undefined && c.lng !== undefined) return c;
	if (!c.address && !c.neighborhood && !c.city) return c;
	const wait = lastGeocodeAt + GEOCODE_GAP_MS - Date.now();
	if (wait > 0) await sleep(wait);
	lastGeocodeAt = Date.now();
	try {
		const { lat, lng } = await resolveGemachCoords({ address: c.address, neighborhood: c.neighborhood, city: c.city });
		if (lat === null || lng === null) return c;
		return { ...c, lat, lng };
	} catch (e) {
		logger.debug(`geocoding נכשל ל-${c.name}: ${e instanceof Error ? e.message : String(e)}`);
		return c;
	}
}

export interface PipelineDeps {
	gateway: StrapiGateway;
	store: StateStore;
	logger: Logger;
	sources: DiscoverySource[];
	cities: string[];
	defaultCategories: CategoryRef[];
	/** השלמת lat/lng למועמד לפני הייבוא. ברירת מחדל: Nominatim; הבדיקות מזריקות stub */
	geocode?: (c: Candidate) => Promise<Candidate>;
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
			const known = await store.knownFingerprints();
			deduper.addFingerprints(known, 'memory', 'memory');
			logger.info(`אינדקס כפילויות: ${existing.length} מ-Strapi, ${staticGemachim.length} סטטיים, ${known.size} מהזיכרון (${deduper.size} טביעות)`);

			// זיכרון הסריקות: כתובות שכבר טופלו (לא מעבדים שוב) ושאילתות עקרות (לא רצות שוב)
			const memory = await store.loadScanMemory();

			// --- שלב 2: תכנון שאילתות (סבב מתגלגל, בלי שאילתות בהשהיה) ---
			const planner = new QueryPlanner(defaultCategories);
			const universe = planner.buildUniverse(spec);
			const cursor = await store.getCursor(CURSOR_KEY);
			const { queries, nextCursor, cursorAfter, skipped } = planner.select(
				universe, cursor, spec.maxQueries, (q) => memory.isStaleQuery(q),
			);
			stats.queries = queries.length;
			if (skipped > 0) stats.skippedQueries = skipped;
			logger.info(`נבחרו ${queries.length} שאילתות מתוך מרחב של ${universe.length} (cursor ${cursor} → ${nextCursor}${skipped ? `, ${skipped} בהשהיה דולגו` : ''})`);

			// מעקב לפי שאילתה: מה באמת רץ (לקידום ה-cursor) וכמה חדש כל אחת הניבה
			const executed = new Set<string>();
			const newByQuery = new Map<string, number>();
			let sourceReportsQueries = false;
			let capReached = false;

			// --- שלב 3: הקשר משותף למקורות. הדפדפן עולה רק אם מישהו מבקש
			// אותו (מקור מבוסס-דפדפן או העשרה) — ריצת DuckDuckGo טהורה לא
			// פותחת Chromium כלל.
			const limiter = new RateLimiter(...QUERY_DELAY_MS);
			const enrichLimiter = new RateLimiter(...ENRICH_DELAY_MS);
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
				onQueryDone: (query) => { sourceReportsQueries = true; executed.add(query); },
			};

			const catIcons = new Map((spec.categories?.length ? spec.categories : defaultCategories).map((c) => [c.key, c.icon ?? '🤝']));
			const activeSources = this.deps.sources.filter(
				(s) => spec.sources.length === 0 || spec.sources.includes(s.name),
			);
			if (activeSources.length === 0) throw new Error(`אף מקור לא תואם ל-${spec.sources.join(',')}`);

			// --- שלב 4: איסוף → נירמול → השוואה → ייבוא ---
			for (const source of activeSources) {
				if (capReached) break;
				logger.info(`מקור: ${source.label}`);
				for await (const raw of source.discover(queries, ctx)) {
					stats.rawResults++;
					await store.recordRaw(runId, raw);

					// עמוד שכבר טופל בריצה קודמת (יובא / נדחה / בלי טלפון / זבל) —
					// לא מנרמלים, לא מורידים ולא מגאוקדים אותו שוב
					if (raw.url && memory.seenUrl(raw.url)) {
						stats.skippedSeen = (stats.skippedSeen ?? 0) + 1;
						continue;
					}
					// ריצה יבשה לא כותבת לזיכרון — אחרת ריצת apply אחריה הייתה מדלגת על הכול
					if (raw.url && spec.apply) memory.rememberUrl(raw.url);

					const outcome = normalizer.normalize(raw);
					if (!outcome.ok) {
						stats.lowQuality++;
						continue;
					}
					let candidate = outcome.candidate;
					// כפילות לפי שם+עיר / טלפון / כתובת URL נבדקת כבר עכשיו — לפני
					// ההעשרה — כדי לא להוריד עמוד של גמ"ח שכבר במאגר (או שנפסל) בכל שאילתה
					const dupEarly = deduper.check(candidate);
					if (dupEarly) {
						stats.duplicates++;
						await store.recordCandidate(runId, { ...candidate, decision: 'duplicate', duplicateOf: dupEarly.ref });
						continue;
					}
					if (spec.enrich) {
						// ההעשרה מורידה את עמוד המועמד (fetch, בלי דפדפן) וממלאת מה שחסר:
						// טלפון, כתובת, שכונה, שעות, איש קשר, תיאור, לוגו
						enricher ??= new PageEnricher(enrichLimiter, cityDetector, logger.child('enrich'));
						candidate = await enricher.enrich(candidate);
					}
					// בלי טלפון אין טיוטה: גמ"ח שאי אפשר להתקשר אליו לא שווה בדיקת אדמין,
					// והטיוטות האלה רק הציפו את מסך הגילוי. הטביעות נזכרות כדי שאותו
					// עמוד-אינדקס לא יחזור (ויורד שוב) בכל שאילתה.
					if (!candidate.phone) {
						stats.lowQuality++;
						await store.recordCandidate(runId, { ...candidate, decision: 'no_phone' });
						await store.rememberFingerprints(candidate.fingerprints, 'no_phone');
						deduper.register(candidate, 'no_phone');
						logger.info(`✖ בלי טלפון — לא יובא: ${candidate.name} | ${candidate.city || '-'}`);
						continue;
					}
					stats.candidates++;

					// בדיקה שנייה: ההעשרה הוסיפה טלפון, ואיתו טביעת-אצבע חדשה
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
							// פין במפה: geocoding של הכתובת (או מרכז העיר) — בלי זה הגמ"ח
							// המאושר לא מופיע במפה של "קהילה בשכונה" ולא נספר שם
							candidate = await (this.deps.geocode ?? withCoords)(candidate, logger);
							const docId = await gateway.createDraftGemach(candidate, {
								icon: catIcons.get(candidate.category),
								runRef: runId,
								requestedBy: spec.requestedBy,
							});
							record.decision = 'imported';
							record.strapiDocumentId = docId;
							stats.imported++;
							newByQuery.set(raw.query, (newByQuery.get(raw.query) ?? 0) + 1);
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

					// המנה לסריקה הזו מלאה — עוצרים. השאילתות שלא רצו יחזרו בסריקה
					// הבאה (ה-cursor מתקדם רק על מה שרץ), במקום להמשיך לחפש בלי לייבא.
					if (spec.apply && stats.imported >= spec.maxImports) {
						capReached = true;
						logger.info(`הגענו ל-${spec.maxImports} טיוטות חדשות — הסריקה מסתיימת כאן.`);
						break;
					}

					// עדכון התקדמות ל-job בפאנל (לא בכל תוצאה — חוסך כתיבות)
					if (spec.triggerJobId && stats.rawResults % 25 === 0) {
						await gateway.updateJobProgress(spec.triggerJobId, stats);
					}
				}
			}

			// ה-cursor מתקדם רק על השאילתות שבאמת רצו (חסימה / תקרת ייבוא עוצרות
			// באמצע) — השאר יחזרו בריצה הבאה ולא ידולגו לתמיד. מקור שלא מדווח על
			// שאילתות (Google) נחשב כמי שהריץ את כולן, אלא אם נחסם.
			const ranAll = !sourceReportsQueries && !stats.blocked && !capReached;
			const executedCount = ranAll ? queries.length : Math.min(queries.length, executed.size);
			await store.setCursor(CURSOR_KEY, cursorAfter[executedCount] ?? nextCursor);
			if (executedCount < queries.length) {
				logger.warn(`הריצה כיסתה ${executedCount} מתוך ${queries.length} שאילתות — השאר יחזרו בריצה הבאה.`);
			}

			// זיכרון השאילתות: שאילתה שרצה ולא הניבה חדש נספרת כעקרה
			if (spec.apply) {
				const ranQueries = ranAll ? queries : queries.filter((q) => executed.has(q));
				for (const q of ranQueries) memory.recordQuery(q, newByQuery.get(q) ?? 0);
				await store.saveScanMemory(memory);
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
