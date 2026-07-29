<script lang="ts">
    import { enhance } from '$app/forms';
    import { page } from '$app/stores';
    import type { CategoryDef } from '$lib/gemachData';
    import { compressTileImage, dataUriWeightKb, MAX_CATEGORY_IMAGES_KB } from '$lib/imageCompress';
    import { imageDrop } from '$lib/imageDrop';

    let { data, form } = $props();

    // עותק ניתן לעריכה. existing = מפתחות שכבר קיימים (לא ניתן לשנות מפתח כדי לא לנתק גמ"חים)
    let list = $state<CategoryDef[]>(data.categories.map(c => ({ ...c })));
    const existingKeys = new Set(data.categories.map(c => c.key));

    let saving = $state(false);
    const flash = $derived($page.url.searchParams.get('flash'));

    /* ═══════════ תמונת האריח ═══════════ */
    let busy = $state(false);
    let imgError = $state('');

    /** מוצג בתצוגה המקדימה רק מה שהדפדפן אכן יכול לטעון */
    const previewOf = (src?: string) =>
        src && /^(data:image\/|https:\/\/|\/)/i.test(src.trim()) ? src.trim() : '';

    /** מקבל קבצים משני המסלולים — גרירה לתוך האריח, או בחירה מהדיאלוג */
    async function setImage(i: number, files: File[]) {
        const file = files.find(f => f.type.startsWith('image/'));
        if (!file) return;
        busy = true;
        imgError = '';
        try {
            list[i].image = await compressTileImage(file);
        } catch {
            imgError = 'לא הצלחנו לקרוא את הקובץ. נסה תמונה אחרת (JPG/PNG/WebP).';
        }
        busy = false;
    }

    function onFilePicked(e: Event, i: number) {
        const input = e.currentTarget as HTMLInputElement;
        const files = Array.from(input.files ?? []);
        input.value = '';                       // בחירת אותו קובץ שוב תירה onchange
        setImage(i, files);
    }

    /** הדבקה (Ctrl+V) של תמונה מהלוח — הדרך הקצרה לצילום מסך או תמונה מהדפדפן */
    function onPaste(e: ClipboardEvent, i: number) {
        const files = Array.from(e.clipboardData?.files ?? []);
        if (!files.length) return;
        e.preventDefault();
        setImage(i, files);
    }

    /** משקל התמונות שהועלו כקבצים — כתובות חיצוניות/מקומיות לא נשקלות */
    const imagesKb = $derived(list.reduce((sum, c) => sum + dataUriWeightKb(c.image ?? ''), 0));
    const overCap = $derived(imagesKb > MAX_CATEGORY_IMAGES_KB);

    function add() {
        list = [...list, { key: '', label: '', icon: '📦' }];
    }
    function remove(i: number) {
        if (list.length <= 1) return;
        list = list.filter((_, idx) => idx !== i);
    }
    function move(i: number, dir: -1 | 1) {
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        const copy = [...list];
        [copy[i], copy[j]] = [copy[j], copy[i]];
        list = copy;
    }
    const payload = $derived(JSON.stringify(list));
</script>

<svelte:head><title>קטגוריות – פאנל ניהול</title></svelte:head>

