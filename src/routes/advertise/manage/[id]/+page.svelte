<script lang="ts">
    // ============================================================
    // דף ניהול הנכס של המפרסם
    //   • מדדים: צפיות, הקלקות, צפיות בדף הנחיתה ופניות — סך הכל ולפי ימים
    //   • עריכה מחדש: טוען את המודעה לבונה ומחליף אותה בסיום (PUT)
    //   • חידוש: התראה לפני סוף התקופה + דרך ליצור קשר לחידוש
    // ============================================================
    import { goto } from '$app/navigation';
    import {
        statusView, fmtDate, ctr, daysLeft, needsRenewal, isExpired,
        RENEW_WARNING_DAYS, type AdStatusKind,
    } from '$lib/adOwner';

    let { data } = $props();
    const ad = $derived(data.ad);
    const lp = $derived(data.ad.landing ?? {});
    const totals = $derived(data.stats.totals);
    const days = $derived(data.stats.days);

    const sv = $derived(statusView(ad.status as AdStatusKind, ad.expiresAt));
    const left = $derived(daysLeft(ad.expiresAt));
    const renew = $derived(
        needsRenewal(ad.status as AdStatusKind, ad.expiresAt) ||
        isExpired(ad.status as AdStatusKind, ad.expiresAt)
    );

    const TONE: Record<string, string> = {
        amber: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
        emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
        rose: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
        slate: 'border-[#3b5794] bg-[#1c2f5a] text-gray-300',
    };

    // הגרף: כל יום מוצג כעמודה. הסקאלה נגזרת מהיום החזק בתקופה.
    const maxDay = $derived(
        Math.max(1, ...days.map((d: { impressions: number }) => d.impressions))
    );
    function dayLabel(date: string): string {
        return new Date(date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
    }

    // ===== העברה לבונה לעריכה מחדש =====
    // הבונה קורא טיוטה מ-localStorage בעליית העמוד — לכן "עריכה" היא
    // כתיבת המודעה הקיימת לאותה טיוטה, בתוספת מזהה העריכה שאומר
    // לשלב האחרון להחליף את המודעה הקיימת ולא ליצור חדשה.
    const LS_KEY = 'ng_ad_builder_draft_v1';
    const EDIT_KEY = 'ng_ad_edit_id';
    let editError = $state('');

    function editInBuilder() {
        const adv = (lp.advantages ?? []) as string[];
        const draft = {
            logo: ad.logo ?? '',
            logoOriginal: ad.logo ?? '',
            hasCircleCrop: false,
            logoShape: 'square',
            logoPosition: 'right',
            logoPositionExplicit: false,
            mainImage: ad.mainImage ?? '',
            mainImageObjectX: 50,
            mainImageObjectY: 50,
            title: ad.title ?? '',
            titleColor: '#ffffff',
            titleOffsetY: 0,
            subtitle: ad.subtitle ?? '',
            hoverText: ad.hoverText ?? '',
            cta: ad.cta ?? '',
            gradient: ad.gradient ?? '',
            diagHeight: 12,
            landingHeadline: lp.headline ?? '',
            landingPitch: lp.pitch ?? '',
            landingExtended: lp.extended ?? '',
            landingImage: lp.image ?? '',
            landingAdvantages: [adv[0] ?? '', adv[1] ?? '', adv[2] ?? ''],
            uniqueness: lp.uniqueness ?? '',
            phone: lp.phone ?? '',
            whatsapp: lp.whatsapp ?? '',
            website: lp.website ?? '',
            email: lp.email ?? '',
            address: lp.address ?? '',
            hours: lp.hours ?? '',
            products: lp.products ?? [],
        };
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(draft));
            localStorage.setItem(EDIT_KEY, ad.id);
        } catch {
            // מקום אחסון מלא (תמונות data-URI כבדות) — לא נשלח לבונה חצי-טיוטה
            editError = 'לא הצלחנו לפתוח את הפרסומת לעריכה בדפדפן הזה. נסו לפנות מקום (היסטוריה/אחסון) או להשתמש בדפדפן אחר.';
            return;
        }
        void goto('/advertise/builder');
    }

    const WA_NUMBER = '972508750632';
    const renewWa = $derived(
        `https://wa.me/${WA_NUMBER}?text=` +
        encodeURIComponent(`שלום! אני רוצה לחדש את הפרסום של "${ad.title}" בגמ"ח הארצי 🙂`)
    );
</script>

<svelte:head><title>ניהול הפרסומת {ad.title} | הגמ"ח הארצי</title></svelte:head>

