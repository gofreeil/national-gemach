<script lang="ts">
    // דף "פרסמו אצלנו" מקומי — אליו מופנים מתעניינים מהמודעות עצמן
    // (טור הדסקטופ ופרסומת-הביניים בנייד) ומהפוטר, במקום לאתר קהילה בשכונה.
    const email = 'freedomhasbegun@gmail.com';
    // הבילדר המקומי — שם מעצבים את הפרסומת, משלמים, והמודעה
    // עוברת אישור מנהל (/admin/ads) לפני שהיא עולה.
    const builderUrl = '/advertise/builder';
    const mailto =
        `mailto:${email}` +
        `?subject=${encodeURIComponent('פרסום בגמ"ח הארצי')}` +
        `&body=${encodeURIComponent(
            'שלום,\nאשמח לפרסם באתר הגמ"ח הארצי.\n\n' +
            'שם העסק / הארגון:\n' +
            'טלפון לחזרה:\n' +
            'המיקום המבוקש (טור הדסקטופ / פרסומת הנייד / שניהם):\n'
        )}`;

    const placements = [
        {
            icon: '🖥️',
            title: 'טור הפרסומות בדסקטופ',
            where: 'עמודה קבועה בצד ימין של האתר, בכל הדפים',
            points: [
                'מוצג לכל גולשי הדסקטופ לאורך כל הביקור',
                'המודעות מתחלפות במחזור — כל מודעה מקבלת את הבמה',
                'המודעה נשארת על המסך גם בזמן גלילה',
            ],
        },
        {
            icon: '📱',
            title: 'פרסומת מסך-מלא בנייד',
            where: 'מוצגת במעבר לדף גמ"ח ובחשיפת מספר טלפון',
            points: [
                'מסך מלא למשך מספר שניות — חשיפה מלאה ללא הסחות',
                'מוצגת בדיוק כשהגולש ממוקד — רגע לפני המידע שביקש',
                'לחיצה על המודעה פותחת את האתר שלכם',
            ],
        },
    ];
</script>

<svelte:head>
    <title>פרסמו אצלנו | הגמ"ח הארצי</title>
    <meta name="description" content="פרסום באתר הגמ&quot;ח הארצי — טור פרסומות בדסקטופ ופרסומת מסך-מלא בנייד. מעצבים את הפרסומת ישירות באתר, משלמים, והמודעה עולה מיד אחרי אישור מנהל." />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8 md:py-12" dir="rtl">

    <!-- כותרת — בתוך קופסה כהה (אין טקסט אפור ישירות על הרקע הוורוד) -->
    <div class="rounded-3xl border border-[#3b5794] bg-[#16264d] p-6 md:p-10 text-center shadow-2xl mb-6">
        <div class="text-5xl mb-4">📢</div>
        <h1 class="text-3xl md:text-4xl font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent mb-3">
            פרסמו בגמ"ח הארצי
        </h1>
        <p class="text-gray-300 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
            אלפי גולשים מחפשים כאן גמ"חים בכל רחבי הארץ.
            המודעה שלכם פוגשת אותם בדיוק ברגעי החיפוש — וההכנסות מהפרסום
            עוזרות להחזיק את המאגר חינמי ופתוח לציבור.
        </p>
    </div>

    <!-- שני מיקומי הפרסום -->
    <div class="grid md:grid-cols-2 gap-4 mb-6">
        {#each placements as p (p.title)}
            <div class="rounded-3xl border border-[#3b5794] bg-[#16264d] p-6 shadow-xl flex flex-col">
                <div class="text-4xl mb-3">{p.icon}</div>
                <h2 class="text-xl font-black text-white mb-1">{p.title}</h2>
                <p class="text-sm text-amber-300 font-bold mb-4">{p.where}</p>
                <ul class="space-y-2">
                    {#each p.points as point}
                        <li class="text-sm text-gray-300 flex items-start gap-2 leading-relaxed">
                            <span class="text-green-400 flex-shrink-0">✓</span>
                            {point}
                        </li>
                    {/each}
                </ul>
            </div>
        {/each}
    </div>

    <!-- איך מפרסמים -->
    <div class="rounded-3xl border border-[#3b5794] bg-[#16264d] p-6 md:p-8 text-center shadow-2xl">
        <h2 class="text-2xl font-black text-white mb-6">איך מפרסמים?</h2>
        <ol class="text-right max-w-md mx-auto space-y-4 mb-8">
            <li class="flex items-start gap-3">
                <span class="w-7 h-7 rounded-full bg-amber-400 text-black text-sm font-black flex items-center justify-center flex-shrink-0">1</span>
                <span class="text-gray-200 text-sm md:text-base leading-relaxed">מעצבים את הפרסומת שלכם ישירות באתר.</span>
            </li>
            <li class="flex items-start gap-3">
                <span class="w-7 h-7 rounded-full bg-amber-400 text-black text-sm font-black flex items-center justify-center flex-shrink-0">2</span>
                <span class="text-gray-200 text-sm md:text-base leading-relaxed">משלמים.</span>
            </li>
            <li class="flex items-start gap-3">
                <span class="w-7 h-7 rounded-full bg-amber-400 text-black text-sm font-black flex items-center justify-center flex-shrink-0">3</span>
                <span class="text-gray-200 text-sm md:text-base leading-relaxed">הפרסומת עוברת אישור מנהל — ומיד עולה לאוויר.</span>
            </li>
        </ol>
        <a
            href={builderUrl}
            class="inline-block rounded-2xl bg-gradient-to-r from-amber-500 to-pink-600 px-8 py-4 font-black text-white text-lg shadow-xl transition hover:opacity-90 hover:scale-[1.02]"
        >
            🎨 לעיצוב הפרסומת
        </a>
        <p class="mt-4 text-xs text-gray-400">
            שאלות? כתבו לנו:
            <a href={mailto} class="underline hover:text-white transition-colors" dir="ltr">{email}</a>
        </p>
    </div>
</div>
