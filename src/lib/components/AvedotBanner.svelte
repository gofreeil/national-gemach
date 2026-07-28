<script lang="ts">
    // ============================================================
    // AvedotBanner.svelte — הבאנר של "פינת האבדות" בקטגוריית
    // "מיזמים חשובים לציבור".
    // ------------------------------------------------------------
    // באנר רגיל, באותה מידה ובאותה שפה של GemachCard: משטח כהה,
    // טקסט מימין וסימן מלבני משמאל, וכל הבאנר הוא קישור אחד לאתר
    // (ולכן אין בפנים כפתורים שיקוננו בתוך עוגן).
    // מסומן "מיזם ארצי · חינם" ואינו עובר ב-adGate — שירות, לא פרסומת.
    // ============================================================
    const SITE = 'https://avedot.gofreeil.com';
</script>

<article class="rounded-2xl border border-[#3b5794] bg-[#16264d] transition-all hover:border-[#4c6cb0] hover:bg-[#1e3260]">
    <a
        href={SITE}
        target="_blank"
        rel="noopener noreferrer"
        class="group flex items-center gap-4 p-4"
    >
        <div class="min-w-0 flex-1">
            <h3 class="text-lg font-black leading-tight text-white transition-colors group-hover:text-cyan-300">
                פינת האבדות הארצית
            </h3>

            <div class="mt-1 flex flex-wrap items-center gap-2">
                <span class="rounded-full border border-cyan-500/30 bg-cyan-900/40 px-2 py-0.5 text-xs text-cyan-300">
                    מיזם ארצי · חינם
                </span>
                <span class="text-xs text-gray-400">📍 כל הארץ</span>
            </div>

            <p class="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-300">
                אבד לכם משהו? מצאתם חפץ ומחפשים את הבעלים? לוח אבידות ומציאות ארצי — פרסום וחיפוש חינם.
            </p>
            <p class="mt-2 text-xs font-bold text-cyan-300/90">avedot.gofreeil.com <span aria-hidden="true">←</span></p>
        </div>

        <!-- ב-RTL האיבר האחרון יושב בצד שמאל — שם הסימן, בגרדיאנט הזהות של פינת האבדות -->
        <div class="grid h-20 w-20 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 text-[#08182e]" aria-hidden="true">
            <svg class="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m20 20-4.9-4.9" />
            </svg>
        </div>
    </a>
</article>
