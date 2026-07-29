<script lang="ts">
    // ============================================================
    // /info — דף המידע של האתר. כאן יושב כל הטקסט המסביר (מהות האתר,
    // מה יש במאגר, שאלות ותשובות) שהיה קודם בתחתית דף הבית. הכניסה אליו
    // היא מכפתור "מידע" שבהאדר, מכל דף באתר.
    // זה גם דף התוכן שגוגל ומנועי ה-AI מצטטים כשמישהו שואל "מה זה גמ"ח" —
    // ולכן ה-FAQPage שב-JSON-LD יושב כאן, ליד השו"ת הגלוי שהוא מתאר.
    // ============================================================
    import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
    import JsonLd from '$lib/components/JsonLd.svelte';
    import Seo from '$lib/components/Seo.svelte';
    import { SITE_NAME, breadcrumbSchema, faqSchema } from '$lib/seo';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    /** גלולות הערך — מה שמבדיל את המאגר, בשורה אחת במקום ברשימה */
    const values = [
        'חינם לחלוטין',
        'בלי הרשמה',
        'בלי תיווך ובלי עמלה',
        'ארצי — מדן ועד אילת',
        'פתוח לכל אדם',
    ];

    const faqs = [
        {
            q: 'מה זה גמ"ח?',
            a: 'גמ"ח (גמילות חסדים) הוא ארגון התנדבותי שמשאיל או נותן בחינם ציוד, כספים או שירותים לכל מי שצריך — למשל גמ"ח ציוד רפואי שמשאיל כיסא גלגלים, גמ"ח שמלות לחתונה, גמ"ח כלי אירוח או גמ"ח הלוואות. אין רווח ואין תיווך: מקבלים, מחזירים, ועוזרים לבא אחרינו.',
        },
        {
            q: 'איך מוצאים גמ"ח קרוב לבית?',
            a: 'מקלידים בשדה החיפוש את מה שצריך ("ציוד רפואי", "שמלות", "כלי אירוח") ובוחרים עיר במסנן הערים. אפשר גם לגלול את מסילת הקטגוריות ולראות את כל הגמ"חים בנושא. בדף הגמ"ח מופיעים הכתובת, שעות הפעילות והטלפון.',
        },
        {
            q: 'האם השימוש באתר בתשלום?',
            a: 'לא. החיפוש באתר חינמי לחלוטין, וגם רישום גמ"ח למאגר הוא בחינם וללא עלות. האתר הוא חלק מפעילות התנועה החברתית "יוצאים לחירות".',
        },
        {
            q: 'אני מפעיל גמ"ח — איך מוסיפים אותו למאגר?',
            a: 'לוחצים על "הוסף גמח חינם", ממלאים שם, נושא, עיר, כתובת, שעות פעילות וטלפון — והגמ"ח מקבל דף אינדקס משלו שמופיע בגוגל ובחיפוש באתר. אין עלות ואין התחייבות.',
        },
        {
            q: 'האם צריך להירשם או להשאיר פרטים כדי לראות טלפון של גמ"ח?',
            a: 'לא. הטלפון נחשף בלחיצה על "גלה טלפון" בדף הגמ"ח, בלי הרשמה ובלי השארת פרטים.',
        },
    ];

    const schemas = [
        breadcrumbSchema([
            { name: 'דף הבית', path: '/' },
            { name: 'מידע', path: '/info' },
        ]),
        faqSchema(faqs),
    ];
</script>

<Seo
    title={`מה זה גמ"ח ואיך מוצאים אחד — מידע על ${SITE_NAME}`}
    description='כל המידע על גמ"חים: מה זה גמ"ח, איך מוצאים גמ"ח קרוב לבית לפי עיר ולפי נושא, איך מוסיפים גמ"ח למאגר בחינם, ושאלות נפוצות — באתר הגמ"ח הארצי.'
    path="/info"
    keywords='מה זה גמ"ח, גמילות חסדים, איך מוצאים גמ"ח, מאגר גמחים, אודות הגמ"ח הארצי, שאלות נפוצות גמחים'
/>
<JsonLd data={schemas} />

