<script lang="ts">
    import { tick, untrack } from 'svelte';
    import { categoryKeys, cities } from '$lib/gemachData';
    import GemachCard from '$lib/components/GemachCard.svelte';
    import AvedotBanner from '$lib/components/AvedotBanner.svelte';
    import JsonLd from '$lib/components/JsonLd.svelte';
    import Seo from '$lib/components/Seo.svelte';
    import {
        SITE_NAME,
        SITE_DESCRIPTION,
        websiteSchema,
        organizationSchema,
        serviceSchema,
        collectionSchema,
    } from '$lib/seo';
    import type { PageData, Snapshot } from './$types';

    let { data }: { data: PageData } = $props();
    let gemachim = $derived(data.gemachim);
    let categories = $derived(data.categories);

    /** מספר הערים שבהן יש גמ"חים בפועל (לשורת הסטטיסטיקה) */
    let cityCount = $derived(new Set(gemachim.map(g => g.city)).size);

    /** הנעוצים — הרשימה שהאדמין עורך ב-/admin/pinned, בסדר שנקבע שם */
    let pinnedGemachim = $derived(data.pinned);
    let pinnedIds = $derived(new Set(pinnedGemachim.map(g => g.id)));
    /** החדשים שנוספו — בלי הנעוצים. פריטים עם טלפון קודם, כדי שדף הבית לא יוביל
     *  בפריטים חלקיים (מיון יציב → סדר החדש-קודם נשמר בתוך כל קבוצה).
     *  hasPhone ולא phone: המספר עצמו לא נשלח לרשימות. */
    let newestGemachim = $derived(
        gemachim.filter(g => !pinnedIds.has(g.id))
            .sort((a, b) => (b.hasPhone ? 1 : 0) - (a.hasPhone ? 1 : 0))
            .slice(0, 6)
    );

    /** הבאנר הקשיח של "פינת האבדות" מוצג רק כל עוד אין לה פריט אמיתי במאגר.
     *  ברגע שהיא קיימת כגמ"ח (עם קישור ל-avedot) היא מוצגת ככרטיס רגיל —
     *  עם עריכה לבעלים וסנכרון ל"קהילה בשכונה" — והבאנר נסוג כדי לא לכפול. */
    let hasAvedotGemach = $derived(
        gemachim.some(g => (g.link ?? '').includes('avedot.gofreeil.com'))
    );

    let searchQuery = $state('');
    let selectedCategory = $state('');
    let selectedCity = $state('');
    let showResults = $state(false);

    /** מפתחות קטגוריה שתמונת הנושא שלהן נכשלה בטעינה — נופלים חזרה לאימוג'י */
    let brokenImg = $state(new Set<string>());

    /** זום-פנימה פר-קטגוריה: תמונות הקולאז' 341×341 (ביגוד, כלים, ספרים, חשמל)
     *  מגיעות עם מסגרת קרם אפויה ולא-אחידה בקצוות. הגדלה מעבר לריבוע + חיתוך-מרכז
     *  (overflow:hidden) מעלימה אותה לגמרי. הערכים אומתו חזותית (ffmpeg crop).
     *  שאר התמונות (תינוקות/ריהוט/צעצועים/אחר) מלאות ומקבלות זום עדין בלבד.
     *  תמונות שנחתכו כאן ידנית (ספרים, מזון) כבר צמודות לנושא — 1.0, בלי זום. */
    const CAT_ZOOM: Record<string, number> = {
        clothing: 1.20,       // clothing.webp — מסגרת קרם בקצוות
        tools: 1.28,
        books: 1.00,          // books.webp — חיתוך ידני צמוד, אין מסגרת להעלים
        food: 1.00,           // food.webp — כנ"ל
        electronics: 1.20,    // מסגרת קרם דקה בקצה הימני
        judaism: 1.14,        // judaism.webp — הבהרה רכה בקצוות סביב הטלית
        initiatives: 1.00,    // initiatives.webp — חיתוך ידני סביב הסמל, זום יקצץ אותו
        money: 1.00,          // money.webp — חותמת "כשר ללא ריבית" צמודה לפינה, זום יחתוך אותה
    };
    const zoomFor = (key: string) => CAT_ZOOM[key] ?? 1.06;

    /* ═══════════ מסילת הקטגוריות — מיון ═══════════ */
    const OTHER_KEY = 'other';   // "אחר" תמיד אחרון, גם אם צבר הרבה

    type RailCat = { key: string; label: string; icon: string; image?: string; count: number };

    /** מונה גמ"חים לקטגוריה במעבר יחיד, במקום filter נפרד לכל אריח */
    let countByCat = $derived.by(() => {
        const m = new Map<string, number>();
        // גמ"ח רב-נושאי נספר בכל אחד מהנושאים שלו — האריח מבטיח כמה יימצאו בו
        for (const g of gemachim)
            for (const key of categoryKeys(g)) m.set(key, (m.get(key) ?? 0) + 1);
        return m;
    });

    /** הסדר שנקבע בפאנל הניהול הוא סדר התצוגה. "אחר" תמיד אחרון. */
    let railCategories = $derived.by((): RailCat[] =>
        categories
            .map((cat, i) => ({ cat, i }))
            .sort((a, b) =>
                (a.cat.key === OTHER_KEY ? 1 : 0) - (b.cat.key === OTHER_KEY ? 1 : 0) ||
                a.i - b.i
            )
            .map((r) => ({
                key: r.cat.key,
                label: r.cat.label,
                icon: r.cat.icon,
                image: r.cat.image,
                count: countByCat.get(r.cat.key) ?? 0
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
    /* רוחבי הדהייה בשני הקצוות, בפיקסלים. נגזרים ממרחק הגלילה ולא מ-atStart/atEnd:
       מיתוג בינארי הקפיץ מסכה של 32px בפריים אחד על הקצה הימני — פופ שנראה כגליצ'.
       עכשיו הדהייה גדלה ~2px לפריים יחד עם הגלילה. */
    const FADE_PX = 32;               // = 2rem, וגם scroll-padding-inline של המסילה
    let fadeLeadPx = $state(0);       // הקצה שממנו האריחים יוצאים (ימין ב-RTL)
    let fadeTailPx = $state(0);       // הקצה שממנו הם נכנסים

    // לא-ריאקטיביים: לא מוצגים, ולכן אין טעם ב-$state
    let pointerId = -1;
    let thumbPointerId = -1, thumbGrab = 0;   // ידית הסקראבר: מזהה מצביע + היסט האחיזה בתוך הידית
    let isTouch = false;
    let axisLock: 'h' | 'v' | null = null;
    let startX = 0, startY = 0, startScroll = 0, maxMove = 0;
    let suppressClick = false, dragEndedAt = 0;
    let rafId = 0, nudged = false, tileStep = 0;
    let gapPx = GAP_PX, spacerPx = 32;   // נמדדים מה-DOM; הקבועים הם רק ברירת מחדל ל-SSR
    let padStartPx = 8;                  // padding-inline-start של המסילה (0.5rem)
    let reduceMotion = false;            // נקרא פעם אחת; הדומינו כבוי כשמבקשים פחות תנועה

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
        // עיגול לפיקסל: קצה הגרדיאנט רך, וחישוב מסכה חדש בכל שבריר פיקסל הוא בזבוז
        fadeLeadPx = Math.round(Math.min(FADE_PX, Math.max(0, pos)));
        fadeTailPx = Math.round(Math.min(FADE_PX, Math.max(0, max - pos)));
        thumbRatio = el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1;
        // גלגלת/מקלדת/סרגל — תזוזה אמיתית מכבה את הרמז. הסף גבוה מ-36px של הנדנוד
        // האוטומטי, כדי שהרמז לא יכבה את עצמו
        if (pos > 48) hinted = true;

        // כל האריחים ברוחב זהה, ולכן די במדידת הראשון.
        // offsetWidth ולא getBoundingClientRect: הראשון עשוי להיות מסובב בדומינו,
        // ותיבת ה-rect שלו מצטמקת עם הסיבוב — offsetWidth הוא מידת הפריסה האמיתית
        const first = el.querySelector<HTMLElement>('[data-tile]');
        if (first) tileStep = first.offsetWidth + gapPx;
        const spacer = el.querySelector<HTMLElement>('[data-spacer]');
        if (spacer) spacerPx = spacer.offsetWidth;

        // ספירה לפי מרחק הגלילה שנותר, לא לפי אינדקסים: אחרת המונה מגיע ל-0
        // בזמן שהאריח האחרון עדיין חתוך, והגלולה מציגה "עוד 0"
        if (tileStep > 0 && !isEnd) {
            const remaining = max - pos - spacerPx - gapPx;
            hiddenCount = Math.max(0, Math.ceil(remaining / tileStep));
        } else {
            hiddenCount = 0;
        }

        paintDepth(pos);
    }

    /* ── דומינו תלת-מימדי ────────────────────────────────────────────────
       אריח שמתקרב לקצה-ההובלה (ימין ב-RTL) נסוג אחורה והצידה, כמו אבן
       דומינו שנוטה ליפול, וכל אריח גורר את זה שאחריו — השורה נקראת
       כאלכסון נסוג ולא כרצועה שטוחה. ה-JS כותב רק ‎--t (0..1), ומתוכו
       ה-CSS גוזר סיבוב, עומק, היסט ושקיפות.

       חלון ההקדמה (lead) נפתח עם הגלילה ולא קבוע: בלעדיו האריח הראשון
       היה נראה נוטה כבר במנוחה, ודווקא הקטגוריה המובילה הייתה מוטה. */
    /* LEAD קטן מרוחב אריח: הנטייה מתחילה סמוך לקצה הימני, ולא באמצע השורה —
       בכל רגע יש אריח אחד נוטה בקצה ואחריו מתחיל הבא, כמו אבן דומינו שמפילה
       את הבאה אחריה. LEAD גדול היה מתחיל את הנטייה כבר במרכז המסך. */
    const DOMINO_LEAD = 0.9;    // עד כמה לפני קצה-ההובלה מתחילה הנטייה (ביחידות אריח)
    const DOMINO_RAMP = 1.6;    // על פני כמה אריחים הנטייה מתפתחת מ-0 למקסימום
    const DOMINO_OPEN = 4;      // על פני כמה אריחים נפתח חלון ההקדמה בתחילת הגלילה

    function paintDepth(pos: number) {
        const el = railEl;
        if (!el || reduceMotion || tileStep <= 0) return;
        /* חלון ההקדמה נפתח בעקומת smoothstep ולא ב-Math.min: ב-min הוא גדל בקצב 1
           יחד עם past, ולכן הנטייה רצה בקצב כפול עד לנקודת הרוויה ושם נחתכת בבת
           אחת לחצי — קפיצת-קצב שנראית כגליצ' בדיוק בקצה הימני. smoothstep מתחיל
           בנגזרת אפס, ולכן הקצב יוצא מהמנוחה חלק ולא מזנק באמצע. */
        const u = Math.min(1, pos / (tileStep * DOMINO_OPEN));
        const lead = tileStep * DOMINO_LEAD * u * u * (3 - 2 * u);
        const ramp = tileStep * DOMINO_RAMP;
        const wraps = el.querySelectorAll<HTMLElement>('[data-depth]');
        for (let i = 0; i < wraps.length; i++) {
            // past = כמה האריח כבר חלף את קצה-ההובלה של החלון הנראה
            const past = pos - (padStartPx + i * tileStep);
            const t = Math.max(0, Math.min(1, (past + lead) / ramp));
            wraps[i].style.setProperty('--t', t < 0.002 ? '0' : t.toFixed(3));
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
        padStartPx = parseFloat(cs.paddingInlineStart) || 8;
        reduceMotion = prefersReduce();
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
            const matchesCategory = !selectedCategory || categoryKeys(g).includes(selectedCategory);
            const matchesCity = !cityQ || g.city.includes(cityQ);
            return matchesQuery && matchesCategory && matchesCity;
        });
    });

    function doSearch() {
        showResults = true;
    }

    /* ═══════════ הוספת גמ"ח מתוך הקטגוריה שנבחרה ═══════════
       מי שסינן לפי נושא ולא מצא את הגמ"ח שהוא מכיר הוא בדיוק מי שיכול להוסיף
       אותו. הקישור נושא את הקטגוריה בכתובת, וטופס ההוספה בוחר אותה מראש. */
    let selectedCategoryDef = $derived(categories.find(c => c.key === selectedCategory) ?? null);
    let addHref = $derived(
        selectedCategory ? `/gemach/add?category=${encodeURIComponent(selectedCategory)}` : '/gemach/add'
    );

    function handleKey(e: KeyboardEvent) {
        if (e.key === 'Enter') doSearch();
    }

    function clearFilters() {
        searchQuery = '';
        selectedCategory = '';
        selectedCity = '';
        showResults = false;
    }

    /** "חזור" — יציאה ממסך התוצאות חזרה לדף הבית הרגיל (קטגוריות, נעוצים,
     *  חדשים). מנקה את הסינון וגולל לראש הדף, כדי שהחזרה תרגיש כמו מסך קודם. */
    function goBack() {
        clearFilters();
        window.scrollTo({ top: 0 });
    }

    /* ═══════════ חזרה לדף הבית עם החיפוש שהיה ═══════════
       מצב החיפוש הוא state של הרכיב ולא פרמטרים בכתובת, ולכן מי שחיפש,
       סינן ולחץ על גמ"ח קיבל דף בית מאופס כשחזר — גם בכפתור "חזרה" של
       דף הגמ"ח וגם בזה של הדפדפן — ונאלץ לחפש את הכול מהתחלה.
       snapshot של SvelteKit נשמר לרשומת ההיסטוריה (ב-sessionStorage) ומוחזר
       בחזרה אליה בלבד, כך שכניסה רגילה לדף הבית נשארת נקייה.
       מסילת הקטגוריות אינה נשמרת: כשיש סינון היא כלל אינה מרונדרת. */
    interface HomeSnapshot {
        q: string;
        cat: string;
        city: string;
        results: boolean;
        y: number;
    }

    export const snapshot: Snapshot<HomeSnapshot> = {
        capture: () => ({
            q: searchQuery,
            cat: selectedCategory,
            city: selectedCity,
            results: showResults,
            y: window.scrollY,
        }),
        restore: (v) => {
            searchQuery = v.q ?? '';
            selectedCategory = v.cat ?? '';
            selectedCity = v.city ?? '';
            showResults = v.results ?? false;
            // התוצאות מרונדרות רק אחרי שהמצב חזר. בלי ההמתנה לרינדור הדף
            // עדיין קצר ברגע שחזור הגלילה, והמבקר נוחת בראש הדף במקום
            // באותו גמ"ח שהסתכל עליו.
            if (v.y > 0) tick().then(() => window.scrollTo(0, v.y));
        },
    };

    /* ═══════════ SEO ═══════════
       דף הבית הוא דף הכניסה הראשי מגוגל וממנועי ה-AI. הכותרת והתיאור
       יורשים מה-layout; כאן נוספים canonical ו-JSON-LD (WebSite, Organization,
       Service, CollectionPage עם הגמ"חים). ההסבר המלא והשו"ת עברו ל-/info
       (כפתור "מידע" בהאדר), ושם יושב גם ה-FAQPage — ליד השו"ת שהוא מתאר. */
    const schemas = $derived([
        websiteSchema(),
        organizationSchema(),
        serviceSchema(),
        collectionSchema({
            name: `${SITE_NAME} — מאגר הגמ"חים של ישראל`,
            description: SITE_DESCRIPTION,
            path: '/',
            numberOfItems: gemachim.length,
            items: [...pinnedGemachim, ...newestGemachim].map((g) => ({
                name: g.name,
                path: `/gemach/${g.id}`,
            })),
        }),
    ]);
</script>

<Seo
    title='הגמ"ח הארצי — כל הגמ"חים בישראל במקום אחד, לפי עיר ולפי נושא'
    description={SITE_DESCRIPTION}
    path="/"
    keywords='גמ"ח, גמחים, מאגר גמחים, אינדקס גמחים, גמ"ח ציוד רפואי, גמ"ח שמלות, גמ"ח ריהוט, גמ"ח כלי אירוח, גמ"ח תינוקות, גמ"ח הלוואות, גמילות חסדים'
/>
<JsonLd data={schemas} />

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
             באנר כהה אחד, שני הנתונים זה מתחת לזה, מופרדים בקו קצר שלא נוגע בשוליים. -->
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
        </div>
    </div>
    <h1 class="sr-only">הגמ"ח הארצי – כל הגמחים בארץ בכף ידך</h1>

    <!-- Search Bar — עיצוב "רגוע ומלוכד": שדה חיפוש-גיבור אחד רחב עם כפתור מוטמע בקצה,
         ומתחתיו שני מסננים שקטים (קטגוריה · עיר) שמתעוררים במגע ומאירים בזהב כשהם פעילים.
         חוט זהב דק בקצה הגיבור קושר ללוגו מעל ולמובילי-הקטגוריות מתחת. הכול RTL בתכונות לוגיות. -->
    <div class="max-w-2xl mx-auto">
        <!-- שדה החיפוש הראשי (הגיבור): שדה אחד רחב, כפתור גרדיאנט מוטמע בקצה — נקרא כאובייקט אחד -->
        <div class="hero-search group relative flex items-center gap-2 rounded-2xl bg-[#16264d] border border-[#3b5794] ps-3.5 pe-2 py-2 shadow-lg shadow-black/25 transition-all duration-200 focus-within:border-blue-400 focus-within:bg-[#1b2f5e] focus-within:shadow-blue-500/20">
            <!-- זכוכית מגדלת מובילה (קצה פנימי = ימין ב-RTL) -->
            <span class="hero-icon pointer-events-none shrink-0 transition-colors" aria-hidden="true">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            </span>
            <input
                type="search"
                bind:value={searchQuery}
                onkeydown={handleKey}
                placeholder="חפש לפי שם, עניין או עיר..."
                aria-label="חיפוש גמחים"
                class="hero-input flex-1 min-w-0 bg-transparent border-0 outline-none text-white placeholder-gray-400 text-base sm:text-lg py-2.5"
            />
            <!-- כפתור מוטמע בתוך המעטפת -->
            <button
                onclick={doSearch}
                aria-label="חפש"
                class="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold px-5 sm:px-6 py-2.5 shadow-md hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#16264d] transition-all"
            >חפש</button>
        </div>

        <!-- שני מסננים שקטים: קטגוריה + עיר — חולקים שורה, מתעוררים במגע; זהב = מסנן פעיל -->
        <div class="mt-3 flex items-stretch gap-2.5">
            <!-- קטגוריה -->
            <div class="filter group relative flex-1 min-w-0" class:is-active={selectedCategory}>
                <span class="filter-icon pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 transition-colors" aria-hidden="true">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                </span>
                <select
                    bind:value={selectedCategory}
                    onchange={doSearch}
                    aria-label="סנן לפי קטגוריה"
                    class="qc-select w-full appearance-none cursor-pointer rounded-xl bg-[#1c2f5a]/70 border border-[#3b5794]/70 text-white/90 text-base sm:text-sm ps-9 pe-9 py-3 outline-none transition-all hover:bg-[#1c2f5a] hover:border-[#4c6cb0] focus:bg-[#243a6e] focus:border-blue-400 focus:text-white focus-visible:ring-2 focus-visible:ring-blue-400/50"
                >
                    <option value="">כל הקטגוריות</option>
                    {#each categories as cat}
                        <option value={cat.key}>{cat.icon} {cat.label}</option>
                    {/each}
                </select>
            </div>

            <!-- עיר -->
            <div class="filter group relative flex-1 min-w-0" class:is-active={selectedCity}>
                <span class="filter-icon pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 transition-colors" aria-hidden="true">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                </span>
                <input
                    type="text"
                    bind:value={selectedCity}
                    onchange={doSearch}
                    onkeydown={handleKey}
                    list="home-cities-list"
                    placeholder="כל הערים"
                    aria-label="סנן לפי עיר"
                    class="w-full rounded-xl bg-[#1c2f5a]/70 border border-[#3b5794]/70 text-white/90 placeholder-white/50 text-base sm:text-sm ps-9 pe-3 py-3 outline-none transition-all hover:bg-[#1c2f5a] hover:border-[#4c6cb0] focus:bg-[#243a6e] focus:border-blue-400 focus:text-white focus-visible:ring-2 focus-visible:ring-blue-400/50"
                />
                <datalist id="home-cities-list">
                    {#each cities as city (city)}
                        <option value={city}></option>
                    {/each}
                </datalist>
            </div>
        </div>

        {#if showResults || selectedCategory || selectedCity}
            <div class="mt-3 flex justify-center">
                <button
                    onclick={clearFilters}
                    class="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 text-white/85 px-5 py-2.5 min-h-[44px] text-sm hover:bg-white/15 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 transition-all"
                >
                    נקה הכל
                    <span aria-hidden="true">✕</span>
                </button>
            </div>
        {/if}
    </div>
</section>

<!-- כותרת סקשן משותפת: שלושת שלבי דף הבית (נעוצים · חדשים · כל השאר) נושאים אותו
     אייקון-גלולה, אותה טיפוגרפיה ואותו חוט זהב, כדי שייקראו כרצף אחד ולא כשלושה
     עיצובים שונים. הכותרות יושבות על הרקע הוורוד, ולכן לבן + צל דק (בלי אפור). -->
{#snippet sectionHead(icon: string, title: string, sub: string)}
    <div class="sec-head">
        <h2 class="sec-title">
            <span class="sec-ico" aria-hidden="true">{icon}</span>
            <span>{title}</span>
        </h2>
        <p class="sec-sub">{sub}</p>
    </div>
{/snippet}

<!-- Results / Categories -->
{#if showResults || selectedCategory || selectedCity}
    <!-- Search Results -->
    <section class="px-2 md:px-4 pb-8" aria-label="תוצאות חיפוש">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div class="flex flex-wrap items-center gap-3">
                <!-- חזרה מהתוצאות לדף הבית הרגיל — בלי לגעת בהיסטוריית הדפדפן -->
                <button
                    type="button"
                    onclick={goBack}
                    class="inline-flex items-center gap-1.5 rounded-full border border-[#3b5794] bg-[#1c2f5a] px-4 py-2 min-h-[40px] text-sm font-bold text-gray-100 shadow-md hover:bg-[#2a4379] hover:text-white active:scale-95 transition-all"
                >
                    <span aria-hidden="true">→</span>
                    חזור
                </button>
                <h2 class="text-xl font-bold text-white">
                    נמצאו <span class="text-blue-400">{filteredGemachim.length}</span> גמחים
                </h2>
            </div>
            <!-- הוספה בתוך ההקשר: הקטגוריה שנבחרה נשלחת לטופס ונבחרת בו מראש -->
            <a
                href={addHref}
                class="add-here-btn inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black transition-all"
            >
                <span aria-hidden="true">➕</span>
                {#if selectedCategoryDef}
                    הוספת גמ"ח ב{selectedCategoryDef.label}
                {:else}
                    הוספת גמ"ח למאגר
                {/if}
            </a>
        </div>

        {#if filteredGemachim.length === 0}
            <!-- גם בלי תוצאות, "מיזמים חשובים לציבור" עדיין מציג את פינת האבדות -->
            {#if selectedCategory === 'initiatives' && !hasAvedotGemach}
                <div class="mb-5"><AvedotBanner /></div>
            {/if}
            <!-- קופסה כהה: טקסט אפור ישירות על הרקע הוורוד אינו קריא -->
            <div class="mx-auto max-w-md rounded-2xl border border-[#3b5794] bg-[#16264d] px-6 py-12 text-center text-gray-300 shadow-lg">
                <div class="text-5xl mb-4" aria-hidden="true">🔍</div>
                <p class="text-lg font-bold text-white">לא נמצאו גמחים מתאימים</p>
                <p class="text-sm mt-2">נסה לחפש במילים אחרות או לשנות את הפילטרים</p>
                <!-- אין תוצאות בנושא = הזדמנות להוסיף. ההוספה היא הפעולה הראשית כאן -->
                <p class="mt-5 text-sm font-bold text-amber-100">
                    {#if selectedCategoryDef}
                        מכירים גמ"ח {selectedCategoryDef.label} שחסר כאן?
                    {:else}
                        מכירים גמ"ח שחסר במאגר?
                    {/if}
                </p>
                <div class="mt-3 flex flex-wrap items-center justify-center gap-2.5">
                    <a
                        href={addHref}
                        class="add-here-btn inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-black transition-all"
                    >
                        <span aria-hidden="true">➕</span>
                        {#if selectedCategoryDef}
                            הוספת גמ"ח ב{selectedCategoryDef.label}
                        {:else}
                            הוספת גמ"ח למאגר
                        {/if}
                    </a>
                    <button onclick={clearFilters} class="px-5 py-2.5 rounded-full bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 transition-colors text-sm font-bold">
                        נקה חיפוש
                    </button>
                </div>
            </div>
        {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- פינת האבדות ראשונה ברשת התוצאות של "מיזמים חשובים לציבור" —
                     משבצת רגילה בגודל כרטיס, לא באנר-על מעל הרשימה -->
                {#if selectedCategory === 'initiatives' && !hasAvedotGemach}
                    <AvedotBanner />
                {/if}
                {#each filteredGemachim as gemach (gemach.id)}
                    <GemachCard {gemach} {categories} />
                {/each}
            </div>
        {/if}
    </section>

{:else}
    <!-- מסילת הקטגוריות: המובילות ראשונות, השאר נחשפות בגרירה של השורה.
         גלישה ולא הסתרה — כל קטגוריה נשארת ב-DOM, בסדר ה-Tab ובעץ הנגישות. -->
    <section class="px-2 md:px-4 pb-8" aria-labelledby="cat-rail-title">
      <div class="mx-auto mb-10 max-w-4xl">

        <div class="mb-3 px-1">
            <h2 id="cat-rail-title" class="text-2xl font-black text-white">סינון מהיר</h2>
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
                class:is-empty={cat.count === 0}
                onclick={(e) => pick(cat.key, e)}
                aria-label="חפש גמחי {cat.label} — {cat.count} גמחים"
            >
                <span class="cat-count-badge" aria-hidden="true">{cat.count}</span>

                <span class="cat-ico">
                    {#if cat.image && !brokenImg.has(cat.key)}
                        <!-- תמונת נושא מ"קהילה בשכונה" (דף למסירה); זום-פנימה (‎--z) חותך
                             מסגרת לבנה אפויה בקצוות. קישור שבור → חזרה לאימוג'י -->
                        <span class="cat-photo">
                            <img
                                src={cat.image}
                                alt=""
                                draggable="false"
                                loading="lazy"
                                decoding="async"
                                style="--z:{zoomFor(cat.key)}"
                                onerror={() => (brokenImg = new Set(brokenImg).add(cat.key))}
                            />
                        </span>
                    {:else if cat.key === 'judaism'}
                        <img src="/icons/menorah.svg" alt="" draggable="false" class="h-9 w-9 object-contain" />
                    {:else}
                        <span class="text-3xl leading-none" aria-hidden="true">{cat.icon}</span>
                    {/if}
                </span>

                <span class="cat-label">{cat.label}</span>
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
                style="--f-l:{rtl ? fadeTailPx : fadeLeadPx}px; --f-r:{rtl ? fadeLeadPx : fadeTailPx}px; --sx:{rtl ? 1 : -1}; --o:{rtl ? '0%' : '100%'}"
                onscroll={scheduleRead}
                onpointerdown={onRailPointerDown}
                onpointermove={onRailPointerMove}
                onpointerup={onRailPointerUp}
                onpointercancel={onRailPointerCancel}
                onlostpointercapture={onRailLostCapture}
                onclickcapture={onRailClickCapture}
            >
                {#each railCategories as cat (cat.key)}
                    <!-- העטיפה נושאת את טרנספורם הדומינו ולא ה-li ולא הכפתור: לכפתור יש
                         טרנספורם משלו ב-hover וב-active, ושתי הצהרות transform על אותו
                         אלמנט דורסות אחת את השנייה. -->
                    <li class="cat-item">
                        <span class="cat-3d" data-depth>{@render catTile(cat)}</span>
                    </li>
                {/each}
                <!-- מרווח סיום אמיתי: padding-inline-end נבלע בסקרולר flex, והוא חייב
                     להיות רחב כמו המסכה כדי שהאריח האחרון לא יישאר מעומעם -->
                <li class="cat-spacer" data-spacer aria-hidden="true"></li>
            </ul>
        </div>

        <!-- בקרי החשיפה מרוכזים מתחת למסילה, צמודים לאלמנט שהם מזיזים:
             רמז (בלי מסגרת, לא ככפתור) מעל שורת חץ ← סקראבר נגרר → חץ+מונה.
             רוחב ידית הסקראבר מקודד כמה מהרשימה מוסתר; לחיצה על המסילה = קפיצה. -->
        <div class="mt-3 flex flex-col items-center gap-2 {overflowing ? '' : 'invisible'}">
            <!-- בלי גלולה/מסגרת כדי שלא ייראה ככפתור; צל-טקסט מרים את הלבן מהרקע הוורוד -->
            <p class="cat-hint-label inline-flex items-center gap-1.5 text-sm font-bold text-white" aria-hidden="true">
                <span>גררו את השורה כדי לגלות עוד</span>
                <span class="cat-hint-arrow" class:is-live={!hinted}>↔</span>
            </p>

            <!-- החיצים הם צעדנים, והסקראבר הנגרר ביניהם — כולם על שורה אחת -->
            <div class="cat-controls flex w-full max-w-md items-center justify-center gap-2">
                <button
                    type="button"
                    class="cat-nav"
                    aria-controls="cat-rail"
                    aria-disabled={atStart}
                    aria-label="חזרה לתחילת רשימת הקטגוריות"
                    onclick={() => { if (!atStart) nudge(-1); }}
                >
                    <svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true" fill="none"
                         stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d={rtl ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
                    </svg>
                </button>

                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    bind:this={trackEl}
                    class="cat-track"
                    class:is-scrubbing={scrubbing}
                    style="--p:{progress}; --ratio:{thumbRatio}"
                    aria-hidden="true"
                    onpointerdown={onThumbPointerDown}
                    onpointermove={onThumbPointerMove}
                    onpointerup={endThumb}
                    onpointercancel={endThumb}
                    onlostpointercapture={endThumb}
                >
                    <span class="cat-thumb"></span>
                </div>

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
      </div>

        <!-- (1) נעוצים — הרשימה שהאדמין עורך ב-/admin/pinned (📌) -->
        {#if pinnedGemachim.length > 0}
            {@render sectionHead('📌', 'גמ"חים נעוצים', 'מה שכדאי להכיר קודם')}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                {#each pinnedGemachim as gemach (gemach.id)}
                    <GemachCard {gemach} {categories} pinned />
                {/each}
            </div>
        {/if}

        <!-- (2) החדשים שנוספו -->
        {@render sectionHead('✨', 'גמ"חים חדשים', 'הגמ"חים האחרונים שנוספו למאגר')}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each newestGemachim as gemach (gemach.id)}
                <GemachCard {gemach} {categories} />
            {/each}
        </div>
    </section>
{/if}

<!-- (3) כל השאר — מעבר לרשימה המעומדת. אותה כותרת בדיוק כמו שתי הקודמות,
     ומתחתיה קישור אחד רזה במקום קופסת-ענק. -->
<section class="px-2 md:px-4 pb-6 pt-2">
    {@render sectionHead('🗂️', 'כל שאר הגמ"חים', `עיון בכל ${gemachim.length} הגמ"חים במאגר, לפי עיר ולפי נושא`)}
    <div class="flex justify-center">
        <a
            href="/gemachim"
            class="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-900/50 to-purple-900/50 px-8 py-3.5 text-base font-black text-white shadow-lg transition-all hover:border-blue-400/60 hover:from-blue-900/70 hover:to-purple-900/70 md:text-lg"
        >
            לרשימת כל הגמ"חים ←
        </a>
    </div>
</section>

<!-- באנר הוספת גמ"ח — שורה אחת בזהב, בלי כותרת ובלי אייקון-ענק.
     בכוונה בפלטה אחרת מכל שאר האתר (זהב על כמעט-שקוף במקום כחול-סגול),
     כדי שייקרא כפנייה נפרדת ולא כעוד כרטיס בדף. -->
<section class="px-4 pb-14">
    <div class="add-banner mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-2xl px-5 py-4 text-center sm:flex-row sm:justify-between sm:text-right">
        <p class="text-sm font-bold text-amber-50 sm:text-base">
            מפעילים גמ"ח?
            <span class="font-normal text-amber-100/80">הוסיפו אותו למאגר — וקדמו את העולם למתוקן יותר!</span>
        </p>
        <a
            href="/gemach/add"
            class="add-banner-btn shrink-0 rounded-full px-6 py-2.5 text-sm font-black transition-all"
        >
            הוספת גמ"ח
        </a>
    </div>
</section>

<style>
    /* ═══ כותרות הסקשנים: נעוצים · חדשים · כל השאר ═══
       שלושתן חולקות אייקון, טיפוגרפיה, תת-כותרת וחוט זהב — אותו מוטיב זהב
       של שדה החיפוש ושל תגי הכמות במסילה — ולכן נקראות כרצף אחד.
       הן יושבות על הרקע הוורוד, ולכן לבן + צל דק (אסור אפור על ורוד). */
    .sec-head { margin-bottom: 1.25rem; text-align: center; }
    .sec-title {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.5rem;
        font-weight: 900;
        line-height: 1.15;
        color: #fff;
        text-shadow: 0 1px 4px rgba(11, 18, 38, 0.55);
    }
    .sec-ico { font-size: 1.15rem; }
    .sec-sub {
        margin-top: 0.35rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #fdf4ff;
        text-shadow: 0 1px 4px rgba(11, 18, 38, 0.6);
    }
    .sec-head::after {
        content: "";
        display: block;
        width: 4.5rem;
        height: 2px;
        margin: 0.6rem auto 0;
        border-radius: 999px;
        background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.9), transparent);
    }
    @media (min-width: 768px) {
        .sec-title { font-size: 1.75rem; }
        .sec-ico { font-size: 1.35rem; }
    }

    /* ═══ באנר הוספת גמ"ח ═══
       בכוונה בפלטה נפרדת מכל שאר האתר — זהב על כמעט-שקוף במקום כחול-סגול,
       מסגרת דקה בלי מילוי — כדי שייקרא כפנייה ולא כעוד כרטיס בדף. */
    .add-banner {
        border: 1px solid rgba(212, 175, 55, 0.45);
        background: rgba(15, 28, 55, 0.5);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }
    .add-banner-btn {
        color: #3a2a06;
        background: linear-gradient(145deg, #f3d68b, #d4af37);
        box-shadow: 0 6px 18px -10px rgba(212, 175, 55, 0.9);
    }
    .add-banner-btn:hover { filter: brightness(1.06); }
    .add-banner-btn:active { transform: scale(0.97); }

    /* כפתור "הוספת גמ"ח ב<נושא>" בתוך התוצאות — אותה פלטת זהב של באנר ההוספה,
       כדי שההוספה תיקרא כאותה פעולה בכל מקום שבו היא מוצעת. */
    .add-here-btn {
        color: #3a2a06;
        background: linear-gradient(145deg, #f3d68b, #d4af37);
        box-shadow: 0 6px 18px -10px rgba(212, 175, 55, 0.9);
    }
    .add-here-btn:hover { filter: brightness(1.06); }
    .add-here-btn:active { transform: scale(0.97); }

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
        scroll-padding-inline: 2rem;    /* תואם בדיוק את רוחב המסכה; שומר על טבעת הפוקוס במקלדת */
        /* אין כאן scroll-snap-type — ואסור להחזיר אותו: ההצמדה קופצת מיידית ובלי
           אנימציה, וכל קפיצה כזו קופצת גם את נטיית הדומינו (‎--t הוא פונקציה של
           מקום הגלילה). מדידה: עם x proximity המסילה נחה רק בנקודות ההצמדה
           (0, 72, 168, 264px ברוחב 412px), כתיבה של כל מקום ביניהם נבלעה, וכל
           שחרור גרירה או גרירת ידית סקראבר הזיזה את השורה בקפיצה של עד אריח —
           ‎12°—24° של סיבוב בפריים אחד, לסירוגין, בדיוק בקצה הימני.
           scroll-behavior: smooth לא מוצהר בכוונה — הוא היה הופך כל גרירה למקרטעת. */
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
    .cat-rail.is-dragging { cursor: grabbing; scroll-behavior: auto; }
    .cat-rail.is-dragging .cat-tile { transition: none; }
    @media (hover: none) { .cat-rail { cursor: default; } }

    .cat-item { flex: 0 0 auto; display: flex; }
    .cat-spacer { flex: 0 0 2rem; display: block; }   /* ≥ רוחב המסכה, אחרת האריח האחרון נשאר מעומעם */

    /* ═══ דומינו תלת-מימדי ═══
       ‎--t (0..1) נכתב מה-JS לפי מקומו של האריח ביחס לקצה-ההובלה, וכאן הוא
       נפרש לנסיגה לעומק: הכרטיס הולך אחורה, מצטמק בפרספקטיבה, פונה מעט
       ודוהה. אין כאן translateX — היסט הצידה הרחיק את הכרטיס מהשכן שלו
       ופתח רווח שגדל, במקום להיראות כמו כרטיס שנסוג לתוך המסך.

       ‎--o היא נקודת הציר, והיא מוצבת על הקצה שפונה אל הכרטיס הבא (שמאל
       ב-RTL). בגלל ש-perspective() הוא פונקציית טרנספורם, נקודת המגוז שלו
       יושבת על ה-transform-origin, ולכן הקצה הזה נשאר מסומר בדיוק במקומו
       בכל עומק ובכל זווית — הצטמקות והפנייה נבלעות אל הקצה היוצא, והרווח
       אל השכן אינו גדל כלל. ‎--sx הופך את הצירים ב-LTR.

       perspective מקומי לכל אריח ולא על המסילה: perspective על מכל-גלילה
       מוליד באגי נקודת-מגוז בין הדפדפנים.
       בלי transition — הערך נצבע בכל פריים של גלילה, וכל השהיה הייתה משתרכת. */
    .cat-3d {
        display: flex;
        transform-origin: var(--o, 0%) 50%;
        transform:
            perspective(460px)
            translateZ(calc(var(--t, 0) * -110px))
            rotateY(calc(var(--t, 0) * var(--sx, 1) * 22deg));
        opacity: calc(1 - var(--t, 0) * 0.35);
    }
    @media (prefers-reduced-motion: reduce) {
        .cat-3d { transform: none; opacity: 1; }
    }

    /* ═══ אריח ═══
       המידות כאן הן של הנייד: אריח צר ⇒ ~4 קטגוריות במסך אחד במקום 3,
       וההצצה לאריח הבא נשמרת. מ-md ומעלה חוזרים לאריח הגדול. */
    .cat-tile {
        position: relative;
        width: clamp(4.75rem, 20.5vw, 7rem); /* vw ⇒ ההצצה לאריח הבא מובטחת בכל רוחב מסך */
        min-height: 8rem;
        height: 100%;                       /* ה-li נמתח לגובה השורה; בלי זה תחתית האריחים מתפרעת */
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.3rem;
        padding: 0.6rem 0.35rem;            /* ריפוד צר ⇒ מקום לתמונה גדולה יותר */
        border-radius: 0.85rem;
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

    .cat-tile.is-empty { opacity: 0.72; }

    /* מהטאבלט ומעלה יש רוחב בשפע — אריח גדול, תמונה גדולה, כמו קודם */
    @media (min-width: 768px) {
        .cat-tile {
            width: clamp(7rem, 29vw, 8.5rem);
            min-height: 10.25rem;
            gap: 0.4rem;
            padding: 0.85rem 0.5rem;
            border-radius: 1rem;
        }
    }

    /* תג הכמות בפינה — כמה גמחים בקטגוריה. גלולה שמתרחבת לפי מספר הספרות */
    .cat-count-badge {
        position: absolute;
        top: 0.3rem;
        inset-inline-end: 0.35rem;      /* לוגי ⇒ נוחת בפינה הנכונה ב-RTL */
        display: grid;
        place-items: center;
        min-width: 1.1rem;
        height: 1.1rem;
        padding: 0 0.28rem;
        z-index: 2;                     /* מעל התמונה — התג לא נבלע במסגרת */
        border-radius: 999px;
        font-size: 0.62rem;
        font-weight: 900;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        color: #3a2a06;
        background: linear-gradient(145deg, #f3d68b, #d4af37);
        box-shadow: 0 2px 6px -2px rgba(212, 175, 55, 0.8);
    }
    .cat-ico { display: grid; place-items: center; width: 100%; min-height: 2.5rem; }
    /* תמונת נושא במקום האימוג'י — גדולה, ממלאת כמעט את כל רוחב האריח.
       overflow:hidden חותך את הזום-פנימה (‎--z) שמעלים מסגרות לבנות אפויות בקצוות. */
    .cat-photo {
        width: 6.75rem;                 /* max-width מקצץ אותה לרוחב הפנימי של האריח בנייד */
        max-width: 100%;
        aspect-ratio: 1 / 1;
        overflow: hidden;
        border-radius: 0.7rem;
        border: 2px solid #000;         /* מסגרת שחורה צמודה — התמונה ממלאת אותה בלי רווח */
        background: #0f1c3d;
        box-shadow: 0 10px 22px -12px rgba(0, 0, 0, 0.95);
    }
    .cat-photo img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        object-position: center;
        transform: scale(var(--z, 1.06));
    }
    .cat-label { font-size: 0.75rem; font-weight: 700; line-height: 1.15; color: #e5e7eb; }

    @media (min-width: 768px) {
        .cat-count-badge {
            top: 0.45rem;
            inset-inline-end: 0.55rem;
            min-width: 1.35rem;
            height: 1.35rem;
            padding: 0 0.4rem;
            font-size: 0.72rem;
        }
        .cat-ico { min-height: 3.5rem; }
        .cat-photo { border-radius: 0.85rem; border-width: 3px; }
        .cat-label { font-size: 0.875rem; }
    }

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
    .cat-hint-label {
        /* בלי גלולה/מסגרת — צל דק מרים את הטקסט הלבן מהרקע הוורוד ושומר על קריאוּת */
        text-shadow: 0 1px 4px rgba(11, 18, 38, 0.55);
    }
    /* בשורת הבקרים הסקראבר נמתח בין שני החיצים במקום רוחב קבוע */
    .cat-controls .cat-track { flex: 1 1 auto; width: auto; min-width: 0; }
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

    /* ═══ שדה הגיבור: חוט זהב דק-כשׂערה בקצה העליון — קושר לגבול הזהב של הלוגו מעל
       ולמובילי הקטגוריות בזהב שברֵיל שמתחת. לחישה, לא מילוי. ═══ */
    .hero-search::before {
        content: '';
        position: absolute;
        top: -1px;
        inset-inline: 22%;
        height: 2px;
        border-radius: 999px;
        background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.85), transparent);
        pointer-events: none;
    }
    /* זכוכית מגדלת — פֶּריווינקל רגוע ⇒ כחול בפוקוס */
    .hero-icon { color: #9fb4e0; }
    .hero-search:focus-within .hero-icon { color: #93c5fd; }
    /* מסתירים את כפתור ה-×/הקישוט המובנים של type=search — הניקוי מרוכז ב"נקה הכל" */
    .hero-input::-webkit-search-cancel-button,
    .hero-input::-webkit-search-decoration {
        -webkit-appearance: none;
        appearance: none;
        display: none;
    }

    /* ═══ מסננים שקטים: אייקון מוביל אחיד (white/55 ⇒ כחול בפוקוס ⇒ זהב כשפעיל) ═══ */
    .filter-icon { color: rgba(255, 255, 255, 0.55); }
    .filter:focus-within .filter-icon { color: #93c5fd; }
    .filter.is-active .filter-icon { color: #D4AF37; }

    /* מסנן פעיל — הדגשת זהב מרוסנת (גבול בלבד, בלי להאפיל על מובילי-הזהב במסילה) */
    .filter.is-active .qc-select,
    .filter.is-active input {
        border-color: rgba(212, 175, 55, 0.75);
        background-color: #243a6e;
        color: #fff;
        box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.28);
    }

    /* ═══ <select> נייטיב שמתמזג במעטפת: מסתירים את החץ המובנה ומציירים חץ SVG מותאם
       בקצה הפנימי. RTL: background-position:left = inline-end (הצד השמאלי הפיזי);
       ps-9/pe-9 שומרים שהערך לא ייתקל באייקון המוביל (ימין) או בחץ (שמאל). ═══ */
    .qc-select {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c9d4ef' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: left 0.9rem center;
        background-size: 0.72rem;
    }
    .qc-select::-ms-expand { display: none; }
    /* בפוקוס/פעיל — חץ בהיר יותר / זהב להתאמה לסביבה */
    .filter:focus-within .qc-select {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23dbe6ff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    }
    .filter.is-active .qc-select {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23D4AF37' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    }

    @media (prefers-reduced-motion: reduce) {
        .hero-search,
        .hero-icon,
        .filter-icon,
        .qc-select,
        .filter input { transition: none; }
    }
</style>
