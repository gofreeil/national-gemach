<script lang="ts">
    import Seo from '$lib/components/Seo.svelte';
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
            'המסלול המבוקש:\n'
        )}`;

    // המחירון — מקור אמת יחיד ב-$lib/adPlans (משותף לבילדר, לשרת ולמסך האישור)
    import { adPlans } from '$lib/adPlans';

    // פרסומת אחת בלבד באתר — אותה מודעה מוצגת בשני המסכים:
    // בדסקטופ בטור הימני, ובנייד למשך INTERSTITIAL_SECONDS אחרי לחיצה על פריט.
    const placements = [
        {
            icon: '🖥️',
            title: 'בדסקטופ — הטור הימני',
            where: 'עמודה קבועה בצד ימין של האתר, בכל הדפים',
            points: [
                'מוצגת לכל גולשי הדסקטופ לאורך כל הביקור',
                'המודעות מתחלפות במחזור — כל מודעה מקבלת את הבמה',
                'נשארת על המסך גם בזמן גלילה',
            ],
        },
        {
            icon: '📱',
            title: 'בנייד — 5 שניות אחרי לחיצה על פריט',
            where: 'אותה פרסומת, במסך מלא',
            points: [
                'מסך מלא למשך 5 שניות — חשיפה מלאה ללא הסחות',
                'מוצגת בדיוק כשהגולש ממוקד — רגע לפני המידע שביקש',
                'לחיצה על המודעה פותחת את האתר שלכם',
            ],
        },
    ];
</script>

<Seo
    title='פרסום באתר הגמ"ח הארצי — חשיפה לקהילה שמחפשת עזרה'
    description='פרסום באתר הגמ"ח הארצי — טור פרסומות בדסקטופ ופרסומת מסך-מלא בנייד. מעצבים את הפרסומת ישירות באתר, משלמים, והמודעה עולה מיד אחרי אישור מנהל.'
    path="/advertise"
    keywords='פרסום באתר, פרסום מקומי, באנרים, הגמ"ח הארצי'
/>

<div class="mx-auto max-w-3xl px-4 py-8 md:py-12" dir="rtl">

    <!-- באנר אחד — כל התוכן בקופסה כהה אחת, ההפרדה בקווים פנימיים
         (אין טקסט אפור ישירות על הרקע הוורוד) -->
    <div class="rounded-3xl border border-[#3b5794] bg-[#16264d] shadow-2xl overflow-hidden">

    <!-- כותרת -->
    <div class="p-6 md:p-10 text-center">
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

    <!-- איפה הפרסומת (האחת) מופיעה — באותו באנר, מופרדים בקווים פנימיים מקוצרים
         (הקווים לא נוגעים בקצוות הבאנר) -->
    <div class="mx-8 md:mx-12 border-t border-[#3b5794]"></div>
    <div class="grid md:grid-cols-2">
        {#each placements as p, i (p.title)}
            <div class="relative p-6 flex flex-col">
                {#if i === 1}
                    <div class="absolute top-0 right-8 left-8 border-t border-[#3b5794] md:top-6 md:bottom-6 md:right-0 md:left-auto md:border-t-0 md:border-r" aria-hidden="true"></div>
                {/if}
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
    <div class="mx-8 md:mx-12 border-t border-[#3b5794]"></div>
    <div class="p-6 md:p-8 text-center">
        <h2 class="text-2xl font-black text-white mb-6">איך מפרסמים?</h2>
        <ol class="text-right max-w-md mx-auto space-y-4 mb-8">
            <li class="flex items-start gap-3">
                <span class="w-7 h-7 rounded-full bg-amber-400 text-black text-sm font-black flex items-center justify-center flex-shrink-0">1</span>
                <span class="text-gray-200 text-sm md:text-base leading-relaxed">מעצבים את הפרסומת בקלות ישירות על האתר.</span>
            </li>
            <li class="flex items-start gap-3">
                <span class="w-7 h-7 rounded-full bg-amber-400 text-black text-sm font-black flex items-center justify-center flex-shrink-0">2</span>
                <span class="text-gray-200 text-sm md:text-base leading-relaxed">בוחרים תקופת פרסום ומשלמים מראש.</span>
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
        <p class="mt-4 text-sm text-gray-300">
            כבר יש לכם פרסומת?
            <a href="/advertise/manage" class="font-bold text-amber-300 underline hover:text-amber-200 transition-colors">
                לנתונים ולעריכה בדשבורד שלכם ←
            </a>
        </p>
        <p class="mt-3 text-xs text-gray-400">
            שאלות? כתבו לנו:
            <a href={mailto} class="underline hover:text-white transition-colors" dir="ltr">{email}</a>
        </p>
    </div>

    <!-- מחירון — לבחור ולשלם מראש -->
    <div class="mx-8 md:mx-12 border-t border-[#3b5794]"></div>
    <div class="p-6 md:p-8" id="plans">
        <h2 class="text-2xl font-black text-white mb-2 text-center">לבחור ולשלם מראש</h2>
        <p class="text-sm text-gray-300 text-center mb-6">בוחרים תקופה, משלמים מראש — והמודעה רצה עד סופה.</p>
        <ul class="max-w-md mx-auto space-y-2">
            {#each adPlans as plan (plan.days)}
                <li class="flex items-baseline justify-between gap-3 rounded-xl bg-[#0f1c3d] border border-[#3b5794] px-4 py-3">
                    <span class="text-gray-200 text-sm md:text-base">{plan.title}</span>
                    <span class="text-amber-300 font-black text-base md:text-lg whitespace-nowrap">{plan.price} ₪</span>
                </li>
            {/each}
        </ul>
        <p class="mt-5 text-center text-sm text-gray-300">
            <a href="/advertise/terms" class="underline hover:text-white transition-colors">📜 תנאי הפרסום</a>
            — מומלץ לקרוא לפני התשלום
        </p>
    </div>

    </div><!-- /הבאנר האחד -->
</div>
