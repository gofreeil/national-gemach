<script lang="ts">
    import { enhance } from '$app/forms';
    import { categories, cities } from '$lib/gemachData';
    import type { ActionData } from './$types';

    let { form }: { form: ActionData } = $props();

    let name         = $state('');
    let category     = $state('');
    let city         = $state('');
    let neighborhood = $state('');
    let address      = $state('');
    let phone        = $state('');
    let contact      = $state('');
    let description  = $state('');
    let hours        = $state('');
    let icon         = $state('🤝');
    let logoBase64   = $state('');
    let images       = $state<string[]>([]);
    let clientError  = $state('');

    const MAX_IMAGES = 6;

    function fileToResizedBase64(file: File, maxDim: number, quality = 0.82): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('read error'));
            reader.onload = (ev) => {
                const src = ev.target?.result as string;
                const img = new Image();
                img.onerror = () => reject(new Error('image error'));
                img.onload = () => {
                    let w = img.naturalWidth;
                    let h = img.naturalHeight;
                    if (w > maxDim || h > maxDim) {
                        const ratio = Math.min(maxDim / w, maxDim / h);
                        w = Math.round(w * ratio);
                        h = Math.round(h * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = src;
            };
            reader.readAsDataURL(file);
        });
    }

    async function handleLogoChange(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try { logoBase64 = await fileToResizedBase64(file, 400, 0.85); }
        catch { clientError = 'בעיה בטעינת הלוגו'; }
    }

    async function handleImagesChange(e: Event) {
        const files = Array.from((e.target as HTMLInputElement).files ?? []);
        if (files.length === 0) return;
        const remaining = MAX_IMAGES - images.length;
        const toProcess = files.slice(0, remaining);
        try {
            const newImgs: string[] = [];
            for (const f of toProcess) newImgs.push(await fileToResizedBase64(f, 900, 0.82));
            images = [...images, ...newImgs];
        } catch { clientError = 'בעיה בטעינת אחת התמונות'; }
        (e.target as HTMLInputElement).value = '';
    }

    function removeLogo() { logoBase64 = ''; }
    function removeImage(i: number) { images = images.filter((_, idx) => idx !== i); }
</script>

<svelte:head>
    <title>הוסף גמ"ח | הגמ"ח הארצי</title>
</svelte:head>