<div class="max-w-3xl space-y-4">
    <div class="flex items-center justify-between">
        <h2 class="text-xl font-black text-white">🏷️ ניהול קטגוריות</h2>
    </div>

    {#if flash === 'saved'}<div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">✅ הקטגוריות נשמרו</div>{/if}
    {#if flash === 'reset'}<div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">↩️ שוחזרה רשימת ברירת המחדל</div>{/if}
    {#if form?.error}<div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{form.error}</div>{/if}

    <p class="text-sm text-gray-400">
        הקטגוריות משמשות לסינון ולתצוגה באתר. הסדר כאן קובע את סדר ההצגה.
        מפתח של קטגוריה קיימת נעול — שינויו ינתק את הגמ"חים המשויכים אליה.
        תמונת האריח בדף הבית: גרור תמונה אל הריבוע, הדבק אותה עם Ctrl+V, או לחץ
        לבחירת קובץ. היא נחתכת אוטומטית לריבוע.
    </p>

    {#if imgError}<div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{imgError}</div>{/if}

    <div class="space-y-2">
        {#each list as cat, i (i)}
            <div class="card p-3 flex flex-wrap items-center gap-2">
                <div class="flex flex-col gap-1">
                    <button type="button" onclick={() => move(i, -1)} disabled={i === 0}
                        class="w-6 h-6 rounded bg-[#16264d] hover:bg-[#243a6e] text-gray-300 text-xs disabled:opacity-30">▲</button>
                    <button type="button" onclick={() => move(i, 1)} disabled={i === list.length - 1}
                        class="w-6 h-6 rounded bg-[#16264d] hover:bg-[#243a6e] text-gray-300 text-xs disabled:opacity-30">▼</button>
                </div>
                <!-- תצוגה מקדימה של האריח = יעד גרירה + כפתור העלאה + הדבקה -->
                <label use:imageDrop={(files) => setImage(i, files)}
                    onpaste={(e) => onPaste(e, i)}
                    title="גרור תמונה לכאן, הדבק עם Ctrl+V, או לחץ לבחירת קובץ"
                    class="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-[#4c6cb0] bg-[#0f1c3d] transition-colors hover:border-purple-500 focus-within:border-purple-500">
                    {#if previewOf(cat.image)}
                        <img src={previewOf(cat.image)} alt="" class="h-full w-full object-cover" />
                    {:else}
                        <span class="text-lg leading-none" aria-hidden="true">🖼️</span>
                    {/if}
                    <input type="file" accept="image/*" class="hidden" disabled={busy}
                        aria-label="תמונת אריח ל{cat.label || 'קטגוריה'}"
                        onchange={(e) => onFilePicked(e, i)} />
                </label>
                <input bind:value={cat.icon} maxlength="4" aria-label="אייקון"
                    class="w-14 text-center rounded-lg border border-[#3b5794] bg-[#1e293b] px-2 py-2 text-lg focus:border-purple-500 focus:outline-none" />
                <input bind:value={cat.label} placeholder="שם הקטגוריה" aria-label="שם"
                    class="flex-1 min-w-40 rounded-lg border border-[#3b5794] bg-[#1e293b] px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
                <input bind:value={cat.key} placeholder="key" aria-label="מפתח" dir="ltr"
                    readonly={existingKeys.has(cat.key)}
                    class="w-32 rounded-lg border border-[#3b5794] bg-[#1e293b] px-3 py-2 text-gray-400 text-sm focus:border-purple-500 focus:outline-none text-left {existingKeys.has(cat.key) ? 'opacity-60' : ''}" />
                <button type="button" onclick={() => remove(i)} disabled={list.length <= 1}
                    class="w-8 h-8 rounded-lg bg-red-900/30 text-red-300 hover:bg-red-900/60 transition-colors disabled:opacity-30" title="הסר">🗑️</button>

                <!-- כתובת התמונה: לעריכה ידנית של נתיב מקומי או קישור https -->
                <div class="flex w-full items-center gap-2">
                    <input bind:value={cat.image} dir="ltr" aria-label="כתובת תמונת האריח"
                        placeholder="/images/categories/example.webp או https://..."
                        class="flex-1 rounded-lg border border-[#3b5794] bg-[#111e3f] px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:border-purple-500 focus:outline-none text-left" />
                    {#if cat.image?.startsWith('data:')}
                        <span class="shrink-0 text-xs text-gray-400">קובץ · {dataUriWeightKb(cat.image)}KB</span>
                    {/if}
                    {#if cat.image}
                        <button type="button" onclick={() => (list[i].image = '')}
                            class="shrink-0 rounded-lg bg-[#1c2f5a] px-2 py-1.5 text-xs text-gray-300 hover:bg-[#2a4379] transition-colors">נקה</button>
                    {/if}
                </div>
            </div>
        {/each}
    </div>

    <button type="button" onclick={add}
        class="rounded-xl border border-dashed border-[#4c6cb0] text-gray-300 hover:bg-[#1e3260] px-4 py-2.5 text-sm font-bold w-full transition-colors">
        ➕ הוסף קטגוריה
    </button>

    {#if imagesKb > 0}
        <p class="text-xs {overCap ? 'text-red-300' : 'text-gray-500'}">
            תמונות שהועלו: {imagesKb}KB מתוך {MAX_CATEGORY_IMAGES_KB}KB
            {#if overCap}— חורג מהתקרה, הסר תמונה אחת או שתיים כדי לשמור{/if}
        </p>
    {/if}

    <div class="flex items-center gap-3 pt-3 border-t border-[#3b5794]">
        <form method="POST" action="?/save" use:enhance={() => { saving = true; return async ({ update }) => { await update(); saving = false; }; }}>
            <input type="hidden" name="categories" value={payload} />
            <button type="submit" disabled={saving || busy || overCap}
                class="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-bold text-white transition hover:opacity-90 disabled:opacity-60">
                {saving ? 'שומר...' : 'שמור קטגוריות'}
            </button>
        </form>
        <form method="POST" action="?/reset" use:enhance={({ cancel }) => { if (!confirm('לשחזר את רשימת ברירת המחדל? השינויים שלך יימחקו.')) cancel(); }}>
            <button type="submit" class="rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] px-5 py-3 font-bold text-white transition-colors">↩️ שחזר ברירת מחדל</button>
        </form>
    </div>
</div>
