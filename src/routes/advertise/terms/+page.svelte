<script lang="ts">
    // תנאי הפרסום — מקושרים מדף "פרסמו אצלנו" ומקופסת התשלום בבילדר,
    // לפני שהמפרסם בוחר מסלול ומשלם.
    import { adPlans } from '$lib/adPlans';

    const contactUrl = 'https://freedom.gofreeil.com';
    const email = 'freedomhasbegun@gmail.com';
</script>

<svelte:head>
    <title>תנאי פרסום | הגמ"ח הארצי</title>
    <meta name="description" content="תנאי הפרסום באתר הגמ&quot;ח הארצי — מה מותר ומה אסור לפרסם, תשלום מראש לפי מסלול, אישור מנהל, ותנאי ההסרה." />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-8 md:py-12" dir="rtl">
    <div class="rounded-3xl border border-[#3b5794] bg-[#16264d] shadow-2xl overflow-hidden">

        <!-- כותרת -->
        <div class="p-6 md:p-10 text-center">
            <div class="text-5xl mb-4">📜</div>
            <h1 class="text-3xl md:text-4xl font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent mb-3">
                תנאי פרסום
            </h1>
            <p class="text-gray-300 text-base leading-relaxed max-w-xl mx-auto">
                לפני בחירת מסלול ותשלום — כדאי לקרוא. שליחת פרסומת לאישור
                מהווה הסכמה לתנאים שלהלן.
            </p>
        </div>

        <!-- מה אסור לפרסם -->
        <div class="mx-8 md:mx-12 border-t border-[#3b5794]"></div>
        <section class="p-6 md:p-8">
            <h2 class="text-xl font-black text-white mb-3">1. מה אסור לפרסם</h2>
            <p class="text-gray-200 text-sm md:text-base leading-relaxed mb-3">אין לפרסם:</p>
            <ul class="space-y-2 mb-4">
                <li class="text-sm md:text-base text-gray-200 flex items-start gap-2 leading-relaxed">
                    <span class="text-red-400 flex-shrink-0">✗</span> דברים שאינם חוקיים.
                </li>
                <li class="text-sm md:text-base text-gray-200 flex items-start gap-2 leading-relaxed">
                    <span class="text-red-400 flex-shrink-0">✗</span> מסרים פוליטיים.
                </li>
                <li class="text-sm md:text-base text-gray-200 flex items-start gap-2 leading-relaxed">
                    <span class="text-red-400 flex-shrink-0">✗</span> או כל תוכן מסית ומפלג.
                </li>
            </ul>
            <p class="text-amber-300 font-black text-sm md:text-base">פרסום כזה לא יאושר!</p>
            <p class="text-gray-300 text-sm leading-relaxed mt-3">
                בנוסף, לא יאושרו תוכן פוגעני או מבזה, תוכן שאינו הולם אתר משפחתי,
                הצגה מטעה של מוצר או שירות, ופרסום שאינו שלכם או שאין לכם זכות
                להשתמש בו (תמונות, לוגו, שם מסחרי).
            </p>
        </section>

        <!-- אישור המודעה -->
        <div class="mx-8 md:mx-12 border-t border-[#3b5794]"></div>
        <section class="p-6 md:p-8">
            <h2 class="text-xl font-black text-white mb-3">2. אישור המודעה</h2>
            <p class="text-gray-200 text-sm md:text-base leading-relaxed">
                כל פרסומת עוברת אישור ידני של מנהל לפני שהיא עולה לאוויר. ההחלטה
                נתונה לשיקול דעת המערכת, ואין חובה לנמק דחייה. מודעה שנדחתה בגלל
                תוכן — אפשר לתקן ולשלוח מחדש. אם מודעה נדחתה ולא ניתן לתקנה,
                התשלום שהתקבל עבורה יוחזר במלואו.
            </p>
            <p class="text-gray-300 text-sm leading-relaxed mt-3">
                תקופת הפרסום נספרת מרגע האישור ועליית המודעה לאוויר — לא מרגע
                השליחה או התשלום.
            </p>
        </section>

        <!-- תשלום ותקופת פרסום -->
        <div class="mx-8 md:mx-12 border-t border-[#3b5794]"></div>
        <section class="p-6 md:p-8">
            <h2 class="text-xl font-black text-white mb-3">3. תשלום ותקופת פרסום</h2>
            <p class="text-gray-200 text-sm md:text-base leading-relaxed mb-4">
                בוחרים מסלול ומשלמים מראש עבור כל התקופה:
            </p>
            <ul class="space-y-1.5 mb-4">
                {#each adPlans as plan (plan.days)}
                    <li class="flex items-baseline justify-between gap-3 rounded-xl bg-[#0f1c3d] border border-[#3b5794] px-4 py-2">
                        <span class="text-gray-200 text-sm md:text-base">{plan.title}</span>
                        <span class="text-amber-300 font-black text-sm md:text-base whitespace-nowrap">{plan.price} ₪</span>
                    </li>
                {/each}
            </ul>
            <p class="text-gray-200 text-sm md:text-base leading-relaxed">
                לא ניתן לקצר את תקופת הפירסום שנבחרה ושולמה מראש, אלא אם מדובר
                בסיבות כח עליון חריגות - אז ניתן לפנות למערכת יוצאים לחירות.
            </p>
        </section>

        <!-- אחריות המפרסם -->
        <div class="mx-8 md:mx-12 border-t border-[#3b5794]"></div>
        <section class="p-6 md:p-8">
            <h2 class="text-xl font-black text-white mb-3">4. אחריות המפרסם לתוכן</h2>
            <ul class="space-y-2">
                <li class="text-sm md:text-base text-gray-200 flex items-start gap-2 leading-relaxed">
                    <span class="text-green-400 flex-shrink-0">✓</span>
                    התוכן, התמונות והמחירים שבמודעה הם באחריותכם המלאה — נכונותם, עדכניותם וזכויות השימוש בהם.
                </li>
                <li class="text-sm md:text-base text-gray-200 flex items-start gap-2 leading-relaxed">
                    <span class="text-green-400 flex-shrink-0">✓</span>
                    האתר אינו צד לעסקה בינכם לבין הגולשים, ואינו אחראי למוצר, לשירות או לתוצאותיהם.
                </li>
                <li class="text-sm md:text-base text-gray-200 flex items-start gap-2 leading-relaxed">
                    <span class="text-green-400 flex-shrink-0">✓</span>
                    פרסום מודעה אינו המלצה של האתר על העסק המפרסם.
                </li>
            </ul>
        </section>

        <!-- מיקום והצגה -->
        <div class="mx-8 md:mx-12 border-t border-[#3b5794]"></div>
        <section class="p-6 md:p-8">
            <h2 class="text-xl font-black text-white mb-3">5. מיקום והצגה</h2>
            <p class="text-gray-200 text-sm md:text-base leading-relaxed">
                המודעות מוצגות במחזור בטור הפרסומות בדסקטופ ובפרסומת מסך-מלא
                בנייד. המערכת אינה מתחייבת למספר חשיפות, לסדר הצגה או למיקום
                קבוע, ורשאית לשנות את עיצוב האתר ואת מיקומי הפרסום. תקלה טכנית
                קצרה אינה נחשבת הפסקת פרסום; הפסקה ממושכת תזכה בהארכה מקבילה של
                התקופה.
            </p>
        </section>

        <!-- שינויים והסרה -->
        <div class="mx-8 md:mx-12 border-t border-[#3b5794]"></div>
        <section class="p-6 md:p-8">
            <h2 class="text-xl font-black text-white mb-3">6. שינויים והסרה</h2>
            <p class="text-gray-200 text-sm md:text-base leading-relaxed">
                עדכון פרטים במודעה פעילה (טלפון, שעות, מוצרים) — פונים למערכת
                והשינוי ייכנס אחרי אישור. מודעה שמפרה את התנאים תוסר גם באמצע
                התקופה וללא החזר, ובמקרה של הפרה חמורה נשמרת הזכות לסרב לפרסום
                נוסף.
            </p>
        </section>

        <!-- יצירת קשר -->
        <div class="mx-8 md:mx-12 border-t border-[#3b5794]"></div>
        <section class="p-6 md:p-8 text-center">
            <p class="text-amber-300 font-black text-lg mb-4">בהצלחה 🍀</p>
            <p class="text-sm text-gray-300 leading-relaxed">
                לשאלות, שינויים או פנייה בסיבות כח עליון:
                <a href={"mailto:" + email} class="underline hover:text-white transition-colors" dir="ltr">{email}</a>
                <br />
                מערכת <a href={contactUrl} target="_blank" rel="noopener noreferrer" class="underline hover:text-white transition-colors">יוצאים לחירות</a>
            </p>
            <a
                href="/advertise/builder"
                class="mt-6 inline-block rounded-2xl bg-gradient-to-r from-amber-500 to-pink-600 px-8 py-4 font-black text-white text-lg shadow-xl transition hover:opacity-90 hover:scale-[1.02]"
            >
                🎨 לעיצוב הפרסומת
            </a>
        </section>

    </div>
</div>
