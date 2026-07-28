// ============================================================
// selftest.ts — בדיקות עצמיות: לוגיקה + אינטגרציה של הצינור
// ============================================================
//
// רצות בלי רשת ובלי Strapi: שער מזויף ומקור פיקטיבי מוזרקים לצינור
// האמיתי (אותו DiscoveryPipeline שרץ בפרודקשן), כך שהבדיקה מכסה את
// נירמול → זיהוי כפילויות → החלטת ייבוא → תיעוד באחסון.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { categories as siteCategories, cities as siteCities } from '../../src/lib/gemachData.ts';
import { Logger } from './core/logger.ts';
import { CandidateNormalizer } from './core/normalizer.ts';
import { Deduper } from './core/deduper.ts';
import { fingerprintsFor } from './core/fingerprint.ts';
import { CityDetector, cleanTitle, extractPhone, guessCategory, normalizePhone } from './core/text.ts';
import { DiscoverySource, type SourceContext } from './core/source.ts';
import { DiscoveryPipeline } from './core/pipeline.ts';
import { FileStateStore } from './db/fileStateStore.ts';
import { StrapiGateway } from './strapi/gateway.ts';
import type { Candidate, ExistingEntry, RawResult } from './core/types.ts';

let failed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
	if (cond) console.log(`  ✓ ${name}`);
	else {
		failed++;
		console.error(`  ✗ ${name}`, detail ?? '');
	}
}

// ---------- שער Strapi מזויף ----------

interface CreatedDraft {
	candidate: Candidate;
	icon?: string;
}

class FakeGateway extends StrapiGateway {
	readonly created: CreatedDraft[] = [];

	constructor(private readonly existing: ExistingEntry[]) {
		super('fake-token', new Logger('fake'));
	}

	override assertWritable(): void {}

	override async listGemachimLight(): Promise<ExistingEntry[]> {
		return this.existing;
	}

	override async createDraftGemach(c: Candidate, opts: { icon?: string }): Promise<string> {
		this.created.push({ candidate: c, icon: opts.icon });
		return `fake-doc-${this.created.length}`;
	}
}

// ---------- מקור פיקטיבי ----------

class FixtureSource extends DiscoverySource {
	readonly name = 'fixture';
	readonly label = 'מקור בדיקה';

	constructor(private readonly rows: RawResult[]) {
		super();
	}

	async *discover(_queries: string[], _ctx: SourceContext): AsyncGenerator<RawResult> {
		for (const row of this.rows) yield row;
	}
}

// ---------- בדיקות ----------

function unitTests(): void {
	console.log('בדיקות טקסט:');
	check('נירמול טלפון בינלאומי', normalizePhone('+972-58-682-7276') === '0586827276');
	check('חילוץ טלפון מטקסט', extractPhone('התקשרו 02-500 1234 בשעות הבוקר') === '025001234');
	check('ניקוי כותרת עם שם אתר', cleanTitle('גמ"ח כלי עבודה - האתר הגדול למדריכים') === 'גמ"ח כלי עבודה');
	check('זיהוי קטגוריה', guessCategory('השאלת קביים והליכונים לנזקקים') === 'medical');

	const detector = new CityDetector(siteCities);
	check('זיהוי עיר עם אות שימוש', detector.detect('גמ"ח שמחות בבני ברק ליד הרחוב') === 'בני ברק');
	check('כינוי עיר (תל אביב)', detector.detect('גמ"ח בתל אביב') === 'תל אביב - יפו');

	console.log('בדיקות נירמול מועמד:');
	const normalizer = new CandidateNormalizer(siteCities);
	const good = normalizer.normalize({
		source: 't',
		query: 'q',
		url: 'https://example.org/gemach',
		title: 'גמ"ח ציוד רפואי חסדי אבות | מדריך הגמחים',
		snippet: 'השאלת קביים וכיסאות גלגלים בירושלים. טלפון: 02-1234567',
	});
	check('תוצאה טובה מתקבלת', good.ok);
	if (good.ok) {
		check('שם נוקה', good.candidate.name === 'גמ"ח ציוד רפואי חסדי אבות', good.candidate.name);
		check('עיר זוהתה', good.candidate.city === 'ירושלים', good.candidate.city);
		check('טלפון חולץ', good.candidate.phone === '021234567', good.candidate.phone);
		check('קטגוריה זוהתה', good.candidate.category === 'medical', good.candidate.category);
	}
	const bad = normalizer.normalize({
		source: 't', query: 'q', url: 'https://example.org/x',
		title: 'חנות רהיטים מומלצת', snippet: 'מבצעים על ספות',
	});
	check('תוצאה בלי גמ"ח נדחית', !bad.ok);

	console.log('בדיקות כפילויות:');
	const deduper = new Deduper();
	deduper.addExisting([
		{ ref: 'doc1', kind: 'strapi', name: 'גמח ציוד רפואי חסדי אבות', city: 'ירושלים', phone: '+972-2-123-4567' },
	]);
	if (good.ok) {
		const hit = deduper.check(good.candidate);
		check('כפילות טלפון נתפסת (פורמט שונה)', hit?.ref === 'doc1', hit);
	}
	const fresh = fingerprintsFor({ name: 'גמ"ח חדש לגמרי', city: 'צפת', phone: '050-999-8888' });
	check('גמ"ח חדש לא נתפס', deduper.check({ fingerprints: fresh } as never) === null);
}

