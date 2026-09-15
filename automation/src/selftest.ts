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
import { cleanDescription, extractDetails, guessCategories, isWeakDescription } from './core/details.ts';
import { PageEnricher, parseHtml } from './core/enricher.ts';
import { RateLimiter } from './core/rateLimiter.ts';
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
		// בלי רשת: geocoding מזויף
		geocode: async (c) => ({ ...c, lat: 32.96, lng: 35.5 }),
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

// ---------- חילוץ פרטים: "שדה: ערך" → שדות הטופס ----------

function detailsTests(): void {
	console.log('\nחילוץ פרטים (details):');

	// snippet אמיתי מטיוטה שנוצרה לפני השכלול — כל המידע היה תקוע בתיאור
	const snippet = 'גמ"ח -ירושלים תרופות כתיבת תגובה / מאת ahron yossef / יולי 25, 2025 כתובת: סנהדריה המורחבת 106, ירושלים שכונה: סנהדריה המורחבת עיר: ירושלים מדינה: ישראל קטגוריה: תרופות טלפון ליצירת קשר: 02-5812345 שעות פעילות/פרטים: 20:00-23:00 בערב, לא בשבת';
	const d = extractDetails(snippet, 'ירושלים');
	check('כתובת חולצה בלי העיר', d.address === 'סנהדריה המורחבת 106', d.address);
	check('שכונה חולצה', d.neighborhood === 'סנהדריה המורחבת', d.neighborhood);
	check('עיר חולצה', d.city === 'ירושלים', d.city);
	check('שעות חולצו', d.hours === '20:00-23:00 בערב, לא בשבת', d.hours);
	check('טלפון חולץ', d.phones[0] === '025812345', d.phones);

	const desc = cleanDescription(snippet, { name: 'גמ"ח -ירושלים תרופות' });
	check('התיאור נוקה מבלוקי השדות ומשאריות התבנית', !/כתובת:|מאת|כתיבת תגובה|טלפון/.test(desc), desc);

	// כתובת בסגנון מדריך + שני טלפונים
	const d2 = extractDetails('כתובת הגמ"ח: מתתיהו 12, בני ברק, ישראל טלפונים: 03-5551234, 050-1234567 איש קשר: משפחת כהן', 'בני ברק');
	check('כתובת מדריך בלי ", ישראל" ובלי העיר', d2.address === 'מתתיהו 12', d2.address);
	check('שני טלפונים', d2.phones.length === 2 && d2.phones[1] === '0501234567', d2.phones);
	check('איש קשר', d2.contact === 'משפחת כהן', d2.contact);

	// בלי תוויות: "ברחוב X N" / "שכונת Y"
	const d3 = extractDetails('הגמ"ח ממוקם ברחוב בית ישראל 4 בשכונת הר נוף, פתוח בימים א-ה 9:00-13:00');
	check('כתובת חופשית "ברחוב"', d3.address === 'בית ישראל 4', d3.address);
	check('שכונה חופשית "בשכונת"', d3.neighborhood?.startsWith('הר נוף') === true, d3.neighborhood);
	check('שעות חופשיות', !!d3.hours && d3.hours.includes('9:00-13:00'), d3.hours);

	check('קטגוריות מרובות, הראשית ראשונה', JSON.stringify(guessCategories('גמ"ח ציוד רפואי וקביים וגם עגלות תינוק')) === '["medical","baby"]', guessCategories('גמ"ח ציוד רפואי וקביים וגם עגלות תינוק'));
	check('תיאור חלש מזוהה', isWeakDescription('גמ"ח, ירושלים') && !isWeakDescription('גמ"ח להשאלת ציוד רפואי לכל דורש בירושלים, ללא תשלום, בתיאום טלפוני מראש'));

	// המעשיר: עמוד HTML → מטא + טקסט → מילוי שדות חסרים בלי דריסה
	const html = `<html><head><meta name="description" content="גמ&quot;ח ציוד רפואי בהר נוף — קביים, הליכונים וכיסאות גלגלים להשאלה ללא תשלום, בתיאום מראש"><meta property="og:image" content="/img/photo.jpg"></head>
		<body><script>var x=1;</script><h1>גמ"ח רפואי</h1><p>כתובת: אגסי 12, ירושלים</p><p>שעות פעילות: 10:00-12:00</p><p>טלפון: 02-6543210 &middot; נייד: 052-1112222</p></body></html>`;
	const meta = parseHtml(html);
	check('meta description פוענח (כולל ישויות)', meta.description.startsWith('גמ"ח ציוד רפואי'), meta.description);
	check('og:image נקרא', meta.image === '/img/photo.jpg', meta.image);
	check('סקריפטים הוסרו מהטקסט', !meta.text.includes('var x') && meta.text.includes('כתובת: אגסי 12'), meta.text.slice(0, 80));
	const enricher = new PageEnricher(new RateLimiter(0, 0), new CityDetector(siteCities), new Logger('selftest-enrich', 'warn'));
	const base: Candidate = {
		name: 'גמ"ח רפואי', city: 'ירושלים', description: 'גמ"ח, ירושלים', category: 'other', tags: ['ירושלים'],
		confidence: 0.5, fingerprints: [], source: 'fixture', sourceUrl: 'https://example.org', query: 'q', link: 'https://example.org',
	};
	const merged = enricher.merge(base, meta);
	check('טלפון מולא', merged.phone === '026543210', merged.phone);
	check('טלפון שני לא נלקח מעמוד (רק מה-snippet)', merged.phone2 === undefined, merged.phone2);
	// עמוד מדריך שבו הגמ"ח לא מוזכר כלל — שום פרט לא נלקח מהטקסט
	const foreign = enricher.merge({ ...base, name: 'גמ"ח אחר לגמרי' }, { ...meta, description: '' });
	check('עמוד בלי שם הגמ"ח — בלי טלפון/כתובת ממנו', !foreign.phone && !foreign.address, foreign);
	check('כתובת מולאה', merged.address === 'אגסי 12', merged.address);
	check('שעות מולאו', merged.hours === '10:00-12:00', merged.hours);
	check('תיאור חלש הוחלף ב-meta', merged.description.startsWith('גמ"ח ציוד רפואי'), merged.description);
	check('קטגוריה other הושלמה מהעמוד', merged.category === 'medical', merged.category);
	const keep: Candidate = { ...base, phone: '0501111111', address: 'רחוב אחר 1', description: 'תיאור מלא ומפורט של הגמ"ח שנכתב בידי המקור המקורי ואין לגעת בו' };
	const merged2 = enricher.merge(keep, meta);
	check('ערכים קיימים לא נדרסים', merged2.phone === '0501111111' && merged2.address === 'רחוב אחר 1' && merged2.description === keep.description, merged2);
}

export async function runSelftest(): Promise<void> {
	failed = 0;
	unitTests();
	detailsTests();
	await pipelineIntegrationTest();
	console.log(failed === 0 ? '\nכל הבדיקות עברו ✔' : `\n${failed} בדיקות נכשלו ✗`);
	process.exitCode = failed === 0 ? 0 : 1;
}
