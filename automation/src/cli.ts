// ============================================================
// cli.ts — נקודת הכניסה של אוטומציית הגילוי
// ============================================================
//
//   scan     — ריצת גילוי אחת. ברירת מחדל: ריצה יבשה; --apply מייבא באמת.
//   worker   — לולאת עובד: מושך משימות מהתור שהאדמין יוצר בפאנל ומריץ אותן.
//   migrate  — הכנת סכמת ה-Postgres (או הקובץ המקומי).
//   status   — סיכום מצב האחסון התפעולי.
//   selftest — בדיקות עצמיות לוגיות, בלי רשת ובלי דפדפן.
//
// הפעלה: npm run scan / worker / migrate / status / selftest (בתיקיית automation)

import os from 'node:os';
import { categories as siteCategories, cities as siteCities } from '../../src/lib/gemachData.ts';
import type { CategoryRef, ScanSpec } from './core/types.ts';
import { Logger } from './core/logger.ts';
import { sleep } from './core/rateLimiter.ts';
import { createStateStore } from './core/stateStore.ts';
import { StrapiGateway } from './strapi/gateway.ts';
import { DiscoveryPipeline } from './core/pipeline.ts';
import { GoogleSearchSource } from './sources/googleSearch.ts';
import { GoogleLocalSource } from './sources/googleLocal.ts';

const logger = new Logger('discovery');

// ---------- פירוק ארגומנטים ----------

interface CliArgs {
	command: string;
	flags: Map<string, string | true>;
}

function parseArgs(argv: string[]): CliArgs {
	const command = argv[2] && !argv[2].startsWith('--') ? argv[2] : 'help';
	const flags = new Map<string, string | true>();
	for (let i = command === 'help' ? 2 : 3; i < argv.length; i++) {
		const a = argv[i];
		if (!a?.startsWith('--')) continue;
		const eq = a.indexOf('=');
		if (eq > -1) flags.set(a.slice(2, eq), a.slice(eq + 1));
		else flags.set(a.slice(2), true);
	}
	return { command, flags };
}

function flagStr(flags: CliArgs['flags'], name: string): string | undefined {
	const v = flags.get(name);
	return typeof v === 'string' ? v : undefined;
}

function flagNum(flags: CliArgs['flags'], name: string, fallback: number): number {
	const v = Number(flagStr(flags, name));
	return Number.isFinite(v) && v > 0 ? v : fallback;
}

