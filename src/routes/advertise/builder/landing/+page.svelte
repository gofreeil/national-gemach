<script>
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";

    // עורך דף הנחיתה + שליחה סופית - פורט מקבוצות רכישה (במקור מ"קהילה בשכונה").
    // חולק את אותה טיוטת localStorage עם ה-builder הראשי.

    let { data } = $props();

    const LS_KEY = "ng_ad_builder_draft_v1";
    const PAID_KEY = "ad_paid";
    const PAID_AT_KEY = "ad_paid_at";

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
    let logo = $state("");
    let logoShape = $state(/** @type {'square' | 'circle'} */ ("square"));
    let gradient = $state("linear-gradient(135deg, #f59e0b, #ea580c)");

    // ===== גרירת קבצים =====
    let isDraggingLandingImage = $state(false);
    /** @type {number | null} */
    let draggingProductId = $state(null);

    // ===== עזרי תמונה (זהים ל-builder) =====
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
     * @param {'landing' | { kind: 'product', id: number }} target
     */
    async function processImageFile(file, target) {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            alert("נא להעלות קובץ תמונה");
            return;
        }
        const MAX_BYTES = 5 * 1024 * 1024;
        const { dataUrl, wasCompressed, originalMB, finalMB } = await compressImageToFit(file, MAX_BYTES);
        if (wasCompressed) showCompressNotice(originalMB, finalMB);
        if (target === "landing") {
            landingImage = String(dataUrl);
        } else {
            const idx = products.findIndex((p) => p.id === target.id);
            if (idx >= 0) {
                products[idx] = { ...products[idx], image: String(dataUrl) };
                products = [...products];
            }
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
    // קוד מאחורי הקלעים: מי שכותב אותו במקום כסף — המודעה נשלחת לאישור
    // האדמין כאילו שולם. הקוד עצמו לא כתוב בשום מקום באתר.
    let payCode = $state("");
    let payCodeOk = $state(false);
    let payCodeError = $state(false);
    // תקופת הפרסום שהמפרסם בוחר — עוברת לאדמין ומקבעת את ברירת המחדל באישור
    let payDuration = $state(30);
    const payDurationLabel = $derived(payDuration === 180 ? "חצי שנה" : "חודש");
    /** @param {SubmitEvent} e */
    function tryPayCode(e) {
        e.preventDefault();
        const normalized = payCode.trim().replace(/\s+/g, " ");
        if (normalized === "יוצאים לחירות") {
            payCodeOk = true;
            payCodeError = false;
            try {
                localStorage.setItem(PAID_KEY, "1");
                localStorage.setItem(PAID_AT_KEY, new Date().toISOString());
            } catch {}
        } else {
            payCodeError = true;
        }
    }

    onMount(() => {
        if (!browser) return;
        checkAccess();

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
                    logo = d.logo ?? "";
                    logoShape = d.logoShape ?? "square";
                    gradient = d.gradient ?? gradient;
                }
            } catch {}
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

    // ===== ולידציה + שליחה =====
    let canSubmit = $derived(
        Boolean(mainImage && title && subtitle && hoverText && (phone || website) && (landingHeadline || landingPitch)),
    );
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

    async function submitAd() {
        if (!canSubmit || submitting) return;
        submitting = true;
        submitError = "";
        try {
            const payload = {
                title, subtitle, hoverText, cta, gradient,
                logo, mainImage,
                landing: {
                    headline: landingHeadline,
                    pitch: landingPitch,
                    extended: landingExtended,
                    image: landingImage,
                    advantages: landingAdvantages,
                    uniqueness, phone, whatsapp, website, email, address, hours, products,
                },
                // "code" = הוזן קוד התנועה — נשלח כמי ששולם; אחרת התשלום לתיאום
                payment: payCodeOk ? "code" : "pending",
                requestedDurationDays: payDuration,
            };
            const res = await fetch("/api/ads/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                throw new Error(await extractServerError(res));
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
</script>

<svelte:head>
    <title>עריכת דף נחיתה | בונה הפרסומות</title>
</svelte:head>

<div class="ad-landing-builder" dir="rtl">

    {#if accessGranted}

        {#if compressNotice.visible}
            <div class="compress-toast" role="status" aria-live="polite">
                <button type="button" class="compress-toast-close" onclick={dismissCompressNotice} aria-label="סגור">✕</button>
                <p>🪄 התמונה כווצה מ-{compressNotice.originalMB.toFixed(1)}MB ל-{compressNotice.finalMB.toFixed(1)}MB</p>
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
                        <header class="landing-hero" style:background={gradient}>
                            {#if landingImage || mainImage}
                                <img src={landingImage || mainImage} alt={title} class="landing-hero-bg" />
                            {/if}
                            <div class="landing-hero-overlay"></div>
                            {#if logo}
                                <img src={logo} alt="לוגו" class="landing-logo" class:circle={logoShape === "circle"} />
                            {/if}
                            <div class="landing-hero-content">
                                <h1>{landingHeadline || title || "כותרת דף הנחיתה"}</h1>
                                <p>{landingPitch || subtitle || "משפט הפתיחה יופיע כאן"}</p>
                                {#if phone}
                                    <a href="tel:{phone}" class="landing-cta">📞 {phone}</a>
                                {:else if website}
                                    <a href={website} class="landing-cta">לאתר שלנו ←</a>
                                {:else}
                                    <span class="landing-cta dim">השלימו פרטי קשר</span>
                                {/if}
                            </div>
                        </header>

                        {#if landingAdvantages.some((a) => a.trim())}
                            <section class="landing-section">
                                <ul class="advantages-list">
                                    {#each landingAdvantages as adv}
                                        {#if adv.trim()}
                                            <li class="advantage-item">
                                                <span class="advantage-check" style:background={gradient} aria-hidden="true">✓</span>
                                                <span class="advantage-text">{adv}</span>
                                            </li>
                                        {/if}
                                    {/each}
                                </ul>
                            </section>
                        {/if}

                        {#if landingExtended}
                            <section class="landing-section">
                                <h2>הסיפור שלנו</h2>
                                <p style="white-space: pre-line">{landingExtended}</p>
                            </section>
                        {/if}

                        {#if uniqueness}
                            <section class="landing-section">
                                <h2>מה מייחד אותנו</h2>
                                <p style="white-space: pre-line">{uniqueness}</p>
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

                        <section class="landing-section landing-contact">
                            <h2>פרטי קשר</h2>
                            <ul>
                                {#if phone}<li>📞 <a href="tel:{phone}">{phone}</a></li>{/if}
                                {#if whatsapp}<li>💬 <a href="https://wa.me/{whatsapp.replace(/\D/g, '')}">וואטסאפ: {whatsapp}</a></li>{/if}
                                {#if email}<li>✉️ <a href="mailto:{email}">{email}</a></li>{/if}
                                {#if website}<li>🌐 <a href={website} target="_blank" rel="noopener">{website}</a></li>{/if}
                                {#if address}<li>📍 {address}</li>{/if}
                                {#if hours}<li>🕒 {hours}</li>{/if}
                            </ul>
                        </section>
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
                    <li class:done={products.length > 0}><span>{products.length > 0 ? "✅" : "⬜"}</span> מוצרים ({products.length})</li>
                    <li class:done={!!uniqueness}><span>{uniqueness ? "✅" : "⬜"}</span> מה מייחד אתכם</li>
                    <li class:done={!!address}><span>{address ? "✅" : "⬜"}</span> כתובת</li>
                </ul>

                <!-- ===== תקופת פרסום + תשלום — אחרי העיצוב, לפני השליחה ===== -->
                <div class="pay-box">
                    <p class="pay-title">💳 תקופת פרסום ותשלום</p>
                    <div class="pay-duration" role="group" aria-label="תקופת הפרסום">
                        <span class="pay-duration-label">תקופת הפרסום:</span>
                        <button type="button" class="pay-duration-btn" class:active={payDuration === 30} onclick={() => (payDuration = 30)}>חודש</button>
                        <button type="button" class="pay-duration-btn" class:active={payDuration === 180} onclick={() => (payDuration = 180)}>חצי שנה</button>
                    </div>
                    {#if payCodeOk}
                        <p class="pay-ok">✅ הקוד התקבל — המודעה תישלח לאישור כמי ששולם ({payDurationLabel}).</p>
                    {:else}
                        <p class="pay-sub">
                            המודעה תעלה לאוויר אחרי אישור מנהל, בהתאם לתשלום.
                            לתיאום התשלום:
                        </p>
                        <a
                            href={"https://wa.me/972508750632?text=" + encodeURIComponent(`שלום, אני מעלה פרסומת באתר הגמ"ח הארצי ורוצה לתאם תשלום לתקופה של ${payDurationLabel}`)}
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

                {#if !canSubmit}
                    <p class="submit-note">כדי לשלוח: תמונה, כותרת, סלוגן, טקסט ריחוף, דרך קשר וכותרת/פתיח לדף הנחיתה. חסר משהו? חזרו <button type="button" class="inline-link" onclick={goBack}>לעריכת הכרטיס</button>.</p>
                {/if}
                {#if submitError}
                    <p class="submit-error">השליחה נכשלה: {submitError}</p>
                {/if}

                <button type="button" onclick={submitAd} disabled={!canSubmit || submitting} class="submit-btn" class:enabled={canSubmit && !submitting}>
                    {#if submitting}שולח...{:else}🚀 שליחת הפרסומת לאישור{/if}
                </button>
            </section>

        {:else}
            <!-- =================== נשלח =================== -->
            <section class="step-card success-card">
                <div class="done-box">
                    <div class="done-emoji">🎉</div>
                    <h2>הפרסומת נשלחה לאישור!</h2>
                    <p>
                        הצוות שלנו יעבור על הפרסומת ויאשר אותה בהקדם.
                        ברגע שתאושר - היא תופיע באתר ותקבלו עדכון.
                    </p>
                    <div class="done-actions">
                        <a href="/" class="l-btn ghost">לדף הבית</a>
                        <a href="/advertise" class="l-btn amber">לדף הפרסום</a>
                    </div>
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
    .pay-duration-label {
        font-size: 0.9rem;
        font-weight: 700;
        color: #d1d5db;
    }
    .pay-duration-btn {
        padding: 0.45rem 1.1rem;
        border-radius: 999px;
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
        text-align: center;
        min-height: 160px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }
    .landing-hero-bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.28;
    }
    .landing-hero-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.25));
    }
    .landing-hero-content {
        position: relative;
        z-index: 2;
        max-width: 480px;
    }
    .landing-logo {
        position: absolute;
        top: 0.7rem;
        right: 0.7rem;
        width: 42px;
        height: 42px;
        border-radius: 0.55rem;
        background: white;
        padding: 4px;
        object-fit: contain;
        z-index: 3;
        margin: 0;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    }
    .landing-logo.circle { border-radius: 999px; }
    .landing-hero h1 {
        color: white;
        font-size: 1.55rem;
        font-weight: 900;
        margin: 0 0 0.4rem;
    }
    .landing-hero p {
        color: rgba(255, 255, 255, 0.92);
        font-size: 0.95rem;
        margin: 0 0 1rem;
        line-height: 1.45;
    }
    .landing-cta {
        display: inline-block;
        padding: 0.75rem 1.5rem;
        border-radius: 999px;
        background: white;
        color: black;
        font-weight: 800;
        font-size: 1rem;
        text-decoration: none;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
    }
    .landing-cta.dim { opacity: 0.6; }

    .landing-section {
        padding: 1.25rem 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
    .landing-section h2 {
        color: white;
        font-size: 1.15rem;
        font-weight: 900;
        margin: 0 0 0.75rem;
        text-align: center;
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
        gap: 0.65rem;
        max-width: 540px;
        margin-inline: auto;
    }
    .advantage-item {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 0.4rem 0.2rem;
        text-align: right;
        transition: transform 200ms ease;
    }
    .advantage-item:hover { transform: translateX(-3px); }
    .advantage-check {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 900;
        font-size: 1rem;
        line-height: 1;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    }
    .advantage-text {
        color: #e5e7eb;
        font-size: 0.92rem;
        line-height: 1.4;
        font-weight: 600;
    }
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
    .landing-contact ul {
        list-style: none;
        padding: 0;
        max-width: 360px;
        margin: 0 auto;
    }
    .landing-contact li {
        padding: 0.4rem 0;
        color: #e5e7eb;
        font-size: 0.9rem;
    }
    .landing-contact a {
        color: #fbbf24;
        text-decoration: none;
    }
    .landing-contact a:hover { text-decoration: underline; }
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
    .submit-note {
        color: #fcd34d;
        font-size: 0.85rem;
        margin: 0.75rem 0 0;
        font-weight: 700;
    }
    .inline-link {
        background: none;
        border: none;
        color: #fbbf24;
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
