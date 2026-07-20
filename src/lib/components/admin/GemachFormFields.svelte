<script lang="ts">
    import type { Gemach, CategoryDef } from '$lib/gemachData';
    import TagEditor from './TagEditor.svelte';

    let {
        gemach = null,
        categories,
        cities = []
    }: {
        gemach?: Partial<Gemach> | null;
        categories: CategoryDef[];
        cities?: string[];
    } = $props();

    let tags = $state<string[]>(gemach?.tags ? [...gemach.tags] : []);
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

    <!-- סידור והצמדה -->
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
</div>