function buildSpec(flags: CliArgs['flags'], overrides: Partial<ScanSpec> = {}): ScanSpec {
	const defaultCats: CategoryRef[] = siteCategories.map((c) => ({ key: c.key, label: c.label, icon: c.icon }));
	return {
		sources: (flagStr(flags, 'sources') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
		categories: flagStr(flags, 'categories')
			? defaultCats.filter((c) => flagStr(flags, 'categories')!.split(',').map((s) => s.trim()).includes(c.key))
			: undefined,
		cities: flagStr(flags, 'cities')?.split(',').map((s) => s.trim()).filter(Boolean),
		maxQueries: flagNum(flags, 'queries', 20),
		maxImports: flagNum(flags, 'imports', 40),
		enrich: flags.has('enrich'),
		headful: flags.has('headful'),
		apply: flags.has('apply'),
		triggerJobId: flagStr(flags, 'job'),
		...overrides,
	};
}

// ---------- פקודות ----------

async function cmdScan(flags: CliArgs['flags']): Promise<void> {
	const spec = buildSpec(flags);
	if (!spec.apply) logger.info('ריצה יבשה — שום דבר לא ייכתב. הוסיפו --apply לייבוא אמיתי.');
	const gateway = new StrapiGateway(process.env.STRAPI_TOKEN, logger.child('strapi'));
	const store = await createStateStore(logger);
	try {
		const pipeline = new DiscoveryPipeline({
			gateway,
			store,
			logger,
			sources: [new GoogleSearchSource(), new GoogleLocalSource()],
			cities: siteCities,
			defaultCategories: siteCategories.map((c) => ({ key: c.key, label: c.label, icon: c.icon })),
		});
		await pipeline.run(spec);
	} finally {
		await store.close();
	}
}

async function cmdWorker(flags: CliArgs['flags']): Promise<void> {
	if (!flags.has('apply')) {
		logger.error('worker דורש --apply במפורש (הוא מייבא טיוטות ל-Strapi). הרצה: npm run worker');
		process.exitCode = 1;
		return;
	}
	const gateway = new StrapiGateway(process.env.STRAPI_TOKEN, logger.child('strapi'));
	gateway.assertWritable();
	const workerId = `${os.hostname()}#${process.pid}`;
	const intervalSec = flagNum(flags, 'interval', 20);
	const once = flags.has('once');
	logger.info(`עובד ${workerId} מאזין לתור (כל ${intervalSec} שניות${once ? ', ריצה בודדת' : ''}). Ctrl+C לעצירה.`);

	let stopping = false;
	process.on('SIGINT', () => {
		logger.info('קיבלתי עצירה — מסיים אחרי המשימה הנוכחית...');
		stopping = true;
	});

	const store = await createStateStore(logger);
	try {
		while (!stopping) {
			// רק ריצה שהושלמה מדלגת על ההמתנה (כדי לרוקן תור). כישלון תפיסה
			// חוזר (טוקן שפג, עובד מקביל) חייב להמתין — אחרת לולאה חמה מול Strapi.
			let didWork = false;
			const job = await gateway.fetchQueuedJob();
			if (job) {
				const claimed = await gateway.claimJob(job.documentId, workerId).catch((e) => {
					logger.error('תפיסת המשימה נכשלה', e);
					return false;
				});
				if (claimed) {
					didWork = true;
					logger.info(`מריץ משימה ${job.documentId} (${job.note || 'ללא הערה'})`);
					const x = job.extra;
					const spec = buildSpec(flags, {
						apply: true,
						triggerJobId: job.documentId,
						requestedBy: typeof x.requested_by === 'string' ? x.requested_by : undefined,
						maxQueries: typeof x.max_queries === 'number' ? x.max_queries : flagNum(flags, 'queries', 20),
						categories: Array.isArray(x.categories) ? (x.categories as CategoryRef[]) : undefined,
						sources: Array.isArray(x.sources) ? (x.sources as string[]) : [],
					});
					const pipeline = new DiscoveryPipeline({
						gateway,
						store,
						logger,
						sources: [new GoogleSearchSource(), new GoogleLocalSource()],
						cities: siteCities,
						defaultCategories: siteCategories.map((c) => ({ key: c.key, label: c.label, icon: c.icon })),
					});
					try {
						const stats = await pipeline.run(spec);
						const cancelled = (await gateway.getJobStatus(job.documentId)) === 'cancelled';
						if (!cancelled) await gateway.finishJob(job.documentId, 'done', stats);
						else logger.info('המשימה בוטלה ע"י האדמין — נשארת מסומנת כמבוטלת');
					} catch (e) {
						const msg = e instanceof Error ? e.message : String(e);
						await gateway.finishJob(job.documentId, 'failed', {}, msg).catch(() => {});
						logger.error('המשימה נכשלה', e);
					}
				}
			} else if (once) {
				logger.info('אין משימות בתור.');
				break;
			}
			if (once) break;
			// ריצה שהסתיימה → בודקים מיד אם יש עוד בתור; אחרת ממתינים
			if (!didWork) await sleep(intervalSec * 1000);
		}
	} finally {
		await store.close();
	}
}

async function cmdMigrate(): Promise<void> {
	const store = await createStateStore(logger);
	await store.init();
	logger.info('הסכמה מוכנה.');
	await store.close();
}

async function cmdStatus(): Promise<void> {
	const store = await createStateStore(logger);
	await store.init();
	const s = await store.summary();
	console.log('\n===== מצב אוטומציית הגילוי =====');
	console.log(`אחסון:            ${s.backend}`);
	console.log(`ריצות:            ${s.runs}${s.lastRunAt ? ` (אחרונה: ${s.lastRunAt})` : ''}`);
	console.log(`טביעות בזיכרון:   ${s.fingerprints}`);
	console.log('מועמדים לפי החלטה:', JSON.stringify(s.candidatesByDecision));
	await store.close();
}

// ---------- main ----------

const HELP = `
אוטומציית גילוי גמ"חים — פקודות:
  scan      ריצת גילוי אחת (ברירת מחדל: יבשה). דגלים: --apply --sources=a,b
            --queries=N --imports=N --cities=א,ב --categories=a,b --enrich --headful
  worker    לולאת עובד לתור הפאנל. דגלים: --apply (חובה) --interval=שניות --once
  migrate   הכנת סכמת האחסון (Postgres אם DATABASE_URL מוגדר)
  status    סיכום מצב האחסון התפעולי
  selftest  בדיקות לוגיקה מקומיות (בלי רשת)
`;

async function main(): Promise<void> {
	const { command, flags } = parseArgs(process.argv);
	switch (command) {
		case 'scan': return cmdScan(flags);
		case 'worker': return cmdWorker(flags);
		case 'migrate': return cmdMigrate();
		case 'status': return cmdStatus();
		case 'selftest': {
			const { runSelftest } = await import('./selftest.ts');
			return runSelftest();
		}
		default:
			console.log(HELP);
	}
}

main().catch((e) => {
	logger.error('שגיאה קריטית', e);
	process.exitCode = 1;
});
