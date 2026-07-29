<script lang="ts">
    // "הנכסים שלי" — רשימת הפרסומות של המפרסם המחובר.
    // כל שורה: תצוגה מקדימה, סטטוס, ומדדי-על. הניהול המלא בדף הנכס.
    import { statusView, fmtDate, needsRenewal, type AdStatusKind } from '$lib/adOwner';

    let { data } = $props();

    const TONE: Record<string, string> = {
        amber: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
        emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
        rose: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
        slate: 'border-[#3b5794] bg-[#1c2f5a] text-gray-300',
    };
</script>

<svelte:head><title>הנכסים שלי | הגמ"ח הארצי</title></svelte:head>

<section class="mx-auto max-w-4xl px-3 py-6 md:px-4" dir="rtl">
    <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
            <h1 class="text-2xl font-black text-white md:text-3xl">📢 הנכסים שלי</h1>
            <!-- גלולה כהה — טקסט אפור ישירות על הרקע הוורוד אינו קריא -->
            <p class="mt-2 inline-block rounded-full border border-[#3b5794] bg-[#1c2f5a] px-3 py-1 text-xs font-semibold text-gray-100 shadow-md">
                {data.gemachim.length} גמ"חים · {data.ads.length} פרסומות בחשבון {data.user.email}
            </p>
        </div>
        <a href="/advertise" class="rounded-full border border-[#3b5794] bg-[#1c2f5a] px-3.5 py-1.5 text-sm font-bold text-gray-100 shadow-md transition-colors hover:bg-[#2a4379] hover:text-white">
            ➕ פרסומת חדשה
        </a>
    </div>

    <!-- הגמ"חים שרשומים על שם המשתמש. אותו פריט Strapi נערך גם ב"קהילה
         בשכונה" — לכן העריכה כאן היא העריכה שם. -->
    {#if data.gemachim.length > 0}
        <h2 class="mb-3 text-lg font-black text-white">🤝 הגמ"חים שלי</h2>
        <div class="mb-8 flex flex-col gap-4">
            {#each data.gemachim as g (g.id)}
                <article class="overflow-hidden rounded-2xl border border-[#3b5794] bg-[#16264d] transition-all hover:border-[#4c6cb0] hover:bg-[#1e3260]">
                    <div class="flex items-stretch gap-4 p-4">
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <h3 class="text-lg font-black leading-tight text-white">{g.name}</h3>
                                {#if g.status === 'draft'}
                                    <span class="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-200">⏳ ממתין לאישור</span>
                                {:else}
                                    <span class="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-200">● באוויר</span>
                                {/if}
                                {#if g.verified}
                                    <span class="rounded-full border border-blue-500/30 bg-blue-900/50 px-2 py-0.5 text-xs font-bold text-blue-300">✔ מאומת</span>
                                {/if}
                            </div>
                            <p class="mt-1 text-xs text-gray-400">{g.categoryLabel} · 📍 {g.city}</p>
                            <div class="mt-3 flex flex-wrap gap-2">
                                <a href="/gemach/{g.id}/edit" class="rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90">
                                    ✏️ עריכה
                                </a>
                                <a href="/gemach/{g.id}" class="rounded-xl border border-[#3b5794] bg-[#1c2f5a] px-4 py-2 text-sm font-bold text-gray-100 transition-colors hover:bg-[#2a4379] hover:text-white">
                                    לעמוד הגמ"ח ←
                                </a>
                            </div>
                        </div>

                        <!-- ב-RTL האיבר האחרון יושב בצד שמאל -->
                        <div class="flex min-h-[110px] w-2/5 max-w-[190px] flex-shrink-0 items-center justify-center self-stretch overflow-hidden rounded-xl border border-[#3b5794] bg-[#0f1c3d]">
                            {#if g.image}
                                <img src={g.image} alt="" class="h-full w-full object-cover" />
                            {:else}
                                <span class="text-4xl" aria-hidden="true">{g.icon || '🤝'}</span>
                            {/if}
                        </div>
                    </div>
                </article>
            {/each}
        </div>

        <h2 class="mb-3 text-lg font-black text-white">📢 הפרסומות שלי</h2>
    {/if}

    {#if data.loadFailed}
        <div class="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm font-bold text-rose-200">
            לא הצלחנו לטעון את הפרסומות שלך כרגע. רעננו את העמוד בעוד רגע.
        </div>
    {:else if data.ads.length === 0}
        <div class="rounded-2xl border border-[#3b5794] bg-[#16264d] px-6 py-12 text-center shadow-lg">
            <div class="mb-4 text-5xl" aria-hidden="true">📢</div>
            <p class="text-lg font-bold text-white">אין לך עדיין פרסומות</p>
            <p class="mt-2 text-sm text-gray-300">כשתעלו פרסומת בבונה — היא תופיע כאן, עם נתוני הצפיות וההקלקות.</p>
            <a href="/advertise" class="mt-5 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 px-6 py-3 font-bold text-white transition hover:opacity-90">
                לפרסום באתר ←
            </a>
        </div>
    {:else}
        <div class="flex flex-col gap-4">
            {#each data.ads as ad (ad.id)}
                {@const sv = statusView(ad.status as AdStatusKind, ad.expiresAt)}
                <article class="overflow-hidden rounded-2xl border border-[#3b5794] bg-[#16264d] transition-all hover:border-[#4c6cb0] hover:bg-[#1e3260]">
                    <a href="/advertise/manage/{ad.id}" class="flex items-stretch gap-4 p-4">
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <h2 class="text-lg font-black leading-tight text-white">{ad.title}</h2>
                                <span class="rounded-full border px-2 py-0.5 text-xs font-bold {TONE[sv.tone]}">{sv.label}</span>
                                {#if needsRenewal(ad.status as AdStatusKind, ad.expiresAt)}
                                    <span class="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-200">⏳ לחידוש</span>
                                {/if}
                            </div>
                            {#if ad.subtitle}
                                <p class="mt-1 line-clamp-2 text-sm text-gray-300">{ad.subtitle}</p>
                            {/if}
                            <p class="mt-1 text-xs text-gray-400">{sv.hint}{ad.expiresAt ? ` · עד ${fmtDate(ad.expiresAt)}` : ''}</p>

                            <dl class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                                <div class="flex items-baseline gap-1.5">
                                    <dt class="text-gray-400">צפיות</dt>
                                    <dd class="font-black tabular-nums text-white">{ad.totals.impressions}</dd>
                                </div>
                                <div class="flex items-baseline gap-1.5">
                                    <dt class="text-gray-400">הקלקות</dt>
                                    <dd class="font-black tabular-nums text-white">{ad.totals.clicks}</dd>
                                </div>
                                <div class="flex items-baseline gap-1.5">
                                    <dt class="text-gray-400">דף הנחיתה</dt>
                                    <dd class="font-black tabular-nums text-white">{ad.totals.landing}</dd>
                                </div>
                                <div class="flex items-baseline gap-1.5">
                                    <dt class="text-gray-400">פניות</dt>
                                    <dd class="font-black tabular-nums text-emerald-300">{ad.totals.leads}</dd>
                                </div>
                            </dl>
                            <p class="mt-3 text-sm font-bold text-blue-300">לניהול הנכס ←</p>
                        </div>

                        <!-- ב-RTL האיבר האחרון יושב בצד שמאל -->
                        <div
                            class="flex min-h-[130px] w-2/5 max-w-[190px] flex-shrink-0 items-center justify-center self-stretch overflow-hidden rounded-xl border border-[#3b5794]"
                            style="background: {ad.gradient || 'linear-gradient(135deg, #f59e0b, #ea580c)'}"
                        >
                            {#if ad.mainImage}
                                <img src={ad.mainImage} alt="" class="h-full w-full object-cover" />
                            {:else}
                                <span class="text-4xl" aria-hidden="true">📢</span>
                            {/if}
                        </div>
                    </a>
                </article>
            {/each}
        </div>
    {/if}
</section>
