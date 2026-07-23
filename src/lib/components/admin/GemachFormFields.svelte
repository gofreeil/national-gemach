<script lang="ts">
    import type { Gemach, CategoryDef } from '$lib/gemachData';
    import TagEditor from './TagEditor.svelte';
    import { imageDrop } from '$lib/imageDrop';
    import { compressImage, dataUriWeightKb, MAX_GALLERY_IMAGES, MAX_TOTAL_IMAGE_KB } from '$lib/imageCompress';

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

    function moveImage(from: number, to: number) {
        if (to < 0 || to >= images.length) return;
        const next = [...images];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        images = next;
    }
</script>

<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <!-- שם -->
    <div class="md:col-span-2">
        <label for="f-name" class="block text-sm font-bold text-gray-300 mb-1">שם הגמ"ח <span class="text-red-400">*</span></label>
        <input id="f-name" name="name" required value={gemach?.name ?? ''}
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder='לדוגמה: גמ"ח ציוד רפואי ירושלים' />
    </div>

    <!-- קטגוריה -->
    <div>
        <label for="f-category" class="block text-sm font-bold text-gray-300 mb-1">קטגוריה <span class="text-red-400">*</span></label>
        <select id="f-category" name="category" required
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white focus:border-purple-500 focus:outline-none">
            {#each categories as cat (cat.key)}
                <option value={cat.key} selected={gemach?.category === cat.key}>{cat.icon} {cat.label}</option>
            {/each}
        </select>
    </div>

    <!-- אייקון -->
    <div>
        <label for="f-icon" class="block text-sm font-bold text-gray-300 mb-1">אייקון (אימוג'י)</label>
        <input id="f-icon" name="icon" value={gemach?.icon ?? ''} maxlength="4"
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="🤝" />
    </div>

    <!-- לוגו -->
    <div class="md:col-span-2">
        <span class="block text-sm font-bold text-gray-300 mb-1">לוגו / תמונה ראשית</span>
        <input type="hidden" name="image" value={image} />
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
                        <button type="button" onclick={() => { image = ''; imageBroken = false; }}
                            class="rounded-xl bg-[#1c2f5a] px-3 py-2.5 text-sm font-bold text-gray-300 transition-colors hover:bg-red-900/50 hover:text-red-200">
                            הסר
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
                <p class="mt-1 text-xs {imageBroken ? 'text-amber-300' : 'text-gray-500'}">
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
                <div class="group relative h-24 w-24 overflow-hidden rounded-xl border border-[#3b5794] bg-[#1e293b]">
                    <img {src} alt="תמונה {i + 1}" class="h-full w-full object-cover"
                        onerror={(e) => (e.currentTarget as HTMLImageElement).classList.add('opacity-30', 'grayscale')} />
                    <div class="absolute inset-x-0 bottom-0 flex justify-between bg-black/70 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button type="button" onclick={() => moveImage(i, i - 1)} disabled={i === 0}
                            class="px-1 text-xs text-white disabled:opacity-30" aria-label="הזז ימינה">→</button>
                        <button type="button" onclick={() => (images = images.filter((_, j) => j !== i))}
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

        <p class="mt-1.5 text-xs {uploadError ? 'text-amber-300' : 'text-gray-500'}">
            {#if uploadError}
                {uploadError}
            {:else}
                {images.length}/{MAX_GALLERY_IMAGES} · אפשר לגרור קבצים · התמונות מכווצות אוטומטית
                {#if totalKb > 0} · סה"כ {totalKb}KB מתוך {MAX_TOTAL_IMAGE_KB}KB{/if}
            {/if}
        </p>
    </div>

    <!-- עיר -->
    <div>
        <label for="f-city" class="block text-sm font-bold text-gray-300 mb-1">עיר <span class="text-red-400">*</span></label>
        <input id="f-city" name="city" required list="cities-list" value={gemach?.city ?? ''}
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="ירושלים" />
        <datalist id="cities-list">
            {#each cities as c (c)}<option value={c}></option>{/each}
        </datalist>
    </div>

    <!-- שכונה -->
    <div>
        <label for="f-neighborhood" class="block text-sm font-bold text-gray-300 mb-1">שכונה</label>
        <input id="f-neighborhood" name="neighborhood" value={gemach?.neighborhood ?? ''}
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="קרית משה" />
    </div>

    <!-- טלפון -->
    <div>
        <label for="f-phone" class="block text-sm font-bold text-gray-300 mb-1">טלפון</label>
        <input id="f-phone" name="phone" value={gemach?.phone ?? ''} inputmode="tel" dir="ltr"
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none text-right"
            placeholder="02-5001234" />
    </div>

    <!-- איש קשר -->
    <div>
        <label for="f-contact" class="block text-sm font-bold text-gray-300 mb-1">איש קשר</label>
        <input id="f-contact" name="contact" value={gemach?.contact ?? ''}
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="שם / תפקיד" />
    </div>

    <!-- כתובת -->
    <div>
        <label for="f-address" class="block text-sm font-bold text-gray-300 mb-1">כתובת</label>
        <input id="f-address" name="address" value={gemach?.address ?? ''}
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="רחוב ומספר" />
    </div>

    <!-- שעות -->
    <div>
        <label for="f-hours" class="block text-sm font-bold text-gray-300 mb-1">שעות פעילות</label>
        <input id="f-hours" name="hours" value={gemach?.hours ?? ''}
            class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="א-ה 9:00-13:00" />
    </div>

    <!-- קישור -->
    <div class="md:col-span-2">
        <label for="f-link" class="block text-sm font-bold text-gray-300 mb-1">קישור (אתר / טופס)</label>
        <input id="f-link" name="link" type="url" value={gemach?.link ?? ''} dir="ltr"
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
        <input id="f-notes" name="notes" value={gemach?.notes ?? ''}
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
            <input id="f-order" name="order" type="number" step="1" value={gemach?.order ?? ''}
                class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none text-right"
                placeholder="ריק = לפי סדר ההוספה" />
        </div>
        <div class="flex items-end">
            <label class="flex items-center gap-2 cursor-pointer select-none rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 w-full">
                <input name="featured" type="checkbox" value="true" checked={gemach?.featured ?? false}
                    class="h-5 w-5 rounded accent-amber-500" />
                <span class="text-sm font-bold text-amber-200">⭐ הצמד לראש הרשימה</span>
            </label>
        </div>
    {/if}
</div>