<div class="mx-auto max-w-4xl px-4 py-5 md:py-8" dir="rtl">
    <Breadcrumbs crumbs={[{ label: 'דף הבית', href: '/' }, { label: 'מידע' }]} />

    <!-- באנר אחד — כל התוכן בקופסה כהה, ההפרדה בקווים פנימיים.
         טקסט אפור ישירות על הרקע הוורוד אינו קריא, ולכן אין כאן טקסט "עירום". -->
    <div class="overflow-hidden rounded-3xl border border-[#3b5794] bg-[#16264d] shadow-2xl">

        <!-- כותרת: לוגו ומלל זה לצד זה (לרוחב, בלי קומה נוספת לגלול) -->
        <div class="flex flex-col items-center gap-5 p-5 text-center sm:flex-row sm:p-7 sm:text-right">
            <img
                src="/images/logo.png"
                alt='הגמ"ח הארצי'
                class="h-24 w-24 flex-shrink-0 rounded-2xl border-[3px] border-[#D4AF37] bg-white object-cover shadow-lg md:h-28 md:w-28"
            />
            <div class="min-w-0">
                <h1 class="mb-2 text-2xl font-black text-white md:text-3xl">
                    מידע על הגמ"ח הארצי
                </h1>
                <p class="leading-relaxed text-gray-200">
                    מאגר ציבורי אחד שמרכז את כל הגמ"חים בישראל — כל מקום שמשאיל, נותן או מלווה
                    בחינם — ומאפשר למצוא אותו בשתי לחיצות: לפי נושא ולפי עיר.
                </p>
                <ul class="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                    {#each values as v (v)}
                        <li class="rounded-full border border-[#3b5794] bg-[#1c2f5a] px-3 py-1 text-xs font-bold text-gray-100">
                            {v}
                        </li>
                    {/each}
                </ul>
            </div>
        </div>

        <!-- מצב המאגר בפועל — שורה אחת, לא שלושה כרטיסים -->
        {#if data.gemachCount > 0}
            <div class="mx-5 border-t border-[#3b5794] sm:mx-7"></div>
            <dl class="grid grid-cols-3 divide-x divide-x-reverse divide-[#3b5794] px-5 py-4 text-center sm:px-7">
                <div>
                    <dt class="text-[11px] font-semibold text-gray-300 md:text-xs">גמ"חים רשומים</dt>
                    <dd class="text-xl font-black text-blue-300 md:text-2xl">{data.gemachCount}</dd>
                </div>
                <div>
                    <dt class="text-[11px] font-semibold text-gray-300 md:text-xs">ערים</dt>
                    <dd class="text-xl font-black text-purple-300 md:text-2xl">{data.cityCount}</dd>
                </div>
                <div>
                    <dt class="text-[11px] font-semibold text-gray-300 md:text-xs">נושאים</dt>
                    <dd class="text-xl font-black text-amber-300 md:text-2xl">{data.categoryCount}</dd>
                </div>
            </dl>
        {/if}

        <!-- מהות האתר: שתי עמודות זו לצד זו במקום שתי קומות -->
        <div class="mx-5 border-t border-[#3b5794] sm:mx-7"></div>
        <section class="p-5 sm:p-7" aria-labelledby="essence-title">
            <h2 id="essence-title" class="mb-3 text-xl font-black text-white">מהות האתר</h2>
            <div class="grid gap-5 md:grid-cols-2">
                <div>
                    <h3 class="mb-1.5 font-black text-blue-300">הרעיון</h3>
                    <p class="text-sm leading-relaxed text-gray-200">
                        בכל בית בארץ מונחים דברים שנקנו פעם וכמעט אינם בשימוש: כיסא גלגלים
                        שנשאר אחרי החלמה, שמלת אירוסין, סט כלים לשלושים אורחים, מיטת תינוק.
                        גמ"ח הוא הכתובת שמעבירה את מה שמונח אצל אחד למי שזקוק לו עכשיו —
                        בהשאלה, בלי מחיר. גמ"חים יש בארץ בשפע; מה שחסר היה מקום אחד שבו
                        אפשר למצוא אותם. בשביל זה קם האתר הזה.
                    </p>
                </div>
                <div>
                    <h3 class="mb-1.5 font-black text-blue-300">איך זה עובד</h3>
                    <p class="text-sm leading-relaxed text-gray-200">
                        לכל גמ"ח יש דף משלו עם נושא, עיר, כתובת, שעות פעילות וטלפון. מקלידים
                        מה שצריך, מסננים לפי עיר או בוחרים נושא — ומתקשרים ישירות לגמ"ח.
                        האתר אינו עומד בין המבקש לנותן: אין הרשמה, אין השארת פרטים ואין
                        דמי מתווך — רק הדרך אל הכתובת הנכונה.
                    </p>
                </div>
            </div>
            <p class="mt-4 rounded-2xl border border-[#3b5794] bg-[#1c2f5a]/70 p-4 text-sm leading-relaxed text-gray-200">
                <strong class="text-white">למה זה חינם?</strong>
                הגמ"ח הארצי הוא חלק מפעילות התנועה החברתית
                <a href="https://gofreeil.com" target="_blank" rel="noopener noreferrer" class="font-bold text-blue-300 underline hover:text-blue-200">יוצאים לחירות</a>
                ומופעל בהתנדבות. גם החיפוש וגם רישום גמ"ח הם ללא עלות, ללא עמלה וללא דמי
                פרסום; ההוצאות מכוסות ממודעות של עסקים שבחרו לתמוך. הדבר היחיד שמבקשים ממי
                שמקבל: להחזיר בזמן, להחזיר במצב טוב, ולהעביר את הידיעה הלאה.
            </p>
        </section>

        <!-- ═══ תוכן SEO: הסבר מלא על המאגר ═══
             הטקסט שגוגל ומנועי ה-AI קוראים ומצטטים כשמישהו שואל "איפה יש גמ"ח ציוד רפואי". -->
        <div class="mx-5 border-t border-[#3b5794] sm:mx-7"></div>
        <section class="p-5 sm:p-7" aria-labelledby="about-gemach-title">
            <h2 id="about-gemach-title" class="mb-3 text-xl font-black text-white">
                מאגר הגמ"חים הארצי — כל הגמ"חים בישראל במקום אחד
            </h2>
            <p class="mb-3 leading-relaxed text-gray-200">
                <strong>הגמ"ח הארצי</strong> מרכז במקום אחד את הגמ"חים (גמילות חסדים) מכל רחבי הארץ:
                גמ"ח <strong>ציוד רפואי</strong> (כיסאות גלגלים, הליכונים, משאבות חלב), גמ"ח
                <strong>שמלות וחליפות</strong> לחתונות ולשמחות, גמ"ח <strong>כלי אירוח</strong>,
                גמ"ח <strong>ריהוט</strong>, גמ"ח <strong>ציוד לתינוקות</strong>, גמ"ח
                <strong>ספרים</strong>, גמ"ח <strong>כלי עבודה</strong>, גמ"ח <strong>מזון</strong>,
                גמ"ח <strong>כספים והלוואות</strong> ועוד. החיפוש הוא לפי נושא ולפי עיר, ובכל דף גמ"ח
                מופיעים הכתובת, שעות הפעילות והטלפון — בלי הרשמה ובלי עלות.
            </p>
            <p class="leading-relaxed text-gray-200">
                מפעילים גמ"ח? <a href="/gemach/add" class="font-bold text-blue-300 underline hover:text-blue-200">הוסיפו אותו למאגר בחינם</a>
                ותקבלו דף אינדקס שמופיע בגוגל, כדי שכל מי שמחפש בדיוק את מה שאתם משאילים ימצא אתכם.
                אפשר גם לעיין ב<a href="/gemachim" class="font-bold text-blue-300 underline hover:text-blue-200">רשימת כל הגמ"חים במאגר</a>.
            </p>
        </section>

        <!-- שאלות ותשובות — מקביל ל-FAQPage שב-JSON-LD למעלה -->
        <div class="mx-5 border-t border-[#3b5794] sm:mx-7"></div>
        <section class="p-5 sm:p-7" aria-labelledby="faq-title">
            <h2 id="faq-title" class="mb-3 text-xl font-black text-white">שאלות נפוצות על גמ"חים</h2>
            <div class="space-y-2">
                {#each faqs as f (f.q)}
                    <details class="rounded-xl border border-[#3b5794] bg-[#1c2f5a]/80 px-4">
                        <summary class="cursor-pointer py-3 font-bold text-white">{f.q}</summary>
                        <p class="pb-3 text-sm leading-relaxed text-gray-200">{f.a}</p>
                    </details>
                {/each}
            </div>
        </section>

        <!-- שתי הדרכים להמשיך — זו לצד זו, בלי קומת CTA נפרדת -->
        <div class="mx-5 border-t border-[#3b5794] sm:mx-7"></div>
        <div class="flex flex-col gap-3 p-5 sm:flex-row sm:p-7">
            <a
                href="/gemachim"
                class="flex-1 rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-900/50 to-purple-900/50 px-5 py-3 text-center font-bold text-white transition-all hover:border-blue-400/60 hover:from-blue-900/70 hover:to-purple-900/70"
            >
                לכלל הגמ"חים במאגר ←
            </a>
            <a
                href="/gemach/add"
                class="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-center font-bold text-white shadow-lg transition-opacity hover:opacity-90"
            >
                הוסף גמ"ח חינם
            </a>
        </div>
    </div>
</div>