<section class="mx-auto max-w-3xl px-3 py-6 md:px-4" dir="rtl">
    <a href="/advertise/manage" class="inline-block rounded-full border border-[#3b5794] bg-[#1c2f5a] px-3.5 py-1.5 text-sm font-bold text-gray-100 shadow-md transition-colors hover:bg-[#2a4379] hover:text-white">
        → לכל הנכסים שלי
    </a>

    <!-- כרטיס הנכס: תצוגה מקדימה + מצב הפרסום -->
    <header class="mt-4 rounded-2xl border border-[#3b5794] bg-[#16264d] p-4 md:p-5">
        <div class="flex flex-col gap-4 md:flex-row md:items-start">
            <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                    <h1 class="text-xl font-black leading-tight text-white md:text-2xl">{ad.title}</h1>
                    <span class="rounded-full border px-2.5 py-0.5 text-xs font-bold {TONE[sv.tone]}">{sv.label}</span>
                </div>
                {#if ad.subtitle}
                    <p class="mt-1.5 text-sm text-gray-200">{ad.subtitle}</p>
                {/if}
                <p class="mt-1.5 text-xs text-gray-400">{sv.hint}</p>

                <dl class="mt-3.5 grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-[#3b5794] pt-3.5 text-sm sm:grid-cols-2">
                    <div class="flex gap-1.5"><dt class="flex-shrink-0 text-gray-400">מסלול:</dt><dd class="font-bold text-white">{data.plan.label} ({data.plan.price} ₪)</dd></div>
                    {#if ad.expiresAt}
                        <div class="flex gap-1.5"><dt class="flex-shrink-0 text-gray-400">בתוקף עד:</dt><dd class="font-bold text-white">{fmtDate(ad.expiresAt)}</dd></div>
                    {/if}
                    <div class="flex gap-1.5"><dt class="flex-shrink-0 text-gray-400">נשלחה:</dt><dd class="font-bold text-white">{fmtDate(ad.submittedAt)}</dd></div>
                    {#if ad.editedAt}
                        <div class="flex gap-1.5"><dt class="flex-shrink-0 text-gray-400">עודכנה:</dt><dd class="font-bold text-white">{fmtDate(ad.editedAt)}</dd></div>
                    {/if}
                </dl>

                {#if ad.status === 'rejected' && ad.rejectionReason}
                    <p class="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                        <span class="font-bold">סיבת הדחייה:</span> {ad.rejectionReason}
                    </p>
                {/if}

                <div class="mt-4 flex flex-wrap gap-2">
                    <button type="button" onclick={editInBuilder}
                        class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90">
                        ✏️ ערוך את הפרסומת
                    </button>
                    {#if ad.status === 'approved'}
                        <a href="/ads/{ad.id}" target="_blank" rel="noopener"
                            class="inline-flex items-center gap-2 rounded-xl bg-[#1c2f5a] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2a4379]">
                            🔗 לדף הנחיתה
                        </a>
                    {/if}
                </div>
                {#if editError}
                    <p class="mt-2 text-sm font-bold text-rose-300">{editError}</p>
                {/if}
            </div>

            <!-- תצוגה מקדימה של הבאנר כפי שהוא מוצג באתר -->
            <div class="w-full flex-shrink-0 md:w-56">
                <div class="overflow-hidden rounded-xl border border-[#3b5794]"
                     style="background: {ad.gradient || 'linear-gradient(135deg, #f59e0b, #ea580c)'}">
                    {#if ad.mainImage}
                        <img src={ad.mainImage} alt="" class="h-40 w-full scale-[1.18] object-cover md:h-48" />
                    {:else}
                        <div class="flex h-40 items-center justify-center text-5xl md:h-48" aria-hidden="true">📢</div>
                    {/if}
                    <div class="px-3 py-2 text-center">
                        <p class="text-sm font-black text-white">{ad.title}</p>
                        {#if ad.cta}<p class="mt-0.5 text-[11px] font-bold text-white/90">{ad.cta}</p>{/if}
                    </div>
                </div>
            </div>
        </div>
    </header>

    <!-- חידוש הפרסום -->
    {#if renew}
        <div class="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 md:p-5">
            <p class="text-base font-black text-amber-100">
                {#if isExpired(ad.status as AdStatusKind, ad.expiresAt)}
                    ⏳ הפרסום הסתיים — המודעה ירדה מהאתר
                {:else}
                    ⏳ הפרסום מסתיים בעוד {left} ימים
                {/if}
            </p>
            <p class="mt-1 text-sm leading-relaxed text-amber-100/80">
                חידוש שומר על אותה מודעה ואותם נתונים — בלי לבנות מחדש.
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
                <a href={renewWa} target="_blank" rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90">
                    💬 לחידוש בוואטסאפ
                </a>
                <a href="/advertise#plans"
                    class="inline-flex items-center gap-2 rounded-xl bg-[#1c2f5a] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2a4379]">
                    המחירון והמסלולים
                </a>
            </div>
        </div>
    {/if}

    <!-- מדדים -->
    <section class="mt-4 rounded-2xl border border-[#3b5794] bg-[#16264d] p-4 md:p-5">
        <h2 class="text-lg font-black text-white">📊 הביצועים שלך</h2>
        <p class="mt-1 text-xs text-gray-400">
            נמדד מרגע העלאת המודעה. צפייה נספרת פעם אחת לכל מבקר.
        </p>

        <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {#snippet stat(label: string, value: number, hint: string, accent: string)}
                <div class="rounded-xl border border-[#3b5794] bg-[#0f1c3d] px-3 py-3 text-center">
                    <p class="text-2xl font-black tabular-nums {accent}">{value}</p>
                    <p class="mt-0.5 text-xs font-bold text-gray-200">{label}</p>
                    <p class="mt-0.5 text-[11px] leading-tight text-gray-400">{hint}</p>
                </div>
            {/snippet}
            {@render stat('צפיות', totals.impressions, 'המודעה נראתה', 'text-white')}
            {@render stat('הקלקות', totals.clicks, `אחוז הקלקה ${ctr(totals.clicks, totals.impressions)}`, 'text-blue-300')}
            {@render stat('דף הנחיתה', totals.landing, 'נכנסו לדף שלך', 'text-purple-300')}
            {@render stat('פניות', totals.leads, 'טלפון · וואטסאפ · אתר', 'text-emerald-300')}
        </div>

        {#if days.length > 0}
            <h3 class="mt-5 text-sm font-bold text-gray-200">צפיות ב-{data.statsDays} הימים האחרונים</h3>
            <div class="mt-2 flex items-end justify-between gap-1" style="height: 96px">
                {#each days as d (d.date)}
                    <div class="flex h-full flex-1 flex-col justify-end" title="{dayLabel(d.date)}: {d.impressions} צפיות · {d.clicks} הקלקות">
                        <div class="rounded-t bg-gradient-to-t from-blue-700 to-blue-400"
                             style="height: {Math.round((d.impressions / maxDay) * 100)}%; min-height: {d.impressions > 0 ? '3px' : '2px'}"
                             class:opacity-25={d.impressions === 0}></div>
                    </div>
                {/each}
            </div>
            <div class="mt-1 flex justify-between text-[10px] text-gray-400">
                <span>{dayLabel(days[0].date)}</span>
                <span>{dayLabel(days[days.length - 1].date)}</span>
            </div>
        {/if}

        {#if totals.impressions === 0}
            <p class="mt-4 rounded-xl border border-[#3b5794] bg-[#0f1c3d] px-3 py-2.5 text-sm text-gray-300">
                {#if ad.status === 'approved'}
                    עדיין לא נאספו נתונים — המספרים מתחילים לזוז ברגע שגולשים נחשפים למודעה.
                {:else}
                    המדידה מתחילה כשהמודעה מאושרת ועולה לאתר.
                {/if}
            </p>
        {/if}
    </section>

    <!-- התראות — בסיס להודעות האוטומטיות (חידוש / מבצעים) -->
    <section class="mt-4 rounded-2xl border border-[#3b5794] bg-[#16264d] p-4 md:p-5">
        <h2 class="text-lg font-black text-white">🔔 התראות ועדכונים</h2>
        <p class="mt-1.5 text-sm leading-relaxed text-gray-300">
            עדכונים על הנכס נשלחים לכתובת <span class="font-bold text-white" dir="ltr">{data.notifyEmail}</span>.
        </p>
        <ul class="mt-3 flex flex-col gap-2 text-sm text-gray-300">
            <li class="rounded-xl border border-[#3b5794] bg-[#0f1c3d] px-3 py-2">
                ⏳ <span class="font-bold text-white">תזכורת חידוש</span> — {RENEW_WARNING_DAYS} ימים לפני סוף התקופה,
                וגם כאן בדף (הקריאה לחידוש מופיעה למעלה).
            </li>
            <li class="rounded-xl border border-[#3b5794] bg-[#0f1c3d] px-3 py-2">
                🎁 <span class="font-bold text-white">מבצעים למפרסמים קיימים</span> — הטבות ותוספות פרסום שכדאי לך להכיר.
            </li>
        </ul>
        <p class="mt-2 text-[11px] text-gray-400">
            השליחה האוטומטית במייל בהקמה — בשלב הזה התזכורות מוצגות בדף הזה.
        </p>
    </section>
</section>
