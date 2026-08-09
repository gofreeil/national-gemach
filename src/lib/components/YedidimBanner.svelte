<script lang="ts">
    // ============================================================
    // YedidimBanner.svelte — הבאנר של "ידידים – סיוע בדרכים"
    // בקטגוריית הרכב.
    // ------------------------------------------------------------
    // באותה מידה ובאותה שפה של GemachCard/AvedotBanner: משטח כהה,
    // לוגו הארגון בצד ופרטים מימין. בשונה מפינת האבדות — כאן העיקר
    // הוא החיוג: מי שתקוע בצד הדרך צריך כפתור אחד, לא מסע ניווט.
    // ולכן הבאנר אינו עוגן אחד גדול אלא כרטיס עם שתי פעולות.
    // מסומן "ארגון מתנדבים · חינם" ואינו עובר ב-adGate — שירות, לא פרסומת.
    // ============================================================
    const PHONE = '1230';
    const SITE = 'https://yedidim-il.org';
</script>

<article class="rounded-2xl border border-[#3b5794] bg-[#16264d] p-4 transition-all hover:border-[#4c6cb0] hover:bg-[#1e3260]">
    <div class="flex items-start gap-3.5">
        <!-- הלוגו הרשמי על משטח לבן — הסמל צבעוני ונבלע על רקע כהה -->
        <div class="grid h-20 w-20 flex-shrink-0 place-items-center rounded-xl bg-white p-1.5">
            <img
                src="/images/yedidim.png"
                alt='לוגו ארגון "ידידים – סיוע בדרכים"'
                width="200"
                height="200"
                loading="lazy"
                class="h-full w-full object-contain"
            />
        </div>

        <div class="min-w-0 flex-1">
            <h3 class="text-lg font-black leading-tight text-white">ידידים – סיוע בדרכים</h3>

            <div class="mt-1 flex flex-wrap items-center gap-2">
                <span class="rounded-full border border-emerald-500/30 bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300">
                    ארגון מתנדבים · ללא תשלום
                </span>
                <span class="text-xs text-gray-400">📍 כל הארץ · 24 שעות (למעט שבת וחג)</span>
            </div>

            <p class="mt-2 text-sm leading-relaxed text-gray-300">
                ילד שננעל ברכב, גלגל תקר, רכב שלא מניע, חילוץ מבוץ או תקיעה במעלית —
                65,000 מתנדבים בכל הארץ מגיעים לעזור, בחינם.
            </p>
        </div>
    </div>

    <!-- החיוג הוא הפעולה הראשית: לחיצה אחת פותחת את החייגן עם 1230 -->
    <div class="mt-3.5 flex flex-wrap items-center gap-2">
        <a
            href="tel:{PHONE}"
            class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-green-500"
        >
            <span aria-hidden="true">📞</span>
            חיוג למוקד {PHONE}
        </a>
        <a
            href={SITE}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-xl border border-[#3b5794] bg-[#1c2f5a] px-4 py-2.5 text-sm font-bold text-gray-100 transition-colors hover:bg-[#2a4379] hover:text-white"
        >
            לאתר הארגון <span aria-hidden="true">←</span>
        </a>
    </div>
</article>
