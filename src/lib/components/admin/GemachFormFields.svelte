<script lang="ts">
    import type { Gemach, CategoryDef } from '$lib/gemachData';
    import TagEditor from './TagEditor.svelte';
    import OpeningHoursEditor from './OpeningHoursEditor.svelte';
    import { imageDrop } from '$lib/imageDrop';
    import { compressImage, dataUriWeightKb, MAX_GALLERY_IMAGES, MAX_TOTAL_IMAGE_KB } from '$lib/imageCompress';
    import { DEFAULT_FIT, isCustomFit, fitStyle, fitObjectClass, type ImageFit } from '$lib/imageFit';

    let {
        gemach = null,
        categories,
        cities = [],
        admin = true
    }: {
        // בשמירה שנכשלה הטופס נזרע מחדש מ-CreateGemachInput, ששם הגלריה נקראת `images`
        gemach?: (Partial<Gemach> & { images?: string[] }) | null;
        categories: CategoryDef[];
        cities?: string[];
        // admin=false → מסתיר את פקדי ההצמדה/סידור (עריכת בעלים)
        admin?: boolean;
    } = $props();

    let tags = $state<string[]>(gemach?.tags ? [...gemach.tags] : []);

    // ---- נושאים ----
    // גמ"ח אחד משרת לא פעם כמה נושאים (ציוד רפואי + ריהוט, ביגוד + תינוקות),
    // ולכן הבחירה מרובה. הסדר הוא סדר הסימון, והראשון הוא הנושא הראשי —
    // הוא שקובע את התווית בכרטיס, את האייקון ואת דף הנושא הראשי בגוגל.
    let selectedCats = $state<string[]>(
        gemach?.categories?.length
            ? [...gemach.categories]
            : (gemach?.category ? [gemach.category] : [])
    );

    function toggleCat(key: string) {
        selectedCats = selectedCats.includes(key)
            ? selectedCats.filter((k) => k !== key)
            : [...selectedCats, key];
    }

    // ---- תמונות ----
    // התמונות נשמרות כ-data URI בתוך הרשומה (ולא ב-Media Library), בדיוק כמו
    // ב"קהילה בשכונה" — כך שתמונה שהועלתה שם נראית כאן ולהפך. ההעלאה מכווצת
    // בצד הלקוח, ולכן מה שנשלח לשרת כבר בגודל סביר.

    let image = $state(gemach?.image ?? '');
    let imageBroken = $state(false);
    const imagePreview = $derived(/^(https?:\/\/|data:image\/|\/)/i.test(image.trim()) ? image.trim() : '');
    $effect(() => { if (imagePreview) imageBroken = false; });   // כתובת חדשה → ניסיון טעינה מחדש

    let images = $state<string[]>([...(gemach?.gallery ?? gemach?.images ?? [])]);

    let busy = $state(false);
    let uploadError = $state('');

    const totalKb = $derived(
        [image, ...images].reduce((sum, src) => sum + dataUriWeightKb(src), 0)
    );

    const OVER_BUDGET = `התמונות חורגות מ-${MAX_TOTAL_IMAGE_KB}KB — הסר תמונה או השתמש בכתובת URL במקום העלאה`;

    async function pickLogo(files: File[]) {
        const file = files.find(f => f.type.startsWith('image/'));
        if (!file) return;
        busy = true;
        uploadError = '';
        try {
            const next = await compressImage(file);
            const rest = images.reduce((s, src) => s + dataUriWeightKb(src), 0);
            if (rest + dataUriWeightKb(next) > MAX_TOTAL_IMAGE_KB) {
                uploadError = OVER_BUDGET;
                return;
            }
            image = next;
            // תמונה חדשה — קומפוזיציה חדשה; המיקוד של הקודמת לא רלוונטי
            dropFit('logo');
        } catch {
            uploadError = 'קובץ התמונה לא נתמך';
        } finally {
            busy = false;
        }
    }

    async function addToGallery(files: File[]) {
        busy = true;
        uploadError = '';
        try {
            const next = [...images];
            let kb = totalKb;
            for (const f of files) {
                if (next.length >= MAX_GALLERY_IMAGES) {
                    uploadError = `אפשר עד ${MAX_GALLERY_IMAGES} תמונות בגלריה`;
                    break;
                }
                if (!f.type.startsWith('image/')) continue;
                try {
                    const src = await compressImage(f);
                    if (kb + dataUriWeightKb(src) > MAX_TOTAL_IMAGE_KB) {
                        uploadError = OVER_BUDGET;
                        break;
                    }
                    kb += dataUriWeightKb(src);
                    next.push(src);
                } catch {
                    uploadError = 'אחד הקבצים אינו תמונה תקינה';
                }
            }
            images = next;
        } finally {
            busy = false;
        }
    }

    /** קבצים שנבחרו ב-<input type="file">; מאפסים כדי שאפשר יהיה לבחור שוב אותו קובץ */
    function onFilePicked(e: Event, handler: (files: File[]) => void) {
        const input = e.currentTarget as HTMLInputElement;
        handler(Array.from(input.files ?? []));
        input.value = '';
    }

    // ---- מיקום-ותקריב (image_fit) ----
    // המעלה בוחר איזה חלק מהתמונה ימלא את משבצות התצוגה (כרטיס, דף הגמ"ח):
    // גרירה בתצוגה המקדימה + מחוון תקריב. נשמר לפי מפתח — 'logo' או אינדקס
    // גלריה — ולכן מחיקה/סידור של הגלריה חייבים להזיז את המפתחות יחד עם התמונות.

    let fit = $state<Record<string, ImageFit>>({ ...(gemach?.imageFit ?? {}) });
    /** המפתח שנערך כרגע בעורך המיקוד (null = סגור) */
    let fitEditing = $state<string | null>(null);

    const fitJson = $derived(JSON.stringify(
        Object.fromEntries(Object.entries(fit).filter(([, f]) => isCustomFit(f)))
    ));

    const editedFit = $derived(fitEditing !== null ? (fit[fitEditing] ?? DEFAULT_FIT) : DEFAULT_FIT);
    const editedSrc = $derived(
        fitEditing === null ? '' : fitEditing === 'logo' ? imagePreview : (images[Number(fitEditing)] ?? '')
    );

    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

    /** מסיר את המיקום של מפתח (חזרה לברירת המחדל — מרכז בלי תקריב) */
    function dropFit(key: string) {
        const next = { ...fit };
        delete next[key];
        fit = next;
    }

    function setEditedFit(patch: Partial<ImageFit>) {
        if (fitEditing === null) return;
        fit = { ...fit, [fitEditing]: { ...editedFit, ...patch } };
    }

    /** מעבר בין "מילוי המשבצת" (חיתוך + תקריב) ל"תמונה שלמה" (בלי חיתוך).
     *  ב"תמונה שלמה" אין תקריב, ולכן z חוזר ל-1. "מילוי" נשמר כ-contain:false
     *  מפורש — מחיקת המפתח הייתה משאירה fit ברירת-מחדל שנשמט בשמירה, ואז
     *  נפילת ה-contain האוטומטית לתמונה רחבה הציגה "תמונה שלמה" בכרטיס בכל זאת. */
    function setContain(on: boolean) {
        if (fitEditing === null) return;
        const { contain: _was, ...rest } = editedFit;
        fit = { ...fit, [fitEditing]: on ? { ...rest, z: 1, contain: true } : { ...rest, contain: false } };
    }

    /** כותב מחדש את מפתחות הגלריה אחרי שינוי סדר/מחיקה (הלוגו נשאר במקומו) */
    function setGalleryFits(arr: (ImageFit | undefined)[]) {
        const next: Record<string, ImageFit> = {};
        if (fit['logo']) next['logo'] = fit['logo'];
        arr.forEach((f, i) => { if (f) next[String(i)] = f; });
        fit = next;
    }

    function moveImage(from: number, to: number) {
        if (to < 0 || to >= images.length) return;
        const fits = images.map((_, j) => fit[String(j)]);
        const next = [...images];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        const [movedFit] = fits.splice(from, 1);
        fits.splice(to, 0, movedFit);
        images = next;
        setGalleryFits(fits);
        if (fitEditing !== null && fitEditing !== 'logo') fitEditing = null;
    }

    function removeGalleryImage(i: number) {
        const fits = images.map((_, j) => fit[String(j)]);
        fits.splice(i, 1);
        images = images.filter((_, j) => j !== i);
        setGalleryFits(fits);
        if (fitEditing !== null && fitEditing !== 'logo') fitEditing = null;
    }

    // ---- גרירת התמונה בעורך המיקוד ----
    let fitImgEl = $state<HTMLImageElement | null>(null);
    let fitDragging = $state(false);
    let dragLast = { x: 0, y: 0 };

    function onFitPointerDown(e: PointerEvent) {
        fitDragging = true;
        dragLast = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    function onFitPointerMove(e: PointerEvent) {
        if (!fitDragging || fitEditing === null || !fitImgEl?.naturalWidth) return;
        const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const rw = box.width / fitImgEl.naturalWidth;
        const rh = box.height / fitImgEl.naturalHeight;
        // במילוי התמונה גולשת מחוץ למשבצת, ובתמונה שלמה היא קטנה ממנה ונשארת
        // רצועה ריקה. object-position באחוזים מחלק בדיוק את הגלישה/הרצועה, ולכן
        // ‎Δ%‎ = Δpx/טווח — עם היפוך סימן: בגלישה גוררים את חלון-החיתוך, וברצועה
        // גוררים את התמונה עצמה.
        const scale = editedFit.contain ? Math.min(rw, rh) : Math.max(rw, rh) * editedFit.z;
        const overW = fitImgEl.naturalWidth * scale - box.width;
        const overH = fitImgEl.naturalHeight * scale - box.height;
        const dx = e.clientX - dragLast.x;
        const dy = e.clientY - dragLast.y;
        dragLast = { x: e.clientX, y: e.clientY };
        const pan = (v: number, d: number, over: number) =>
            Math.abs(over) < 1 ? undefined : clamp(v - (d / over) * 100, 0, 100);
        const nx = pan(editedFit.x, dx, overW);
        const ny = pan(editedFit.y, dy, overH);
        setEditedFit({
            ...(nx !== undefined ? { x: nx } : {}),
            ...(ny !== undefined ? { y: ny } : {}),
        });
    }

    function onFitPointerUp() {
        fitDragging = false;
    }
</script>

<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <!-- שם -->
    <div class="md:col-span-2">
        <label for="f-name" class="block text-sm font-bold text-gray-300 mb-1">שם הגמ"ח <span class="text-red-400">*</span></label>
        <input id="f-name" name="name" required defaultValue={gemach?.name ?? ''}
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder='לדוגמה: גמ"ח ציוד רפואי ירושלים' />
    </div>

    <!-- נושאים (בחירה מרובה) -->
    <fieldset class="md:col-span-2">
        <legend class="block text-sm font-bold text-gray-300 mb-1">נושאים <span class="text-red-400">*</span></legend>
        <!-- כל נושא מסומן נשלח כערך נפרד, בסדר הסימון — השרת לוקח את הראשון
             כנושא הראשי. בלי סימון אין ברירת מחדל: גמ"ח לא יפורסם בנושא שלא נבחר. -->
        {#each selectedCats as key (key)}
            <input type="hidden" name="categories" value={key} />
        {/each}
        <div class="flex flex-wrap gap-2">
            {#each categories as cat (cat.key)}
                {@const idx = selectedCats.indexOf(cat.key)}
                <button type="button" onclick={() => toggleCat(cat.key)} aria-pressed={idx >= 0}
                    class="flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold transition-colors
                        {idx >= 0
                            ? 'border-purple-400 bg-purple-600/30 text-white'
                            : 'border-[#3b5794] bg-[#1e293b] text-gray-300 hover:bg-[#243a6e]'}">
                    <span aria-hidden="true">{cat.icon}</span>
                    <span>{cat.label}</span>
                    {#if idx === 0}
                        <span class="rounded-full bg-purple-500 px-1.5 py-0.5 text-[10px] font-black text-white">ראשי</span>
                    {/if}
                </button>
            {/each}
        </div>
        <p class="mt-1.5 text-xs {selectedCats.length === 0 ? 'text-red-300' : 'text-gray-500'}">
            {#if selectedCats.length === 0}
                יש לבחור לפחות נושא אחד
            {:else}
                אפשר לסמן כמה נושאים — הגמ"ח יופיע בסינון של כל אחד מהם. הראשון שסומן הוא הנושא הראשי (הוא שמוצג בכרטיס).
            {/if}
        </p>
    </fieldset>

    <!-- אייקון -->
    <div class="md:col-span-2">
        <label for="f-icon" class="block text-sm font-bold text-gray-300 mb-1">אייקון (אימוג'י)</label>
        <input id="f-icon" name="icon" defaultValue={gemach?.icon ?? ''} maxlength="4"
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="לדוגמה: 🤝" />
    </div>

    <!-- לוגו -->
    <div class="md:col-span-2">
        <span class="block text-sm font-bold text-gray-300 mb-1">לוגו / תמונה ראשית</span>
        <input type="hidden" name="image" value={image} />
        <!-- מיקומי-התמונות של כל הטופס (לוגו + גלריה) — ראו $lib/imageFit -->
        <input type="hidden" name="image_fit" value={fitJson} />
        <div class="flex items-start gap-3">
            <div class="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#3b5794] bg-[#1e293b]">
                {#if imagePreview && !imageBroken}
                    <img src={imagePreview} alt="" class="h-full w-full object-cover" onerror={() => (imageBroken = true)} />
                {:else}
                    <span class="text-2xl" aria-hidden="true">{imageBroken ? '⚠️' : (gemach?.icon || '🖼️')}</span>
                {/if}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                    <label use:imageDrop={pickLogo}
                        class="cursor-pointer rounded-xl border border-dashed border-[#4c6cb0] bg-[#1e293b] px-4 py-2.5 text-sm font-bold text-blue-300 transition-colors hover:bg-[#243a6e]">
                        {busy ? '⏳ מעבד...' : '📤 העלה תמונה'}
                        <input type="file" accept="image/*" class="hidden" disabled={busy}
                            onchange={(e) => onFilePicked(e, pickLogo)} />
                    </label>
                    {#if image}
                        <button type="button" onclick={() => { image = ''; imageBroken = false; dropFit('logo'); if (fitEditing === 'logo') fitEditing = null; }}
                            class="rounded-xl bg-[#1c2f5a] px-3 py-2.5 text-sm font-bold text-gray-300 transition-colors hover:bg-red-900/50 hover:text-red-200">
                            הסר
                        </button>
                    {/if}
                    {#if imagePreview && !imageBroken}
                        <button type="button" onclick={() => (fitEditing = fitEditing === 'logo' ? null : 'logo')}
                            aria-pressed={fitEditing === 'logo'}
                            class="rounded-xl px-3 py-2.5 text-sm font-bold transition-colors {fit['logo'] || fitEditing === 'logo'
                                ? 'bg-purple-600/40 text-purple-100 border border-purple-400'
                                : 'bg-[#1c2f5a] text-gray-300 hover:bg-[#243a6e]'}">
                            🎯 חיתוך ומיקום
                        </button>
                    {/if}
                </div>
                {#if image.startsWith('data:')}
                    <p class="mt-2 text-sm text-gray-400">קובץ שהועלה · {dataUriWeightKb(image)}KB</p>
                {:else}
                    <!-- ללא name — הערך נשלח דרך ה-hidden שלמעלה -->
                    <input aria-label="כתובת תמונה" bind:value={image} dir="ltr"
                        class="mt-2 w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none text-right"
                        placeholder="או הדבק כתובת: https://example.com/logo.png" />
                {/if}
                <p class="mt-1 text-xs {imageBroken ? 'text-red-300' : 'text-gray-500'}">
                    {#if imageBroken}
                        התמונה לא נטענה — בדוק את הכתובת. בכרטיס יוצג האימוג'י במקומה.
                    {:else}
                        אפשר לגרור קובץ לכאן. ריק = יוצג האימוג'י של הקטגוריה.
                    {/if}
                </p>
            </div>
        </div>
    </div>

    <!-- גלריית תמונות -->
    <div class="md:col-span-2">
        <span class="block text-sm font-bold text-gray-300 mb-1">
            גלריית תמונות <span class="font-normal text-gray-500">— עד {MAX_GALLERY_IMAGES}, מוצגות בדף הגמ"ח</span>
        </span>
        {#each images as src, i (i)}
            <input type="hidden" name="images" value={src} />
        {/each}

        <div class="flex flex-wrap gap-2">
            {#each images as src, i (i)}
                <div class="group relative h-24 w-24 overflow-hidden rounded-xl border {fitEditing === String(i) ? 'border-purple-400' : 'border-[#3b5794]'} bg-[#1e293b]">
                    <img {src} alt="תמונה {i + 1}" class="h-full w-full object-cover"
                        onerror={(e) => (e.currentTarget as HTMLImageElement).classList.add('opacity-30', 'grayscale')} />
                    <!-- עורך המיקוד: איזה חלק מהתמונה ימלא את משבצות התצוגה -->
                    <button type="button" onclick={() => (fitEditing = fitEditing === String(i) ? null : String(i))}
                        aria-pressed={fitEditing === String(i)} aria-label="מיקום תמונה {i + 1} בתצוגה" title="מיקום בתצוגה"
                        class="absolute top-0.5 left-0.5 rounded-full px-1 py-0.5 text-[11px] leading-none transition-colors
                            {fit[String(i)] || fitEditing === String(i) ? 'bg-purple-600/80' : 'bg-black/60 opacity-0 group-hover:opacity-100 focus:opacity-100'}">🎯</button>
                    <div class="absolute inset-x-0 bottom-0 flex justify-between bg-black/70 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button type="button" onclick={() => moveImage(i, i - 1)} disabled={i === 0}
                            class="px-1 text-xs text-white disabled:opacity-30" aria-label="הזז ימינה">→</button>
                        <button type="button" onclick={() => removeGalleryImage(i)}
                            class="px-1 text-xs text-red-300 hover:text-red-200" aria-label="מחק תמונה">✕</button>
                        <button type="button" onclick={() => moveImage(i, i + 1)} disabled={i === images.length - 1}
                            class="px-1 text-xs text-white disabled:opacity-30" aria-label="הזז שמאלה">←</button>
                    </div>
                </div>
            {/each}

            {#if images.length < MAX_GALLERY_IMAGES}
                <label use:imageDrop={addToGallery}
                    class="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#4c6cb0] bg-[#1e293b] text-blue-300 transition-colors hover:bg-[#243a6e]">
                    <span class="text-xl" aria-hidden="true">{busy ? '⏳' : '＋'}</span>
                    <span class="text-xs font-bold">{busy ? 'מעבד' : 'הוסף'}</span>
                    <input type="file" accept="image/*" multiple class="hidden" disabled={busy}
                        onchange={(e) => onFilePicked(e, addToGallery)} />
                </label>
            {/if}
        </div>

        <p class="mt-1.5 text-xs {uploadError ? 'text-red-300' : 'text-gray-500'}">
            {#if uploadError}
                {uploadError}
            {:else}
                {images.length}/{MAX_GALLERY_IMAGES} · אפשר לגרור קבצים · התמונות מכווצות אוטומטית
                {#if totalKb > 0} · סה"כ {totalKb}KB מתוך {MAX_TOTAL_IMAGE_KB}KB{/if}
            {/if}
        </p>

        <!-- עורך המיקוד: המשבצת מדמה את חלון-החיתוך של הכרטיס/דף הגמ"ח —
             גוררים את התמונה כדי לבחור מה ייכנס אליו, והמחוון מקרב פנימה -->
        {#if fitEditing !== null && editedSrc}
            <div class="mt-3 rounded-2xl border border-purple-500/40 bg-[#101d3f] p-3">
                <p class="text-sm font-bold text-purple-200">
                    🎯 חיתוך ומיקום {fitEditing === 'logo' ? 'הלוגו / התמונה הראשית' : `תמונה ${Number(fitEditing) + 1}`}
                </p>
                <p class="mt-0.5 text-xs text-gray-400">
                    גררו את התמונה כדי לבחור איזה חלק ממנה יוצג בכרטיס ובדף הגמ"ח, וקרבו או הרחיקו עם המחוון.
                </p>

                <div class="mt-2 flex flex-wrap items-start gap-4">
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="relative aspect-[4/3] w-full max-w-[260px] touch-none select-none overflow-hidden rounded-xl border-2 {fitDragging ? 'cursor-grabbing border-purple-300' : 'cursor-grab border-purple-500/60'} bg-[#0f1c3d]"
                        onpointerdown={onFitPointerDown}
                        onpointermove={onFitPointerMove}
                        onpointerup={onFitPointerUp}
                        onpointercancel={onFitPointerUp}
                    >
                        <img bind:this={fitImgEl} src={editedSrc} alt="" draggable="false"
                            class="pointer-events-none h-full w-full {fitObjectClass(editedFit)}"
                            style={fitStyle(editedFit)} />
                    </div>

                    <div class="min-w-[180px] flex-1">
                        <!-- שני קצות הזום-אאוט: "מילוי" חותך את מה שלא נכנס,
                             "תמונה שלמה" מקטין עד שהכול נכנס (בלי חיתוך) -->
                        <div class="inline-flex rounded-xl border border-purple-500/40 bg-[#0f1c3d] p-0.5 text-xs font-bold">
                            <button type="button" onclick={() => setContain(false)} aria-pressed={!editedFit.contain}
                                class="rounded-lg px-2.5 py-1.5 transition-colors {editedFit.contain ? 'text-gray-400 hover:text-gray-200' : 'bg-purple-600 text-white'}">
                                מילוי המשבצת
                            </button>
                            <button type="button" onclick={() => setContain(true)} aria-pressed={!!editedFit.contain}
                                class="rounded-lg px-2.5 py-1.5 transition-colors {editedFit.contain ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-gray-200'}">
                                תמונה שלמה
                            </button>
                        </div>

                        <label class="mt-3 block text-xs font-bold {editedFit.contain ? 'text-gray-500' : 'text-gray-300'}">
                            תקריב · ‏{editedFit.contain ? 'התמונה כולה' : `${Math.round(editedFit.z * 100)}%`}
                            <input type="range" min="1" max="3" step="0.05" value={editedFit.z}
                                disabled={editedFit.contain}
                                oninput={(e) => setEditedFit({ z: Number((e.currentTarget as HTMLInputElement).value) })}
                                class="mt-1 w-full accent-purple-500 disabled:opacity-40" />
                        </label>
                        <div class="mt-3 flex flex-wrap gap-2">
                            <button type="button" onclick={() => { if (fitEditing !== null) dropFit(fitEditing); }}
                                class="rounded-xl bg-[#1c2f5a] px-3 py-1.5 text-xs font-bold text-gray-300 transition-colors hover:bg-[#243a6e]">
                                איפוס למרכז
                            </button>
                            <button type="button" onclick={() => (fitEditing = null)}
                                class="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-purple-500">
                                סיימתי
                            </button>
                        </div>
                        <p class="mt-2 text-[11px] leading-snug text-gray-500">
                            המיקום נשמר יחד עם הטופס. משבצות התצוגה משתנות מעט בין מסכים — המיקום כאן הוא קירוב טוב לכולן.
                        </p>
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <!-- עיר -->
    <div>
        <label for="f-city" class="block text-sm font-bold text-gray-300 mb-1">עיר <span class="text-red-400">*</span></label>
        <input id="f-city" name="city" required list="cities-list" defaultValue={gemach?.city ?? ''}
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="לדוגמה: ירושלים" />
        <datalist id="cities-list">
            <!-- גמ"ח שפועל בכל הארץ (משלוחים/טלפוני) — ראשון, לפני רשימת היישובים -->
            <option value="ארצית"></option>
            {#each cities as c (c)}<option value={c}></option>{/each}
        </datalist>
    </div>

    <!-- שכונה -->
    <div>
        <label for="f-neighborhood" class="block text-sm font-bold text-gray-300 mb-1">שכונה</label>
        <input id="f-neighborhood" name="neighborhood" defaultValue={gemach?.neighborhood ?? ''}
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="לדוגמה: קרית משה" />
    </div>

    <!-- כתובת -->
    <div>
        <label for="f-address" class="block text-sm font-bold text-gray-300 mb-1">כתובת</label>
        <input id="f-address" name="address" defaultValue={gemach?.address ?? ''}
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="רחוב ומספר" />
    </div>

    <!-- קומה ודירה — רוב הגמ"חים פועלים מדירה פרטית, ובלי זה המבקר עומד בלובי -->
    <div class="grid grid-cols-2 gap-3">
        <div>
            <label for="f-floor" class="block text-sm font-bold text-gray-300 mb-1">קומה</label>
            <input id="f-floor" name="floor" defaultValue={gemach?.floor ?? ''}
                class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                placeholder="לדוגמה: 3" />
        </div>
        <div>
            <label for="f-apartment" class="block text-sm font-bold text-gray-300 mb-1">מספר דירה</label>
            <input id="f-apartment" name="apartment" defaultValue={gemach?.apartment ?? ''}
                class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                placeholder="לדוגמה: 5" />
        </div>
    </div>

    <!-- הוראות הגעה -->
    <div class="md:col-span-2">
        <label for="f-arrival" class="block text-sm font-bold text-gray-300 mb-1">הוראות הגעה</label>
        <input id="f-arrival" name="arrival_notes" defaultValue={gemach?.arrivalNotes ?? ''}
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="כניסה מהחצר האחורית, קוד בשער, חניה ברחוב הסמוך..." />
    </div>

    <!-- טלפון -->
    <div>
        <label for="f-phone" class="block text-sm font-bold text-gray-300 mb-1">טלפון</label>
        <input id="f-phone" name="phone" defaultValue={gemach?.phone ?? ''} inputmode="tel" dir="ltr"
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none text-right"
            placeholder="לדוגמה: 02-5001234" />
    </div>

    <!-- איש קשר -->
    <div>
        <label for="f-contact" class="block text-sm font-bold text-gray-300 mb-1">איש קשר</label>
        <input id="f-contact" name="contact" defaultValue={gemach?.contact ?? ''}
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="שם האחראי/ת על הגמ&quot;ח" />
    </div>

    <!-- שעות פעילות — לוח ימים/שעות מובנה, בפורמט המשותף עם "קהילה בשכונה" -->
    <div class="md:col-span-2">
        <span class="block text-sm font-bold text-gray-300 mb-1">שעות פעילות</span>
        <OpeningHoursEditor value={gemach?.hours ?? ''} name="hours" />
    </div>

    <!-- קישור -->
    <div class="md:col-span-2">
        <label for="f-link" class="block text-sm font-bold text-gray-300 mb-1">קישור (אתר / טופס)</label>
        <input id="f-link" name="link" type="url" defaultValue={gemach?.link ?? ''} dir="ltr"
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none text-right"
            placeholder="https://..." />
    </div>

    <!-- תיאור -->
    <div class="md:col-span-2">
        <label for="f-description" class="block text-sm font-bold text-gray-300 mb-1">תיאור</label>
        <textarea id="f-description" name="description" rows="3"
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none resize-y"
            placeholder="מה הגמ&quot;ח מציע, תנאי השאלה, וכו'">{gemach?.description ?? ''}</textarea>
    </div>

    <!-- הערות -->
    <div class="md:col-span-2">
        <label for="f-notes" class="block text-sm font-bold text-gray-300 mb-1">הערות (מוצג בקטן)</label>
        <input id="f-notes" name="notes" defaultValue={gemach?.notes ?? ''}
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="הערה קצרה" />
    </div>

    <!-- תגים -->
    <div class="md:col-span-2">
        <span class="block text-sm font-bold text-gray-300 mb-1">תגים</span>
        <TagEditor bind:tags name="tags" />
    </div>

    <!-- סידור והצמדה — פקדי אדמין בלבד (הבעלים לא רואה ולא משנה) -->
    {#if admin}
        <div>
            <label for="f-order" class="block text-sm font-bold text-gray-300 mb-1">מיקום בסידור (קטן = מוקדם)</label>
            <input id="f-order" name="order" type="number" step="1" defaultValue={gemach?.order ?? ''}
                class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none text-right"
                placeholder="ריק = לפי סדר ההוספה" />
        </div>
        <div class="flex items-end">
            <label class="flex items-center gap-2 cursor-pointer select-none rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 w-full">
                <input name="featured" type="checkbox" value="true" checked={gemach?.featured ?? false}
                    class="h-5 w-5 rounded accent-amber-500" />
                <span class="text-sm font-bold text-amber-200">📌 נעץ בראש דף הבית</span>
            </label>
        </div>
    {/if}
</div>

<style>
    /* רמז אינו ערך: טקסט העזרה בשדה ריק נטוי ועמום, כדי שלא ייקרא כשדה מלא.
       קודם "ירושלים" האפור בשדה העיר נראה כמו בחירה קיימת, והמשתמש גילה
       שהשדה בעצם ריק רק כשהדפדפן עצר אותו ב"זהו שדה חובה". */
    input::placeholder,
    textarea::placeholder {
        font-style: italic;
        opacity: 0.8;
    }
</style>