<div class="min-h-screen pt-6 pb-20 px-4" dir="rtl">
    <div class="max-w-2xl mx-auto">
        <div class="text-center mb-6">
            <span class="text-5xl mb-3 block">🤝</span>
            <h1 class="text-3xl font-black text-white mb-2">הוסף גמ"ח חדש למאגר הארצי</h1>
            <p class="text-gray-400">הגמ"ח יופיע באתר הארצי וגם באתרי הקהילות המקומיות</p>
        </div>

        <form method="POST" use:enhance class="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4">
            <div>
                <label for="name" class="text-white text-sm font-bold mb-1 block">שם הגמ"ח *</label>
                <input id="name" name="name" bind:value={name} required placeholder='לדוגמה: גמ"ח כיסאות'
                    class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" />
            </div>

            <div>
                <label for="category" class="text-white text-sm font-bold mb-1 block">קטגוריה *</label>
                <select id="category" name="category" bind:value={category} required
                    class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white">
                    <option value="">-- בחר קטגוריה --</option>
                    {#each categories as cat}
                        <option value={cat.key}>{cat.icon} {cat.label}</option>
                    {/each}
                </select>
            </div>

            <div>
                <label for="icon" class="text-white text-sm font-bold mb-1 block">אייקון (אמוג'י)</label>
                <input id="icon" name="icon" bind:value={icon} maxlength="4"
                    class="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-center text-xl" />
            </div>

            <!-- Logo -->
            <div>
                <p class="text-white text-sm font-bold mb-1">לוגו (אופציונלי)</p>
                {#if logoBase64}
                    <div class="relative inline-block">
                        <img src={logoBase64} alt="לוגו" class="w-24 h-24 rounded-xl object-cover border border-white/15 bg-black/30" />
                        <button type="button" onclick={removeLogo} aria-label="הסר לוגו"
                            class="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-black/70 hover:bg-red-600 text-white text-sm flex items-center justify-center transition-colors">✕</button>
                    </div>
                {:else}
                    <label class="flex flex-col items-center justify-center gap-1 w-32 h-32 rounded-xl border-2 border-dashed border-white/15 hover:border-blue-500/50 bg-white/3 hover:bg-blue-900/10 cursor-pointer transition-all">
                        <span class="text-2xl">🎨</span>
                        <span class="text-gray-400 text-xs font-bold">העלה לוגו</span>
                        <input type="file" accept="image/*" class="hidden" onchange={handleLogoChange} />
                    </label>
                {/if}
                <input type="hidden" name="logo_base64" value={logoBase64} />
            </div>

            <!-- Images -->
            <div>
                <p class="text-white text-sm font-bold mb-1">תמונות (עד {MAX_IMAGES}, אופציונלי)</p>
                <div class="grid grid-cols-3 gap-2">
                    {#each images as img, i}
                        <div class="relative aspect-square rounded-lg overflow-hidden border border-white/10">
                            <img src={img} alt="תמונה {i + 1}" class="w-full h-full object-cover bg-black/30" />
                            <button type="button" onclick={() => removeImage(i)} aria-label="הסר תמונה"
                                class="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/70 hover:bg-red-600 text-white text-xs flex items-center justify-center transition-colors">✕</button>
                        </div>
                    {/each}
                    {#if images.length < MAX_IMAGES}
                        <label class="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-white/15 hover:border-blue-500/50 bg-white/3 hover:bg-blue-900/10 cursor-pointer transition-all">
                            <span class="text-2xl">📷</span>
                            <span class="text-gray-400 text-xs font-bold">הוסף</span>
                            <input type="file" accept="image/*" multiple class="hidden" onchange={handleImagesChange} />
                        </label>
                    {/if}
                </div>
                <input type="hidden" name="images_json" value={JSON.stringify(images)} />
            </div>

            <div>
                <label for="description" class="text-white text-sm font-bold mb-1 block">תיאור</label>
                <textarea id="description" name="description" bind:value={description} rows="3"
                    placeholder="מה ניתן להשאיל / לקבל"
                    class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"></textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label for="city" class="text-white text-sm font-bold mb-1 block">עיר *</label>
                    <select id="city" name="city" bind:value={city} required
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white">
                        <option value="">-- בחר עיר --</option>
                        {#each cities as c}
                            <option value={c}>{c}</option>
                        {/each}
                    </select>
                </div>
                <div>
                    <label for="neighborhood" class="text-white text-sm font-bold mb-1 block">שכונה</label>
                    <input id="neighborhood" name="neighborhood" bind:value={neighborhood}
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" />
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label for="address" class="text-white text-sm font-bold mb-1 block">כתובת מדויקת</label>
                    <input id="address" name="address" bind:value={address}
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" />
                </div>
                <div>
                    <label for="hours" class="text-white text-sm font-bold mb-1 block">שעות פעילות</label>
                    <input id="hours" name="hours" bind:value={hours} placeholder="9:00-21:00"
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" />
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label for="contact" class="text-white text-sm font-bold mb-1 block">שם איש קשר</label>
                    <input id="contact" name="contact" bind:value={contact}
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" />
                </div>
                <div>
                    <label for="phone" class="text-white text-sm font-bold mb-1 block">טלפון *</label>
                    <input id="phone" name="phone" bind:value={phone} type="tel" required
                        class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" />
                </div>
            </div>

            {#if clientError}
                <p class="text-red-400 text-sm text-center">{clientError}</p>
            {/if}
            {#if form?.error}
                <p class="text-red-400 text-sm text-center">{form.error}</p>
            {/if}

            <button type="submit" class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all">
                הוסף לגמ"ח הארצי
            </button>

            <p class="text-gray-500 text-xs text-center pt-2 border-t border-white/5">
                🌐 הגמ"ח יופיע באתר הארצי <strong class="text-gray-400">וגם</strong> באתר הקהילה המקומית של אותה שכונה
            </p>
        </form>

        <div class="text-center mt-6">
            <a href="/" class="text-gray-500 hover:text-white transition-colors text-sm">← חזרה לדף הראשי</a>
        </div>
    </div>
</div>
