<script lang="ts">
    // ============================================================
    // AvedotBanner.svelte — הבאנר של "פינת האבדות" בקטגוריית
    // "מיזמים חשובים לציבור".
    // ------------------------------------------------------------
    //   1. זה מיזם ארצי של הרשת, לא פרסומת — ולכן הוא מסומן
    //      "מיזם ארצי · חינם" ולא עובר דרך adGate/adTrack.
    //   2. פריסה לרוחב (סימן + טקסט זה לצד זה) על משטח כהה — טקסט
    //      אפור ישירות על הרקע הוורוד אינו קריא.
    //   3. שלוש דרכי כניסה, בדיוק כמו בעמוד הבית של פינת האבדות:
    //      אבד לי · מצאתי · לאתר. הבאנר עצמו אינו קישור אחד גדול,
    //      כדי שהכפתורים לא יקוננו בתוך עוגן.
    // ============================================================
    const SITE = 'https://avedot.gofreeil.com';
</script>

<article
    class="relative overflow-hidden rounded-2xl border border-cyan-400/35 bg-[#0d1e3a] shadow-lg shadow-black/25 transition-colors hover:border-cyan-300/60"
>
    <!-- הילה רכה בפינה — נותנת לבאנר נפח בלי להוסיף קומה לדף -->
    <div
        class="pointer-events-none absolute -top-16 -end-16 h-48 w-48 rounded-full bg-cyan-400/10 blur-2xl"
        aria-hidden="true"
    ></div>

    <div class="relative flex flex-col items-center gap-4 p-4 text-center sm:flex-row sm:items-start sm:p-5 sm:text-start">
        <!-- הסימן: זכוכית מגדלת בגרדיאנט הזהות של פינת האבדות (#60a5fa → #22d3ee) -->
        <div
            class="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-400 text-[#08182e] shadow-lg shadow-cyan-500/25"
            aria-hidden="true"
        >
            <svg class="h-11 w-11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m20 20-4.9-4.9" />
            </svg>
        </div>

        <div class="min-w-0 flex-1">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[11px] font-bold text-cyan-200">
                <span aria-hidden="true">🌟</span> מיזם ארצי · חינם
            </span>

            <h3 class="mt-2 text-xl font-black leading-tight text-white sm:text-2xl">
                פינת האבדות הארצית
            </h3>

            <p class="mt-1.5 text-sm leading-relaxed text-gray-300">
                אבד לכם משהו? מצאתם חפץ ומחפשים את הבעלים? לוח אבידות ומציאות ארצי,
                פרסום וחיפוש חינם — ומסונכרן עם "קהילה בשכונה".
            </p>

            <div class="mt-3.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <a
                    href="{SITE}/add?type=lost"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1e3a]"
                >
                    <span aria-hidden="true">❓</span> אבד לי משהו
                </a>
                <a
                    href="{SITE}/add?type=found"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-gradient-to-r from-green-600 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1e3a]"
                >
                    <span aria-hidden="true">✅</span> מצאתי משהו
                </a>
                <a
                    href={SITE}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-cyan-400/40 px-5 py-2.5 text-sm font-bold text-cyan-200 transition-colors hover:bg-cyan-400/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1e3a]"
                >
                    avedot.gofreeil.com <span aria-hidden="true">←</span>
                </a>
            </div>
        </div>
    </div>
</article>
