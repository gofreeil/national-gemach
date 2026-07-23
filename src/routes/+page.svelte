<script lang="ts">
    import { untrack } from 'svelte';
    import { cities, type Gemach } from '$lib/gemachData';
    import GemachAvatar from '$lib/components/GemachAvatar.svelte';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
    let gemachim = $derived(data.gemachim);
    let categories = $derived(data.categories);

    /** מספר הערים שבהן יש גמ"חים בפועל (לשורת הסטטיסטיקה) */
    let cityCount = $derived(new Set(gemachim.map(g => g.city)).size);

    /** גמ"חים שהאדמין נעץ (⭐ בפאנל הניהול) */
    let featuredGemachim = $derived(gemachim.filter(g => g.featured));
    /** החדשים שנוספו — בלי הנעוצים, כדי לא להציג פעמיים */
    let newestGemachim = $derived(gemachim.filter(g => !g.featured).slice(0, 6));

    let searchQuery = $state('');
    let selectedCategory = $state('');
    let selectedCity = $state('');
    let showResults = $state(false);

    /* ═══════════ מסילת הקטגוריות — דירוג ═══════════ */
    const OTHER_KEY = 'other';   // "אחר" תמיד אחרון, גם אם צבר הרבה
    const LEAD_COUNT = 3;        // כמה קטגוריות מקבלות מדליית זהב

    type RailCat = { key: string; label: string; icon: string; count: number; rank: number; lead: boolean };

    /** מונה גמ"חים לקטגוריה במעבר יחיד, במקום filter נפרד לכל אריח */
    let countByCat = $derived.by(() => {
        const m = new Map<string, number>();
        for (const g of gemachim) m.set(g.category, (m.get(g.category) ?? 0) + 1);
        return m;
    });

    /** המובילות ראשונות · שובר שוויון יציב לפי הסדר שנקבע בפאנל הניהול */
    let railCategories = $derived.by((): RailCat[] =>
        categories
            .map((cat, i) => ({ cat, i, count: countByCat.get(cat.key) ?? 0 }))
            .sort((a, b) =>
                (a.cat.key === OTHER_KEY ? 1 : 0) - (b.cat.key === OTHER_KEY ? 1 : 0) ||
                b.count - a.count ||
                a.i - b.i
            )
            .map((r, idx) => ({
                key: r.cat.key,
                label: r.cat.label,
                icon: r.cat.icon,
                count: r.count,
                rank: idx + 1,
                lead: idx < LEAD_COUNT && r.count > 0
            }))
    );

    /* ═══════════ מסילת הקטגוריות — גרירה וגלילה ═══════════ */
    const LOCK_PX = 10;          // דד-זון לנעילת ציר הגרירה
    const TAP_PX = 15;           // מעל זה זו גרירה ולא הקשה
    const GAP_PX = 12;           // חייב להתאים ל-gap של .cat-rail (0.75rem)
    const CLICK_GUARD_MS = 120;
    const CLICK_EXPIRE_MS = 400;

    let railEl = $state<HTMLUListElement | null>(null);
    let trackEl = $state<HTMLDivElement | null>(null);
    let rtl = $state(true);           // ברירת מחדל נכונה כבר ב-SSR (הדף כולו rtl)
    let dragging = $state(false);
    let hinted = $state(false);
    let overflowing = $state(false);
    let atStart = $state(true);
    let atEnd = $state(false);
    let progress = $state(0);         // 0..1
    let thumbRatio = $state(1);       // clientWidth / scrollWidth
    let hiddenCount = $state(0);      // כמה קטגוריות עוד מחכות קדימה
    let scrubbing = $state(false);    // גרירת ידית הסקראבר פעילה

    // לא-ריאקטיביים: לא מוצגים, ולכן אין טעם ב-$state
    let pointerId = -1;
    let thumbPointerId = -1, thumbGrab = 0;   // ידית הסקראבר: מזהה מצביע + היסט האחיזה בתוך הידית
    let isTouch = false;
    let axisLock: 'h' | 'v' | null = null;
    let startX = 0, startY = 0, startScroll = 0, maxMove = 0;
    let suppressClick = false, dragEndedAt = 0;
    let rafId = 0, nudged = false, tileStep = 0;
    let gapPx = GAP_PX, spacerPx = 32;   // נמדדים מה-DOM; הקבועים הם רק ברירת מחדל ל-SSR

    const prefersReduce = () =>
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /** קריאה יחידה של גאומטריית הגלילה — אדישה לסימן של scrollLeft ב-RTL */
    function readScroll() {
        const el = railEl;
        if (!el) return;
        const max = el.scrollWidth - el.clientWidth;
        const pos = Math.min(Math.abs(el.scrollLeft), Math.max(max, 0));
        // משתנה מקומי ולא קריאה חוזרת של atEnd: קריאת $state שנכתב זה עתה הייתה
        // הופכת את ה-$effect שקורא לפונקציה לתלוי בו, ומרכיבה מחדש את ה-ResizeObserver
        const isEnd = max <= 4 || pos >= max - 2;

        overflowing = max > 4;
        atStart = pos <= 2;                       // אפסילון נגד עיגול בזום/hi-dpi
        atEnd = isEnd;
        progress = max > 0 ? pos / max : 0;
        thumbRatio = el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1;
        // גלגלת/מקלדת/סרגל — תזוזה אמיתית מכבה את הרמז. הסף גבוה מ-36px של הנדנוד
        // האוטומטי, כדי שהרמז לא יכבה את עצמו
        if (pos > 48) hinted = true;

        // כל האריחים ברוחב זהה, ולכן די במדידת הראשון
        const first = el.querySelector<HTMLElement>('[data-tile]');
        if (first) tileStep = first.getBoundingClientRect().width + gapPx;
        const spacer = el.querySelector<HTMLElement>('[data-spacer]');
        if (spacer) spacerPx = spacer.getBoundingClientRect().width;

        // ספירה לפי מרחק הגלילה שנותר, לא לפי אינדקסים: אחרת המונה מגיע ל-0
        // בזמן שהאריח האחרון עדיין חתוך, והגלולה מציגה "עוד 0"
        if (tileStep > 0 && !isEnd) {
            const remaining = max - pos - spacerPx - gapPx;
            hiddenCount = Math.max(0, Math.ceil(remaining / tileStep));
        } else {
            hiddenCount = 0;
        }
    }

    /** onscroll יורה בתדר פריים — חנק ב-rAF כדי לא לכתוב 6 ערכי state בכל פריים */
    function scheduleRead() {
        if (rafId) return;
        rafId = requestAnimationFrame(() => { rafId = 0; readScroll(); });
    }

    $effect(() => {
        const el = railEl;
        if (!el) return;
        const cs = getComputedStyle(el);
        rtl = cs.direction === 'rtl';
        gapPx = parseFloat(cs.columnGap) || GAP_PX;
        untrack(readScroll);       // המדידה לא אמורה לחבר את ה-effect לערכים שהיא כותבת
        const ro = new ResizeObserver(readScroll);
        ro.observe(el);
        return () => { ro.disconnect(); if (rafId) cancelAnimationFrame(rafId); rafId = 0; };
    });

    /** הרשימה השתנתה (עריכה בפאנל הניהול) — למדוד מחדש בלי לתלות בכך את ה-effect שלמעלה */
    $effect(() => { void railCategories.length; untrack(readScroll); });

    /** נדנוד חד-פעמי "אני זזה" — פעם אחת ב-session, ולא כשמבקשים פחות תנועה */
    $effect(() => {
        const el = railEl;
        if (!el || !overflowing || nudged) return;
        nudged = true;
        if (prefersReduce()) return;
        try {
            if (sessionStorage.getItem('catRailHinted')) return;
            sessionStorage.setItem('catRailHinted', '1');
        } catch { return; }                        // Safari במצב פרטי זורק
        const s = rtl ? -1 : 1;                    // "קדימה" ב-RTL = דלתא שלילית
        const t1 = setTimeout(() => el.scrollBy({ left: s * 36, behavior: 'smooth' }), 700);
        const t2 = setTimeout(() => el.scrollBy({ left: -s * 36, behavior: 'smooth' }), 1250);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    });

    /* גרירה: עכבר/עט מנוהלים ב-JS; מגע נשאר נטיבי כדי לשמור על מומנטום אמיתי */
    function onRailPointerDown(e: PointerEvent) {
        suppressClick = false;
        if (e.button > 0) return;
        pointerId = e.pointerId;
        isTouch = e.pointerType === 'touch';
        startX = e.clientX; startY = e.clientY;
        startScroll = railEl ? railEl.scrollLeft : 0;
        maxMove = 0; axisLock = null; dragging = false;
        hinted = true;
    }

    function onRailPointerMove(e: PointerEvent) {
        if (e.pointerId !== pointerId || !railEl) return;
        // הכפתור שוחרר מחוץ לחלון ולא קיבלנו pointerup — אחרת המסילה נדבקת לסמן
        if (e.pointerType !== 'touch' && e.buttons === 0) { endPointer(e, true); return; }
        const dx = e.clientX - startX, dy = e.clientY - startY;
        maxMove = Math.max(maxMove, Math.abs(dx));
        if (isTouch) return;                       // הדפדפן גולל; אנחנו רק סופרים תזוזה

        if (axisLock === null) {
            if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
            axisLock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
            if (axisLock === 'v') { pointerId = -1; return; }   // מחווה אנכית — משחררים לתמיד
            dragging = true;
            railEl.setPointerCapture(e.pointerId);
        }
        e.preventDefault();
        railEl.scrollLeft = startScroll - dx;      // דלתא יחסית בלבד ⇒ נכון בכל דפדפן, בשני הכיוונים
    }

    function endPointer(e: PointerEvent, cancelled: boolean) {
        if (e.pointerId !== pointerId) return;
        // dragging ולא רק maxMove: גרירת עכבר מתחילה כבר ב-LOCK_PX (10px), ובלעדיו
        // גרירה של 10—15px הייתה מסתיימת בבחירת קטגוריה
        if (cancelled || dragging || maxMove > TAP_PX) { suppressClick = true; dragEndedAt = performance.now(); }
        if (dragging && railEl?.hasPointerCapture(e.pointerId)) railEl.releasePointerCapture(e.pointerId);
        dragging = false; axisLock = null; pointerId = -1;
        readScroll();
    }
    function onRailPointerUp(e: PointerEvent) { endPointer(e, false); }
    function onRailPointerCancel(e: PointerEvent) { endPointer(e, true); }
    function onRailLostCapture(e: PointerEvent) { endPointer(e, true); }

    /** בולם את ה-click שנורה בסוף גרירה. שלב ה-capture על האב רץ לפני היעד,
        וגם לפני ה-delegation של Svelte שיושב על שורש האפליקציה בשלב ה-bubble. */
    function onRailClickCapture(e: MouseEvent) {
        if (!suppressClick) return;
        suppressClick = false;
        if (e.detail === 0) return;                                    // Enter/Space מהמקלדת — לא לבלוע
        if (performance.now() - dragEndedAt > CLICK_EXPIRE_MS) return; // דגל ישן — לא לבלוע
        e.stopPropagation();
        e.preventDefault();
    }

    /** dir=1 → קדימה ברשימה (חשיפת הבאות) · dir=-1 → חזרה למובילות */
    function nudge(dir: 1 | -1) {
        const el = railEl;
        if (!el) return;
        hinted = true;
        const step = Math.max(180, el.clientWidth * 0.8);
        el.scrollBy({ left: (rtl ? -1 : 1) * dir * step, behavior: prefersReduce() ? 'auto' : 'smooth' });
    }

    /* ── ידית הסקראבר: גרירה פרופורציונלית שמזיזה את המסילה ──────────────
       ptrInline נמדד מקצה ה-inline-start (מימין ב-RTL) — בדיוק כמו שממקם
       ה-CSS את הידית — ולכן אותו מיפוי עובד זהה בשני הכיוונים. scrollLeft
       חיובי ב-LTR ושלילי ב-RTL, כמוסכמת הדפדפנים המודרנית שבה משתמש nudge. */
    function scrubTo(clientX: number) {
        const el = railEl, track = trackEl;
        if (!el || !track) return;
        const rect = track.getBoundingClientRect();
        const trackW = rect.width;
        const max = el.scrollWidth - el.clientWidth;
        if (trackW <= 0 || max <= 0) return;
        const thumbW = Math.min(trackW, (el.clientWidth / el.scrollWidth) * trackW);
        const travel = trackW - thumbW;
        if (travel <= 0) return;
        const ptrInline = rtl ? rect.right - clientX : clientX - rect.left;
        const start = Math.max(0, Math.min(travel, ptrInline - thumbGrab));
        el.scrollLeft = (rtl ? -1 : 1) * (start / travel) * max;
        readScroll();     // עדכון מיידי של --p/--ratio כדי שהידית תדבק לאצבע
    }

    function onThumbPointerDown(e: PointerEvent) {
        if (e.button > 0) return;
        const el = railEl, track = trackEl;
        if (!el || !track) return;
        const rect = track.getBoundingClientRect();
        const trackW = rect.width;
        if (trackW <= 0 || el.scrollWidth - el.clientWidth <= 0) return;
        const thumbW = Math.min(trackW, (el.clientWidth / el.scrollWidth) * trackW);
        const travel = trackW - thumbW;
        if (travel <= 0) return;
        const ptrInline = rtl ? rect.right - e.clientX : e.clientX - rect.left;
        const thumbStart = Math.max(0, Math.min(1, progress)) * travel;
        // לחיצה על הידית → אחיזה יחסית (בלי קפיצה); לחיצה על המסילה → מרכוז הידית תחת המצביע
        thumbGrab = ptrInline >= thumbStart && ptrInline <= thumbStart + thumbW
            ? ptrInline - thumbStart
            : thumbW / 2;
        thumbPointerId = e.pointerId;
        scrubbing = true;
        hinted = true;
        track.setPointerCapture(e.pointerId);
        e.preventDefault();
        scrubTo(e.clientX);
    }

    function onThumbPointerMove(e: PointerEvent) {
        if (e.pointerId !== thumbPointerId) return;
        e.preventDefault();
        scrubTo(e.clientX);
    }

    function endThumb(e: PointerEvent) {
        if (e.pointerId !== thumbPointerId) return;
        if (trackEl?.hasPointerCapture(e.pointerId)) trackEl.releasePointerCapture(e.pointerId);
        thumbPointerId = -1;
        scrubbing = false;
    }

    function onRailKeydown(e: KeyboardEvent) {
        const el = railEl;
        if (!el || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        const tiles = Array.from(el.querySelectorAll<HTMLElement>('[data-tile]'));
        const i = tiles.indexOf(document.activeElement as HTMLElement);
        if (i === -1) return;
        const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';                  // ב-RTL שמאלה = הבא
        const next = e.key === 'Home' ? 0
                   : e.key === 'End' ? tiles.length - 1
                   : e.key === fwd ? Math.min(i + 1, tiles.length - 1)
                   : Math.max(i - 1, 0);
        if (next === i) return;
        e.preventDefault();
        hinted = true;
        tiles[next].focus();     // הדפדפן גולל פנימה; scroll-padding שומר על טבעת הפוקוס
    }

    function pick(key: string, e?: MouseEvent) {
        // חגורה שנייה מעל onclickcapture; Enter/Space מהמקלדת (detail=0) פטורים ממנה
        if (e?.detail !== 0 && performance.now() - dragEndedAt < CLICK_GUARD_MS) return;
        selectedCategory = key;
        doSearch();
    }

    let filteredGemachim = $derived.by(() => {
        const q = searchQuery.trim().toLowerCase();
        return gemachim.filter(g => {
            const matchesQuery = !q || (
                g.name.toLowerCase().includes(q) ||
                g.description.toLowerCase().includes(q) ||
                g.tags.some(t => t.toLowerCase().includes(q)) ||
                g.city.toLowerCase().includes(q) ||
                (g.neighborhood?.toLowerCase().includes(q) ?? false) ||
                (g.contact?.toLowerCase().includes(q) ?? false) ||
                (g.notes?.toLowerCase().includes(q) ?? false)
            );
            const cityQ = selectedCity.trim();
            const matchesCategory = !selectedCategory || g.category === selectedCategory;
            const matchesCity = !cityQ || g.city.includes(cityQ);
            return matchesQuery && matchesCategory && matchesCity;
        });
    });

    function doSearch() {
        showResults = true;
    }

    function handleKey(e: KeyboardEvent) {
        if (e.key === 'Enter') doSearch();
    }

    function clearFilters() {
        searchQuery = '';
        selectedCategory = '';
        selectedCity = '';
        showResults = false;
    }

    function getCategoryLabel(key: string) {
        return categories.find(c => c.key === key)?.label ?? key;
    }

</script>

<!-- Hero Section -->
<section class="text-center py-6 md:py-8 px-4">
    <div class="flex items-center justify-center gap-4 md:gap-6 mb-5">
        <div class="h-40 w-40 md:h-52 md:w-52 flex-shrink-0 rounded-2xl overflow-hidden bg-white shadow-xl border-[3px] border-[#D4AF37] shadow-[0_0_0_1px_rgba(212,175,55,0.3),0_25px_50px_-12px_rgba(0,0,0,0.25)]">
            <img
                src="/images/logo.png"
                alt="הגמח הארצי לוגו"
                class="w-full h-full object-cover scale-[1.15]"
                style="object-position: center; translate: 0 4%;"
            />
        </div>

        <!-- סטטיסטיקות חיות — נגזרות מהנתונים בפועל (לא מוקאפ), צמודות ללוגו.
             באנר כהה אחד, שלושת הנתונים זה מתחת לזה, מופרדים בקו קצר שלא נוגע בשוליים. -->
        <div class="rounded-2xl bg-[#1c2f5a] border border-[#3b5794] shadow-md px-4 py-3 min-w-[112px]">
            <div class="text-center">
                <div class="text-xl md:text-2xl font-black text-blue-300 leading-tight">{gemachim.length}</div>
                <div class="text-[11px] md:text-xs font-semibold text-gray-300 leading-tight">גמחים רשומים</div>
            </div>
            <div class="mx-auto my-2 h-px w-3/5 bg-[#3b5794]" aria-hidden="true"></div>
            <div class="text-center">
                <div class="text-xl md:text-2xl font-black text-purple-300 leading-tight">{cityCount}</div>
                <div class="text-[11px] md:text-xs font-semibold text-gray-300 leading-tight">ערים</div>
            </div>
            <div class="mx-auto my-2 h-px w-3/5 bg-[#3b5794]" aria-hidden="true"></div>
            <div class="text-center">
                <div class="text-xl md:text-2xl font-black text-pink-300 leading-tight">{categories.length}</div>
                <div class="text-[11px] md:text-xs font-semibold text-gray-300 leading-tight">קטגוריות</div>
            </div>
        </div>
    </div>
    <h1 class="sr-only">הגמ"ח הארצי – כל הגמחים בארץ בכף ידך</h1>

    <!-- Search Bar -->
    <div class="max-w-2xl mx-auto">
        <div class="flex gap-2 mb-4">
            <input
                type="search"
                bind:value={searchQuery}
                onkeydown={handleKey}
                placeholder="חפש לפי שם, עניין או עיר..."
                aria-label="חיפוש גמחים"
                class="flex-1 rounded-xl bg-[#1c2f5a] border border-[#4c6cb0] text-white placeholder-gray-400 px-4 py-3 text-base focus:outline-none focus:border-blue-400 focus:bg-[#243a6e] transition-all"
            />
            <button
                onclick={doSearch}
                class="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
            >
                חפש 🔍
            </button>
        </div>

        <!-- Filters Row -->
        <div class="flex gap-3 flex-wrap justify-center">
            <select
                bind:value={selectedCategory}
                onchange={doSearch}
                aria-label="סנן לפי קטגוריה"
                class="rounded-xl bg-[#1c2f5a] border border-[#4c6cb0] text-white px-4 py-2 text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
            >
                <option value="">כל הקטגוריות</option>
                {#each categories as cat}
                    <option value={cat.key}>{cat.icon} {cat.label}</option>
                {/each}
            </select>

            <input
                type="text"
                bind:value={selectedCity}
                onchange={doSearch}
                onkeydown={handleKey}
                list="home-cities-list"
                placeholder="כל הערים — הקלד שם עיר"
                aria-label="סנן לפי עיר"
                class="w-48 rounded-xl bg-[#1c2f5a] border border-[#4c6cb0] text-white placeholder-gray-400 px-4 py-2 text-sm focus:outline-none focus:border-blue-400 focus:bg-[#243a6e] transition-all"
            />
            <datalist id="home-cities-list">
                {#each cities as city (city)}
                    <option value={city}></option>
                {/each}
            </datalist>

            {#if showResults || selectedCategory || selectedCity}
                <button
                    onclick={clearFilters}
                    class="rounded-xl bg-red-900/40 border border-red-500/30 text-red-300 px-4 py-2 text-sm hover:bg-red-900/60 transition-colors"
                >
                    נקה הכל ✕
                </button>
            {/if}
        </div>
    </div>
</section>

<!-- Results / Categories -->
{#if showResults || selectedCategory || selectedCity}
    <!-- Search Results -->
    <section class="px-2 md:px-4 pb-8" aria-label="תוצאות חיפוש">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold text-white">
                נמצאו <span class="text-blue-400">{filteredGemachim.length}</span> גמחים
            </h2>
        </div>

        {#if filteredGemachim.length === 0}
            <div class="text-center py-16 text-gray-400">
                <div class="text-5xl mb-4" aria-hidden="true">🔍</div>
                <p class="text-lg font-bold">לא נמצאו גמחים מתאימים</p>
                <p class="text-sm mt-2">נסה לחפש במילים אחרות או לשנות את הפילטרים</p>
                <button onclick={clearFilters} class="mt-4 px-6 py-2 rounded-xl bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 transition-colors">
                    נקה חיפוש
                </button>
            </div>
        {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {#each filteredGemachim as gemach (gemach.id)}
                    <article class="relative bg-[#16264d] border border-[#3b5794] rounded-2xl p-5 hover:bg-[#1e3260] hover:border-[#4c6cb0] transition-all">
                        <div class="flex items-start gap-3">
                            <div class="text-3xl flex-shrink-0 mt-0.5" aria-hidden="true">
                                <GemachAvatar {gemach} {categories} />
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="font-black text-white text-lg leading-tight">
                                    <a href="/gemach/{gemach.id}" class="after:absolute after:inset-0 after:content-[''] hover:text-blue-300 transition-colors">{gemach.name}</a>
                                </h3>
                                <div class="flex items-center gap-2 mt-1 flex-wrap">
                                    <span class="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                                        {getCategoryLabel(gemach.category)}
                                    </span>
                                    <span class="text-xs text-gray-400">
                                        📍 {gemach.city}{gemach.neighborhood ? ` – ${gemach.neighborhood}` : ''}
                                    </span>
                                </div>
                                <p class="text-gray-300 text-sm mt-2 leading-relaxed">{gemach.description}</p>
                                {#if gemach.contact}
                                    <p class="text-xs text-gray-400 mt-2">👤 {gemach.contact}</p>
                                {/if}
                                {#if gemach.notes}
                                    <p class="text-xs text-amber-300/80 mt-1">💬 {gemach.notes}</p>
                                {/if}
                                <div class="flex items-center gap-4 mt-3 flex-wrap">
                                    {#if gemach.phone}
                                        <a
                                            href="tel:{gemach.phone}"
                                            class="relative z-10 inline-flex items-center gap-2 text-sm font-bold text-green-400 hover:text-green-300 transition-colors"
                                            aria-label="התקשר ל{gemach.name}"
                                        >
                                            📞 {gemach.phone}
                                        </a>
                                    {/if}
                                    {#if gemach.link}
                                        <a
                                            href={gemach.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="relative z-10 inline-flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            🔗 קישור
                                        </a>
                                    {/if}
                                    <a href="/gemach/{gemach.id}" class="relative z-10 inline-flex items-center gap-1 text-sm font-bold text-gray-300 hover:text-white transition-colors">
                                        לפרטים ←
                                    </a>
                                </div>
                            </div>
                        </div>
                    </article>
                {/each}
            </div>
        {/if}
    </section>

{:else}
    <!-- מסילת הקטגוריות: המובילות ראשונות, השאר נחשפות בגרירה של השורה.
         גלישה ולא הסתרה — כל קטגוריה נשארת ב-DOM, בסדר ה-Tab ובעץ הנגישות. -->
    <section class="px-2 md:px-4 pb-8" aria-labelledby="cat-rail-title">
      <div class="mx-auto mb-10 max-w-4xl">

        <div class="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
            <div class="min-w-0">
                <h2 id="cat-rail-title" class="text-2xl font-black text-white">חפש לפי קטגוריה</h2>
                <!-- הרקע הוורוד לא נותן ניגודיות לטקסט שירות — לכן גלולה כהה, כמו באנר הסטטיסטיקה -->
                <p class="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#3b5794] bg-[#1c2f5a] px-3 py-1 text-[11px] font-semibold text-gray-200 shadow-md">
                    <span>גררו את השורה כדי לגלות עוד</span>
                    <span class="cat-hint-arrow" class:is-live={!hinted} aria-hidden="true">↔</span>
                </p>
            </div>

            <div class="flex shrink-0 items-center gap-2 {overflowing ? '' : 'invisible'}">
                <button
                    type="button"
                    class="cat-nav"
                    aria-controls="cat-rail"
                    aria-disabled={atStart}
                    aria-label="חזרה לקטגוריות המובילות"
                    onclick={() => { if (!atStart) nudge(-1); }}
                >
                    <svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true" fill="none"
                         stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d={rtl ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
                    </svg>
                </button>

                <!-- הגלולה היא גם המונה של מה שמוסתר וגם דרך הגישה ללא גרירה -->
                <button
                    type="button"
                    class="cat-nav cat-nav--pill"
                    aria-controls="cat-rail"
                    aria-disabled={atEnd}
                    aria-label={atEnd ? 'כל הקטגוריות מוצגות' : `הצג עוד ${hiddenCount} קטגוריות`}
                    onclick={() => { if (!atEnd) nudge(1); }}
                >
                    <svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true" fill="none"
                         stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d={rtl ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
                    </svg>
                    <span class="text-xs font-black tabular-nums" aria-hidden="true">
                        {atEnd ? 'הכל מוצג' : `עוד ${hiddenCount}`}
                    </span>
                </button>
            </div>
        </div>

        <p id="cat-rail-help" class="sr-only">
            רשימת קטגוריות נגללת לרוחב, מסודרת לפי מספר הגמחים. אפשר לגרור אותה,
            או לעבור בין הקטגוריות עם מקשי החצים ימינה ושמאלה, ומקשי Home ו-End.
        </p>

        {#snippet catTile(cat: RailCat)}
            <button
                type="button"
                data-tile
                class="cat-tile"
                class:is-lead={cat.lead}
                class:is-empty={cat.count === 0}
                onclick={(e) => pick(cat.key, e)}
                aria-label="חפש גמחי {cat.label} — {cat.count} גמחים"
            >
                {#if cat.lead}<span class="cat-rank" aria-hidden="true">{cat.rank}</span>{/if}

                <span class="cat-ico">
                    {#if cat.key === 'judaism'}
                        <img src="/icons/menorah.svg" alt="" draggable="false" class="h-9 w-9 object-contain" />
                    {:else}
                        <span class="text-3xl leading-none" aria-hidden="true">{cat.icon}</span>
                    {/if}
                </span>

                <span class="cat-label">{cat.label}</span>

                <span class="cat-count" aria-hidden="true">
                    {cat.count} גמחים
                </span>
            </button>
        {/snippet}

        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
            role="group"
            aria-labelledby="cat-rail-title"
            aria-describedby="cat-rail-help"
            onkeydown={onRailKeydown}
        >
            <ul
                id="cat-rail"
                bind:this={railEl}
                class="cat-rail"
                class:is-dragging={dragging}
                style="--f-l:{rtl ? (atEnd ? '0px' : '2rem') : (atStart ? '0px' : '2rem')}; --f-r:{rtl ? (atStart ? '0px' : '2rem') : (atEnd ? '0px' : '2rem')}"
                onscroll={scheduleRead}
                onpointerdown={onRailPointerDown}
                onpointermove={onRailPointerMove}
                onpointerup={onRailPointerUp}
                onpointercancel={onRailPointerCancel}
                onlostpointercapture={onRailLostCapture}
                onclickcapture={onRailClickCapture}
            >
                {#each railCategories as cat (cat.key)}
                    <li class="cat-item">{@render catTile(cat)}</li>
                {/each}
                <!-- מרווח סיום אמיתי: padding-inline-end נבלע בסקרולר flex, והוא חייב
                     להיות רחב כמו המסכה כדי שהאריח האחרון לא יישאר מעומעם -->
                <li class="cat-spacer" data-spacer aria-hidden="true"></li>
            </ul>
        </div>

        <!-- סקראבר פרופורציונלי ונגרר: רוחב הידית מקודד כמה מהרשימה מוסתר,
             וגרירתה שמאלה/ימינה מזיזה את הקטגוריות (לחיצה על המסילה = קפיצה). -->
        <div class="mt-2 flex justify-center {overflowing ? '' : 'invisible'}" aria-hidden="true">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                bind:this={trackEl}
                class="cat-track"
                class:is-scrubbing={scrubbing}
                style="--p:{progress}; --ratio:{thumbRatio}"
                onpointerdown={onThumbPointerDown}
                onpointermove={onThumbPointerMove}
                onpointerup={endThumb}
                onpointercancel={endThumb}
                onlostpointercapture={endThumb}
            >
                <span class="cat-thumb"></span>
            </div>
        </div>
      </div>

        {#snippet gemachCard(gemach: Gemach, pinned: boolean = false)}
            <article class="relative bg-[#16264d] border {pinned ? 'border-amber-500/30' : 'border-[#3b5794]'} rounded-2xl p-5 hover:bg-[#1e3260] hover:border-[#4c6cb0] transition-all">
                <div class="flex items-start gap-3">
                    <div class="text-3xl flex-shrink-0 mt-0.5" aria-hidden="true">
                        <GemachAvatar {gemach} {categories} />
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-black text-white text-lg leading-tight">
                            {#if pinned}<span class="text-amber-400 text-sm" aria-hidden="true">⭐</span> {/if}<a
                                href="/gemach/{gemach.id}" class="after:absolute after:inset-0 after:content-[''] hover:text-blue-300 transition-colors">{gemach.name}</a>
                        </h3>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            <span class="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                                {getCategoryLabel(gemach.category)}
                            </span>
                            <span class="text-xs text-gray-400">
                                📍 {gemach.city}{gemach.neighborhood ? ` – ${gemach.neighborhood}` : ''}
                            </span>
                        </div>
                        <p class="text-gray-300 text-sm mt-2 leading-relaxed line-clamp-2">{gemach.description}</p>
                        {#if gemach.phone}
                            <a
                                href="tel:{gemach.phone}"
                                class="relative z-10 inline-flex items-center gap-2 mt-3 text-sm font-bold text-green-400 hover:text-green-300 transition-colors"
                                aria-label="התקשר ל{gemach.name}"
                            >
                                📞 {gemach.phone}
                            </a>
                        {/if}
                    </div>
                </div>
            </article>
        {/snippet}

        <!-- Featured Gemachim — נעוצים ע"י האדמין (⭐ בפאנל הניהול) -->
        {#if featuredGemachim.length > 0}
            <h2 class="text-2xl font-black text-white text-center mb-6">גמחים מומלצים</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                {#each featuredGemachim as gemach (gemach.id)}
                    {@render gemachCard(gemach, true)}
                {/each}
            </div>
        {/if}

        <!-- Newest Gemachim -->
        <h2 class="text-2xl font-black text-white text-center mb-6">גמחים חדשים שנוספו</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each newestGemachim as gemach (gemach.id)}
                {@render gemachCard(gemach)}
            {/each}
        </div>

        <!-- CTA -->
        <div class="text-center mt-10 p-8 rounded-2xl bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/20">
            <div class="text-4xl mb-3" aria-hidden="true">➕</div>
            <h3 class="text-xl font-black text-white mb-2">יש לך גמח?</h3>
            <p class="text-gray-300 text-sm mb-4">הוסף אותו למאגר הארצי ועזור לאנשים למצוא אותך בקלות</p>
            <a
                href="https://community.gofreeil.com/gmachim/add"
                class="inline-block px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:opacity-90 transition-opacity shadow-lg"
            >
                הוסף גמח חינם
            </a>
        </div>
    </section>
{/if}

<!-- מעבר לרשימת כל הגמ"חים (עם עימוד, 20 בכל עמוד) — בסוף דף הבית -->
<section class="px-4 pb-14 pt-2 text-center">
    <a
        href="/gemachim"
        class="group inline-flex flex-col items-center gap-2 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-900/40 to-purple-900/40 px-8 py-6 transition-all hover:border-blue-400/60 hover:from-blue-900/60 hover:to-purple-900/60"
    >
        <h2 class="text-2xl md:text-3xl font-black text-white group-hover:text-blue-200 transition-colors">
            לכלל הגמ"חים ←
        </h2>
        <p class="text-sm text-gray-300">עיון בכל {gemachim.length} הגמ"חים במאגר, 20 בכל עמוד</p>
    </a>
</section>

<style>
    /* ═══ המסילה ═══ */
    .cat-rail {
        display: flex;
        gap: 0.75rem;                   /* חייב להתאים ל-GAP_PX בסקריפט */
        list-style: none;
        margin: 0;
        padding: 0.75rem 0.5rem 1rem;   /* טבעת הפוקוס הגלובלית היא 3px + 3px offset — 4px לא הספיקו */
        overflow-x: auto;
        overflow-y: hidden;
        overscroll-behavior-x: contain; /* בלי back-swipe של הדפדפן באייפון */
        -webkit-overflow-scrolling: touch;
        scroll-padding-inline: 2rem;    /* תואם בדיוק את רוחב המסכה */
        /* ה-snap מוגדר כאן ולא כ-utility, כדי שהעקיפה בגרירה תשב באותו מקור בקסקייד.
           scroll-behavior: smooth לא מוצהר בכוונה — הוא היה הופך כל גרירה למקרטעת. */
        scroll-snap-type: x proximity;
        cursor: grab;
        user-select: none;
        -webkit-user-select: none;
        scrollbar-width: none;
        -ms-overflow-style: none;
        /* דהייה בקצוות במסכה ולא בגרדיאנט צבוע — מאחור יושב הרקע הוורוד,
           וכל צבע קשיח היה נראה כמריחה */
        --cat-mask: linear-gradient(
            to right,
            transparent 0,
            #000 var(--f-l, 2rem),
            #000 calc(100% - var(--f-r, 2rem)),
            transparent 100%
        );
        -webkit-mask-image: var(--cat-mask);
        mask-image: var(--cat-mask);
    }
    .cat-rail::-webkit-scrollbar { display: none; }
    .cat-rail.is-dragging { cursor: grabbing; scroll-snap-type: none; scroll-behavior: auto; }
    .cat-rail.is-dragging .cat-tile { transition: none; }
    @media (hover: none) { .cat-rail { cursor: default; } }

    .cat-item { flex: 0 0 auto; scroll-snap-align: start; }
    .cat-spacer { flex: 0 0 2rem; }   /* ≥ רוחב המסכה, אחרת האריח האחרון נשאר מעומעם */

    /* ═══ אריח ═══ */
    .cat-tile {
        position: relative;
        width: clamp(7rem, 29vw, 8.5rem);   /* vw ⇒ ההצצה לאריח הבא מובטחת בכל רוחב מסך */
        min-height: 9.75rem;
        height: 100%;                       /* ה-li נמתח לגובה השורה; בלי זה תחתית האריחים מתפרעת */
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1rem 0.75rem;
        border-radius: 1rem;
        border: 1px solid #3b5794;
        background: linear-gradient(160deg, #1b2f5e 0%, #132342 55%, #0f1c37 100%);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 12px 26px -20px rgba(0, 0, 0, 0.95);
        transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        cursor: pointer;
        text-align: center;
    }
    /* אף צאצא לא יבלע pointermove ולא יתחיל drag-image */
    .cat-tile > * { pointer-events: none; }
    .cat-tile img { -webkit-user-drag: none; }

    /* hover רק במכשירים שיש בהם — אחרת הוא נדבק אחרי גרירה במסך מגע */
    @media (hover: hover) {
        .cat-rail:not(.is-dragging) .cat-tile:hover {
            transform: translateY(-4px);
            border-color: #5474b8;
            background: linear-gradient(160deg, #24407c 0%, #182c54 60%, #12203e 100%);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 18px 34px -20px rgba(0, 0, 0, 1);
        }
        .cat-rail:not(.is-dragging) .cat-tile.is-empty:hover { opacity: 1; }
    }
    /* אותה סגוליות כמו כלל ה-hover ואחריו בסדר המקורות, אחרת ההרמה גוברת על הלחיצה */
    .cat-rail:not(.is-dragging) .cat-tile:active { transform: translateY(-1px) scale(0.985); }

    .cat-tile.is-lead {
        border-color: rgba(212, 175, 55, 0.45);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09),
                    0 0 0 1px rgba(212, 175, 55, 0.14),
                    0 16px 32px -20px rgba(212, 175, 55, 0.55);
    }
    .cat-tile.is-empty { opacity: 0.72; }

    .cat-rank {
        position: absolute;
        top: 0.45rem;
        inset-inline-end: 0.55rem;      /* לוגי ⇒ נוחת בפינה הנכונה ב-RTL */
        display: grid;
        place-items: center;
        width: 1.2rem;
        height: 1.2rem;
        border-radius: 999px;
        font-size: 0.66rem;
        font-weight: 900;
        line-height: 1;
        color: #3a2a06;
        background: linear-gradient(145deg, #f3d68b, #d4af37);
        box-shadow: 0 2px 6px -2px rgba(212, 175, 55, 0.8);
    }
    .cat-ico { display: grid; place-items: center; min-height: 2.5rem; }
    .cat-label { font-size: 0.875rem; font-weight: 700; line-height: 1.15; color: #e5e7eb; }
    .cat-count {
        font-size: 0.6875rem;
        color: #9db4e6;
        padding: 0.1rem 0.5rem;
        border-radius: 999px;
        background: rgba(8, 17, 38, 0.75);
        box-shadow: inset 0 0 0 1px rgba(59, 87, 148, 0.9);
    }
    .cat-tile.is-lead .cat-count { color: #f0d089; box-shadow: inset 0 0 0 1px rgba(212, 175, 55, 0.35); }

    /* ═══ פקדי ניווט ═══ */
    .cat-nav {
        display: inline-grid;
        grid-auto-flow: column;
        align-items: center;
        gap: 0.35rem;
        place-items: center;
        min-width: 2.75rem;             /* יעד מגע נדיב בנייד */
        height: 2.75rem;
        padding: 0 0.5rem;
        border-radius: 999px;
        color: #dbe4fb;
        background: rgba(22, 38, 77, 0.92);
        border: 1px solid #3b5794;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 6px 16px -10px rgba(0, 0, 0, 0.9);
        cursor: pointer;
        transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
    }
    @media (min-width: 768px) { .cat-nav { min-width: 2.25rem; height: 2.25rem; } }
    /* לוגי ולא פיזי: ההתחלה היא צד החץ, הסוף הוא צד הטקסט */
    .cat-nav--pill { padding-block: 0; padding-inline: 0.6rem 0.85rem; color: #f0d089; }
    .cat-nav:hover { background: #213569; border-color: #5474b8; }
    /* aria-disabled ולא disabled — כדי לא לחטוף פוקוס ממשתמש מקלדת שהגיע לקצה */
    .cat-nav[aria-disabled='true'] { opacity: 0.35; cursor: default; }
    .cat-nav[aria-disabled='true']:hover { background: rgba(22, 38, 77, 0.92); border-color: #3b5794; }

    /* ═══ סקראבר ═══ */
    .cat-track {
        position: relative;
        width: min(22rem, 70%);
        height: 0.375rem;
        border-radius: 999px;
        background: #16264d;
        box-shadow: inset 0 0 0 1px #3b5794;
        cursor: pointer;
        touch-action: none;            /* גרירת-מגע מזיזה את המסילה, לא גוללת את הדף */
    }
    /* אזור-מגע גבוה יותר בלי לעבות את הפס הדק — קל לתפוס גם באצבע */
    .cat-track::before {
        content: '';
        position: absolute;
        inset: -0.7rem 0;
    }
    .cat-thumb {
        position: absolute;
        top: 0;
        bottom: 0;
        border-radius: 999px;
        width: calc(var(--ratio, 1) * 100%);
        /* inset-inline-start מודע-כיוון: ב-RTL זה היסט מימין ⇒ p=0 = המובילות */
        inset-inline-start: calc(var(--p, 0) * (100% - var(--ratio, 1) * 100%));
        background: linear-gradient(90deg, #d4af37, #7fa0e8);
        box-shadow: 0 0 10px -2px rgba(127, 160, 232, 0.7);
        cursor: grab;
    }
    .cat-track.is-scrubbing { cursor: grabbing; }
    .cat-track.is-scrubbing .cat-thumb { cursor: grabbing; filter: brightness(1.12); }

    /* ═══ רמז ═══ */
    .cat-hint-arrow { display: inline-block; }
    .cat-hint-arrow.is-live { animation: cat-hint 1.6s ease-in-out infinite; }
    @keyframes cat-hint {
        0%, 100% { transform: translateX(0); }
        50%      { transform: translateX(5px); }
    }

    /* הכלל הגלובלי ב-app.css מאפס רק משכי אנימציה — הוא לא מסיר transform שכבר הוחל */
    @media (prefers-reduced-motion: reduce) {
        .cat-hint-arrow, .cat-hint-arrow.is-live { animation: none !important; transform: none !important; }
        .cat-tile, .cat-tile:hover, .cat-tile:active { transform: none !important; }
        .cat-rail { scroll-behavior: auto !important; }
    }
</style>
