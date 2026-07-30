<script lang="ts">
    import { locale } from 'svelte-i18n';
    import { onMount } from 'svelte';

    // משתמש מחובר (מגיע מ-+layout.server דרך +layout.svelte); null = אנונימי
    let {
        user = null,
        visitors = null
    }: {
        user?: { name: string; email: string } | null;
        visitors?: { count: number; label: string } | null;
    } = $props();

    // מוצג רק כשיש נתון אמיתי מ-GA (אין מספרים מזויפים). count מעוצב עם מפריד אלפים.
    const visitorText = $derived(
        visitors && visitors.count > 0
            ? new Intl.NumberFormat('he-IL').format(visitors.count)
            : null
    );

    let languages = [
        { name: "עברית", code: "he", flag: "il" },
        { name: "English", code: "en", flag: "us" },
        { name: "русский", code: "ru", flag: "ru" },
    ];

    let showLangDropdown = $state(false);

    function changeLang(code: string) {
        locale.set(code);
        try { localStorage.setItem('lang', code); } catch {}
        showLangDropdown = false;
    }

    onMount(() => {
        try {
            const saved = localStorage.getItem('lang');
            if (saved) locale.set(saved);
        } catch {}
        document.addEventListener('click', (e) => {
            if (!(e.target as HTMLElement).closest('.lang-dropdown')) {
                showLangDropdown = false;
            }
        });
    });
</script>

<header
    class="site-header sticky top-0 z-50 shadow-lg backdrop-blur-lg"
