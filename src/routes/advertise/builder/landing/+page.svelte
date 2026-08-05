<script>
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import { adPlans, planFor, normalizePlanDays, DEFAULT_PLAN_DAYS } from "$lib/adPlans";
    import {
        AD_BODY_LIMIT, AD_EFFECTIVE_LIMIT, SIDE_IMAGE_MAX_BYTES,
        bodyBytes, fmtWeight, approxDataUrlBytes, compressImageToFit,
        shrinkAdPayload, heaviestImageLabel,
    } from "$lib/adPayloadBudget";

    // עורך דף הנחיתה + שליחה סופית - פורט מקבוצות רכישה (במקור מ"קהילה בשכונה").
    // חולק את אותה טיוטת localStorage עם ה-builder הראשי.

    let { data } = $props();

    const LS_KEY = "ng_ad_builder_draft_v1";
    const PAID_KEY = "ad_paid";
    const PAID_AT_KEY = "ad_paid_at";
    // מזהה מודעה קיימת שנפתחה לעריכה מדשבורד הנכס (/advertise/manage/[id]):
    // בסיום מחליפים את המודעה הקיימת (PUT) במקום ליצור חדשה, ובלי תשלום נוסף.
    const EDIT_KEY = "ng_ad_edit_id";
    let editId = $state("");

    // ===== שערת גישה (כמו ב-builder הראשי) =====
    let accessGranted = $state(false);
    let accessChecked = $state(false);
    // אדמין של האתר — נכנס בלי דף התשלום
    let isAdmin = $derived(Boolean(data?.isAdmin));

    // ===== שדות דף הנחיתה (נערכים כאן) =====
    let landingHeadline = $state("");
    let landingPitch = $state("");
    let landingExtended = $state("");
    let landingImage = $state("");
    /** @type {[string, string, string]} */
    let landingAdvantages = $state(["", "", ""]);
    let phone = $state("");
    let whatsapp = $state("");
    let website = $state("");
    let email = $state(data?.layoutUser?.email ?? "");
    /** @type {Array<{ id: number, name: string, price: string, image: string, description: string }>} */
    let products = $state([]);
    let uniqueness = $state("");
    let address = $state("");
    let hours = $state("");
    let nextProductId = 1;

    // ===== שדות הכרטיס (לקריאה בלבד - מוצגים בתצוגה המקדימה) =====
    let title = $state("");
    let subtitle = $state("");
    let hoverText = $state("");
    let cta = $state("הקלק לפרטים והזמנות");
    let mainImage = $state("");
    // מיקום+זום שנבחרו בבילדר — עוברים כמו-שהם אל המודעה בשליחה
    let mainImageFit = $state({ x: 50, y: 50, z: 1 });
    let logo = $state("");
    let logoShape = $state(/** @type {'square' | 'circle'} */ ("square"));
    let gradient = $state("linear-gradient(135deg, #f59e0b, #ea580c)");

    // ===== גרירת קבצים =====
    let isDraggingLandingImage = $state(false);
    /** @type {number | null} */
    let draggingProductId = $state(null);

    // ===== העלאת תמונות + שמירה על תקציב המשקל (משותף עם ה-builder) =====
    // הכלל: אף העלאה לא משאירה את הטיוטה מעל התקציב — אם צריך מפנים
    // מקום בכיווץ תמונות קיימות, ואם גם זה לא מספיק ההעלאה נדחית כאן,
    // בשלב עצמו, עם הסבר — ולא בכישלון בשליחה הסופית.

    let compressNotice = $state({ visible: false, originalBytes: 0, finalBytes: 0 });
    /** @type {number | null} */
    let compressNoticeTimer = null;
    /**
     * @param {number} originalBytes
     * @param {number} finalBytes
     */
    function showCompressNotice(originalBytes, finalBytes) {
        if (compressNoticeTimer) { clearTimeout(compressNoticeTimer); compressNoticeTimer = null; }
        compressNotice = { visible: true, originalBytes, finalBytes };
        compressNoticeTimer = window.setTimeout(() => {
            compressNotice = { ...compressNotice, visible: false };
            compressNoticeTimer = null;
        }, 9000);
    }
    function dismissCompressNotice() {
        if (compressNoticeTimer) { clearTimeout(compressNoticeTimer); compressNoticeTimer = null; }
        compressNotice = { ...compressNotice, visible: false };
    }

    // הודעת דחייה ליד אזור ההעלאה שבו אין מקום לתמונה
    let uploadIssue = $state({ zone: /** @type {'' | 'landing' | 'product'} */ (""), msg: "" });

    /** המודעה כפי שתישלח — הבסיס לכל מדידת משקל (זהה ל-payload של submitAd) */
    function buildPayloadSnapshot() {
        return {
            title, subtitle, hoverText, cta, gradient,
            logo, mainImage, mainImageFit,
            landing: {
                headline: landingHeadline,
                pitch: landingPitch,
                extended: landingExtended,
                image: landingImage,
                advantages: [...landingAdvantages],
                uniqueness, phone, whatsapp, website, email, address, hours,
                products: products.map((p) => ({ ...p })),
            },
            ownerCode: payCodeOk ? payCode : "",
            requestedDurationDays: payDuration,
        };
    }

    /** החלת תמונות שכווצו בחזרה על המצב (אחרי shrinkAdPayload) @param {any} p */
    function applyPayloadImages(p) {
        if (p.mainImage !== mainImage) mainImage = p.mainImage;
        if (p.logo !== logo) logo = p.logo;
        if (p.landing.image !== landingImage) landingImage = p.landing.image;
        let productsChanged = false;
        const nextProducts = products.map((cur, i) => {
            const img = p.landing.products[i]?.image ?? cur.image;
            if (img !== cur.image) { productsChanged = true; return { ...cur, image: img }; }
            return cur;
        });
        if (productsChanged) products = nextProducts;
        // תמונות הכרטיס לא נשמרות בטיוטה מהדף הזה בשגרה — אחרי כיווץ
        // כן מעדכנים אותן, שהתיקון יחזיק גם בחזרה לבילדר
        try {
            const raw = localStorage.getItem(LS_KEY);
            const cur = raw ? JSON.parse(raw) : {};
            localStorage.setItem(LS_KEY, JSON.stringify({ ...cur, logo: p.logo, mainImage: p.mainImage }));
        } catch {}
    }

    /**
     * @param {File | null | undefined} file
     * @param {'landing' | { kind: 'product', id: number }} target
     */
    async function processImageFile(file, target) {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            alert("נא להעלות קובץ תמונה");
            return;
        }
        uploadIssue = { zone: "", msg: "" };
        const res = await compressImageToFit(file, SIDE_IMAGE_MAX_BYTES);
        const url = String(res.dataUrl);

        // בדיקת התקציב הכולל: התמונה נכנסת רק אם כל המודעה נשארת מתחת לתקרה
        const candidate = buildPayloadSnapshot();
        if (target === "landing") {
            candidate.landing.image = url;
        } else {
            const idx = products.findIndex((p) => p.id === target.id);
            if (idx < 0) return;
            candidate.landing.products[idx] = { ...candidate.landing.products[idx], image: url };
        }
        const fit = await shrinkAdPayload(candidate, AD_EFFECTIVE_LIMIT);
        if (!fit.ok) {
            uploadIssue = {
                zone: target === "landing" ? "landing" : "product",
                msg: `אין מקום לתמונה הזו — המודעה כולה מוגבלת במשקל, וגם אחרי דחיסה היא חורגת. `
                    + `הסירו או החליפו תמונה אחרת (הכבדה ביותר: ${heaviestImageLabel(candidate) || "—"}) ונסו שוב.`,
            };
            return; // המצב הקיים לא נגעו בו
        }

        applyPayloadImages(candidate);
        if (res.wasCompressed || fit.changed) {
            const finalUrl = target === "landing"
                ? candidate.landing.image
                : candidate.landing.products[products.findIndex((p) => p.id === target.id)]?.image ?? url;
            showCompressNotice(res.originalBytes, approxDataUrlBytes(finalUrl));
        }
    }
    /** @param {Event} e */
    async function handleLandingImage(e) {
        const input = /** @type {HTMLInputElement} */ (e.target);
        await processImageFile(input.files?.[0], "landing");
    }
    /**
     * @param {Event} e
     * @param {number} id
     */
    async function handleProductImage(e, id) {
        const input = /** @type {HTMLInputElement} */ (e.target);
        await processImageFile(input.files?.[0], { kind: "product", id });
    }
    function clearLandingImage() {
        landingImage = "";
    }

    /** @param {DragEvent} e */
    function dragOverLanding(e) {
        if (!e.dataTransfer?.types.includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
        isDraggingLandingImage = true;
    }
    /** @param {DragEvent} e */
    function dragLeaveLanding(e) {
        e.preventDefault();
        e.stopPropagation();
        isDraggingLandingImage = false;
    }
    /** @param {DragEvent} e */
    async function dropLanding(e) {
        e.preventDefault();
        e.stopPropagation();
        isDraggingLandingImage = false;
        await processImageFile(e.dataTransfer?.files?.[0], "landing");
    }
    /**
     * @param {DragEvent} e
     * @param {number} id
     */
    function dragOverProduct(e, id) {
        if (!e.dataTransfer?.types.includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
        draggingProductId = id;
    }
    /** @param {DragEvent} e */
    function dragLeaveProduct(e) {
        e.preventDefault();
        e.stopPropagation();
        draggingProductId = null;
    }
    /**
     * @param {DragEvent} e
     * @param {number} id
     */
    async function dropProduct(e, id) {
        e.preventDefault();
        e.stopPropagation();
        draggingProductId = null;
        await processImageFile(e.dataTransfer?.files?.[0], { kind: "product", id });
    }

    function addProduct() {
        products = [...products, { id: nextProductId++, name: "", price: "", image: "", description: "" }];
    }
    /** @param {number} id */
    function removeProduct(id) {
        products = products.filter((p) => p.id !== id);
    }

    // ===== טעינת הטיוטה =====
    // קודם מעצבים — עניין התשלום מגיע רק כאן, בשלב השליחה. אין שער.
    function checkAccess() {
        if (!browser) return;
        accessGranted = true;
        accessChecked = true;
    }

    // ===== תשלום בשלב השליחה =====
    // קוד הבעלים מאומת בצד השרת בלבד (משתנה סביבה) — הוא לא מופיע
    // בקוד הלקוח, וגם ההגשה עצמה מאומתת שוב בשרת.
    let payCode = $state("");
    let payCodeOk = $state(false);
    let payCodeError = $state(false);
    let payCodeChecking = $state(false);
    // תקופת הפרסום שהמפרסם בוחר — עוברת לאדמין ומקבעת את ברירת המחדל באישור.
    // נשמרת גם ל-localStorage כדי שהבילדר יציג "הפרסום ירוץ עד" לפי המסלול הזה.
    const PLAN_DAYS_KEY = "ad_plan_days";
    let payDuration = $state(DEFAULT_PLAN_DAYS);
    const payPlan = $derived(planFor(payDuration));
    const payDurationLabel = $derived(payPlan.label);
    /** @param {number} days */
    function setPayDuration(days) {
        payDuration = days;
        try { localStorage.setItem(PLAN_DAYS_KEY, String(days)); } catch {}
    }
    /** @param {SubmitEvent} e */
    async function tryPayCode(e) {
        e.preventDefault();
        if (payCodeChecking || !payCode.trim()) return;
        payCodeChecking = true;
        payCodeError = false;
        try {
            const res = await fetch("/api/ads/verify-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: payCode }),
            });
            const data = res.ok ? await res.json() : null;
            if (data?.ok) {
                payCodeOk = true;
            } else {
                payCodeError = true;
            }
        } catch {
            payCodeError = true;
        } finally {
            payCodeChecking = false;
        }
    }

    onMount(() => {
        if (!browser) return;
        checkAccess();

        // שחזור התקופה שנבחרה בביקור קודם - עקבי עם הבילדר
        const storedPlanDays = localStorage.getItem(PLAN_DAYS_KEY);
        if (storedPlanDays) payDuration = normalizePlanDays(storedPlanDays);

        try { editId = localStorage.getItem(EDIT_KEY) ?? ""; } catch {}

        /** @param {DragEvent} e */
        const blockOutsideDrop = (e) => {
            if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
        };
        window.addEventListener("dragover", blockOutsideDrop);
        window.addEventListener("drop", blockOutsideDrop);

        if (accessGranted) {
            try {
                const raw = localStorage.getItem(LS_KEY);
                if (raw) {
                    const d = JSON.parse(raw);
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
                    phone = d.phone ?? phone;
                    whatsapp = d.whatsapp ?? whatsapp;
                    website = d.website ?? "";
                    email = d.email ?? email;
                    products = Array.isArray(d.products) ? d.products : [];
                    nextProductId = (products.reduce((m, p) => Math.max(m, p.id), 0) || 0) + 1;
                    uniqueness = d.uniqueness ?? "";
                    address = d.address ?? "";
                    hours = d.hours ?? "";

                    title = d.title ?? "";
                    subtitle = d.subtitle ?? "";
                    hoverText = d.hoverText ?? "";
                    cta = d.cta ?? cta;
                    mainImage = d.mainImage ?? "";
                    mainImageFit = {
                        x: typeof d.mainImageObjectX === "number" ? d.mainImageObjectX : 50,
                        y: typeof d.mainImageObjectY === "number" ? d.mainImageObjectY : 50,
                        z: typeof d.mainImageZoom === "number" ? d.mainImageZoom : 1,
                    };
                    logo = d.logo ?? "";
                    logoShape = d.logoShape ?? "square";
                    gradient = d.gradient ?? gradient;
                }
            } catch {}
            // טיוטה ישנה שחורגת מהתקציב מכווצת מיד — לא מחכים לכישלון בסוף
            void repairDraftWeight();
        }

        return () => {
            window.removeEventListener("dragover", blockOutsideDrop);
            window.removeEventListener("drop", blockOutsideDrop);
        };
    });

    // ===== שמירת שדות דף הנחיתה חזרה לאותה טיוטה (מיזוג, בלי לדרוס את הכרטיס) =====
    $effect(() => {
        if (!browser) return;
        try {
            const raw = localStorage.getItem(LS_KEY);
            const cur = raw ? JSON.parse(raw) : {};
            const merged = {
                ...cur,
                landingHeadline, landingPitch, landingExtended, landingImage, landingAdvantages,
                phone, whatsapp, website, email,
                products, uniqueness, address, hours,
            };
            localStorage.setItem(LS_KEY, JSON.stringify(merged));
        } catch {}
    });

    // ===== תצוגה מקדימה =====
    // "אם נכנס בצורה סמטרית" — היתרונות נכנסים לטור שליד התמונה רק כשמשפט
    // הפתיחה קצר; אחרת הם יורדים לשורה רחבה מתחת לגיבור.
    let hasAdvantages = $derived(landingAdvantages.some((a) => a.trim()));
    let advInHero = $derived(
        Boolean(landingImage || mainImage) && hasAdvantages && landingPitch.length <= 300
    );

    // ===== ולידציה + שליחה =====
    // מה חסר לשליחה — עם ציון איפה משלימים: בכרטיס (בילדר) או כאן בדף הנחיתה
    let missingFields = $derived.by(() => {
        /** @type {Array<{ label: string, where: 'card' | 'landing' }>} */
        const out = [];
        if (!mainImage) out.push({ label: "תמונה ראשית", where: "card" });
        if (!title) out.push({ label: "כותרת הפרסומת", where: "card" });
        if (!subtitle) out.push({ label: "סלוגן", where: "card" });
        if (!hoverText) out.push({ label: "טקסט בריחוף", where: "card" });
        if (!phone && !website) out.push({ label: "טלפון או אתר", where: "landing" });
        if (!landingHeadline && !landingPitch) out.push({ label: "כותרת דף הנחיתה או משפט פתיחה", where: "landing" });
        return out;
    });
    // משקל המודעה בזמן אמת — חוסם שליחה עוד לפני הניסיון, עם הסבר
    let adWeightBytes = $derived.by(() => bodyBytes(buildPayloadSnapshot()));
    let overweight = $derived(adWeightBytes > AD_EFFECTIVE_LIMIT);
    let heaviestLabel = $derived.by(() => heaviestImageLabel(buildPayloadSnapshot()));
    // חובה להיות מחובר כדי לשלוח: מודעה שנשלחת בלי חשבון נשמרת בלי בעלים,
    // והמפרסם לא יוכל לעולם לראות את הביצועים שלה, לערוך או לחדש. הטיוטה
    // ממילא נשמרת ל-localStorage בכל הקלדה — אז ההתחברות לא מאבדת כלום.
    let loggedIn = $derived(Boolean(data?.layoutUser));
    let canSubmit = $derived(missingFields.length === 0 && !overweight && loggedIn);
    let submitting = $state(false);
    let submitted = $state(false);
    let submitError = $state("");

    /** @param {Response} res */
    async function extractServerError(res) {
        let serverMsg = "";
        try {
            const body = await res.json();
            if (typeof body?.message === "string") serverMsg = body.message;
            else if (typeof body?.error === "string") serverMsg = body.error;
        } catch {}
        serverMsg = serverMsg.trim();
        // מציגים רק הודעות עבריות מכוונות - כל השאר טכני ומוחלף בהודעה ידידותית
        if (serverMsg && /[֐-׿]/.test(serverMsg)) return serverMsg;
        return "השליחה נכשלה - נסו שוב בעוד רגע";
    }

    // רשת ביטחון אחרונה: העלאות כבר נשמרות בתקציב, אבל טיוטות ישנות
    // מתוקנות בטעינה (repairDraftWeight) וממש לפני השליחה מכווצים שוב
    // אם צריך — כך 413 מהשרת לא אמור לקרות בכלל.
    async function repairDraftWeight() {
        const p = buildPayloadSnapshot();
        const before = bodyBytes(p);
        if (before <= AD_EFFECTIVE_LIMIT) return;
        const res = await shrinkAdPayload(p, AD_EFFECTIVE_LIMIT);
        applyPayloadImages(p);
        if (res.changed) showCompressNotice(before, bodyBytes(p));
    }

    async function submitAd() {
        if (!canSubmit || submitting) return;
        submitting = true;
        submitError = "";
        try {
            // הקוד עצמו נשלח לשרת והוא מאמת אותו שוב — הדגל לא נקבע בדפדפן
            const payload = buildPayloadSnapshot();
            if (!(await shrinkAdPayload(payload, AD_BODY_LIMIT)).ok) {
                throw new Error("התמונות כבדות מדי לשליחה אחת - הקטינו את התמונה הראשית או תמונות המוצרים ונסו שוב");
            }
            // עריכת מודעה קיימת מחליפה את התוכן שלה; השאר (סטטוס, תוקף,
            // מסלול) נקבע בזמנו ע"י האדמין ולא נשלח מכאן.
            const res = editId
                ? await fetch(`/api/ads/${encodeURIComponent(editId)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                })
                : await fetch("/api/ads/submit", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            if (!res.ok) {
                throw new Error(await extractServerError(res));
            }
            // הטיוטה סיימה את תפקידה — כדי שהכניסה הבאה לבונה תתחיל נקייה
            // ולא תדרוס בטעות את המודעה שנערכה
            if (editId) {
                try { localStorage.removeItem(EDIT_KEY); } catch {}
            }
            submitted = true;
        } catch (e) {
            if (e instanceof TypeError) {
                submitError = "בעיית תקשורת - בדקו את החיבור ונסו שוב";
            } else if (e instanceof Error && e.message) {
                submitError = e.message;
            } else {
                submitError = "השליחה נכשלה - נסו שוב בעוד רגע";
            }
        } finally {
            submitting = false;
        }
    }

    function goBack() {
        goto("/advertise/builder");
    }

    // ===== לא מחובר: שומרים טיוטה ומעבירים להתחברות =====
    // הטיוטה נשמרת ממילא ב-$effect בכל הקלדה, אבל לפני יציאה מהעמוד
    // כותבים אותה שוב במפורש — ורק אם הכתיבה הצליחה עוזבים לדף ההתחברות,
    // כדי שהמפרסם לא יגלה אחרי ההתחברות שהתוכן נעלם.
    let draftSaveError = $state("");
    let leavingToLogin = $state(false);

    function goLoginToSubmit() {
        draftSaveError = "";
        leavingToLogin = true;
        try {
            const raw = localStorage.getItem(LS_KEY);
            const cur = raw ? JSON.parse(raw) : {};
            localStorage.setItem(LS_KEY, JSON.stringify({
                ...cur,
                landingHeadline, landingPitch, landingExtended, landingImage, landingAdvantages,
                phone, whatsapp, website, email,
                products, uniqueness, address, hours,
            }));
        } catch {
            leavingToLogin = false;
            draftSaveError = "לא הצלחנו לשמור את הטיוטה בדפדפן הזה — פנו מקום (היסטוריה/אחסון) או נסו דפדפן אחר";
            return;
        }
        void goto(`/login?redirect=${encodeURIComponent("/advertise/builder/landing")}`);
    }
</script>

<svelte:head>
    <title>עריכת דף נחיתה | בונה הפרסומות</title>
</svelte:head>

<div class="ad-landing-builder" dir="rtl">

    {#if accessGranted}

        {#if compressNotice.visible}
            <div class="compress-toast" role="status" aria-live="polite">
                <button type="button" class="compress-toast-close" onclick={dismissCompressNotice} aria-label="סגור">✕</button>
                <p>🪄 התמונות כווצו אוטומטית מ-{fmtWeight(compressNotice.originalBytes)} ל-{fmtWeight(compressNotice.finalBytes)} כדי שהמודעה תעמוד במשקל המותר</p>
            </div>
        {/if}

        <!-- ===== כותרת ===== -->
        <header class="l-header">
            <div class="l-badge">שלב אחרון - דף הנחיתה</div>
            <h1>דף הנחיתה של הפרסומת</h1>
            <p>
                כשגולש לוחץ על הפרסומת שלכם - הוא מגיע לדף נחיתה אישי עם כל הפרטים על העסק.
                כאן ממלאים את התוכן שלו.
            </p>
            <button type="button" onclick={goBack} class="l-back">→ חזרה לעריכת הכרטיס</button>
        </header>

        {#if !submitted}

            <!-- =================== שלב 1: פרטי קשר ותוכן =================== -->
            <section class="step-card">
                <div class="step-head">
                    <span class="step-num">1</span>
                    <h2>פרטי קשר ותוכן הדף</h2>
                </div>
                <p class="step-help">לפחות טלפון או אתר - כדי שלגולשים תהיה דרך להגיע אליכם.</p>

                <div class="l-grid">
                    <div>
                        <label class="field-label" for="l-phone">📞 טלפון</label>
                        <input id="l-phone" type="tel" bind:value={phone} placeholder="050-1234567" class="text-input" />
                    </div>
                    <div>
                        <label class="field-label" for="l-wa">💬 וואטסאפ</label>
                        <input id="l-wa" type="tel" bind:value={whatsapp} placeholder="050-1234567" class="text-input" />
                    </div>
                    <div>
                        <label class="field-label" for="l-web">🌐 אתר אינטרנט</label>
                        <input id="l-web" type="url" bind:value={website} placeholder="https://my-site.co.il" class="text-input" dir="ltr" />
                    </div>
                    <div>
                        <label class="field-label" for="l-mail">✉️ אימייל</label>
                        <input id="l-mail" type="email" bind:value={email} placeholder="me@example.com" class="text-input" dir="ltr" />
                    </div>

                    <div class="span-2">
                        <label class="field-label" for="l-headline">כותרת דף הנחיתה</label>
                        <input id="l-headline" type="text" bind:value={landingHeadline} placeholder="למשל: פיצה של אמא - הפיצרייה של השכונה" class="text-input" />
                    </div>
                    <div class="span-2">
                        <label class="field-label" for="l-pitch">משפט פתיחה קצר</label>
                        <textarea id="l-pitch" bind:value={landingPitch} rows="3" placeholder="שניים-שלושה משפטים שמציגים את העסק" class="text-input"></textarea>
                    </div>
                    <div class="span-2">
                        <label class="field-label" for="l-extended">הסיפור שלנו (לא חובה)</label>
                        <p class="field-note">טקסט חופשי וארוך - הסיפור של העסק, מה מציעים, למי מתאים.</p>
                        <textarea id="l-extended" bind:value={landingExtended} rows="8" placeholder="ספרו על העסק בהרחבה..." class="text-input"></textarea>
                    </div>

                    <div class="span-2">
                        <span class="field-label">תמונה ראשית לדף הנחיתה (לא חובה)</span>
                        <p class="field-note">אם לא תעלו - נשתמש בתמונה של הכרטיס.</p>
                        <label
                            class="upload-zone-lg"
                            class:has-image={!!landingImage}
                            class:dragging={isDraggingLandingImage}
                            ondragover={dragOverLanding}
                            ondragleave={dragLeaveLanding}
                            ondrop={dropLanding}
                        >
                            {#if landingImage}
                                <img src={landingImage} alt="תמונת דף הנחיתה" />
                                <button type="button" class="remove-x" onclick={(e) => { e.preventDefault(); clearLandingImage(); }} aria-label="הסר תמונה">✕</button>
                            {:else}
                                <div class="upload-empty-sm">
                                    <div class="ue-emoji">{isDraggingLandingImage ? "✨" : "🖼️"}</div>
                                    <p>{isDraggingLandingImage ? "שחררו כאן!" : "העלו תמונה"}</p>
                                </div>
                            {/if}
                            <input type="file" accept="image/*" onchange={handleLandingImage} class="hidden-input" />
                        </label>
                        {#if uploadIssue.zone === "landing"}
                            <p class="upload-issue" role="alert">⛔ {uploadIssue.msg}</p>
                        {/if}
                    </div>

                    <div class="span-2">
                        <span class="field-label">3 יתרונות של העסק</span>
                        <p class="field-note">כל יתרון מופיע בשורה משלו עם <strong class="amber-strong">✓</strong> - קצר וחד (עד 80 תווים).</p>
                        <div class="adv-inputs">
                            <input type="text" bind:value={landingAdvantages[0]} maxlength="80" placeholder="למשל: משלוח חינם מעל 100 ₪" class="text-input" />
                            <input type="text" bind:value={landingAdvantages[1]} maxlength="80" placeholder="למשל: חומרי גלם טריים כל בוקר" class="text-input" />
                            <input type="text" bind:value={landingAdvantages[2]} maxlength="80" placeholder="למשל: הנחה קבועה לחברי הקבוצה" class="text-input" />
                        </div>
                    </div>
                </div>
            </section>

            <!-- =================== שלב 2: מוצרים =================== -->
            <section class="step-card">
                <div class="step-head">
                    <span class="step-num">2</span>
                    <h2>מוצרים / שירותים (עד 3)</h2>
                </div>
                <p class="step-help">הציגו מוצרים נבחרים עם תמונה ומחיר - לא חובה, אבל מוכר.</p>

                <div class="products-list">
                    {#each products as p, idx (p.id)}
                        <div class="product-row">
                            <label
                                class="upload-zone-product"
                                class:has-image={!!p.image}
                                class:dragging={draggingProductId === p.id}
                                ondragover={(e) => dragOverProduct(e, p.id)}
                                ondragleave={dragLeaveProduct}
                                ondrop={(e) => dropProduct(e, p.id)}
                            >
                                {#if p.image}
                                    <img src={p.image} alt={p.name} />
                                {:else}
                                    <div class="pz-empty">
                                        {#if draggingProductId === p.id}✨<br />שחררו{:else}📷<br />תמונה{/if}
                                    </div>
                                {/if}
                                <input type="file" accept="image/*" onchange={(e) => handleProductImage(e, p.id)} class="hidden-input" />
                            </label>
                            <div class="product-fields">
                                <input type="text" bind:value={products[idx].name} placeholder="שם המוצר" class="text-input small" />
                                <input type="text" bind:value={products[idx].price} placeholder="מחיר (₪)" class="text-input small" />
                                <input type="text" bind:value={products[idx].description} placeholder="תיאור קצר" class="text-input small" />
                            </div>
                            <button type="button" onclick={() => removeProduct(p.id)} class="remove-btn" aria-label="הסר מוצר">✕</button>
                        </div>
                    {/each}
                </div>

                {#if uploadIssue.zone === "product"}
                    <p class="upload-issue" role="alert">⛔ {uploadIssue.msg}</p>
                {/if}

                {#if products.length < 3}
                    <button type="button" onclick={addProduct} class="add-product-btn">+ הוספת מוצר</button>
                {/if}
            </section>

            <!-- =================== שלב 3: מה מייחד אתכם =================== -->
            <section class="step-card">
                <div class="step-head">
                    <span class="step-num">3</span>
                    <h2>מה מייחד אתכם?</h2>
                </div>
                <p class="step-help">
                    🌟 <strong class="amber-strong">זה הסעיף שסוגר עסקאות:</strong>
                    למה דווקא אתם ולא המתחרים? (עד 500 תווים)
                </p>

                <textarea bind:value={uniqueness} rows="5" maxlength="500" placeholder="ספרו מה מיוחד בעסק שלכם..." class="text-input"></textarea>
                <div class="char-count">{uniqueness.length}/500</div>
            </section>

            <!-- =================== שלב 4: כתובת ושעות =================== -->
            <section class="step-card">
                <div class="step-head">
                    <span class="step-num">4</span>
                    <h2>כתובת ושעות פעילות (לא חובה)</h2>
                </div>

                <div class="l-grid">
                    <div class="span-2">
                        <label class="field-label" for="l-address">📍 כתובת</label>
                        <input id="l-address" type="text" bind:value={address} placeholder="רחוב, מספר, עיר" class="text-input" />
                    </div>
                    <div class="span-2">
                        <label class="field-label" for="l-hours">🕒 שעות פעילות</label>
                        <input id="l-hours" type="text" bind:value={hours} placeholder="למשל: א'-ה' 9:00-19:00, ו' 8:00-13:00" class="text-input" />
                    </div>
                </div>
            </section>

            <!-- =================== תצוגה מקדימה =================== -->
            <section class="step-card">
                <div class="step-head">
                    <span class="step-num">🔍</span>
                    <h2>כך ייראה דף הנחיתה</h2>
                </div>
                <p class="step-help">התצוגה מתעדכנת בזמן אמת בזמן שאתם ממלאים.</p>

                <div class="preview-frame">
                    <div class="landing-mock">
                        <!-- הכותרת, משפט הפתיחה והיתרונות יושבים ליד התמונה — בלי גלילה -->
                        <header class="landing-hero" style:background={gradient}>
                            <div class="landing-hero-inner" class:has-media={!!(landingImage || mainImage)}>
                                <div class="landing-hero-content">
                                    {#if logo}
                                        <img src={logo} alt="לוגו" class="landing-logo" class:circle={logoShape === "circle"} />
                                    {/if}
                                    <h1>{landingHeadline || title || "כותרת דף הנחיתה"}</h1>
                                    <p>{landingPitch || subtitle || "משפט הפתיחה יופיע כאן"}</p>
                                    {#if advInHero}
                                        <ul class="advantages-list on-hero">
                                            {#each landingAdvantages as adv}
                                                {#if adv.trim()}
                                                    <li class="advantage-item">
                                                        <span class="advantage-check" aria-hidden="true">✓</span>
                                                        <span class="advantage-text">{adv}</span>
                                                    </li>
                                                {/if}
                                            {/each}
                                        </ul>
                                    {/if}
                                    <div class="landing-cta-row">
                                        {#if phone}
                                            <a href="tel:{phone}" class="landing-cta">📞 {phone}</a>
                                        {/if}
                                        {#if whatsapp}
                                            <a href="https://wa.me/{whatsapp.replace(/\D/g, '')}" class="landing-cta wa">וואטסאפ</a>
                                        {:else if website}
                                            <a href={website} class="landing-cta">לאתר שלנו ←</a>
                                        {/if}
                                        {#if !phone && !whatsapp && !website}
                                            <span class="landing-cta dim">השלימו פרטי קשר</span>
                                        {/if}
                                    </div>
                                </div>
                                {#if landingImage || mainImage}
                                    <div class="landing-hero-media">
                                        <img src={landingImage || mainImage} alt={title} />
                                    </div>
                                {/if}
                            </div>
                        </header>

                        {#if hasAdvantages && !advInHero}
                            <section class="landing-section">
                                <ul class="advantages-list strip">
                                    {#each landingAdvantages as adv}
                                        {#if adv.trim()}
                                            <li class="advantage-item">
                                                <span class="advantage-check tinted" style:background={gradient} aria-hidden="true">✓</span>
                                                <span class="advantage-text">{adv}</span>
                                            </li>
                                        {/if}
                                    {/each}
                                </ul>
                            </section>
                        {/if}

                        {#if landingExtended || uniqueness}
                            <section class="landing-section landing-about">
                                {#if landingExtended}
                                    <article>
                                        <h2>הסיפור שלנו</h2>
                                        <p style="white-space: pre-line">{landingExtended}</p>
                                    </article>
                                {/if}
                                {#if uniqueness}
                                    <article>
                                        <h2>מה מייחד אותנו</h2>
                                        <p style="white-space: pre-line">{uniqueness}</p>
                                    </article>
                                {/if}
                            </section>
                        {/if}

                        {#if products.length > 0}
                            <section class="landing-section">
                                <h2>המוצרים שלנו</h2>
                                <div class="products-grid">
                                    {#each products as p}
                                        <div class="product-card">
                                            {#if p.image}
                                                <img src={p.image} alt={p.name} />
                                            {:else}
                                                <div class="img-placeholder small">תמונה</div>
                                            {/if}
                                            <div class="product-info">
                                                <p class="product-name">{p.name || "שם המוצר"}</p>
                                                {#if p.description}<p class="product-desc">{p.description}</p>{/if}
                                                {#if p.price}<p class="product-price">₪{p.price}</p>{/if}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </section>
                        {/if}

                        <!-- רק מה שלא כבר מופיע ככפתור בהדר — כל פרט קשר פעם אחת -->
                        {#if email || (website && whatsapp) || address || hours}
                            <section class="landing-section landing-contact">
                                {#if email || (website && whatsapp)}
                                    <div class="landing-pills">
                                        {#if email}<a class="landing-pill" href="mailto:{email}">✉️ {email}</a>{/if}
                                        {#if website && whatsapp}<a class="landing-pill" href={website} target="_blank" rel="noopener">🌐 אתר</a>{/if}
                                    </div>
                                {/if}
                                {#if address || hours}
                                    <p class="landing-meta">
                                        {#if address}📍 {address}{/if}{#if address && hours} · {/if}{#if hours}🕒 {hours}{/if}
                                    </p>
                                {/if}
                            </section>
                        {/if}
                    </div>
                </div>
            </section>

            <!-- =================== שליחה =================== -->
            <section class="step-card">
                <div class="step-head">
                    <span class="step-num">✓</span>
                    <h2>בדיקה אחרונה ושליחה</h2>
                </div>

                <ul class="checklist">
                    <li class:done={!!mainImage}><span>{mainImage ? "✅" : "⬜"}</span> התמונה הראשית</li>
                    <li class:done={!!title}><span>{title ? "✅" : "⬜"}</span> כותרת הפרסומת</li>
                    <li class:done={!!subtitle}><span>{subtitle ? "✅" : "⬜"}</span> סלוגן</li>
                    <li class:done={!!hoverText}><span>{hoverText ? "✅" : "⬜"}</span> טקסט בריחוף</li>
                    <li class:done={!!(phone || website)}><span>{phone || website ? "✅" : "⬜"}</span> דרך ליצירת קשר</li>
                    <li class:done={!!(landingHeadline || landingPitch)}><span>{landingHeadline || landingPitch ? "✅" : "⬜"}</span> כותרת או משפט פתיחה לדף הנחיתה</li>
                    <li class:done={products.length > 0}><span>{products.length > 0 ? "✅" : "⬜"}</span> מוצרים ({products.length})</li>
                    <li class:done={!!uniqueness}><span>{uniqueness ? "✅" : "⬜"}</span> מה מייחד אתכם</li>
                    <li class:done={!!address}><span>{address ? "✅" : "⬜"}</span> כתובת</li>
                </ul>

                <!-- ===== תקופת פרסום + תשלום — אחרי העיצוב, לפני השליחה ===== -->
                {#if editId}
                    <!-- עריכה של מודעה קיימת: אין בחירת מסלול ואין תשלום נוסף -->
                    <div class="pay-box">
                        <p class="pay-title">✏️ עריכת מודעה קיימת</p>
                        <p class="pay-sub">
                            השמירה מחליפה את התוכן של המודעה שכבר קיימת — התקופה, המסלול
                            והתשלום נשארים כמו שהם. אין צורך לשלם שוב.
                        </p>
                        <a href="/advertise/manage/{editId}" class="pay-wa" style="background:#3b5794">
                            → חזרה לדשבורד הנכס בלי לשמור
                        </a>
                    </div>
                {:else}
                <div class="pay-box">
                    <p class="pay-title">💳 לבחור ולשלם מראש</p>
                    <div class="pay-duration" role="group" aria-label="תקופת הפרסום">
                        {#each adPlans as plan (plan.days)}
                            <button
                                type="button"
                                class="pay-duration-btn"
                                class:active={payDuration === plan.days}
                                onclick={() => setPayDuration(plan.days)}
                            >
                                <span class="pay-plan-label">{plan.title}</span>
                                <span class="pay-plan-price">{plan.price} ₪</span>
                            </button>
                        {/each}
                    </div>
                    <p class="pay-terms">
                        <a href="/advertise/terms" target="_blank" rel="noopener">📜 תנאי הפרסום</a>
                        — לקריאה לפני התשלום
                    </p>
                    {#if payCodeOk}
                        <p class="pay-ok">✅ הקוד התקבל — המודעה תישלח לאישור כמי ששולם ({payDurationLabel}).</p>
                    {:else}
                        <p class="pay-sub">
                            המודעה תעלה לאוויר אחרי אישור מנהל, בהתאם לתשלום.
                            לתיאום התשלום:
                        </p>
                        <a
                            href={"https://wa.me/972587448061?text=" + encodeURIComponent(`שלום, אני מעלה פרסומת באתר הגמ"ח הארצי ורוצה לתאם תשלום עבור ${payPlan.title} (${payPlan.price} ₪)`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="pay-wa"
                        >💬 לתיאום תשלום בוואטסאפ</a>
                        <form class="pay-code" onsubmit={tryPayCode}>
                            <input
                                type="text"
                                bind:value={payCode}
                                placeholder="הזן קוד בעלים"
                                class="pay-code-input"
                                aria-label="קוד תשלום"
                            />
                            <button type="submit" class="pay-code-btn">אישור</button>
                        </form>
                        {#if payCodeError}
                            <p class="pay-error">הקוד לא זוהה — בדקו את האיות ונסו שוב</p>
                        {/if}
                    {/if}
                </div>
                {/if}

                {#if !loggedIn}
                    <div class="login-gate">
                        <p class="login-gate-title">🔐 שלב אחרון לפני השליחה — התחברות</p>
                        <p class="login-gate-text">
                            הפרסומת נשמרת על החשבון שלכם, וכך תוכלו לראות כמה גולשים ראו והקליקו עליה,
                            לערוך אותה בכל רגע ולחדש בסוף התקופה. בלי חשבון אין דרך להחזיר אתכם אליה.
                        </p>
                        <button type="button" class="login-gate-btn" onclick={goLoginToSubmit} disabled={leavingToLogin}>
                            {leavingToLogin ? "שומר טיוטה..." : "שמירת הטיוטה והתחברות →"}
                        </button>
                        <p class="login-gate-note">
                            מה שמילאתם נשמר כטיוטה במכשיר הזה ויחכה לכם כאן מיד אחרי ההתחברות.
                        </p>
                        {#if draftSaveError}
                            <p class="submit-error">{draftSaveError}</p>
                        {/if}
                    </div>
                {/if}

                {#if missingFields.length > 0 || overweight}
                    <p class="submit-note">
                        {#if missingFields.length > 0}
                            ⚠️ אי אפשר לשלוח עדיין — חסר: {missingFields.map((f) => f.label).join(", ")}.
                            {#if missingFields.some((f) => f.where === "landing")}
                                ממלאים את זה כאן למעלה, בדף הזה.
                            {/if}
                            {#if missingFields.some((f) => f.where === "card")}
                                את פרטי הכרטיס משלימים <button type="button" class="inline-link" onclick={goBack}>בעמוד עריכת הכרטיס</button>.
                            {/if}
                        {/if}
                        {#if overweight}
                            ⚖️ המודעה כבדה מדי ({fmtWeight(adWeightBytes)} מתוך {fmtWeight(AD_EFFECTIVE_LIMIT)} מותרים) —
                            הקטינו או הסירו תמונה{#if heaviestLabel}&nbsp;(הכבדה ביותר: {heaviestLabel}){/if}.
                        {/if}
                    </p>
                {/if}
                {#if submitError}
                    <p class="submit-error">{editId ? "השמירה נכשלה" : "השליחה נכשלה"}: {submitError}</p>
                {/if}

                <button type="button" onclick={submitAd} disabled={!canSubmit || submitting} class="submit-btn" class:enabled={canSubmit && !submitting}>
                    {#if submitting}
                        {editId ? "שומר..." : "שולח..."}
                    {:else if editId}
                        💾 שמירת השינויים במודעה
                    {:else}
                        🚀 שליחת הפרסומת לאישור
                    {/if}
                </button>
            </section>

        {:else}
            <!-- =================== נשלח =================== -->
            <section class="step-card success-card">
                <div class="done-box">
                    <div class="done-emoji">🎉</div>
                    {#if editId}
                        <h2>השינויים נשמרו!</h2>
                        <p>
                            המודעה המעודכנת מוצגת באתר מעכשיו (עד דקה עד שהתצוגה מתרעננת).
                            הנתונים והתקופה של הפרסום נשמרו כמו שהיו.
                        </p>
                        <div class="done-actions">
                            <a href="/advertise/manage/{editId}" class="l-btn amber">לדשבורד הנכס</a>
                            <a href="/ads/{editId}" class="l-btn ghost">לדף הנחיתה</a>
                        </div>
                    {:else}
                        <h2>הפרסומת נשלחה לאישור!</h2>
                        <p>
                            הצוות שלנו יעבור על הפרסומת ויאשר אותה בהקדם.
                            ברגע שתאושר - היא תופיע באתר ותקבלו עדכון.
                        </p>
                        <div class="done-actions">
                            <a href="/advertise/manage" class="l-btn amber">לנכסים שלי</a>
                            <a href="/" class="l-btn ghost">לדף הבית</a>
                        </div>
                    {/if}
                </div>
            </section>
        {/if}

    {/if}
</div>

<style>
    .ad-landing-builder {
        max-width: 64rem;
        margin: 0 auto;
        padding: 1rem 1rem 3rem;
    }

    /* ===== תשלום בשלב השליחה ===== */
    .pay-box {
        border-radius: 1rem;
        border: 1px solid rgba(245, 158, 11, 0.4);
        background: rgba(245, 158, 11, 0.05);
        padding: 1.25rem;
        text-align: center;
        margin: 1rem 0;
    }
    .pay-title {
        font-size: 1.05rem;
        font-weight: 900;
        color: #fcd34d;
        margin: 0 0 0.5rem;
    }
    .pay-duration {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-bottom: 0.85rem;
    }
    .pay-duration-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.15rem;
        padding: 0.5rem 0.9rem;
        border-radius: 0.9rem;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.05);
        color: #d1d5db;
        font-weight: 800;
        font-size: 0.85rem;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.15s;
    }
    .pay-duration-btn.active {
        background: #f59e0b;
        border-color: #f59e0b;
        color: #000;
    }
    .pay-plan-price {
        font-size: 1rem;
        font-weight: 900;
        color: #fcd34d;
    }
    .pay-duration-btn.active .pay-plan-price {
        color: #000;
    }
    .pay-terms {
        font-size: 0.85rem;
        color: #d1d5db;
        margin: 0 0 0.85rem;
    }
    .pay-terms a {
        color: #fcd34d;
        font-weight: 800;
        text-decoration: underline;
    }
    .pay-sub {
        font-size: 0.9rem;
        color: #d1d5db;
        margin: 0 0 0.75rem;
        line-height: 1.5;
    }
    .pay-ok {
        font-size: 0.95rem;
        font-weight: 800;
        color: #86efac;
        margin: 0;
    }
    .pay-wa {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.6rem 1.2rem;
        border-radius: 0.75rem;
        font-weight: 800;
        text-decoration: none;
        background: #16a34a;
        color: #fff;
        transition: background 0.2s;
    }
    .pay-wa:hover { background: #22c55e; }
    .pay-code {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
        align-items: stretch;
        margin-top: 0.85rem;
        flex-wrap: wrap;
    }
    .pay-code-input {
        padding: 0.6rem 1rem;
        border-radius: 0.75rem;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.06);
        color: #fff;
        font-family: inherit;
        font-size: 0.9rem;
        width: min(100%, 240px);
        outline: none;
        text-align: center;
    }
    .pay-code-input::placeholder { color: #9ca3af; }
    .pay-code-input:focus { border-color: #fbbf24; }
    .pay-code-btn {
        padding: 0.6rem 1.2rem;
        border-radius: 0.75rem;
        border: none;
        background: #f59e0b;
        color: #000;
        font-weight: 900;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.2s;
    }
    .pay-code-btn:hover { background: #fbbf24; }
    .pay-error {
        color: #fca5a5;
        font-size: 0.85rem;
        font-weight: 700;
        margin: 0.6rem 0 0;
    }
    .l-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.65rem 1.25rem;
        border-radius: 0.75rem;
        font-weight: 800;
        text-decoration: none;
        border: none;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.9rem;
        transition: all 0.2s;
    }
    .l-btn.amber { background: #f59e0b; color: #000; }
    .l-btn.amber:hover { background: #fbbf24; }
    .l-btn.ghost {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
    }
    .l-btn.ghost:hover { background: rgba(255, 255, 255, 0.15); }

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
    }
    .compress-toast p {
        color: #fde68a;
        font-size: 0.85rem;
        font-weight: 700;
        margin: 0;
        text-align: right;
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

    /* ===== כותרת ===== */
    .l-header {
        text-align: center;
        margin-bottom: 2rem;
    }
    .l-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.35rem 1rem;
        border-radius: 999px;
        background: linear-gradient(to right, rgba(245, 158, 11, 0.2), rgba(249, 115, 22, 0.2)), #16264d;
        border: 1px solid rgba(245, 158, 11, 0.3);
        margin-bottom: 1rem;
        color: #fcd34d;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.05em;
    }
    .l-header h1 {
        font-size: 1.85rem;
        font-weight: 900;
        color: #fff;
        margin: 0 0 0.75rem;
    }
    .l-header p {
        /* אסור טקסט אפור ישירות על הרקע הוורוד — תמיד קופסה כהה */
        color: #d1d5db;
        font-size: 0.9rem;
        max-width: 42rem;
        margin: 0 auto;
        line-height: 1.6;
        background: #16264d;
        border: 1px solid #3b5794;
        border-radius: 1rem;
        padding: 0.8rem 1.4rem;
    }
    .l-back {
        margin-top: 1rem;
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 0.75rem;
        cursor: pointer;
        font-family: inherit;
        transition: color 0.2s;
    }
    .l-back:hover { color: #fcd34d; }

    /* ===== כרטיס שלב ===== */
    .step-card {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01)), #16264d;
        border: 1px solid #3b5794;
        border-radius: 1.25rem;
        padding: 1.25rem 1.25rem 1.5rem;
        margin-bottom: 1.25rem;
        position: relative;
    }
    @media (min-width: 768px) {
        .step-card { padding: 1.75rem; margin-bottom: 1.75rem; }
    }
    .success-card {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04));
        border-color: rgba(16, 185, 129, 0.4);
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

    /* ===== קלטים ===== */
    .l-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }
    @media (max-width: 768px) {
        .l-grid { grid-template-columns: 1fr; }
    }
    .span-2 { grid-column: 1 / -1; }
    .field-label {
        display: block;
        color: #d1d5db;
        font-weight: 700;
        font-size: 0.85rem;
        margin-bottom: 0.4rem;
    }
    .field-note {
        font-size: 0.75rem;
        color: #9ca3af;
        margin: 0 0 0.5rem;
        line-height: 1.5;
    }
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
    .text-input.small { padding: 0.55rem 0.75rem; font-size: 0.85rem; }
    .text-input::placeholder { color: #6b7280; }
    .text-input:focus {
        border-color: rgba(245, 158, 11, 0.6);
        background: rgba(255, 255, 255, 0.06);
    }
    .char-count {
        font-size: 0.75rem;
        color: #6b7280;
        margin-top: 0.35rem;
        text-align: left;
    }
    .adv-inputs {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .hidden-input { display: none; }

    /* ===== אזורי העלאה ===== */
    .upload-zone-lg {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        max-width: 360px;
        min-height: 160px;
        border: 2px dashed rgba(245, 158, 11, 0.4);
        border-radius: 0.85rem;
        background: rgba(245, 158, 11, 0.04);
        cursor: pointer;
        overflow: hidden;
    }
    .upload-zone-lg.has-image { border-style: solid; padding: 0; }
    .upload-zone-lg img { width: 100%; height: 100%; object-fit: cover; }
    .upload-zone-lg.dragging {
        border-color: #22c55e;
        background: rgba(34, 197, 94, 0.12);
        box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
    }
    .upload-empty-sm { text-align: center; }
    .ue-emoji { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .upload-empty-sm p {
        font-size: 0.75rem;
        font-weight: 700;
        color: #d1d5db;
        margin: 0;
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

    /* ===== מוצרים ===== */
    .products-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    .product-row {
        display: flex;
        align-items: stretch;
        gap: 0.75rem;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 0.85rem;
        padding: 0.75rem;
    }
    @media (max-width: 768px) {
        .product-row { flex-direction: column; }
    }
    .upload-zone-product {
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
    .upload-zone-product.has-image { border-style: solid; }
    .upload-zone-product img { width: 100%; height: 100%; object-fit: cover; }
    .upload-zone-product.dragging {
        border-color: #22c55e;
        background: rgba(34, 197, 94, 0.12);
    }
    .pz-empty {
        text-align: center;
        font-size: 0.7rem;
        color: #9ca3af;
        line-height: 1.5;
    }
    .product-fields {
        flex: 1;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem;
        align-content: center;
    }
    @media (max-width: 768px) {
        .product-fields { grid-template-columns: 1fr; }
    }
    .remove-btn {
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.05);
        color: #9ca3af;
        border: 1px solid rgba(255, 255, 255, 0.08);
        cursor: pointer;
        align-self: center;
        flex-shrink: 0;
    }
    .remove-btn:hover { background: rgba(220, 38, 38, 0.6); color: white; }
    .add-product-btn {
        margin-top: 0.75rem;
        width: 100%;
        padding: 0.75rem;
        border-radius: 0.75rem;
        border: 2px dashed rgba(245, 158, 11, 0.4);
        background: rgba(245, 158, 11, 0.05);
        color: #fcd34d;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.2s;
    }
    .add-product-btn:hover {
        background: rgba(245, 158, 11, 0.1);
        border-color: rgba(245, 158, 11, 0.7);
    }

    /* ===== תצוגת דף הנחיתה ===== */
    .preview-frame {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
    }
    .landing-mock {
        width: 100%;
        max-width: 720px;
        background: #0f172a;
        border-radius: 0.85rem;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    }
    .landing-hero {
        position: relative;
        padding: 1.6rem 1.4rem;
        overflow: hidden;
    }
    .landing-hero-inner {
        display: grid;
        gap: 1.1rem;
        align-items: center;
        text-align: center;
    }
    @media (min-width: 700px) {
        .landing-hero-inner.has-media {
            grid-template-columns: minmax(0, 1fr) minmax(0, 15rem);
            text-align: right;
        }
    }
    .landing-hero-content { min-width: 0; }
    .landing-hero-media { min-width: 0; }
    .landing-hero-media img {
        display: block;
        width: auto;
        max-width: 100%;
        max-height: 12rem;
        margin-inline: auto;
        border-radius: 0.7rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
    }
    @media (min-width: 700px) {
        .landing-hero-media img { max-height: 19rem; }
    }
    .landing-cta-row { margin-top: 0.9rem; }
    @media (min-width: 700px) {
        .has-media .landing-cta-row { text-align: right; }
    }
    /* כמו בדף האמיתי: הלוגו בתוך טור הטקסט, לא צף בפינה (שם הוא היה מכסה את הכותרת) */
    .landing-logo {
        width: 54px;
        height: 54px;
        border-radius: 0.7rem;
        background: white;
        padding: 5px;
        object-fit: contain;
        margin: 0 0 0.6rem;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    }
    @media (min-width: 700px) {
        .landing-logo { width: 68px; height: 68px; border-radius: 0.85rem; }
    }
    .landing-logo.circle { border-radius: 999px; }
    .landing-hero h1 {
        color: white;
        font-size: 1.55rem;
        font-weight: 900;
        line-height: 1.25;
        margin: 0 0 0.4rem;
    }
    .landing-hero p {
        color: rgba(255, 255, 255, 0.92);
        font-size: 0.95rem;
        margin: 0;
        line-height: 1.45;
        overflow-wrap: anywhere;
    }
    .landing-cta {
        display: inline-block;
        padding: 0.6rem 1.25rem;
        border-radius: 999px;
        background: white;
        color: black;
        font-weight: 800;
        font-size: 0.95rem;
        text-decoration: none;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
    }
    .landing-cta.dim { opacity: 0.6; }
    .landing-cta.wa { background: #16a34a; color: #fff; }

    .landing-section {
        padding: 1.1rem 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
    .landing-section h2 {
        color: white;
        font-size: 1.05rem;
        font-weight: 900;
        margin: 0 0 0.5rem;
    }
    .landing-about {
        display: grid;
        gap: 1.1rem;
    }
    @media (min-width: 700px) {
        .landing-about { grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 1.75rem; }
    }
    .landing-section p {
        color: #d1d5db;
        font-size: 0.9rem;
        line-height: 1.55;
        margin: 0;
    }
    .advantages-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.45rem;
    }
    .advantages-list.on-hero { margin-top: 0.85rem; }
    .advantages-list.strip {
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
        gap: 0.5rem 1.25rem;
    }
    .advantage-item {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        text-align: right;
    }
    .advantage-check {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.92);
        color: #111827;
        font-weight: 900;
        font-size: 0.75rem;
        line-height: 1;
    }
    .advantage-check.tinted { color: #fff; }
    .advantage-text {
        font-size: 0.9rem;
        line-height: 1.35;
        font-weight: 600;
    }
    .on-hero .advantage-text { color: rgba(255, 255, 255, 0.95); }
    .strip .advantage-text { color: #e5e7eb; }
    .products-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 0.75rem;
    }
    .product-card {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 0.75rem;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    .product-card img {
        width: 100%;
        height: 100px;
        object-fit: cover;
    }
    .product-info { padding: 0.6rem; }
    .product-name {
        color: white;
        font-weight: 700;
        font-size: 0.85rem;
        margin: 0 0 0.2rem;
    }
    .product-desc {
        color: #9ca3af;
        font-size: 0.72rem;
        margin: 0 0 0.3rem;
        line-height: 1.3;
    }
    .product-price {
        color: #fbbf24;
        font-weight: 900;
        font-size: 0.95rem;
        margin: 0;
    }
    .landing-contact { text-align: center; }
    .landing-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        justify-content: center;
    }
    .landing-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.4rem 0.85rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #e5e7eb;
        font-size: 0.85rem;
        font-weight: 700;
        text-decoration: none;
    }
    .landing-pill:hover {
        background: rgba(251, 191, 36, 0.12);
        border-color: rgba(251, 191, 36, 0.45);
        color: #fde68a;
    }
    .landing-meta {
        color: #9ca3af;
        font-size: 0.8rem;
        margin: 0.7rem 0 0;
    }
    .img-placeholder {
        width: 100%;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.03);
        color: #6b7280;
        font-size: 0.7rem;
        font-weight: 700;
    }

    /* ===== צ'קליסט ושליחה ===== */
    .checklist {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.5rem;
    }
    @media (min-width: 640px) {
        .checklist { grid-template-columns: 1fr 1fr; }
    }
    .checklist li {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 0.6rem;
        padding: 0.55rem 0.85rem;
        color: #9ca3af;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .checklist li.done {
        color: #e5e7eb;
        background: rgba(16, 185, 129, 0.08);
        border-color: rgba(16, 185, 129, 0.25);
    }
    /* אזהרה חוסמת = אדום. צהוב נקרא כהדגשה, ואנשים פשוט לחצו "שלח" שוב ושוב */
    .submit-note {
        color: #fca5a5;
        font-size: 0.85rem;
        margin: 0.75rem 0 0;
        font-weight: 700;
    }
    .inline-link {
        background: none;
        border: none;
        color: #fca5a5;
        text-decoration: underline;
        cursor: pointer;
        font-family: inherit;
        font-size: inherit;
        font-weight: inherit;
        padding: 0;
    }
    .submit-error {
        color: #fca5a5;
        font-size: 0.85rem;
        margin: 0.75rem 0 0;
        font-weight: 700;
    }
    /* שער ההתחברות — מוצג במקום כפתור שליחה פעיל כשהמפרסם לא מחובר */
    .login-gate {
        margin-top: 1.1rem;
        padding: 1rem 1.1rem;
        border-radius: 1rem;
        background: rgba(59, 130, 246, 0.12);
        border: 1px solid rgba(96, 165, 250, 0.45);
        text-align: center;
    }
    .login-gate-title {
        margin: 0;
        font-weight: 900;
        font-size: 1.05rem;
        color: #dbeafe;
    }
    .login-gate-text {
        margin: 0.45rem 0 0;
        font-size: 0.9rem;
        line-height: 1.6;
        color: #cbd5e1;
    }
    .login-gate-btn {
        margin-top: 0.85rem;
        padding: 0.7rem 1.4rem;
        border-radius: 0.85rem;
        border: none;
        background: linear-gradient(to right, #2563eb, #7c3aed);
        color: #fff;
        font-weight: 800;
        font-size: 0.95rem;
        font-family: inherit;
        cursor: pointer;
        transition: opacity 0.2s;
    }
    .login-gate-btn:hover { opacity: 0.9; }
    .login-gate-btn:disabled { opacity: 0.6; cursor: default; }
    .login-gate-note {
        margin: 0.6rem 0 0;
        font-size: 0.8rem;
        color: #94a3b8;
    }
    /* דחיית העלאה בשלב עצמו — כשאין מקום לתמונה בתקציב המודעה */
    .upload-issue {
        margin-top: 0.7rem;
        padding: 0.7rem 0.9rem;
        border-radius: 0.75rem;
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(248, 113, 113, 0.45);
        color: #fecaca;
        font-size: 0.9rem;
        font-weight: 600;
        line-height: 1.55;
    }
    .submit-btn {
        margin-top: 1.25rem;
        width: 100%;
        padding: 1rem;
        border-radius: 1rem;
        background: linear-gradient(to right, #16a34a, #059669);
        color: white;
        font-weight: 900;
        font-size: 1.1rem;
        border: none;
        cursor: not-allowed;
        opacity: 0.5;
        box-shadow: 0 20px 25px rgba(34, 197, 94, 0.3);
        transition: all 0.2s;
        font-family: inherit;
    }
    .submit-btn.enabled {
        cursor: pointer;
        opacity: 1;
    }
    .submit-btn.enabled:hover { transform: scale(1.02); }
    .submit-btn.enabled:active { transform: scale(0.95); }

    .done-box {
        text-align: center;
        padding: 1.5rem 0;
    }
    .done-emoji { font-size: 3.75rem; margin-bottom: 0.75rem; }
    .done-box h2 {
        font-size: 1.6rem;
        font-weight: 900;
        color: #86efac;
        margin: 0 0 0.5rem;
    }
    .done-box p {
        color: #d1d5db;
        max-width: 32rem;
        margin: 0 auto;
        line-height: 1.6;
    }
    .done-actions {
        margin-top: 1.5rem;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
    }
</style>
