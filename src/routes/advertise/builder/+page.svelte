<script>
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";

    // בונה הפרסומות - פורט מקבוצות רכישה (במקור מ"קהילה בשכונה") והותאם לגמ"ח הארצי:
    // עברית בלבד, CSS רגיל (בלי Tailwind), גרדיאנטים כמחרוזות CSS.

    let { data } = $props();

    // ===== שמירה מקומית =====
    const LS_KEY = "ng_ad_builder_draft_v1";
    const PAID_KEY = "ad_paid";
    const PAID_AT_KEY = "ad_paid_at";

    const ADMIN_WA_NUMBER = "972508750632";

    // ===== שערת גישה =====
    let accessGranted = $state(false);
    let accessChecked = $state(false);
    // אדמין של האתר (אדמין/סופר-אדמין) — נכנס לבונה בלי דף התשלום
    let isAdmin = $derived(Boolean(data?.isAdmin));

    // ===== חלון עריכה חינם =====
    /** @type {Date | null} */
    let paidAt = $state(null);
    let now = $state(new Date());
    let freeEditUntil = $derived.by(() => {
        if (!paidAt) return null;
        const d = new Date(paidAt);
        d.setHours(23, 59, 59, 999);
        return d;
    });
    let freeMsRemaining = $derived(freeEditUntil ? Math.max(0, freeEditUntil.getTime() - now.getTime()) : 0);
    let freeEditExpired = $derived(Boolean(freeEditUntil) && freeMsRemaining === 0);
    /** @param {number} ms */
    function fmtCountdown(ms) {
        const totalMin = Math.floor(ms / 60000);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    }
    /** @param {Date} d */
    function fmtDateShort(d) {
        return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
    }

    // ===== שדות הטופס =====
    let logo = $state("");
    let logoOriginal = $state("");
    let logoShape = $state(/** @type {'square' | 'circle'} */ ("square"));
    let hasCircleCrop = $state(false);
    let logoPosition = $state(/** @type {'right' | 'left' | 'cta'} */ ("right"));
    let logoPositionExplicit = $state(false);

    // ===== חיתוך עגול ללוגו =====
    const CROP_STAGE = 320;
    let cropOpen = $state(false);
    let cropZoom = $state(1);
    let cropOffsetX = $state(0);
    let cropOffsetY = $state(0);
    let cropDragging = false;
    let cropDragStartX = 0, cropDragStartY = 0;
    let cropBaseOffsetX = 0, cropBaseOffsetY = 0;

    function openCropper() {
        if (!logoOriginal) return;
        if (!hasCircleCrop) { cropZoom = 1; cropOffsetX = 0; cropOffsetY = 0; }
        cropOpen = true;
    }
    function cancelCrop() {
        cropOpen = false;
        if (!hasCircleCrop) {
            logoShape = "square";
            if (logoOriginal) logo = logoOriginal;
        }
    }
    async function confirmCrop() {
        if (!logoOriginal) { cropOpen = false; return; }
        const img = new Image();
        img.src = logoOriginal;
        await new Promise((resolve, reject) => { img.onload = () => resolve(undefined); img.onerror = () => reject(); });

        const stage = CROP_STAGE;
        const aspectImg = img.width / img.height;
        let drawW, drawH;
        if (aspectImg > 1) { drawW = stage; drawH = stage / aspectImg; }
        else { drawH = stage; drawW = stage * aspectImg; }

        const canvas = document.createElement("canvas");
        canvas.width = stage; canvas.height = stage;
        const ctx = canvas.getContext("2d");
        if (!ctx) { cropOpen = false; return; }
        ctx.save();
        ctx.beginPath();
        ctx.arc(stage / 2, stage / 2, stage / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.translate(stage / 2 + cropOffsetX, stage / 2 + cropOffsetY);
        ctx.scale(cropZoom, cropZoom);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        logo = canvas.toDataURL("image/png");
        hasCircleCrop = true;
        cropOpen = false;
    }
    function chooseSquare() {
        logoShape = "square";
        if (logoOriginal) logo = logoOriginal;
    }
    function chooseCircle() {
        logoShape = "circle";
        if (logoOriginal) openCropper();
    }
    /** @param {PointerEvent} e */
    function cropPointerDown(e) {
        cropDragging = true;
        cropDragStartX = e.clientX; cropDragStartY = e.clientY;
        cropBaseOffsetX = cropOffsetX; cropBaseOffsetY = cropOffsetY;
        /** @type {HTMLElement} */ (e.currentTarget).setPointerCapture(e.pointerId);
    }
    /** @param {PointerEvent} e */
    function cropPointerMove(e) {
        if (!cropDragging) return;
        cropOffsetX = cropBaseOffsetX + (e.clientX - cropDragStartX);
        cropOffsetY = cropBaseOffsetY + (e.clientY - cropDragStartY);
    }
    /** @param {PointerEvent} e */
    function cropPointerUp(e) {
        cropDragging = false;
        try { /** @type {HTMLElement} */ (e.currentTarget).releasePointerCapture(e.pointerId); } catch {}
    }
    /** @param {WheelEvent} e */
    function cropWheel(e) {
        e.preventDefault();
        const delta = -e.deltaY * 0.0015;
        cropZoom = Math.max(0.3, Math.min(4, cropZoom + delta));
    }

    let mainImage = $state("");
    let mainImageObjectX = $state(50);
    let mainImageObjectY = $state(50);
    let title = $state("");
    let titleColor = $state("#ffffff");
    let titleOffsetY = $state(0);
    let subtitle = $state("");
    let hoverText = $state("");
    let cta = $state("הקלק לפרטים והזמנות");
    // גרדיאנט כמחרוזת CSS - תואם לשדה color של adsData.js באתר הזה
    let gradient = $state("linear-gradient(135deg, #f59e0b, #ea580c)");
    let diagHeight = $state(12);

    // שדות דף הנחיתה - נטענים/נשמרים יחד עם הטיוטה, נערכים בדף ההמשך
    let landingHeadline = $state("");
    let landingPitch = $state("");
    let landingExtended = $state("");
    let landingImage = $state("");
    /** @type {[string, string, string]} */
    let landingAdvantages = $state(["", "", ""]);
    let uniqueness = $state("");
    let phone = $state("");
    let whatsapp = $state("");
    let website = $state("");
    let email = $state(data?.layoutUser?.email ?? "");
    let address = $state("");
    let hours = $state("");
    /** @type {Array<{ id: number, name: string, price: string, image: string, description: string }>} */
    let products = $state([]);
    let nextProductId = 1;

    // ===== מדריך שלבים =====
    /** @typedef {'image' | 'logo' | 'title' | 'gradient' | 'subtitle' | 'hover' | 'preview' | 'done'} Step */
    /** @type {Step[]} */
    const stepOrder = ["image", "logo", "title", "gradient", "subtitle", "hover", "preview"];
    let activeStep = $state(/** @type {Step} */ ("image"));

    /** @type {Record<string, { num: boolean, title: boolean }>} */
    const litFlags = $state({
        image: { num: false, title: false },
        logo: { num: false, title: false },
        title: { num: false, title: false },
        gradient: { num: false, title: false },
        subtitle: { num: false, title: false },
        hover: { num: false, title: false },
        preview: { num: false, title: false },
        done: { num: false, title: false },
    });

    const NUM_MS = 700;
    const TITLE_MS = 1500;

    /** @param {Step} step */
    function flashStep(step) {
        /** @type {number[]} */
        const timers = [];
        litFlags[step].num = true;
        timers.push(window.setTimeout(() => (litFlags[step].num = false), NUM_MS));
        timers.push(window.setTimeout(() => (litFlags[step].title = true), NUM_MS));
        timers.push(window.setTimeout(() => (litFlags[step].title = false), NUM_MS + TITLE_MS));
        return () => timers.forEach(clearTimeout);
    }

    $effect(() => {
        if (!browser) return;
        const cleanup = flashStep(activeStep);
        return cleanup;
    });

    /** @type {Record<string, HTMLElement | null>} */
    let stepRefs = $state({
        image: null, logo: null, title: null, gradient: null,
        subtitle: null, hover: null, preview: null, done: null,
    });

    // הדמו "קופץ" להתיישר עם השלב הפעיל
    let demoTop = $state(0);
    function updateDemoPosition() {
        if (!browser) return;
        const stepEl = stepRefs[activeStep];
        if (!stepEl) return;
        const colsEl = stepEl.closest(".builder-cols");
        if (!(colsEl instanceof HTMLElement)) return;
        const stepRect = stepEl.getBoundingClientRect();
        const colsRect = colsEl.getBoundingClientRect();
        demoTop = stepRect.top - colsRect.top;
    }
    $effect(() => {
        // מעקב אחרי activeStep + שינויי גודל חלון
        void activeStep;
        if (!browser) return;
        requestAnimationFrame(updateDemoPosition);
        const onResize = () => requestAnimationFrame(updateDemoPosition);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    });

    // גובה הפס האלכסוני - משתני CSS גלובליים שכל התצוגות משתמשות בהם
    $effect(() => {
        if (!browser) return;
        const topLeft = Math.max(0, Math.min(100, 100 - diagHeight));
        const topRight = Math.max(0, topLeft - 10);
        document.documentElement.style.setProperty("--diag-top-left", `${topLeft}%`);
        document.documentElement.style.setProperty("--diag-top-right", `${topRight}%`);
    });

    /**
     * @param {HTMLElement | null} el
     * @param {number} [duration]
     */
    function slowScrollTo(el, duration = 1400) {
        if (!el) return;
        const startY = window.scrollY;
        const stickyHeader = document.querySelector("header");
        const headerOffset = stickyHeader ? stickyHeader.offsetHeight + 16 : 16;
        const targetY = el.getBoundingClientRect().top + window.scrollY - headerOffset;
        const distance = targetY - startY;
        if (Math.abs(distance) < 4) return;
        const startTime = performance.now();
        /** @param {number} t */
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        /** @param {number} nowTs */
        function step(nowTs) {
            const elapsed = nowTs - startTime;
            const t = Math.min(1, elapsed / duration);
            window.scrollTo(0, startY + distance * ease(t));
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    /** @param {Step} to */
    function advance(to) {
        activeStep = to;
        queueMicrotask(() => slowScrollTo(stepRefs[to]));
        if (browser) {
            requestAnimationFrame(() => requestAnimationFrame(updateDemoPosition));
        }
    }

    /** @param {Step} s */
    function nextOf(s) {
        const i = stepOrder.indexOf(s);
        return stepOrder[Math.min(i + 1, stepOrder.length - 1)];
    }
    /** @param {Step} s */
    function prevOf(s) {
        const i = stepOrder.indexOf(s);
        return stepOrder[Math.max(i - 1, 0)];
    }

    // ===== גרירת קבצים =====
    let isDraggingMain = $state(false);
    let isDraggingLogo = $state(false);

    // ===== העלאת תמונות + דחיסה אוטומטית מתחת ל-5MB =====
    /** @param {File} file */
    async function fileToDataUrl(file) {
        return new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result));
            fr.onerror = rej;
            fr.readAsDataURL(file);
        });
    }
    /** @param {string} dataUrl */
    function approxDataUrlBytes(dataUrl) {
        const i = dataUrl.indexOf(",");
        const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
        return Math.ceil((b64.length * 3) / 4);
    }
    /**
     * @param {File} file
     * @param {number} maxBytes
     */
    async function compressImageToFit(file, maxBytes) {
        const originalMB = file.size / (1024 * 1024);
        if (file.size <= maxBytes) {
            const dataUrl = await fileToDataUrl(file);
            return { dataUrl, wasCompressed: false, originalMB, finalMB: originalMB };
        }
        const srcUrl = await fileToDataUrl(file);
        const img = new Image();
        img.src = String(srcUrl);
        await new Promise((resolve, reject) => { img.onload = () => resolve(undefined); img.onerror = () => reject(new Error("image load failed")); });

        let w = img.naturalWidth, h = img.naturalHeight;
        const MAX_EDGE = 2400;
        const longest = Math.max(w, h);
        if (longest > MAX_EDGE) {
            const scale = MAX_EDGE / longest;
            w = Math.round(w * scale);
            h = Math.round(h * scale);
        }
        let quality = 0.85;
        let dataUrl = "";
        for (let attempt = 0; attempt < 10; attempt++) {
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            const c = canvas.getContext("2d");
            if (!c) break;
            c.drawImage(img, 0, 0, w, h);
            dataUrl = canvas.toDataURL("image/jpeg", quality);
            if (approxDataUrlBytes(dataUrl) <= maxBytes) break;
            if (quality > 0.5) {
                quality -= 0.1;
            } else {
                w = Math.round(w * 0.85);
                h = Math.round(h * 0.85);
                quality = 0.7;
            }
        }
        return { dataUrl, wasCompressed: true, originalMB, finalMB: approxDataUrlBytes(dataUrl) / (1024 * 1024) };
    }

    let compressNotice = $state({ visible: false, originalMB: 0, finalMB: 0 });
    /** @type {number | null} */
    let compressNoticeTimer = null;
    /**
     * @param {number} originalMB
     * @param {number} finalMB
     */
    function showCompressNotice(originalMB, finalMB) {
        if (compressNoticeTimer) { clearTimeout(compressNoticeTimer); compressNoticeTimer = null; }
        compressNotice = { visible: true, originalMB, finalMB };
        compressNoticeTimer = window.setTimeout(() => {
            compressNotice = { ...compressNotice, visible: false };
            compressNoticeTimer = null;
        }, 9000);
    }
    function dismissCompressNotice() {
        if (compressNoticeTimer) { clearTimeout(compressNoticeTimer); compressNoticeTimer = null; }
        compressNotice = { ...compressNotice, visible: false };
    }

    /**
     * @param {File | null | undefined} file
     * @param {'main' | 'logo'} target
     */
    async function processImageFile(file, target) {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            alert("נא להעלות קובץ תמונה");
            return;
        }
        const MAX_BYTES = 5 * 1024 * 1024;
        const { dataUrl: url, wasCompressed, originalMB, finalMB } = await compressImageToFit(file, MAX_BYTES);
        if (wasCompressed) showCompressNotice(originalMB, finalMB);
        if (target === "main") {
            mainImage = String(url);
            mainImageObjectX = 50;
            mainImageObjectY = 50;
        } else {
            logoOriginal = String(url);
            logo = String(url);
            hasCircleCrop = false;
            if (logoShape === "circle") openCropper();
        }
    }

    /**
     * @param {Event} e
     * @param {'main' | 'logo'} target
     */
    async function handleImage(e, target) {
        const input = /** @type {HTMLInputElement} */ (e.target);
        await processImageFile(input.files?.[0], target);
    }

    /** @param {'main' | 'logo'} target */
    function clearImage(target) {
        if (target === "main") { mainImage = ""; mainImageObjectX = 50; mainImageObjectY = 50; }
        else { logo = ""; logoOriginal = ""; hasCircleCrop = false; }
    }
    /** @param {'up' | 'down' | 'left' | 'right'} dir */
    function nudgeMainImage(dir) {
        const STEP = 8;
        if (dir === "up") mainImageObjectY = Math.max(0, mainImageObjectY - STEP);
        if (dir === "down") mainImageObjectY = Math.min(100, mainImageObjectY + STEP);
        if (dir === "left") mainImageObjectX = Math.max(0, mainImageObjectX - STEP);
        if (dir === "right") mainImageObjectX = Math.min(100, mainImageObjectX + STEP);
    }

    /**
     * @param {DragEvent} e
     * @param {(v: boolean) => void} setActive
     */
    function dragOver(e, setActive) {
        if (!e.dataTransfer?.types.includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
        setActive(true);
    }
    /**
     * @param {DragEvent} e
     * @param {(v: boolean) => void} setActive
     */
    function dragLeave(e, setActive) {
        e.preventDefault();
        e.stopPropagation();
        setActive(false);
    }
    /**
     * @param {DragEvent} e
     * @param {'main' | 'logo'} target
     * @param {(v: boolean) => void} setActive
     */
    async function handleDrop(e, target, setActive) {
        e.preventDefault();
        e.stopPropagation();
        setActive(false);
        await processImageFile(e.dataTransfer?.files?.[0], target);
    }

    /** @param {Step} field */
    function commitField(field) {
        if (activeStep !== field) return;
        advance(nextOf(field));
    }

    // ===== פלטת צבעים - גרדיאנטים כמחרוזות CSS =====
    const palettes = [
        { id: "amber",    label: "ענבר",       cls: "linear-gradient(135deg, #f59e0b, #ea580c)" },
        { id: "orange",   label: "כתום",       cls: "linear-gradient(135deg, #f97316, #ef4444)" },
        { id: "yellow",   label: "צהוב",       cls: "linear-gradient(135deg, #facc15, #f59e0b)" },
        { id: "red",      label: "אדום",       cls: "linear-gradient(135deg, #dc2626, #db2777)" },
        { id: "rose",     label: "ורוד עז",    cls: "linear-gradient(135deg, #f43f5e, #c026d3)" },
        { id: "crimson",  label: "בורדו",      cls: "linear-gradient(135deg, #be123c, #7f1d1d)" },
        { id: "fuchsia",  label: "פוקסיה",     cls: "linear-gradient(135deg, #d946ef, #9333ea)" },
        { id: "purple",   label: "סגול",       cls: "linear-gradient(135deg, #9333ea, #db2777)" },
        { id: "violet",   label: "סגול כהה",   cls: "linear-gradient(135deg, #7c3aed, #4338ca)" },
        { id: "indigo",   label: "אינדיגו",    cls: "linear-gradient(135deg, #4f46e5, #2563eb)" },
        { id: "blue",     label: "כחול",       cls: "linear-gradient(135deg, #2563eb, #0891b2)" },
        { id: "sky",      label: "תכלת",       cls: "linear-gradient(135deg, #38bdf8, #3b82f6)" },
        { id: "teal",     label: "טורקיז",     cls: "linear-gradient(135deg, #14b8a6, #0891b2)" },
        { id: "emerald",  label: "אזמרגד",     cls: "linear-gradient(135deg, #10b981, #0f766e)" },
        { id: "green",    label: "ירוק",       cls: "linear-gradient(135deg, #16a34a, #059669)" },
        { id: "lime",     label: "ליים",       cls: "linear-gradient(135deg, #a3e635, #22c55e)" },
        { id: "slate",    label: "אפור",       cls: "linear-gradient(135deg, #64748b, #374151)" },
        { id: "dark",     label: "כהה",        cls: "linear-gradient(135deg, #1f2937, #0f172a)" },
        { id: "peach",    label: "אפרסק",      cls: "linear-gradient(135deg, #fdba74, #f472b6)" },
        { id: "mint",     label: "מנטה",       cls: "linear-gradient(135deg, #6ee7b7, #2dd4bf)" },
        { id: "gold",     label: "זהב",        cls: "linear-gradient(135deg, #eab308, #b45309)" },
        { id: "midnight", label: "חצות",       cls: "linear-gradient(135deg, #334155, #1e3a8a)" },
    ];

    const titleColors = [
        { c: "#ffffff", label: "לבן" },
        { c: "#fbbf24", label: "זהב" },
        { c: "#fde047", label: "צהוב" },
        { c: "#fb923c", label: "כתום" },
        { c: "#f87171", label: "אדום" },
        { c: "#f9a8d4", label: "ורוד" },
        { c: "#c4b5fd", label: "סגול" },
        { c: "#67e8f9", label: "תכלת" },
        { c: "#86efac", label: "ירוק" },
        { c: "#0f172a", label: "שחור" },
    ];

    // ===== תצוגה מקדימה =====
    let previewMode = $state(/** @type {'mobile' | 'desktop'} */ ("mobile"));
    let hoverPreview = $state(false);
    // בשלב 6 (טקסט בריחוף) מציגים אוטומטית את הצד האחורי של הפרסומת
    const showHover = $derived(hoverPreview || activeStep === "hover");

    // ===== שערת גישה =====
    function checkAccess() {
        if (!browser) return;
        const paid = localStorage.getItem(PAID_KEY) === "1";
        accessGranted = isAdmin || paid;
        accessChecked = true;
    }

    // ===== קוד גישה בשער =====
    // פקודה מאחורי הקלעים: הקוד עצמו לא כתוב בשום מקום באתר — מי שמקבל
    // אותו מהמנהלים (או מכיר את התנועה) נכנס מיד, והמודעה שלו ממשיכה
    // לאישור האדמין כאילו שילם.
    let gateCode = $state("");
    let gateCodeError = $state(false);
    /** @param {SubmitEvent} e */
    function tryGateCode(e) {
        e.preventDefault();
        const normalized = gateCode.trim().replace(/\s+/g, " ");
        if (normalized === "יוצאים לחירות") {
            const nowIso = new Date().toISOString();
            try {
                localStorage.setItem(PAID_KEY, "1");
                localStorage.setItem(PAID_AT_KEY, nowIso);
            } catch {}
            paidAt = new Date(nowIso);
            gateCodeError = false;
            checkAccess();
        } else {
            gateCodeError = true;
        }
    }

    // ===== שמירה אוטומטית =====
    onMount(() => {
        if (!browser) return;
        checkAccess();

        // מניעת פתיחת תמונה בטאב חדש כשהגרירה מפספסת את אזור ההעלאה
        /** @param {DragEvent} e */
        const blockOutsideDrop = (e) => {
            if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
        };
        window.addEventListener("dragover", blockOutsideDrop);
        window.addEventListener("drop", blockOutsideDrop);

        let storedPaidAt = localStorage.getItem(PAID_AT_KEY);
        if (!storedPaidAt && accessGranted) {
            storedPaidAt = new Date().toISOString();
            try { localStorage.setItem(PAID_AT_KEY, storedPaidAt); } catch {}
        }
        if (storedPaidAt) {
            const d = new Date(storedPaidAt);
            if (!isNaN(d.getTime())) paidAt = d;
        }

        const tickId = window.setInterval(() => { now = new Date(); }, 60_000);

        /** @param {BeforeUnloadEvent} e */
        const beforeUnload = (e) => {
            if (accessGranted && formDirty && !freeEditExpired) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", beforeUnload);

        if (accessGranted) {
            try {
                const raw = localStorage.getItem(LS_KEY);
                if (raw) {
                    const d = JSON.parse(raw);
                    logo = d.logo ?? "";
                    logoOriginal = d.logoOriginal ?? d.logo ?? "";
                    logoShape = d.logoShape ?? "square";
                    hasCircleCrop = Boolean(d.hasCircleCrop);
                    logoPosition = d.logoPosition ?? "right";
                    logoPositionExplicit = Boolean(d.logoPositionExplicit);
                    mainImage = d.mainImage ?? "";
                    mainImageObjectX = typeof d.mainImageObjectX === "number" ? d.mainImageObjectX : 50;
                    mainImageObjectY = typeof d.mainImageObjectY === "number" ? d.mainImageObjectY : 50;
                    title = d.title ?? "";
                    titleColor = d.titleColor ?? "#ffffff";
                    titleOffsetY = typeof d.titleOffsetY === "number" ? d.titleOffsetY : 0;
                    subtitle = d.subtitle ?? "";
                    hoverText = d.hoverText ?? "";
                    cta = d.cta || "הקלק לפרטים והזמנות";
                    gradient = d.gradient ?? gradient;
                    diagHeight = typeof d.diagHeight === "number" ? d.diagHeight : 12;
                    landingHeadline = d.landingHeadline ?? "";
                    landingPitch = d.landingPitch ?? "";
                    landingExtended = d.landingExtended ?? "";
                    landingImage = d.landingImage ?? "";
                    if (Array.isArray(d.landingAdvantages)) {
                        landingAdvantages = [
                            d.landingAdvantages[0] ?? "",
                            d.landingAdvantages[1] ?? "",
                            d.landingAdvantages[2] ?? "",
                        ];
                    }
                    uniqueness = d.uniqueness ?? "";
                    phone = d.phone ?? phone;
                    whatsapp = d.whatsapp ?? whatsapp;
                    website = d.website ?? "";
                    email = d.email ?? email;
                    address = d.address ?? "";
                    hours = d.hours ?? "";
                    products = Array.isArray(d.products) ? d.products : [];
                    nextProductId = (products.reduce((m, p) => Math.max(m, p.id), 0) || 0) + 1;
                }
            } catch {}
        }

        return () => {
            window.removeEventListener("dragover", blockOutsideDrop);
            window.removeEventListener("drop", blockOutsideDrop);
            window.removeEventListener("beforeunload", beforeUnload);
            window.clearInterval(tickId);
        };
    });

    // ברירת מחדל חכמה למיקום הלוגו: כותרת ארוכה → ליד הכפתור
    $effect(() => {
        if (!logo || logoPositionExplicit) return;
        const next = title.trim().length > 20 ? "cta" : "right";
        if (logoPosition !== next) logoPosition = next;
    });

    // דגל "נערך" לאזהרת beforeunload - רק אחרי עריכה אמיתית בסשן הזה
    let formDirty = $state(false);
    let autosaveRanOnce = false;

    $effect(() => {
        if (!browser) return;
        const snapshot = {
            logo, logoOriginal, hasCircleCrop, logoShape, logoPosition, logoPositionExplicit,
            mainImage, mainImageObjectX, mainImageObjectY, title, titleColor, titleOffsetY,
            subtitle, hoverText, cta, gradient, diagHeight,
            landingHeadline, landingPitch, landingExtended, landingImage, landingAdvantages,
            uniqueness, phone, whatsapp, website, email, address, hours, products,
        };
        try { localStorage.setItem(LS_KEY, JSON.stringify(snapshot)); } catch {}
        if (autosaveRanOnce) {
            formDirty = true;
        } else {
            autosaveRanOnce = true;
        }
    });

    function resetDraft() {
        if (!confirm("לאפס את הטיוטה ולהתחיל מחדש?")) return;
        try { localStorage.removeItem(LS_KEY); } catch {}
        location.reload();
    }

    // ===== מעבר לעריכת דף הנחיתה =====
    let movingToLanding = $state(false);
    async function goToLandingEditor() {
        if (movingToLanding) return;
        movingToLanding = true;
        await goto("/advertise/builder/landing");
    }

    // ===== מודל עזרה בעיצוב - וואטסאפ לאדמין =====
    let helpOpen = $state(false);
    let helpProblem = $state("");
    let helpContact = $state("");
    let helpError = $state("");

    function openHelp() {
        helpProblem = "";
        helpContact = data?.layoutUser?.email ?? data?.layoutUser?.name ?? "";
        helpError = "";
        helpOpen = true;
        queueMicrotask(() => {
            setTimeout(() => document.getElementById("help-problem-input")?.focus(), 30);
        });
    }
    function closeHelp() {
        helpOpen = false;
    }
    function buildDraftSummary() {
        /** @type {string[]} */
        const parts = [];
        if (title) parts.push(`כותרת: "${title}"`);
        if (subtitle) parts.push(`סלוגן: "${subtitle}"`);
        if (mainImage) parts.push("יש תמונה ראשית");
        if (logo) parts.push("יש לוגו");
        if (hoverText) parts.push(`טקסט ריחוף: "${hoverText.slice(0, 60)}${hoverText.length > 60 ? "…" : ""}"`);
        return parts.join(" · ");
    }
    function submitHelp() {
        const problem = helpProblem.trim();
        const contact = helpContact.trim();
        if (problem.length < 5) {
            helpError = "נא לתאר את הבעיה (לפחות כמה מילים)";
            return;
        }
        const isLoggedIn = Boolean(data?.layoutUser?.email || data?.layoutUser?.name);
        if (!isLoggedIn && !contact) {
            helpError = "נא להשאיר דרך ליצירת קשר";
            return;
        }
        helpError = "";
        const identity = contact || data?.layoutUser?.email || data?.layoutUser?.name || "אנונימי";
        const draftSummary = buildDraftSummary();
        const waText =
            `שלום! אני צריך/ה עזרה בעיצוב הפרסומת באתר הגמ"ח הארצי 🆘\n\n` +
            `🧑 ${identity}\n\n` +
            `הבעיה:\n"${problem}"` +
            (draftSummary ? `\n\nמצב הטיוטה: ${draftSummary}` : "");
        const waUrl = `https://wa.me/${ADMIN_WA_NUMBER}?text=${encodeURIComponent(waText)}`;
        window.open(waUrl, "_blank", "noopener,noreferrer");
        helpOpen = false;
    }
</script>

<svelte:head>
    <title>בניית הפרסומת שלי | הגמ"ח הארצי</title>
</svelte:head>

{#if accessChecked && !accessGranted}
    <!-- ===== שערה - נדרש תשלום ===== -->
    <div class="gate" dir="rtl">
        <div class="gate-icon">🔒</div>
        <h1>בונה הפרסומות פתוח למפרסמים</h1>
        <p>
            כדי לבנות ולהעלות פרסומת יש להסדיר קודם את התשלום.
        </p>
        <div class="gate-actions">
            <a href="/advertise" class="b-btn amber">לדף הפרסום והתשלום</a>
            <a
                href={"https://wa.me/972508750632?text=" + encodeURIComponent("שלום, שילמתי על פרסום באתר הגמ\"ח הארצי ואני צריך גישה לבונה הפרסומות")}
                target="_blank"
                rel="noopener noreferrer"
                class="b-btn green"
            >שילמתי - צרו איתי קשר</a>
        </div>
        <!-- שדה קוד — בלי לרמוז מהו הקוד; מי שיודע אותו נכנס מיד -->
        <form class="gate-code" onsubmit={tryGateCode}>
            <input
                type="text"
                bind:value={gateCode}
                placeholder="יש לכם קוד? הזינו אותו כאן"
                class="gate-code-input"
                aria-label="קוד גישה"
            />
            <button type="submit" class="b-btn amber">אישור</button>
        </form>
        {#if gateCodeError}
            <div class="gate-code-error">הקוד לא זוהה — בדקו את האיות ונסו שוב</div>
        {/if}
    </div>
{:else if !accessChecked}
    <div style="min-height: 40vh;" aria-hidden="true"></div>
{:else}
    <div class="ad-builder" dir="rtl">

        <!-- הודעה צפה: תמונה נדחסה אוטומטית -->
        {#if compressNotice.visible}
            <div class="compress-toast" role="status" aria-live="polite">
                <button type="button" class="compress-toast-close" onclick={dismissCompressNotice} aria-label="סגור הודעה">✕</button>
                <div class="compress-toast-body">
                    <span class="compress-toast-icon">🪄</span>
                    <div>
                        <p class="ct-title">התמונה כווצה אוטומטית</p>
                        <p class="ct-text">
                            הגודל המקסימלי הוא <strong>5MB</strong>.
                            התמונה שלך ({compressNotice.originalMB.toFixed(1)}MB) כווצה
                            ל-<strong>{compressNotice.finalMB.toFixed(1)}MB</strong>.
                            <br />אם האיכות לא מספיקה - נסו תמונה קלה יותר.
                        </p>
                    </div>
                </div>
            </div>
        {/if}

        <!-- כותרת -->
        <div class="b-hero">
            <div class="b-hero-icon">🎨</div>
            <h1 class="b-hero-title">בונה הפרסומות</h1>
            <p class="b-hero-sub">
                מעצבים את הפרסומת שלכם צעד-צעד - בדיוק כפי שתיראה באתר.
                <br />כל שינוי נשמר אוטומטית.
            </p>

            <!-- ספירה לאחור ליום העריכה החינמי -->
            {#if paidAt && !freeEditExpired && freeEditUntil}
                <div class="b-countdown">
                    <span class="b-cd-icon">⏰</span>
                    <div>
                        <p class="b-cd-title">יום העריכה החינמי פעיל</p>
                        <p class="b-cd-text">
                            נותרו <strong>{fmtCountdown(freeMsRemaining)}</strong>
                            שעות לסיום העריכה בחינם. <strong>כדאי לסיים היום!</strong>
                            הפרסום ירוץ עד {fmtDateShort(new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000))}.
                        </p>
                    </div>
                </div>
            {:else if paidAt && freeEditExpired}
                <div class="b-expired">
                    <span class="b-cd-icon">⌛</span>
                    <div>
                        <p class="b-cd-title red">יום העריכה החינמי הסתיים</p>
                        <p class="b-cd-text">אפשר עדיין לערוך ולשלוח - צרו קשר אם צריך עזרה.</p>
                    </div>
                </div>
            {/if}

            <!-- שמירה אוטומטית -->
            <div class="b-autosave">
                <span class="b-cd-icon">💾</span>
                <div>
                    <p class="b-as-title">הטיוטה נשמרת אוטומטית</p>
                    <p class="b-cd-text">
                        אפשר לצאת מהדף ולחזור - כל מה שהזנתם מחכה לכם כאן.
                    </p>
                </div>
            </div>

            <div class="b-reset-row">
                <button type="button" onclick={resetDraft} class="b-reset">🗑 איפוס הטיוטה והתחלה מחדש</button>
            </div>
        </div>

        <!-- ========== שתי עמודות: שלבים מימין, דמו חי משמאל ========== -->
        <div class="builder-cols">
            <div class="builder-steps">

                <!-- =================== שלב 1: תמונה ראשית =================== -->
                <section bind:this={stepRefs.image} class="step-card">
                    <div class="step-head" class:step-title-light={litFlags.image.title}>
                        <span class="step-num" class:step-num-light={litFlags.image.num}>1</span>
                        <h2>העלו את התמונה הראשית</h2>
                        {#if activeStep === "image"}
                            <span class="tutorial-finger" aria-hidden="true">👇</span>
                        {/if}
                    </div>
                    <p class="step-help">זו התמונה הגדולה שממלאת את הפרסומת. בחרו תמונה איכותית שמייצגת את העסק.</p>

                    <div class="step1-grid">
                        <div class="tips-box">
                            <p class="tips-title">💡 טיפים לתמונה מנצחת</p>
                            <ul>
                                <li>📸 תמונה חדה ומוארת היטב</li>
                                <li>🎯 מוקד אחד ברור - מוצר, מנה או חזית העסק</li>
                                <li>🌈 צבעים חיים בולטים יותר בפיד</li>
                                <li>🚫 בלי טקסט על התמונה - הטקסט מתווסף בהמשך</li>
                            </ul>
                        </div>

                        <label
                            class="upload-zone"
                            class:has-image={!!mainImage}
                            class:dragging={isDraggingMain}
                            ondragover={(e) => dragOver(e, (v) => (isDraggingMain = v))}
                            ondragleave={(e) => dragLeave(e, (v) => (isDraggingMain = v))}
                            ondrop={(e) => handleDrop(e, "main", (v) => (isDraggingMain = v))}
                        >
                            {#if mainImage}
                                <img src={mainImage} alt="התמונה הראשית" style:object-fit="cover" style:object-position="{mainImageObjectX}% {mainImageObjectY}%" />
                                <button type="button" class="remove-x" onclick={(e) => { e.preventDefault(); clearImage("main"); }} aria-label="הסר תמונה">✕</button>
                                <button type="button" class="crop-arrow up" onclick={(e) => { e.preventDefault(); nudgeMainImage("up"); }} aria-label="הזז למעלה">▲</button>
                                <button type="button" class="crop-arrow down" onclick={(e) => { e.preventDefault(); nudgeMainImage("down"); }} aria-label="הזז למטה">▼</button>
                                <button type="button" class="crop-arrow left" onclick={(e) => { e.preventDefault(); nudgeMainImage("left"); }} aria-label="הזז שמאלה">◀</button>
                                <button type="button" class="crop-arrow right" onclick={(e) => { e.preventDefault(); nudgeMainImage("right"); }} aria-label="הזז ימינה">▶</button>
                                <button type="button" class="crop-reset" onclick={(e) => { e.preventDefault(); mainImageObjectX = 50; mainImageObjectY = 50; }} aria-label="איפוס מיקום">⊙</button>
                            {:else}
                                <div class="upload-empty">
                                    <div class="upload-emoji">📸</div>
                                    <p class="upload-main">{isDraggingMain ? "שחררו כאן! ✨" : "לחצו או גררו תמונה לכאן"}</p>
                                    <p class="upload-note">עד 5MB - תמונות גדולות יכווצו אוטומטית</p>
                                </div>
                            {/if}
                            <input type="file" accept="image/*" onchange={(e) => handleImage(e, "main")} class="hidden-input" />
                        </label>
                    </div>
                    {#if mainImage}
                        <p class="crop-hint">אפשר למרכז את התמונה עם החיצים - התוצאה מוצגת בדמו החי</p>
                        <div class="step-nav-row">
                            <button type="button" class="step-nav-btn" onclick={() => advance("logo")}>סיימתי למרכז - לשלב הבא ←</button>
                        </div>
                    {/if}
                </section>

                <!-- =================== שלב 2: לוגו =================== -->
                <section bind:this={stepRefs.logo} class="step-card">
                    <div class="step-head" class:step-title-light={litFlags.logo.title}>
                        <span class="step-num" class:step-num-light={litFlags.logo.num}>2</span>
                        <h2>לוגו העסק (לא חובה)</h2>
                        {#if activeStep === "logo"}
                            <span class="tutorial-finger" aria-hidden="true">👇</span>
                        {/if}
                    </div>
                    <p class="step-help">הלוגו מופיע בפינת הפרסומת - <strong class="amber-strong">מומלץ</strong> אך אפשר לדלג.</p>

                    <div class="logo-row">
                        <div class="logo-upload-col">
                            <label
                                class="upload-zone-sm"
                                class:has-image={!!logo}
                                class:dragging={isDraggingLogo}
                                ondragover={(e) => dragOver(e, (v) => (isDraggingLogo = v))}
                                ondragleave={(e) => dragLeave(e, (v) => (isDraggingLogo = v))}
                                ondrop={(e) => handleDrop(e, "logo", (v) => (isDraggingLogo = v))}
                            >
                                {#if logo}
                                    <img src={logo} alt="לוגו" />
                                    <button type="button" class="remove-x" onclick={(e) => { e.preventDefault(); clearImage("logo"); }} aria-label="הסר לוגו">✕</button>
                                {:else}
                                    <div class="upload-sm-empty">
                                        <div class="upload-sm-emoji">{isDraggingLogo ? "✨" : "🏷️"}</div>
                                        <p>{isDraggingLogo ? "שחררו!" : "העלו לוגו"}</p>
                                    </div>
                                {/if}
                                <input type="file" accept="image/*" onchange={(e) => handleImage(e, "logo")} class="hidden-input" />
                            </label>
                            {#if logo && logoShape === "circle" && hasCircleCrop}
                                <button type="button" onclick={openCropper} class="edit-crop-link">עריכת החיתוך</button>
                            {/if}
                        </div>

                        {#if logo}
                            <div class="logo-controls">
                                <div>
                                    <p class="control-label">צורת החיתוך</p>
                                    <div class="seg-group">
                                        <button type="button" onclick={chooseSquare} class="seg-btn" class:active={logoShape === "square"}>⬜ מרובע</button>
                                        <button type="button" onclick={chooseCircle} class="seg-btn" class:active={logoShape === "circle"}>⚪ עגול</button>
                                    </div>
                                </div>
                                <div>
                                    <p class="control-label">מיקום הלוגו</p>
                                    <div class="seg-group">
                                        <button type="button" onclick={() => { logoPosition = "right"; logoPositionExplicit = true; }} class="seg-btn" class:active={logoPosition === "right"}>ימין</button>
                                        <button type="button" onclick={() => { logoPosition = "left"; logoPositionExplicit = true; }} class="seg-btn" class:active={logoPosition === "left"}>שמאל</button>
                                        <button type="button" onclick={() => { logoPosition = "cta"; logoPositionExplicit = true; }} class="seg-btn" class:active={logoPosition === "cta"}>למטה</button>
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>

                    <div class="step-nav-row">
                        <button type="button" class="step-nav-btn" onclick={() => advance(prevOf("logo"))}>→ שלב אחורה</button>
                        <button type="button" class="step-nav-btn" onclick={() => advance("title")}>
                            {logo ? "לשלב הבא ←" : "דילוג על הלוגו ←"}
                        </button>
                    </div>

                    <!-- ===== מודל חיתוך עגול ===== -->
                    {#if cropOpen}
                        <div class="crop-modal-bg" role="dialog" aria-modal="true" aria-label="חיתוך הלוגו לעיגול">
                            <div class="crop-modal">
                                <div class="crop-modal-head">
                                    <h3>חיתוך עגול ללוגו</h3>
                                    <button type="button" class="crop-modal-x" onclick={cancelCrop} aria-label="סגור">✕</button>
                                </div>
                                <p class="crop-help">גררו את התמונה למיקום הרצוי, והשתמשו בגלגלת או במחוון לזום.</p>
                                <div
                                    class="crop-stage"
                                    onpointerdown={cropPointerDown}
                                    onpointermove={cropPointerMove}
                                    onpointerup={cropPointerUp}
                                    onpointercancel={cropPointerUp}
                                    onwheel={cropWheel}
                                >
                                    <img
                                        src={logoOriginal}
                                        alt="לוגו"
                                        class="crop-img"
                                        draggable="false"
                                        style:transform="translate({cropOffsetX}px, {cropOffsetY}px) scale({cropZoom})"
                                    />
                                    <div class="crop-circle-mask"></div>
                                </div>
                                <div class="crop-controls">
                                    <span class="crop-zoom-label">זום</span>
                                    <input type="range" min="0.3" max="4" step="0.01" bind:value={cropZoom} class="crop-zoom-slider" aria-label="רמת הזום" />
                                    <span class="crop-zoom-val">{Math.round(cropZoom * 100)}%</span>
                                </div>
                                <div class="crop-actions">
                                    <button type="button" class="crop-btn-cancel" onclick={cancelCrop}>ביטול</button>
                                    <button type="button" class="crop-btn-confirm" onclick={confirmCrop}>אישור החיתוך ✓</button>
                                </div>
                            </div>
                        </div>
                    {/if}
                </section>

                <!-- =================== שלב 3: כותרת =================== -->
                <section bind:this={stepRefs.title} class="step-card">
                    <div class="step-head" class:step-title-light={litFlags.title.title}>
                        <span class="step-num" class:step-num-light={litFlags.title.num}>3</span>
                        <h2>כותרת הפרסומת</h2>
                        {#if activeStep === "title"}
                            <span class="tutorial-finger" aria-hidden="true">👇</span>
                        {/if}

                        <div class="title-color-rail" aria-label="בחירת צבע הכותרת">
                            <span class="title-color-label">צבע:</span>
                            {#each titleColors as p}
                                <button
                                    type="button"
                                    onclick={() => (titleColor = p.c)}
                                    class="title-color-dot"
                                    class:selected={titleColor === p.c}
                                    style:background={p.c}
                                    title={p.label}
                                    aria-label={p.label}
                                    aria-pressed={titleColor === p.c}
                                ></button>
                            {/each}
                            <label class="title-color-custom" title="צבע מותאם אישית">
                                <input type="color" bind:value={titleColor} aria-label="בחירת צבע מותאם" />
                                <span>🎨</span>
                            </label>
                        </div>
                    </div>
                    <p class="step-help">שם העסק או המסר המרכזי - קצר וקליט (עד 35 תווים).</p>

                    <input
                        type="text"
                        bind:value={title}
                        maxlength="35"
                        onfocus={() => activeStep === "title" || (activeStep = "title")}
                        onblur={() => title.trim() && commitField("title")}
                        placeholder="למשל: פיצה של אמא"
                        class="text-input"
                    />
                    <div class="char-count">{title.length}/35</div>

                    <div class="slider-block">
                        <div class="slider-head">
                            <p>מיקום הכותרת <span class="amber-strong">{titleOffsetY > 0 ? `+${titleOffsetY}` : titleOffsetY}px</span></p>
                            <button type="button" onclick={() => (titleOffsetY = 0)} class="slider-reset">איפוס</button>
                        </div>
                        <input type="range" min="-20" max="60" step="1" bind:value={titleOffsetY} class="range-input" aria-label="מיקום אנכי של הכותרת" />
                        <div class="slider-labels"><span>למעלה</span><span>למטה</span></div>
                    </div>

                    <div class="step-nav-row">
                        <button type="button" class="step-nav-btn" onclick={() => advance(prevOf("title"))}>→ שלב אחורה</button>
                        {#if title}
                            <button type="button" class="step-nav-btn" onclick={() => commitField("title")}>לשלב הבא ←</button>
                        {/if}
                    </div>
                </section>

                <!-- =================== שלב 4: צבע הפס =================== -->
                <section bind:this={stepRefs.gradient} class="step-card">
                    <div class="step-head" class:step-title-light={litFlags.gradient.title}>
                        <span class="step-num" class:step-num-light={litFlags.gradient.num}>4</span>
                        <h2>צבע הפס והכפתור</h2>
                        {#if activeStep === "gradient"}
                            <span class="tutorial-finger" aria-hidden="true">👇</span>
                        {/if}
                    </div>
                    <p class="step-help">הצבע של הפס האלכסוני על התמונה ושל כפתור הקריאה לפעולה.</p>

                    <p class="control-label">צבע הפס</p>
                    <div class="color-rail" aria-label="בחירת צבע הפס">
                        {#each palettes as p}
                            <button
                                type="button"
                                onclick={() => (gradient = p.cls)}
                                class="color-dot"
                                class:selected={gradient === p.cls}
                                style:background={p.cls}
                                title={p.label}
                                aria-label={p.label}
                                aria-pressed={gradient === p.cls}
                            ></button>
                        {/each}
                    </div>

                    <div class="slider-block">
                        <div class="slider-head">
                            <p>גובה הפס <span class="amber-strong">{diagHeight}%</span> מהתמונה</p>
                        </div>
                        <input type="range" min="5" max="50" step="1" bind:value={diagHeight} class="range-input" aria-label="גובה הפס האלכסוני" />
                        <div class="slider-labels"><span>נמוך</span><span>גבוה</span></div>
                    </div>

                    <div class="step-nav-row">
                        <button type="button" class="step-nav-btn" onclick={() => advance(prevOf("gradient"))}>→ שלב אחורה</button>
                        <button type="button" class="step-nav-btn" onclick={() => advance("subtitle")}>ממשיכים לשלב הבא ←</button>
                    </div>
                </section>

                <!-- =================== שלב 5: סלוגן =================== -->
                <section bind:this={stepRefs.subtitle} class="step-card">
                    <div class="step-head" class:step-title-light={litFlags.subtitle.title}>
                        <span class="step-num" class:step-num-light={litFlags.subtitle.num}>5</span>
                        <h2>משפט קצר / סלוגן</h2>
                        {#if activeStep === "subtitle"}
                            <span class="tutorial-finger" aria-hidden="true">👇</span>
                        {/if}
                    </div>
                    <p class="step-help">מופיע על הפס הצבעוני בתחתית הפרסומת (עד 70 תווים).</p>

                    <input
                        type="text"
                        bind:value={subtitle}
                        maxlength="70"
                        onfocus={() => activeStep === "subtitle" || (activeStep = "subtitle")}
                        onblur={() => subtitle.trim() && commitField("subtitle")}
                        placeholder="למשל: משלוחים חינם עד הבית בכל הארץ"
                        class="text-input"
                    />
                    <div class="char-count">{subtitle.length}/70</div>

                    <div class="step-nav-row">
                        <button type="button" class="step-nav-btn" onclick={() => advance(prevOf("subtitle"))}>→ שלב אחורה</button>
                        {#if subtitle}
                            <button type="button" class="step-nav-btn" onclick={() => commitField("subtitle")}>לשלב הבא ←</button>
                        {/if}
                    </div>
                </section>

                <!-- =================== שלב 6: טקסט בריחוף =================== -->
                <section bind:this={stepRefs.hover} class="step-card">
                    <div class="step-head" class:step-title-light={litFlags.hover.title}>
                        <span class="step-num" class:step-num-light={litFlags.hover.num}>6</span>
                        <h2>טקסט בריחוף העכבר</h2>
                        {#if activeStep === "hover"}
                            <span class="tutorial-finger" aria-hidden="true">👇</span>
                        {/if}
                    </div>
                    <p class="step-help">
                        כשגולש מרחף עם העכבר מעל הפרסומת - התמונה מתחלפת בטקסט הזה.
                        <br /><strong class="amber-strong">זה המקום למכור:</strong> מה מקבלים, למה דווקא אתם (עד 90 תווים).
                    </p>

                    <textarea
                        bind:value={hoverText}
                        maxlength="90"
                        rows="2"
                        onfocus={() => activeStep === "hover" || (activeStep = "hover")}
                        onblur={() => hoverText.trim() && commitField("hover")}
                        placeholder="למשל: 20% הנחה לחברי הקבוצה על כל התפריט!"
                        class="text-input"
                    ></textarea>
                    <div class="char-count">{hoverText.length}/90</div>

                    <div class="step-nav-row">
                        <button type="button" class="step-nav-btn" onclick={() => advance(prevOf("hover"))}>→ שלב אחורה</button>
                        {#if hoverText}
                            <button type="button" class="step-nav-btn" onclick={() => commitField("hover")}>לשלב הבא ←</button>
                        {/if}
                    </div>
                </section>

                <!-- =================== שלב 7: תצוגה מקדימה =================== -->
                <section bind:this={stepRefs.preview} class="step-card">
                    <div class="step-head" class:step-title-light={litFlags.preview.title}>
                        <span class="step-num" class:step-num-light={litFlags.preview.num}>7</span>
                        <h2>תצוגה מקדימה</h2>
                        {#if activeStep === "preview"}
                            <span class="tutorial-finger" aria-hidden="true">👇</span>
                        {/if}
                    </div>
                    <p class="step-help">כך תיראה הפרסומת שלכם באתר. עברו עם העכבר על הכרטיס כדי לראות את צד הריחוף.</p>

                    <div class="preview-toggle-row">
                        <div class="seg-group">
                            <button type="button" onclick={() => (previewMode = "mobile")} class="seg-btn" class:active={previewMode === "mobile"}>📱 נייד</button>
                            <button type="button" onclick={() => (previewMode = "desktop")} class="seg-btn" class:active={previewMode === "desktop"}>💻 מחשב</button>
                        </div>
                    </div>

                    {#if previewMode === "mobile"}
                        <div class="preview-frame">
                            <div class="phone-screen">
                                <div class="phone-notch"></div>
                                <div class="phone-content">
                                    <div class="mobile-popup">
                                        <div class="popup-title-row">
                                            {#if logo}
                                                <img src={logo} alt="לוגו" class="popup-logo-above" class:circle={logoShape === "circle"} />
                                            {/if}
                                            <h3 class="popup-title-above" style:color={titleColor}>{title || "כותרת הפרסומת"}</h3>
                                        </div>
                                        <div class="popup-img pro-img-wrap">
                                            {#if mainImage}
                                                <img src={mainImage} alt={title} style:object-position="{mainImageObjectX}% {mainImageObjectY}%" />
                                            {:else}
                                                <div class="img-placeholder">התמונה הראשית</div>
                                            {/if}
                                            <div class="pro-diag" style:background={gradient}></div>
                                            <div class="pro-title-wrap mobile">
                                                <p class="pro-sub">{subtitle || "משפט קצר / סלוגן"}</p>
                                            </div>
                                            <div class="close-countdown">5</div>
                                        </div>
                                        <div class="popup-body">
                                            <button type="button" class="popup-cta" style:background={gradient}>← {cta}</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <p class="preview-caption">כך תיראה הפרסומת בנייד - חלונית שנפתחת לגולש</p>
                        </div>
                    {:else}
                        <div class="preview-frame">
                            <div
                                role="button"
                                tabindex="0"
                                class="clean-card"
                                onmouseenter={() => (hoverPreview = true)}
                                onmouseleave={() => (hoverPreview = false)}
                                onfocus={() => (hoverPreview = true)}
                                onblur={() => (hoverPreview = false)}
                            >
                                <div class="pro-img-wrap clean-card-img">
                                    {#if mainImage}
                                        <img src={mainImage} alt={title} class="ad-img" style:opacity={showHover ? 0 : 1} style:object-position="{mainImageObjectX}% {mainImageObjectY}%" />
                                    {:else}
                                        <div class="img-placeholder">התמונה שלך</div>
                                    {/if}
                                    <div class="pro-diag" style:background={gradient} style:opacity={showHover ? 0 : 1}></div>
                                    <div class="pro-title-top" style:opacity={showHover ? 0 : 1} style:transform="translateY({titleOffsetY}px)">
                                        <h3 class="pro-title" style:color={titleColor}>{title || "כותרת הפרסומת"}</h3>
                                    </div>
                                    <div class="pro-title-wrap" style:opacity={showHover ? 0 : 1}>
                                        <p class="pro-sub">{subtitle || "משפט קצר / סלוגן"}</p>
                                    </div>
                                    <div class="hover-overlay" style:opacity={showHover ? 1 : 0}>
                                        <h3 class="hover-title">{title || "הכותרת"}</h3>
                                        <p class="hover-text">{hoverText || "הטקסט שמופיע בריחוף העכבר"}</p>
                                    </div>
                                    {#if logo}
                                        <img
                                            src={logo}
                                            alt="לוגו"
                                            class="ad-logo"
                                            class:circle={logoShape === "circle"}
                                            class:pos-left={logoPosition === "left"}
                                            class:pos-cta={logoPosition === "cta"}
                                        />
                                    {/if}
                                </div>
                                <div class="ad-cta" style:background={gradient}>
                                    <p>{cta}</p>
                                </div>
                            </div>
                            <p class="preview-caption">כך תיראה הפרסומת במחשב - בעמודת הפרסומות שלצד התוכן</p>
                        </div>
                    {/if}

                    <div class="step-nav-row">
                        <button type="button" class="step-nav-btn" onclick={() => advance(prevOf("preview"))}>→ שלב אחורה</button>
                        <div class="help-wrap">
                            <button type="button" onclick={openHelp} class="help-btn" aria-label="בקשת עזרה בעיצוב">
                                <span aria-hidden="true">😩</span>
                                <span>אני מסתבך! צריך עזרה</span>
                                <span aria-hidden="true">🆘</span>
                            </button>
                        </div>
                        <button type="button" class="step-nav-btn" onclick={goToLandingEditor} disabled={movingToLanding}>
                            {#if movingToLanding}
                                ⏳ עוברים לדף הנחיתה...
                            {:else}
                                נראה מעולה 👍 לשלב הבא ←
                            {/if}
                        </button>
                    </div>
                </section>

            </div><!-- /.builder-steps -->

            <!-- ========== דמו חי - קופץ להתיישר עם השלב הפעיל ========== -->
            <aside class="builder-demo" aria-label="דמו חי של הפרסומת" style:top="{demoTop}px">
                <div class="live-demo-card">
                    <p class="live-demo-label">👁 דמו חי</p>
                    <div class="live-demo-frame" dir="rtl">
                        <div class="pro-img-wrap live-demo-img-wrap">
                            {#if mainImage}
                                <img
                                    src={mainImage}
                                    alt={title}
                                    class="ad-img"
                                    style:object-position="{mainImageObjectX}% {mainImageObjectY}%"
                                    style:opacity={activeStep === "hover" ? 0 : 1}
                                />
                            {:else}
                                <div class="placeholder-dashed placeholder-img" style:opacity={activeStep === "hover" ? 0 : 1}>
                                    <div class="placeholder-icon">📸</div>
                                    <p>התמונה הראשית</p>
                                    <p class="placeholder-hint">שלב 1</p>
                                </div>
                            {/if}
                            <div class="pro-diag" style:background={gradient} style:opacity={activeStep === "hover" ? 0 : 1}></div>
                            <div class="pro-title-top" style:transform="translateY({titleOffsetY}px)" style:opacity={activeStep === "hover" ? 0 : 1}>
                                {#if title}
                                    <h3 class="pro-title" style:color={titleColor}>{title}</h3>
                                {:else}
                                    <div class="placeholder-dashed placeholder-line">הכותרת - שלב 3</div>
                                {/if}
                            </div>
                            <div class="pro-title-wrap" style:opacity={activeStep === "hover" ? 0 : 1}>
                                {#if subtitle}
                                    <p class="pro-sub">{subtitle}</p>
                                {:else}
                                    <div class="placeholder-dashed placeholder-line small">הסלוגן - שלב 5</div>
                                {/if}
                            </div>
                            {#if logo}
                                <img
                                    src={logo}
                                    alt="לוגו"
                                    class="ad-logo"
                                    class:circle={logoShape === "circle"}
                                    class:pos-left={logoPosition === "left"}
                                    class:pos-cta={logoPosition === "cta"}
                                    style:opacity={activeStep === "hover" ? 0 : 1}
                                />
                            {:else}
                                <div
                                    class="placeholder-dashed placeholder-logo"
                                    class:pos-left={logoPosition === "left"}
                                    class:pos-cta={logoPosition === "cta"}
                                    style:opacity={activeStep === "hover" ? 0 : 1}
                                >לוגו<br />שלב 2</div>
                            {/if}
                            <div class="hover-overlay" style:opacity={activeStep === "hover" ? 1 : 0}>
                                <h3 class="hover-title">{title || "הכותרת"}</h3>
                                <p class="hover-text">{hoverText || "הטקסט שמופיע בריחוף"}</p>
                            </div>
                        </div>
                        <div class="ad-cta" style:background={gradient}>
                            <p>{cta}</p>
                        </div>
                    </div>
                </div>
            </aside>

        </div><!-- /.builder-cols -->

    </div>
{/if}

<!-- תג אדמין -->
{#if accessGranted && isAdmin}
    <div class="admin-badge" dir="rtl">
        <p>🛡️ מצב אדמין - גישה חופשית לבונה</p>
    </div>
{/if}

<!-- =================== מודל עזרה בעיצוב =================== -->
{#if helpOpen}
    <div
        class="help-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onclick={(e) => { if (e.target === e.currentTarget) closeHelp(); }}
        onkeydown={(e) => { if (e.key === "Escape") closeHelp(); }}
        tabindex="-1"
    >
        <div class="help-modal" dir="rtl">
            <div class="help-modal-head">
                <span class="help-modal-icon" aria-hidden="true">🆘</span>
                <h2 id="help-modal-title">עזרה בעיצוב הפרסומת</h2>
                <button type="button" class="help-close" onclick={closeHelp} aria-label="סגור">×</button>
            </div>

            <p class="help-intro">ספרו לנו מה מסתבך - נחזור אליכם ונעזור לסיים את העיצוב יחד.</p>

            <label class="help-field">
                <span class="help-label">מה הבעיה? <span class="help-required">*</span></span>
                <textarea
                    id="help-problem-input"
                    bind:value={helpProblem}
                    maxlength="2000"
                    rows="5"
                    placeholder="למשל: התמונה לא מסתדרת לי במרכז, או שאני לא בטוח איזה צבע לבחור..."
                    class="help-textarea"
                ></textarea>
                <span class="help-counter">{helpProblem.length}/2000</span>
            </label>

            {#if !data?.layoutUser?.email && !data?.layoutUser?.name}
                <label class="help-field">
                    <span class="help-label">איך ניצור איתך קשר? <span class="help-required">*</span></span>
                    <input type="text" bind:value={helpContact} maxlength="200" placeholder="טלפון או אימייל" class="help-input" />
                </label>
            {:else}
                <p class="help-identity">
                    <span aria-hidden="true">🧑</span>
                    מזוהה כ-<strong>{data?.layoutUser?.name || data?.layoutUser?.email}</strong>
                </p>
            {/if}

            {#if helpError}
                <div class="help-error" role="alert">{helpError}</div>
            {/if}

            <div class="help-actions">
                <button type="button" class="help-btn-secondary" onclick={closeHelp}>ביטול</button>
                <button type="button" class="help-btn-primary" onclick={submitHelp}>
                    <span aria-hidden="true">💬</span>
                    שליחה ופתיחת וואטסאפ
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    /* ============== שערה ============== */
    /* קופסה כהה — הרקע באתר ורוד בהיר וטקסט אפור ישירות עליו אינו קריא */
    .gate {
        max-width: 36rem;
        margin: 2rem auto 3rem;
        padding: 2.5rem 1.5rem;
        text-align: center;
        background: #16264d;
        border: 1px solid #3b5794;
        border-radius: 1.25rem;
    }
    .gate-code {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
        align-items: stretch;
        margin-top: 1.25rem;
        flex-wrap: wrap;
    }
    .gate-code-input {
        padding: 0.7rem 1rem;
        border-radius: 0.75rem;
        border: 1px solid #3b5794;
        background: rgba(255, 255, 255, 0.06);
        color: #fff;
        font-family: inherit;
        font-size: 0.95rem;
        width: min(100%, 260px);
        outline: none;
        text-align: center;
    }
    .gate-code-input::placeholder { color: #9ca3af; }
    .gate-code-input:focus { border-color: #fbbf24; }
    .gate .gate-code-error {
        color: #fca5a5;
        font-size: 0.85rem;
        font-weight: 700;
        margin-top: 0.6rem;
    }
    .gate-icon { font-size: 3.75rem; margin-bottom: 1rem; }
    .gate h1 {
        font-size: 1.75rem;
        font-weight: 900;
        color: #fbbf24;
        margin: 0 0 0.75rem;
    }
    .gate p {
        color: #d1d5db;
        font-size: 1.05rem;
        line-height: 1.6;
        margin: 0 0 1.5rem;
    }
    .gate-actions {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        justify-content: center;
    }
    @media (min-width: 640px) {
        .gate-actions { flex-direction: row; }
    }
    .b-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1.5rem;
        border-radius: 0.75rem;
        font-weight: 900;
        text-decoration: none;
        transition: all 0.2s;
    }
    .b-btn.amber { background: #f59e0b; color: #000; }
    .b-btn.amber:hover { background: #fbbf24; }
    .b-btn.green { background: #16a34a; color: #fff; }
    .b-btn.green:hover { background: #22c55e; }

    /* ============== מבנה כללי ============== */
    .ad-builder {
        max-width: 64rem;
        margin: 0 auto;
        padding: 1rem 1rem 3rem;
    }

    /* ============== הודעת דחיסה ============== */
    .compress-toast {
        position: fixed;
        top: 5rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 60;
        width: calc(100% - 1.5rem);
        max-width: 32rem;
        padding: 0.875rem 2.5rem 0.875rem 1rem;
        border-radius: 1rem;
        border: 1px solid rgba(251, 191, 36, 0.55);
        background: linear-gradient(135deg, rgba(120, 53, 15, 0.92), rgba(146, 64, 14, 0.88));
        box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(8px);
        animation: compressToastIn 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .compress-toast-close {
        position: absolute;
        top: 0.4rem;
        left: 0.5rem;
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.35);
        color: rgba(255, 255, 255, 0.9);
        font-size: 0.75rem;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255, 255, 255, 0.18);
        cursor: pointer;
    }
    .compress-toast-close:hover { background: rgba(220, 38, 38, 0.85); }
    .compress-toast-body {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        text-align: right;
    }
    .compress-toast-icon { font-size: 1.85rem; flex-shrink: 0; }
    .ct-title {
        font-weight: 900;
        color: #fde68a;
        font-size: 0.95rem;
        margin: 0 0 0.25rem;
    }
    .ct-text {
        color: #f3f4f6;
        font-size: 0.8rem;
        line-height: 1.5;
        margin: 0;
    }
    .ct-text strong { color: #fde68a; }
    @keyframes compressToastIn {
        from { opacity: 0; transform: translate(-50%, -8px); }
        to { opacity: 1; transform: translate(-50%, 0); }
    }

    /* ============== כותרת הדף ============== */
    .b-hero { text-align: center; margin-bottom: 2.5rem; }
    .b-hero-icon { font-size: 3rem; margin-bottom: 0.75rem; }
    .b-hero-title {
        font-size: 2.2rem;
        font-weight: 900;
        margin: 0 0 0.75rem;
        background: linear-gradient(to right, #fbbf24, #fde047, #fbbf24);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    .b-hero-sub {
        color: #d1d5db;
        font-size: 1.05rem;
        max-width: 42rem;
        margin: 0 auto;
        line-height: 1.6;
    }

    .b-countdown, .b-expired, .b-autosave {
        margin: 1.25rem auto 0;
        max-width: 42rem;
        border-radius: 1rem;
        padding: 0.9rem 1.1rem;
        text-align: right;
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
    }
    .b-countdown {
        border: 2px solid rgba(245, 158, 11, 0.5);
        background: linear-gradient(135deg, rgba(120, 53, 15, 0.25), rgba(124, 45, 18, 0.15));
    }
    .b-expired {
        border: 1px solid rgba(239, 68, 68, 0.4);
        background: rgba(239, 68, 68, 0.1);
    }
    .b-autosave {
        margin-top: 0.75rem;
        border: 1px solid rgba(34, 197, 94, 0.4);
        background: rgba(34, 197, 94, 0.08);
    }
    .b-cd-icon { font-size: 1.6rem; flex-shrink: 0; }
    .b-cd-title {
        font-weight: 900;
        color: #fcd34d;
        font-size: 0.95rem;
        margin: 0 0 0.25rem;
    }
    .b-cd-title.red { color: #fca5a5; }
    .b-as-title {
        font-weight: 900;
        color: #86efac;
        font-size: 0.95rem;
        margin: 0 0 0.25rem;
    }
    .b-cd-text {
        color: #e5e7eb;
        font-size: 0.82rem;
        line-height: 1.5;
        margin: 0;
    }
    .b-cd-text strong { color: #fde68a; }
    .b-reset-row {
        margin-top: 0.75rem;
        display: flex;
        justify-content: center;
    }
    .b-reset {
        background: none;
        border: none;
        color: #fbbf24;
        font-size: 0.75rem;
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
        font-family: inherit;
    }
    .b-reset:hover { color: #fcd34d; }

    /* ============== שתי עמודות + דמו קופץ ============== */
    .builder-cols {
        position: relative;
        padding-left: 156px; /* מקום לדמו (140px) + רווח */
    }
    .builder-steps { width: 100%; }
    .builder-demo {
        position: absolute;
        top: 0;
        left: 0;
        width: 140px;
        transition: top 700ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    @media (max-width: 768px) {
        .builder-cols { padding-left: 0; }
        .builder-demo {
            position: static;
            width: 100%;
            max-width: 240px;
            margin: 0 auto 1rem;
        }
    }

    /* מסגרת "מקום הדמו" מקווקוות בצד כל שלב */
    .builder-steps .step-card::before {
        content: "";
        position: absolute;
        top: 0.5rem;
        bottom: 0.5rem;
        left: -156px;
        width: 140px;
        border: 2px dashed rgba(251, 191, 36, 0.22);
        border-radius: 0.85rem;
        background: rgba(251, 191, 36, 0.025);
        pointer-events: none;
    }
    @media (max-width: 768px) {
        .builder-steps .step-card::before { display: none; }
    }

    .live-demo-card {
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 0.85rem;
        padding: 0.7rem;
    }
    .live-demo-label {
        color: #fbbf24;
        font-size: 0.78rem;
        font-weight: 800;
        text-align: center;
        margin: 0 0 0.5rem;
    }
    .live-demo-frame {
        width: 100%;
        border-radius: 0.55rem;
        overflow: hidden;
        background: #0f172a;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    }
    .live-demo-img-wrap {
        width: 100%;
        aspect-ratio: 144 / 450; /* פרופורציית הבאנר האמיתי בצד ימין */
    }

    /* ============== כרטיס שלב ============== */
    .step-card {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 1.25rem;
        padding: 1.25rem 1.25rem 1.5rem;
        margin-bottom: 1.25rem;
        scroll-margin-top: 10rem;
        position: relative;
    }
    @media (min-width: 768px) {
        .step-card { padding: 1.75rem; margin-bottom: 1.75rem; }
    }

    .step-head {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.5rem;
        color: #e5e7eb;
        font-weight: 900;
        flex-wrap: wrap;
    }
    .step-head h2 {
        font-size: 1.125rem;
        font-weight: 900;
        line-height: 1.3;
        margin: 0;
    }
    @media (min-width: 768px) {
        .step-head h2 { font-size: 1.4rem; }
    }
    .step-num {
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle, #fde047 0%, #f59e0b 60%, #d97706 100%);
        color: #000;
        font-weight: 900;
        font-size: 0.95rem;
        opacity: 0.85;
        flex-shrink: 0;
    }
    .step-help {
        color: #9ca3af;
        font-size: 0.875rem;
        line-height: 1.55;
        margin: 0 0 1rem;
    }
    .amber-strong { color: #fcd34d; }

    .step-nav-row {
        margin-top: 1.5rem;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
    }
    .step-nav-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.7rem 1.5rem;
        border-radius: 0.85rem;
        background: #f59e0b;
        color: #000;
        font-size: 0.95rem;
        font-weight: 800;
        line-height: 1.1;
        border: 1px solid rgba(245, 158, 11, 0.85);
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
        font-family: inherit;
        box-shadow: 0 4px 14px -4px rgba(245, 158, 11, 0.5);
    }
    .step-nav-btn:hover {
        background: #fbbf24;
        box-shadow: 0 6px 18px -4px rgba(245, 158, 11, 0.6);
    }
    .step-nav-btn:active { transform: scale(0.97); }
    .step-nav-btn:disabled { opacity: 0.6; cursor: wait; }

    /* אנימציות שלבים */
    @keyframes gentleHover {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-5px) scale(1.03); }
    }
    .tutorial-finger {
        display: inline-block;
        animation: gentleHover 2.6s ease-in-out infinite;
        font-size: 1.25rem;
        will-change: transform;
        filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.45));
    }
    @keyframes stepNumFlashAnim {
        0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); transform: scale(1); filter: brightness(1); }
        50% { box-shadow: 0 0 18px 6px rgba(251, 191, 36, 0.95); transform: scale(1.25); filter: brightness(1.55); }
    }
    .step-num.step-num-light {
        animation: stepNumFlashAnim 0.7s ease-in-out 1;
    }
    @keyframes stepTitleGlowAnim {
        0%, 100% { color: #e5e7eb; text-shadow: 0 0 0 rgba(251, 191, 36, 0); }
        50% { color: #fbbf24; text-shadow: 0 0 14px rgba(251, 191, 36, 0.9), 0 0 28px rgba(251, 191, 36, 0.5); }
    }
    .step-head.step-title-light h2 {
        animation: stepTitleGlowAnim 1.5s ease-in-out 1;
    }

    /* ============== קלטים ============== */
    .text-input {
        width: 100%;
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        background: rgba(255, 255, 255, 0.04);
        border: 2px solid rgba(255, 255, 255, 0.08);
        color: white;
        font-size: 0.95rem;
        font-weight: 500;
        outline: none;
        transition: all 0.15s;
        font-family: inherit;
        box-sizing: border-box;
        resize: vertical;
    }
    .text-input::placeholder { color: #6b7280; }
    .text-input:focus {
        border-color: rgba(245, 158, 11, 0.6);
        background: rgba(255, 255, 255, 0.06);
    }
    .char-count {
        font-size: 0.75rem;
        color: #6b7280;
        margin-top: 0.5rem;
        text-align: left;
    }

    .slider-block { margin-top: 1rem; }
    .slider-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.35rem;
    }
    .slider-head p {
        font-size: 0.85rem;
        font-weight: 700;
        color: #d1d5db;
        margin: 0;
    }
    .slider-reset {
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 0.7rem;
        text-decoration: underline;
        cursor: pointer;
        font-family: inherit;
    }
    .slider-reset:hover { color: #fcd34d; }
    .range-input {
        width: 100%;
        accent-color: #f59e0b;
    }
    .slider-labels {
        display: flex;
        justify-content: space-between;
        font-size: 0.7rem;
        color: #6b7280;
        margin-top: 0.25rem;
    }

    /* ============== אזורי העלאה ============== */
    .step1-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }
    @media (max-width: 768px) {
        .step1-grid { grid-template-columns: 1fr; }
    }
    .tips-box {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 1rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 1rem 1.25rem;
        color: #d1d5db;
    }
    .tips-title {
        font-weight: 700;
        color: #fbbf24;
        margin: 0 0 0.75rem;
        font-size: 1rem;
    }
    .tips-box ul {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        font-size: 0.85rem;
        line-height: 1.5;
    }

    .upload-zone {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        border: 2px dashed rgba(245, 158, 11, 0.4);
        border-radius: 1rem;
        background: rgba(245, 158, 11, 0.04);
        cursor: pointer;
        transition: all 0.15s;
        overflow: hidden;
    }
    .upload-zone:hover {
        border-color: rgba(245, 158, 11, 0.7);
        background: rgba(245, 158, 11, 0.08);
    }
    .upload-zone.has-image { border-style: solid; padding: 0; }
    .upload-zone img {
        width: 100%;
        height: 100%;
        min-height: 200px;
        max-height: 280px;
        object-fit: cover;
    }
    .upload-empty { text-align: center; padding: 1rem; }
    .upload-emoji { font-size: 2.25rem; margin-bottom: 0.5rem; }
    .upload-main { font-weight: 700; font-size: 1rem; color: #fff; margin: 0; }
    .upload-note { font-size: 0.75rem; color: #9ca3af; margin: 0.25rem 0 0; }
    .upload-zone.dragging {
        border-color: #22c55e;
        background: rgba(34, 197, 94, 0.1);
        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18), 0 0 30px rgba(34, 197, 94, 0.25);
        transform: scale(1.01);
    }
    .hidden-input { display: none; }

    .logo-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .logo-upload-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
    }
    .upload-zone-sm {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100px;
        height: 100px;
        flex-shrink: 0;
        border: 2px dashed rgba(245, 158, 11, 0.4);
        border-radius: 0.75rem;
        background: rgba(245, 158, 11, 0.04);
        cursor: pointer;
        overflow: hidden;
    }
    .upload-zone-sm.has-image { border-style: solid; padding: 0; }
    .upload-zone-sm img { width: 100%; height: 100%; object-fit: cover; }
    .upload-zone-sm.dragging {
        border-color: #22c55e;
        background: rgba(34, 197, 94, 0.12);
        box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
        transform: scale(1.04);
    }
    .upload-sm-empty { text-align: center; }
    .upload-sm-emoji { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .upload-sm-empty p {
        font-size: 0.75rem;
        font-weight: 700;
        color: #d1d5db;
        margin: 0;
    }
    .edit-crop-link {
        background: none;
        border: none;
        color: #fcd34d;
        font-size: 0.65rem;
        text-decoration: underline;
        cursor: pointer;
        font-family: inherit;
    }

    .remove-x {
        position: absolute;
        top: 0.4rem;
        left: 0.4rem;
        z-index: 5;
        width: 1.75rem;
        height: 1.75rem;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.65);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        font-size: 0.85rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .remove-x:hover { background: rgba(220, 38, 38, 0.85); }

    .logo-controls {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 1rem;
        align-self: center;
    }
    .control-label {
        font-size: 0.75rem;
        font-weight: 700;
        color: #9ca3af;
        margin: 0 0 0.35rem;
    }
    .seg-group {
        display: inline-flex;
        border-radius: 0.5rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.2);
        padding: 0.25rem;
        gap: 0.15rem;
    }
    .seg-btn {
        padding: 0.3rem 0.7rem;
        border-radius: 0.4rem;
        font-size: 0.75rem;
        font-weight: 700;
        border: none;
        background: transparent;
        color: #d1d5db;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
        white-space: nowrap;
    }
    .seg-btn:hover { color: #fff; }
    .seg-btn.active {
        background: #f59e0b;
        color: #000;
    }

    /* ============== חיצי מיקום תמונה ============== */
    .crop-arrow {
        position: absolute;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.5);
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        font-size: 0.75rem;
        line-height: 1;
        cursor: pointer;
        z-index: 4;
        backdrop-filter: blur(4px);
        transition: all 150ms;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }
    .crop-arrow:hover { background: rgba(245, 158, 11, 0.85); color: black; }
    .crop-arrow.up { top: 8px; left: 50%; transform: translateX(-50%); }
    .crop-arrow.down { bottom: 8px; left: 50%; transform: translateX(-50%); }
    .crop-arrow.left { left: 8px; top: 50%; transform: translateY(-50%); }
    .crop-arrow.right { right: 8px; top: 50%; transform: translateY(-50%); }
    .crop-reset {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.5);
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        font-size: 0.9rem;
        line-height: 1;
        cursor: pointer;
        z-index: 4;
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: all 150ms;
    }
    .crop-reset:hover { background: rgba(245, 158, 11, 0.85); color: black; }
    .crop-hint {
        font-size: 0.75rem;
        color: #9ca3af;
        margin-top: 0.6rem;
        text-align: center;
    }

    /* ============== מודל חיתוך עגול ============== */
    .crop-modal-bg {
        position: fixed;
        inset: 0;
        z-index: 999;
        background: rgba(0, 0, 0, 0.75);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        backdrop-filter: blur(4px);
    }
    .crop-modal {
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        padding: 1.1rem;
        max-width: 95vw;
        width: 380px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
        direction: rtl;
    }
    .crop-modal-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.4rem;
    }
    .crop-modal-head h3 {
        color: white;
        font-weight: 800;
        font-size: 1.05rem;
        margin: 0;
    }
    .crop-modal-x {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        font-size: 1.1rem;
        cursor: pointer;
        padding: 0.25rem 0.5rem;
        line-height: 1;
    }
    .crop-modal-x:hover { color: white; }
    .crop-help {
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.78rem;
        line-height: 1.4;
        margin: 0 0 0.7rem;
    }
    .crop-stage {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        background: #111;
        border-radius: 0.6rem;
        overflow: hidden;
        cursor: grab;
        touch-action: none;
        user-select: none;
    }
    .crop-stage:active { cursor: grabbing; }
    .crop-img {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
        user-select: none;
        -webkit-user-drag: none;
        transform-origin: center;
        will-change: transform;
    }
    .crop-circle-mask {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
        pointer-events: none;
        border: 2px dashed rgba(255, 255, 255, 0.55);
    }
    .crop-controls {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        margin: 0.85rem 0 0.6rem;
    }
    .crop-zoom-label { color: rgba(255, 255, 255, 0.85); font-size: 0.85rem; flex-shrink: 0; }
    .crop-zoom-slider { flex: 1; accent-color: #f59e0b; }
    .crop-zoom-val {
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.78rem;
        min-width: 3rem;
        text-align: left;
    }
    .crop-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
    }
    .crop-btn-cancel {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.85);
        padding: 0.55rem 1rem;
        border-radius: 0.65rem;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        font-family: inherit;
    }
    .crop-btn-cancel:hover { background: rgba(255, 255, 255, 0.12); }
    .crop-btn-confirm {
        background: linear-gradient(to right, #f59e0b, #ea580c);
        border: none;
        color: black;
        padding: 0.55rem 1.25rem;
        border-radius: 0.65rem;
        font-weight: 800;
        font-size: 0.9rem;
        cursor: pointer;
        font-family: inherit;
        transition: transform 150ms;
    }
    .crop-btn-confirm:hover { transform: translateY(-1px); }

    /* ============== צבע הכותרת ============== */
    .title-color-rail {
        margin-inline-start: auto;
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        flex-wrap: wrap;
        justify-content: flex-end;
    }
    .title-color-label {
        font-size: 0.78rem;
        color: rgba(203, 213, 225, 0.85);
        margin-inline-end: 0.35rem;
        white-space: nowrap;
    }
    .title-color-dot {
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 999px;
        border: 1.5px solid rgba(255, 255, 255, 0.25);
        cursor: pointer;
        transition: all 120ms;
        padding: 0;
    }
    .title-color-dot:hover { transform: scale(1.12); border-color: rgba(255, 255, 255, 0.6); }
    .title-color-dot.selected {
        border-color: #fbbf24;
        box-shadow: 0 0 0 1.5px rgba(251, 191, 36, 0.45);
        transform: scale(1.15);
    }
    .title-color-custom {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 999px;
        background: linear-gradient(135deg, #f87171, #fbbf24, #34d399, #60a5fa, #c4b5fd);
        border: 1.5px solid rgba(255, 255, 255, 0.35);
        cursor: pointer;
        font-size: 0.65rem;
    }
    .title-color-custom input[type="color"] {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
        border: 0;
        padding: 0;
    }

    /* ============== פלטת גרדיאנטים ============== */
    .color-rail {
        display: grid;
        grid-template-columns: repeat(11, 28px);
        grid-auto-rows: 28px;
        column-gap: 5px;
        row-gap: 5px;
        padding: 0.55rem;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 0.85rem;
        width: max-content;
        margin-inline: auto;
    }
    @media (max-width: 640px) {
        .color-rail { grid-template-columns: repeat(8, 28px); }
    }
    .color-dot {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.16);
        cursor: pointer;
        padding: 0;
        transition: all 180ms ease;
    }
    .color-dot:hover {
        transform: scale(1.18);
        border-color: rgba(255, 255, 255, 0.7);
    }
    .color-dot.selected {
        transform: scale(1.25);
        border-color: white;
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.22), 0 4px 12px rgba(0, 0, 0, 0.45);
    }

    /* ============== תצוגה מקדימה ============== */
    .preview-toggle-row {
        display: flex;
        justify-content: center;
        margin-bottom: 1rem;
    }
    .preview-frame {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
    }
    .preview-caption {
        color: #9ca3af;
        font-size: 0.8rem;
        text-align: center;
        max-width: 28rem;
        margin: 0;
    }

    .phone-screen {
        width: 280px;
        height: 540px;
        max-width: 90vw;
        background: #0b1224;
        border-radius: 2rem;
        border: 8px solid #111827;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.05);
        position: relative;
        overflow: hidden;
    }
    .phone-notch {
        position: absolute;
        top: 6px;
        left: 50%;
        transform: translateX(-50%);
        width: 80px;
        height: 16px;
        background: #111827;
        border-radius: 0 0 12px 12px;
        z-index: 10;
    }
    .phone-content {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
    }
    .mobile-popup {
        width: 100%;
        max-width: 240px;
        background: #0f172a;
        border-radius: 1rem;
        overflow: hidden;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    }
    .popup-title-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.85rem 0.9rem;
        background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
        border-bottom: 2px solid rgba(255, 255, 255, 0.08);
    }
    .popup-title-above {
        flex: 1;
        margin: 0;
        padding: 0;
        text-align: center;
        font-weight: 900;
        font-size: 1.35rem;
        line-height: 1.15;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
    }
    .popup-logo-above {
        width: 44px;
        height: 44px;
        border-radius: 8px;
        background: white;
        padding: 4px;
        object-fit: contain;
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
    }
    .popup-logo-above.circle { border-radius: 50%; }
    .popup-img {
        position: relative;
        height: 130px;
    }
    .popup-img > img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .close-countdown {
        position: absolute;
        top: 8px;
        left: 8px;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: white;
        font-size: 12px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 5;
    }
    .popup-body { padding: 0.85rem; }
    .popup-cta {
        display: block;
        width: 100%;
        padding: 0.55rem;
        border-radius: 0.6rem;
        color: white;
        font-weight: 700;
        font-size: 0.78rem;
        text-align: center;
        border: none;
        cursor: pointer;
        font-family: inherit;
    }

    .clean-card {
        width: 140px;
        border-radius: 0.6rem;
        overflow: hidden;
        background: #0f172a;
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.6), 0 0 6px rgba(245, 158, 11, 0.35);
        animation: cleanCardPulse 2.5s ease-in-out infinite;
        cursor: pointer;
        position: relative;
        display: flex;
        flex-direction: column;
    }
    @keyframes cleanCardPulse {
        0%, 100% { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.6), 0 0 6px rgba(245, 158, 11, 0.35); }
        50% { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.85), 0 0 10px rgba(245, 158, 11, 0.6); }
    }
    .clean-card-img {
        width: 100%;
        aspect-ratio: 144 / 450;
        position: relative;
    }

    /* ============== הפרסומת עצמה (משותף לדמו ולתצוגות) ============== */
    .pro-img-wrap {
        position: relative;
        overflow: hidden;
    }
    .ad-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: opacity 1500ms ease;
    }
    .pro-diag {
        position: absolute;
        inset: 0;
        clip-path: polygon(
            0 var(--diag-top-left, 88%),
            100% var(--diag-top-right, 78%),
            100% 100%,
            0 100%
        );
        opacity: 0.96;
        transition: opacity 1500ms ease, clip-path 280ms ease;
        pointer-events: none;
    }
    .pro-diag::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(125deg, transparent 30%, rgba(255, 255, 255, 0.18) 45%, transparent 60%);
        pointer-events: none;
    }
    .pro-title-top {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        padding: 0.55rem 0.7rem 0.85rem;
        z-index: 4;
        text-align: center;
        background: linear-gradient(180deg, rgba(0, 0, 0, 0.78) 0%, rgba(0, 0, 0, 0.45) 55%, rgba(0, 0, 0, 0) 100%);
        transition: opacity 1500ms ease;
        pointer-events: none;
    }
    .pro-title {
        color: white;
        font-weight: 900;
        font-size: 0.95rem;
        line-height: 1.15;
        margin: 0;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7), 0 1px 2px rgba(0, 0, 0, 0.9);
    }
    .pro-title-wrap {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 0.55rem 0.7rem 1.1rem;
        z-index: 4;
        text-align: right;
        transition: opacity 1500ms ease;
    }
    .pro-title-wrap.mobile { padding: 0.65rem 0.85rem 1.25rem; }
    .pro-sub {
        color: rgba(255, 255, 255, 0.95);
        font-weight: 600;
        font-size: 0.7rem;
        line-height: 1.3;
        margin: 0;
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
    }
    .pro-title-wrap.mobile .pro-sub { font-size: 0.9rem; }
    /* השורה הראשונה של הסלוגן מתקצרת בעקבות האלכסון */
    .pro-sub::before {
        content: "";
        float: left;
        width: 28%;
        height: 1.35em;
        shape-outside: polygon(0 0, 100% 0, 0 100%);
    }
    .ad-logo {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 36px;
        height: 36px;
        border-radius: 6px;
        background: white;
        padding: 3px;
        object-fit: contain;
        z-index: 5;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
        transition: opacity 1500ms ease;
    }
    .ad-logo.circle { border-radius: 50%; }
    .ad-logo.pos-left { left: 6px; right: auto; }
    .ad-logo.pos-cta {
        top: auto;
        bottom: calc(100% - var(--diag-top-right, 78%) - 18px);
        right: 6px;
        left: auto;
    }
    .hover-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0.75rem;
        text-align: center;
        transition: opacity 1500ms ease;
        pointer-events: none;
        z-index: 6;
    }
    .hover-title {
        color: white;
        font-weight: 700;
        font-size: 0.85rem;
        margin: 0 0 0.4rem;
    }
    .hover-text {
        color: #e5e7eb;
        font-size: 0.65rem;
        line-height: 1.4;
        margin: 0;
        font-weight: 700;
    }
    .ad-cta {
        padding: 0.65rem;
        text-align: center;
    }
    .ad-cta p {
        color: white;
        font-weight: 700;
        font-size: 0.72rem;
        line-height: 1.3;
        margin: 0;
    }
    .img-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.03);
        color: #6b7280;
        font-size: 0.85rem;
        font-weight: 700;
    }

    /* ============== ממלאי מקום מקווקווים בדמו ============== */
    .placeholder-dashed {
        border: 2px dashed rgba(255, 255, 255, 0.35);
        background: rgba(255, 255, 255, 0.04);
        color: rgba(255, 255, 255, 0.55);
        font-weight: 700;
        text-align: center;
        border-radius: 0.4rem;
        transition: opacity 1500ms ease;
    }
    .placeholder-img {
        position: absolute;
        inset: 6px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.3rem;
        font-size: 0.55rem;
    }
    .placeholder-img p { margin: 0; }
    .placeholder-icon { font-size: 1.5rem; }
    .placeholder-hint { color: rgba(251, 191, 36, 0.7); font-size: 0.5rem; }
    .placeholder-line {
        font-size: 0.5rem;
        padding: 0.25rem 0.4rem;
        line-height: 1;
        display: inline-block;
    }
    .placeholder-line.small { font-size: 0.45rem; }
    .placeholder-logo {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 28px;
        height: 28px;
        border-radius: 0.3rem;
        font-size: 0.45rem;
        line-height: 1.05;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 5;
    }
    .placeholder-logo.pos-left { left: 6px; right: auto; }
    .placeholder-logo.pos-cta {
        top: auto;
        bottom: calc(100% - var(--diag-top-right, 78%) - 14px);
        right: 6px;
    }

    /* ============== עזרה ============== */
    .help-wrap { position: relative; }
    .help-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.7rem 1.25rem;
        border-radius: 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #e5e7eb;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
        font-size: 0.9rem;
    }
    .help-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(251, 191, 36, 0.5);
        color: #fcd34d;
    }

    .help-backdrop {
        position: fixed;
        inset: 0;
        z-index: 999;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        backdrop-filter: blur(4px);
    }
    .help-modal {
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        padding: 1.25rem;
        max-width: 95vw;
        width: 440px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
    }
    .help-modal-head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }
    .help-modal-icon { font-size: 1.35rem; }
    .help-modal-head h2 {
        color: #fff;
        font-weight: 900;
        font-size: 1.1rem;
        margin: 0;
        flex: 1;
    }
    .help-close {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        font-size: 1.35rem;
        cursor: pointer;
        line-height: 1;
        padding: 0.15rem 0.4rem;
    }
    .help-close:hover { color: #fff; }
    .help-intro {
        color: #9ca3af;
        font-size: 0.85rem;
        line-height: 1.5;
        margin: 0 0 1rem;
    }
    .help-field { display: block; margin-bottom: 0.9rem; }
    .help-label {
        display: block;
        color: #d1d5db;
        font-weight: 700;
        font-size: 0.85rem;
        margin-bottom: 0.35rem;
    }
    .help-required { color: #f87171; }
    .help-textarea, .help-input {
        width: 100%;
        padding: 0.65rem 0.85rem;
        border-radius: 0.6rem;
        background: rgba(255, 255, 255, 0.04);
        border: 2px solid rgba(255, 255, 255, 0.08);
        color: white;
        font-size: 0.9rem;
        outline: none;
        font-family: inherit;
        box-sizing: border-box;
        resize: vertical;
    }
    .help-textarea:focus, .help-input:focus {
        border-color: rgba(245, 158, 11, 0.6);
    }
    .help-counter {
        display: block;
        font-size: 0.7rem;
        color: #6b7280;
        margin-top: 0.25rem;
        text-align: left;
    }
    .help-identity {
        color: #d1d5db;
        font-size: 0.85rem;
        margin: 0 0 0.9rem;
    }
    .help-error {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
        border-radius: 0.5rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
        font-weight: 700;
        margin-bottom: 0.9rem;
    }
    .help-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
    }
    .help-btn-secondary {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.85);
        padding: 0.55rem 1rem;
        border-radius: 0.65rem;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        font-family: inherit;
    }
    .help-btn-secondary:hover { background: rgba(255, 255, 255, 0.12); }
    .help-btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: #16a34a;
        border: none;
        color: #fff;
        padding: 0.55rem 1.25rem;
        border-radius: 0.65rem;
        font-weight: 800;
        font-size: 0.9rem;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s;
    }
    .help-btn-primary:hover { background: #22c55e; }

    /* ============== תג אדמין ============== */
    .admin-badge {
        position: fixed;
        top: 4rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 200;
        border-radius: 0.75rem;
        border: 1px solid rgba(168, 85, 247, 0.5);
        background: rgba(17, 24, 39, 0.95);
        padding: 0.4rem 1rem;
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(6px);
    }
    .admin-badge p {
        color: #c4b5fd;
        font-size: 0.75rem;
        font-weight: 700;
        margin: 0;
    }
</style>