>
    <div class="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">

        <!-- Mobile -->
        <div class="md:hidden flex items-center justify-between h-[56px]">
            <a href="/" class="flex items-center gap-2 min-w-0 flex-1">
                <div class="h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden bg-white border-[3px] border-[#D4AF37] shadow-[0_0_0_1px_rgba(212,175,55,0.25)]">
                    <img
                        src="/images/לוגו-הגמח-הארצי.png"
                        alt="הגמח הארצי לוגו"
                        class="w-full h-full object-contain"
                    />
                </div>
                <!-- הכיתובים חייבים להופיע במלואם ולא להיחתך: whitespace-nowrap בלי truncate,
                     והכפתורים שמימין הוקטנו כדי לפנות להם את הרוחב הדרוש. -->
                <div class="min-w-0">
                    <!-- שם המותג בכותרת הוא <p> ולא <h1>: ה-h1 שייך לכותרת הייחודית של כל דף
                         (שם הגמ"ח בדף גמ"ח, כותרת המאגר בדף הבית). h1 גלובלי זהה בכל
                         הדפים היה מטשטש לגוגל במה כל דף עוסק. -->
                    <p class="hdr-brand-title whitespace-nowrap bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text font-black text-transparent leading-tight">
                        הגמ"ח הארצי
                    </p>
                    <p class="hdr-brand-sub whitespace-nowrap text-gray-100 leading-tight">כל הגמחים בארץ בכף ידך</p>
                </div>
            </a>
            <div class="flex flex-shrink-0 items-center gap-1">
                <!-- אין כאן כפתור ניהול — הפאנל פרוס בתוך האזור האישי (/profile) -->
                <!-- מידע (ימין) — דף ההסבר: מהות האתר, מה יש במאגר ושאלות נפוצות -->
                <!-- בלי מסגרת/רקע: אייקון בלבד, כדי לא להתחרות בכפתורי הפעולה -->
                <a
                    href="/info"
                    class="flex items-center justify-center w-7 h-7 text-white/90 hover:text-white transition-colors"
                    aria-label="מידע על האתר"
                    title="מידע"
                >
                    <svg class="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" /><path d="M12 16.5v-5" /><path d="M12 8h.01" />
                    </svg>
                </a>
                <!-- Language — דגל קטן ובלי מסגרת -->
                <div class="relative lang-dropdown">
                    <button
                        onclick={() => showLangDropdown = !showLangDropdown}
                        class="flex items-center justify-center w-7 h-7 opacity-90 hover:opacity-100 transition-opacity"
                        aria-label="בחר שפה"
                    >
                        <span class="fi fi-{languages.find(l => l.code === $locale || $locale?.startsWith(l.code))?.flag || 'il'}" style="font-size:1.05rem"></span>
                    </button>
                    {#if showLangDropdown}
                        <div class="absolute right-0 mt-2 w-36 rounded-lg bg-[#1c2f5a] border border-[#3b5794] shadow-xl z-50">
                            {#each languages as lang}
                                <button
                                    class="flex w-full items-center gap-3 px-3 py-2 text-white hover:bg-[#213569] transition-colors"
                                    onclick={() => changeLang(lang.code)}
                                >
                                    <span class="fi fi-{lang.flag}" style="font-size:1.1rem"></span>
                                    <span class="text-sm">{lang.name}</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
                <!-- הוספת גמ"ח (אמצע) -->
                <a
                    href="/gemach/add"
                    class="flex h-8 items-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-2 text-[11px] font-bold text-white shadow-lg transition-opacity hover:opacity-90"
                    title="הוספת גמ&quot;ח"
                >
                    + גמ"ח
                </a>
                <!-- התחברות / אזור אישי (שמאל) -->
                {#if user}
                    <a
                        href="/profile"
                        class="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1c2f5a] hover:bg-[#2a4379] transition-colors"
                        aria-label="האזור האישי שלי"
                        title={user.name || user.email}
                    >
                        <span class="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-pink-600 text-[10px]" aria-hidden="true">👤</span>
                    </a>
                {:else}
                    <a
                        href="/login?redirect=/profile"
                        class="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 text-white transition-colors"
                        aria-label="התחברות / אזור אישי"
                        title="התחברות"
                    >
                        <span class="text-xs" aria-hidden="true">👤</span>
                    </a>
                {/if}
            </div>
        </div>

        <!-- Desktop -->
        <div class="hidden md:flex items-center justify-between py-1">
            <!-- Logo + Title -->
            <a href="/" class="brand-link flex items-center gap-4">
                <div class="brand-logo-frame h-20 w-20 rounded-xl overflow-hidden bg-white shadow-lg border-[3px] border-[#D4AF37] shadow-[0_0_0_1px_rgba(212,175,55,0.3),0_10px_15px_-3px_rgba(0,0,0,0.1)]">
                    <img
                        src="/images/לוגו-הגמח-הארצי.png"
                        alt="הגמח הארצי לוגו"
                        class="brand-logo w-full h-full object-contain"
                    />
                </div>
                <div class="brand-text">
                    <p class="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-3xl font-black text-transparent">
                        הגמ"ח הארצי
                    </p>
                    <p class="text-gray-100 text-base font-bold">
                        כל הגמחים בארץ בכף ידך
                    </p>
                </div>
            </a>

            <!-- Right side controls -->
            <div class="flex items-center gap-3">
                <!-- מונה גולשים (נתון אמיתי מ-GA; מוצג רק אם קיים) -->
                {#if visitorText}
                    <div class="flex items-center gap-2 bg-[#16264d] px-3 py-2 rounded-lg border border-blue-500/30" title="לפי Google Analytics, מתעדכן פעם ביום">
                        <span class="text-green-400 text-lg" aria-hidden="true">●</span>
                        <span class="text-white text-sm font-bold">{visitorText}</span>
                        <span class="text-gray-300 text-sm">{visitors?.label}</span>
                    </div>
                {/if}

                <!-- אין כאן כפתור ניהול — הפאנל פרוס בתוך האזור האישי (/profile) -->

                <!-- מידע — דף ההסבר: מהות האתר, מה יש במאגר ושאלות נפוצות -->
                <a
                    href="/info"
                    class="flex items-center gap-2 rounded-lg bg-[#1c2f5a] hover:bg-[#2a4379] px-3 py-2 text-sm font-bold text-white transition-colors"
                    title="מידע על האתר"
                >
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" /><path d="M12 16.5v-5" /><path d="M12 8h.01" />
                    </svg>
                    <span>מידע</span>
                </a>

                <!-- Language -->
                <div class="relative lang-dropdown">
                    <button
                        onclick={() => showLangDropdown = !showLangDropdown}
                        class="flex items-center gap-2 rounded-lg bg-[#1c2f5a] hover:bg-[#2a4379] px-3 py-2 text-white transition-colors"
                        aria-label="בחר שפה"
                    >
                        <span class="fi fi-{languages.find(l => l.code === $locale || $locale?.startsWith(l.code))?.flag || 'il'}" style="font-size:1.3rem"></span>
                        <span class="text-sm">{languages.find(l => l.code === $locale || $locale?.startsWith(l.code))?.name || 'עברית'}</span>
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </button>
                    {#if showLangDropdown}
                        <div class="absolute right-0 mt-2 w-40 rounded-lg bg-[#1c2f5a] border border-[#3b5794] shadow-xl z-50">
                            {#each languages as lang}
                                <button
                                    class="flex w-full items-center gap-3 px-4 py-2 text-white hover:bg-[#213569] transition-colors"
                                    onclick={() => changeLang(lang.code)}
                                >
                                    <span class="fi fi-{lang.flag}" style="font-size:1.2rem"></span>
                                    <span class="text-sm">{lang.name}</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Add Gemach button (אמצע) -->
                <a
                    href="/gemach/add"
                    class="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-lg"
                >
                    + הוסף גמח
                </a>

                <!-- התחברות / אזור אישי (שמאל) -->
                {#if user}
                    <a
                        href="/profile"
                        class="flex items-center gap-2 rounded-lg bg-[#1c2f5a] hover:bg-[#2a4379] px-3 py-2 text-sm font-bold text-white transition-colors"
                        title="האזור האישי שלי"
                    >
                        <span class="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-pink-600 text-xs">👤</span>
                        <span class="hidden sm:inline max-w-[120px] truncate">{user.name || user.email}</span>
                    </a>
                {:else}
                    <a
                        href="/login?redirect=/profile"
                        class="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 px-3 py-2 text-sm font-bold text-white transition-all"
                    >
                        <span aria-hidden="true">👤</span>
                        <span class="hidden sm:inline">התחברות</span>
                    </a>
                {/if}
            </div>
        </div>
    </div>
</header>

<style>
    /* רקע ההדר: דעיכה חלקה מסגול מלא למעלה עד שקוף לגמרי למטה,
       כדי שההדר יימזג ברכות אל רקע הדף בלי קו חד.
       במקום גבול כחול מלא — זוהַר כחול רך ומטושטש שנמוג בקצוות ומטה,
       כך שהמעבר נראה מדורג ולא כקו צבע פתאומי. */
    .site-header {
        background: linear-gradient(
            to bottom,
            rgba(135, 75, 144, 0.95) 0%,
            rgba(135, 75, 144, 0.92) 20%,
            rgba(135, 75, 144, 0.85) 38%,
            rgba(135, 75, 144, 0.74) 54%,
            rgba(135, 75, 144, 0.58) 68%,
            rgba(135, 75, 144, 0.40) 80%,
            rgba(135, 75, 144, 0.22) 90%,
            rgba(135, 75, 144, 0.08) 96%,
            rgba(135, 75, 144, 0) 100%
        );
    }
    .site-header::after {
        content: "";
        position: absolute;
        inset-inline: 6%;
        bottom: -5px;
        height: 12px;
        background: radial-gradient(
            ellipse at center,
            rgba(59, 130, 246, 0.38),
            rgba(59, 130, 246, 0) 72%
        );
        filter: blur(3px);
        pointer-events: none;
    }

    /* שם המותג והסלוגן בנייד — נגזרים מרוחב המסך כדי להיכנס במלואם בשורה אחת
       גם במסכים צרים, בלי חיתוך ובלי גלישה. הגבול העליון הוא הגודל המקורי. */
    .hdr-brand-title {
        font-size: clamp(14px, 4.4vw, 17px);
    }
    .hdr-brand-sub {
        font-size: clamp(9px, 2.9vw, 11px);
    }
    @media (min-width: 768px) {
        .hdr-brand-title,
        .hdr-brand-sub {
            font-size: unset;
        }
    }

    .brand-logo-frame {
        transition: scale 300ms ease;
    }
    .brand-logo {
        transition: scale 300ms ease;
    }
    .brand-text {
        transform-origin: right center;
        transition: scale 300ms ease, opacity 300ms ease;
    }
    .brand-link:hover .brand-logo-frame {
        scale: 1.06;
    }
    .brand-link:hover .brand-logo {
        scale: 1.2;
    }
    .brand-link:hover .brand-text {
        scale: 1.08;
        opacity: 0.95;
    }
</style>