/** מריץ את הצינור האמיתי מקצה-לקצה מול שער ומקור מזויפים */
async function pipelineIntegrationTest(): Promise<void> {
	console.log('בדיקת אינטגרציה של הצינור (בלי רשת):');

	const existing: ExistingEntry[] = [
		{ ref: 'existing-1', kind: 'strapi', name: 'גמ"ח מיטות תינוק', city: 'בני ברק', phone: '03-555-1234' },
	];

	const rows: RawResult[] = [
		// כפול — אותו טלפון כמו הקיים, בפורמט כתיבה אחר
		{
			source: 'fixture', query: 'q1', url: 'https://example.org/a',
			title: 'גמ"ח מיטות ולולים לתינוק',
			snippet: 'השאלת לולים ומיטות תינוק בבני ברק. טלפון 0355 51234',
		},
		// חדש ותקין
		{
			source: 'fixture', query: 'q2', url: 'https://example.org/b',
			title: 'גמ"ח כיסאות גלגלים וקביים צפת',
			snippet: 'ציוד רפואי להשאלה בצפת ללא תשלום. לפרטים 04-6971234',
		},
		// זבל — בלי אזכור גמ"ח
		{
			source: 'fixture', query: 'q3', url: 'https://example.org/c',
			title: 'חנות כלי בית',
			snippet: 'מבצעים לחג',
		},
	];

	const gateway = new FakeGateway(existing);
	const store = new FileStateStore(
		new Logger('selftest-store'),
		join(mkdtempSync(join(tmpdir(), 'ng-discovery-')), 'state.json'),
	);
	const pipeline = new DiscoveryPipeline({
		gateway,
		store,
		logger: new Logger('selftest-pipeline', 'warn'),
		sources: [new FixtureSource(rows)],
		cities: siteCities,
		defaultCategories: siteCategories.map((c) => ({ key: c.key, label: c.label, icon: c.icon })),
	});

	const stats = await pipeline.run({
		sources: ['fixture'],
		maxQueries: 2,
		maxImports: 10,
		enrich: false,
		headful: false,
		apply: true,
	});

	check('נספרו 3 תוצאות גולמיות', stats.rawResults === 3, stats);
	check('תוצאת הזבל נפלה בסינון האיכות', stats.lowQuality === 1, stats);
	check('הכפילות זוהתה ולא יובאה', stats.duplicates === 1, stats);
	check('גמ"ח אחד בלבד יובא', stats.imported === 1, stats);
	check('אין שגיאות', stats.errors === 0, stats);

	const draft = gateway.created[0];
	check('נוצרה טיוטה אחת', gateway.created.length === 1, gateway.created.length);
	if (draft) {
		check('שם הטיוטה נכון', draft.candidate.name === 'גמ"ח כיסאות גלגלים וקביים צפת', draft.candidate.name);
		check('עיר הטיוטה נכונה', draft.candidate.city === 'צפת', draft.candidate.city);
		check('קטגוריית הטיוטה רפואית', draft.candidate.category === 'medical', draft.candidate.category);
		check('טלפון הטיוטה חולץ', draft.candidate.phone === '046971234', draft.candidate.phone);
	}

	const summary = await store.summary();
	check('הריצה תועדה באחסון', summary.runs === 1, summary);
	check('הטביעות נשמרו לזיכרון (מניעת ייבוא חוזר)', summary.fingerprints > 0, summary);
	check(
		'ההחלטות תועדו (יובא + כפול)',
		summary.candidatesByDecision.imported === 1 && summary.candidatesByDecision.duplicate === 1,
		summary.candidatesByDecision,
	);
	await store.close();
}

export async function runSelftest(): Promise<void> {
	failed = 0;
	unitTests();
	await pipelineIntegrationTest();
	console.log(failed === 0 ? '\nכל הבדיקות עברו ✔' : `\n${failed} בדיקות נכשלו ✗`);
	process.exitCode = failed === 0 ? 0 : 1;
}
