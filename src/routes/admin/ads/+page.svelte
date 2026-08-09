<script lang="ts">
    import { enhance } from '$app/forms';
    import { adPlans, planLabel } from '$lib/adPlans';
    import { ctr } from '$lib/adOwner';
    import { adImgFit, parseAdImageFit } from '$lib/adImageFit';
    import { AD_SLOT_COUNT } from '$lib/rightAdsData';

    // מסך ניהול הפרסומות לסופר-אדמין:
    //   1. לוח מלאי — כמה משבצות תפוסות, עד מתי, וכמה פנויות לפרסום עכשיו
    //   2. המפרסמים — הנתונים של כל מפרסם (אותם מדדים שהוא רואה בדשבורד שלו)
    //   3. אישור / דחייה — הטאבים המקוריים
    // פורט מקבוצות רכישה; עטוף בקופסה כהה כי הרקע באתר ורוד בהיר.
    let { data, form } = $props();

    let tab = $state<'pending' | 'approved' | 'rejected'>('pending');

    // תקופות שאפשר לקצוב למודעה שכבר באוויר (נספרות מיום האישור)
    const DURATION_OPTIONS = [7, 14, 30, 60, 90, 180, 365];
    // 12 המקומות הממוספרים בלוח — בורר "⇄ העבר" שליד כל מודעה מאושרת
    const SLOT_NUMBERS = Array.from({ length: AD_SLOT_COUNT }, (_, i) => i + 1);

    let pending  = $derived(data.ads.filter((a: any) => a.status === 'pending'));
    // טאב "מאושרות" בסדר הלוח — אותו סדר מספרים שהגולש רואה בטור
    let approved = $derived(
        data.ads
            .filter((a: any) => a.status === 'approved')
            .sort((x: any, y: any) => (x.slot ?? 9999) - (y.slot ?? 9999))
    );
    let rejected = $derived(data.ads.filter((a: any) => a.status === 'rejected'));
    let shown    = $derived(tab === 'pending' ? pending : tab === 'approved' ? approved : rejected);

    /** המודעות שתופסות משבצת כרגע — לפי הקרוב להתפנות */
    let active = $derived(
        data.ads
            .filter((a: any) => a.isActive)
            .sort((x: any, y: any) => (x.daysLeft ?? 9999) - (y.daysLeft ?? 9999))
    );

    // ===== קיבוץ לפי מפרסם =====
    // מפתח הקבוצה: המייל של השולח (fallback לשם; מודעות בלי זיהוי נאספות יחד).
    interface AdvGroup {
        key: string;
        name: string;
        email: string;
        ads: any[];
        activeCount: number;
        pendingCount: number;
        totals: { impressions: number; clicks: number; landing: number; leads: number };
        /** ההתפנות הרחוקה ביותר — עד מתי המפרסם "מחזיק" משבצת */
        maxDaysLeft: number | null;
    }
    let advertisers = $derived.by((): AdvGroup[] => {
        const map = new Map<string, AdvGroup>();
        for (const a of data.ads as any[]) {
            const email = (a.submittedBy?.email ?? '').trim();
            const name = (a.submittedBy?.name ?? '').trim();
            const key = (email || name || 'ללא זיהוי').toLowerCase();
            let g = map.get(key);
            if (!g) {
                g = {
                    key,
                    name: name || email || 'מפרסם ללא זיהוי',
                    email,
                    ads: [],
                    activeCount: 0,
                    pendingCount: 0,
                    totals: { impressions: 0, clicks: 0, landing: 0, leads: 0 },
                    maxDaysLeft: null,
                };
                map.set(key, g);
            }
            g.ads.push(a);
            if (a.isActive) g.activeCount++;
            if (a.status === 'pending') g.pendingCount++;
            g.totals.impressions += a.totals.impressions;
            g.totals.clicks += a.totals.clicks;
            g.totals.landing += a.totals.landing;
            g.totals.leads += a.totals.leads;
            if (a.isActive && a.daysLeft !== null) {
                g.maxDaysLeft = Math.max(g.maxDaysLeft ?? 0, a.daysLeft);
            }
        }
        // פעילים קודם, אחריהם לפי היקף החשיפות
        return [...map.values()].sort(
            (x, y) => y.activeCount - x.activeCount || y.totals.impressions - x.totals.impressions
        );
    });

    function fmtDate(iso: string): string {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    /** תווית הזמן שנותר למודעה פעילה */
    function leftLabel(a: any): string {
        if (a.daysLeft === null) return 'ללא תוקף מוגדר';
        if (a.daysLeft <= 0) return 'פג תוקף';
        if (a.daysLeft === 1) return 'מתפנה מחר';
        return `נותרו ${a.daysLeft} ימים`;
    }
</script>

<svelte:head>
    <title>ניהול פרסומות | ניהול</title>
</svelte:head>

<div class="ads-admin" dir="rtl">
    <h1>📢 ניהול פרסומות</h1>

    {#if data.backendUnavailable}
        <div class="admin-alert error">שרת התוכן אינו זמין כרגע — נסו לרענן בעוד רגע.</div>
    {/if}
    {#if form?.message}
        <div class="admin-alert ok">{form.message}</div>
    {/if}
    {#if form?.error}
        <div class="admin-alert error">{form.error}</div>
    {/if}

    <!-- ═══ 1. לוח המלאי — תפוסה ופניוּת ═══ -->
    <section class="inv">
        <div class="inv-tiles">
            <div class="inv-tile">
                <span class="inv-num">{data.inventory.totalSlots}</span>
                <span class="inv-label">משבצות בסבב</span>
            </div>
            <div class="inv-tile occupied">
                <span class="inv-num">{data.inventory.occupied}</span>
                <span class="inv-label">תפוסות עכשיו</span>
            </div>
            <div class="inv-tile free">
                <span class="inv-num">{data.inventory.freeNow}</span>
                <span class="inv-label">פנויות לפרסום</span>
            </div>
            <div class="inv-tile" class:warn={data.inventory.pending > 0}>
                <span class="inv-num">{data.inventory.pending}</span>
                <span class="inv-label">ממתינות לאישור</span>
            </div>
        </div>

        {#if data.inventory.freeNow > 0}
            <p class="inv-note free">
                🟢 יש {data.inventory.freeNow === 1 ? 'משבצת פנויה אחת' : `${data.inventory.freeNow} משבצות פנויות`}
                — אפשר לקלוט {data.inventory.freeNow === 1 ? 'מפרסם חדש' : 'מפרסמים חדשים'} כבר עכשיו.
            </p>
        {:else if active.length > 0}
            <p class="inv-note full">
                🔴 כל המשבצות תפוסות — המשבצת הקרובה מתפנה
                ב-{fmtDate(active[0].expiresAt)} ({leftLabel(active[0])}).
            </p>
        {/if}

        <!-- לוח התפוסה: כל מודעה פעילה, כמה זמן נשאר לה ומתי היא מתפנה -->
        {#if active.length > 0}
            <h2 class="sec-title">לוח התפוסה — מי מחזיק משבצת ועד מתי</h2>
            <div class="occ-list">
                {#each active as a (a.id)}
                    <div class="occ-row">
                        <div class="occ-head">
                            <span class="occ-title">{a.title}</span>
                            <span class="occ-who">{a.submittedBy?.email || a.submittedBy?.name || 'ללא זיהוי'}</span>
                        </div>
                        <div class="occ-bar" title="נוצלו {a.usedPct}% מהתקופה">
                            <div class="occ-bar-fill" class:ending={a.daysLeft !== null && a.daysLeft <= 7} style="width: {a.usedPct}%"></div>
                        </div>
                        <div class="occ-meta">
                            <span class:soon={a.daysLeft !== null && a.daysLeft <= 7}>⏳ {leftLabel(a)}</span>
                            {#if a.expiresAt}<span>מתפנה ב-{fmtDate(a.expiresAt)}</span>{/if}
                            {#if a.totalDays}<span>מסלול: {planLabel(a.totalDays)}</span>{/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </section>

    <!-- ═══ 2. המפרסמים — הנתונים של כל אחד ═══ -->
    {#if advertisers.length > 0}
        <section class="advs">
            <h2 class="sec-title">המפרסמים — הנתונים של כל אחד</h2>
            {#each advertisers as g (g.key)}
                <div class="adv-card">
                    <div class="adv-head">
                        <div class="adv-id">
                            <span class="adv-name">👤 {g.name}</span>
                            {#if g.email}
                                <a class="adv-mail" href="mailto:{g.email}" dir="ltr">{g.email}</a>
                            {/if}
                        </div>
                        <div class="adv-flags">
                            {#if g.activeCount > 0}
                                <span class="status-pill approved">
                                    {g.activeCount === 1 ? 'מודעה באוויר' : `${g.activeCount} באוויר`}{#if g.maxDaysLeft !== null}&nbsp;· עוד {g.maxDaysLeft} ימים{/if}
                                </span>
                            {/if}
                            {#if g.pendingCount > 0}
                                <span class="status-pill pending">{g.pendingCount} ממתינות</span>
                            {/if}
                        </div>
                    </div>

                    <!-- המדדים המצטברים של המפרסם — כמו בדשבורד שלו -->
                    <div class="adv-stats">
                        <div class="adv-stat"><span class="n">{g.totals.impressions}</span><span class="l">צפיות</span></div>
                        <div class="adv-stat"><span class="n">{g.totals.clicks}</span><span class="l">הקלקות</span></div>
                        <div class="adv-stat"><span class="n">{ctr(g.totals.clicks, g.totals.impressions)}</span><span class="l">אחוז הקלקה</span></div>
                        <div class="adv-stat"><span class="n">{g.totals.landing}</span><span class="l">דף נחיתה</span></div>
                        <div class="adv-stat leads"><span class="n">{g.totals.leads}</span><span class="l">פניות</span></div>
                    </div>

                    <!-- המודעות של המפרסם -->
                    <div class="adv-ads">
                        {#each g.ads as a (a.id)}
                            <div class="promo-adv">
                                <span class="adv-ad-title">{a.title}</span>
                                <span class="status-pill {a.isExpired ? 'rejected' : a.status}">
                                    {a.isExpired ? 'פג תוקף' : a.status === 'pending' ? 'ממתינה' : a.status === 'approved' ? 'באוויר' : 'נדחתה'}
                                </span>
                                {#if a.isActive}
                                    <span class="adv-ad-left" class:soon={a.daysLeft !== null && a.daysLeft <= 7}>
                                        ⏳ {leftLabel(a)}{#if a.expiresAt}&nbsp;(עד {fmtDate(a.expiresAt)}){/if}
                                    </span>
                                {/if}
                                <span class="adv-ad-nums" title="צפיות · הקלקות · דף נחיתה · פניות (בסוגריים: 7 הימים האחרונים)">
                                    👁️ {a.totals.impressions} ({a.week.impressions})
                                    · 🖱️ {a.totals.clicks} ({a.week.clicks})
                                    · 📄 {a.totals.landing}
                                    · 🤝 {a.totals.leads}
                                </span>
                                {#if a.status === 'approved'}
                                    <a class="adv-ad-link" href="/ads/{a.id}" target="_blank" rel="noopener">לדף הנחיתה ↗</a>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </section>
    {/if}

    <!-- ═══ 3. אישור / דחייה ═══ -->
    <h2 class="sec-title">אישור ודחייה</h2>
    <div class="tabs">
        <button type="button" class="tab-btn" class:active={tab === 'pending'} onclick={() => (tab = 'pending')}>
            ⏳ ממתינות ({pending.length})
        </button>
        <button type="button" class="tab-btn" class:active={tab === 'approved'} onclick={() => (tab = 'approved')}>
            ✅ מאושרות ({approved.length})
        </button>
        <button type="button" class="tab-btn" class:active={tab === 'rejected'} onclick={() => (tab = 'rejected')}>
            ❌ נדחו ({rejected.length})
        </button>
    </div>

    {#if shown.length === 0}
        <p class="empty">אין פרסומות בקטגוריה הזו.</p>
    {/if}

    <div class="promo-list">
        {#each shown as ad (ad.id)}
            <!-- id כעוגן — ההתראה בפרופיל מקשרת ישירות לכרטיס: /admin/ads#ad-{id} -->
            <div class="promo-card" id="ad-{ad.id}">
                <div class="ad-card-img">
                    {#if ad.mainImage}
                        <!-- אותו מיקום/זום שהמפרסם קבע — המנהל מאשר את מה שבאמת יוצג -->
                        <img src={ad.mainImage} alt={ad.title} use:adImgFit={parseAdImageFit(ad.mainImageFit)} />
                    {:else}
                        <div class="no-img">אין תמונה</div>
                    {/if}
                </div>
                <div class="ad-card-body">
                    <div class="ad-card-head">
                        <h2>{ad.title}</h2>
                        <span class="status-pill {ad.isExpired ? 'rejected' : ad.status}">
                            {ad.isExpired ? 'פג תוקף' : ad.status === 'pending' ? 'ממתינה' : ad.status === 'approved' ? 'מאושרת' : 'נדחתה'}
                        </span>
                        {#if ad.isPaused}
                            <span class="status-pill pending">⏸ מושהית — {ad.pausedDaysLeft ?? 0} ימים שמורים</span>
                        {/if}
                        {#if ad.payment === 'code'}
                            <span class="status-pill approved">💳 קוד תנועה — כמו שולם</span>
                        {:else if ad.codeRequested}
                            <!-- הקוד הוא בקשה בלבד. חייב לומר במפורש שלא שולם,
                                 אחרת מאשרים פרסומת בהנחה שנכנס כסף. -->
                            <span class="status-pill pending">🎟️ ביקש חינם עם קוד — לא שולם</span>
                        {:else}
                            <span class="status-pill pending">⌛ תשלום לתיאום</span>
                        {/if}
                        <!-- המפרסם ערך את התוכן בעצמו מדשבורד הנכס שלו — כדאי לעבור עליו -->
                        {#if ad.editedAt}
                            <span class="status-pill pending">✏️ נערכה ע"י המפרסם: {fmtDate(ad.editedAt)}</span>
                        {/if}
                        <!-- מפרסם חוזר ששיפר את המודעה שלו: לא בקשה חדשה -->
                        {#if ad.replacesAdId && ad.status === 'pending'}
                            <span class="status-pill update">🔄 עדכון למודעה קיימת</span>
                        {:else if ad.supersededBy}
                            <span class="status-pill rejected">🔄 גרסה ישנה — הוחלפה בגרסה מעודכנת</span>
                        {/if}
                    </div>
                    {#if ad.replacesAdId && ad.status === 'pending'}
                        {@const prevLive = shown.some((o) => o.id === ad.replacesAdId && o.status === 'approved' && !o.isExpired)}
                        <p class="ad-update-note">
                            גרסה מעודכנת של{ad.replacesTitle ? ` "${ad.replacesTitle}"` : ' מודעה קודמת של אותו מפרסם'}.
                            {prevLive
                                ? 'עם האישור היא נכנסת במקום הישנה — אותה משבצת, אותו תאריך סיום, והישנה יורדת מהאתר.'
                                : 'למפרסם אין כרגע מודעה פעילה על האתר — האישור פשוט יפרסם את הגרסה הזו.'}
                        </p>
                    {/if}
                    <p class="ad-sub">{ad.subtitle}</p>
                    {#if ad.hoverText}<p class="ad-hover">ריחוף: {ad.hoverText}</p>{/if}
                    <p class="ad-meta">
                        {#if ad.submittedBy?.email}👤 {ad.submittedBy.email} · {/if}
                        📅 נשלחה: {fmtDate(ad.submittedAt)}
                        {#if ad.status === 'approved' && ad.expiresAt} · ⏳ {ad.isExpired ? `פגה ב-${fmtDate(ad.expiresAt)}` : `${leftLabel(ad)} (עד ${fmtDate(ad.expiresAt)})`}{/if}
                    </p>
                    {#if ad.status === 'approved'}
                        <!-- המדדים — אותם מספרים שהמפרסם רואה בדשבורד שלו -->
                        <p class="ad-meta">
                            📊 👁️ {ad.totals.impressions} צפיות · 🖱️ {ad.totals.clicks} הקלקות ({ctr(ad.totals.clicks, ad.totals.impressions)})
                            · 📄 {ad.totals.landing} דף נחיתה · 🤝 {ad.totals.leads} פניות
                        </p>
                    {/if}
                    {#if ad.landing?.phone || ad.landing?.website}
                        <p class="ad-meta">
                            {#if ad.landing.phone}📞 {ad.landing.phone}{/if}
                            {#if ad.landing.website}
                                · 🌐 <a href={ad.landing.website} target="_blank" rel="noopener noreferrer">{ad.landing.website}</a>
                            {/if}
                        </p>
                    {/if}
                    {#if ad.rejectionReason}
                        <p class="ad-reject-reason">סיבת דחייה: {ad.rejectionReason}</p>
                    {/if}

                    {#if ad.isActive && ad.slotIndex >= 0}
                        <!-- מקום מעל 12 (גלישה) מתווסף לבורר כדי שלא ייעלם -->
                        {@const slotOptions = ad.slot && !SLOT_NUMBERS.includes(ad.slot)
                            ? [...SLOT_NUMBERS, ad.slot].sort((a: number, b: number) => a - b)
                            : SLOT_NUMBERS}
                        <!-- מספר המקום הקבוע של המודעה בלוח + החלפת מקום: החצים
                             מחליפים מספרים עם השכנה שבאוויר, והבורר מעביר ישירות
                             למקום שנבחר (מקום תפוס — השתיים מתחלפות). -->
                        <div class="slot-row">
                            <span class="slot-badge">{ad.slot ?? ad.slotIndex + 1}</span>
                            <span class="slot-label">משבצת {ad.slot ?? ad.slotIndex + 1} מתוך {AD_SLOT_COUNT} בטור</span>
                            <form method="POST" action="?/move" use:enhance>
                                <input type="hidden" name="id" value={ad.id} />
                                <input type="hidden" name="dir" value="up" />
                                <button type="submit" class="a-btn ghost" disabled={ad.slotIndex === 0} title="העלה משבצת אחת">▲ למעלה</button>
                            </form>
                            <form method="POST" action="?/move" use:enhance>
                                <input type="hidden" name="id" value={ad.id} />
                                <input type="hidden" name="dir" value="down" />
                                <button type="submit" class="a-btn ghost" disabled={ad.slotIndex === ad.slotTotal - 1} title="הורד משבצת אחת">▼ למטה</button>
                            </form>
                            <form method="POST" action="?/setSlot" use:enhance class="slot-jump-form">
                                <input type="hidden" name="id" value={ad.id} />
                                <select name="slot" class="duration-select" aria-label="מספר מקום בלוח">
                                    {#each slotOptions as n (n)}
                                        <!-- רקע לבן + טקסט כהה חובה: רקע כהה נבלע בהדגשת הבחירה של המערכת -->
                                        <option value={n} selected={n === ad.slot} style="background:#fff;color:#111">{n}</option>
                                    {/each}
                                </select>
                                <button type="submit" class="a-btn ghost"
                                        title="העבר למקום שנבחר; אם המקום תפוס — שתי הפרסומות מתחלפות">
                                    ⇄ העבר
                                </button>
                            </form>
                        </div>
                    {/if}

                    <div class="ad-actions">
                        {#if ad.status === 'approved'}
                            <a href="/ads/{ad.id}" target="_blank" class="a-btn ghost">פתח את דף הנחיתה ↗</a>
                        {/if}
                        {#if ad.isActive || ad.isPaused}
                            <!-- קציבת תקופה: נספרת מיום האישור, ולכן קציבה קצרה
                                 מהזמן שכבר רץ מורידה את הפרסומת מיד -->
                            <form method="POST" action="?/setDuration" use:enhance class="approve-form">
                                <input type="hidden" name="id" value={ad.id} />
                                <label class="duration-label">
                                    תקופה:
                                    <select name="days" class="duration-select">
                                        {#each DURATION_OPTIONS as d (d)}
                                            <option value={d} selected={d === ad.totalDays}>{d} ימים</option>
                                        {/each}
                                    </select>
                                </label>
                                <button type="submit" class="a-btn ghost" title="התקופה נספרת מיום האישור">⏱ קצוב</button>
                            </form>
                        {/if}
                        {#if ad.isPaused}
                            <form method="POST" action="?/resume" use:enhance>
                                <input type="hidden" name="id" value={ad.id} />
                                <button type="submit" class="a-btn approve" title="הימים השמורים נספרים מהיום">▶ המשך</button>
                            </form>
                        {:else if ad.isActive}
                            <!-- השהיה: יורדת מהאתר, הימים שנותרו נשמרים לה -->
                            <form method="POST" action="?/pause" use:enhance>
                                <input type="hidden" name="id" value={ad.id} />
                                <button type="submit" class="a-btn ghost"
                                        onclick={(e) => { if (!confirm('להשהות את הפרסומת? היא תרד מהאתר והימים שנותרו יישמרו לה.')) e.preventDefault(); }}>
                                    ⏸ השהה
                                </button>
                            </form>
                        {/if}
                        {#if ad.isActive}
                            <!-- הורדה מהאתר בלי מחיקה: הפרסומת חוזרת לממתינות ואפשר
                                 להחזיר אותה לאוויר באישור מחדש -->
                            <form method="POST" action="?/unapprove" use:enhance>
                                <input type="hidden" name="id" value={ad.id} />
                                <button type="submit" class="a-btn ghost"
                                        onclick={(e) => { if (!confirm('להוריד את הפרסומת מהאתר ולהחזיר אותה לממתינות?')) e.preventDefault(); }}>
                                    ⏸ הורד מהאתר
                                </button>
                            </form>
                        {/if}
                        {#if ad.status !== 'approved' || ad.isExpired}
                            <form method="POST" action="?/approve" use:enhance class="approve-form">
                                <input type="hidden" name="id" value={ad.id} />
                                <label class="duration-label">
                                    שולם עבור:
                                    <!-- ברירת המחדל = התקופה שהמפרסם בחר בשליחה -->
                                    <select name="durationDays" class="duration-select">
                                        {#each adPlans as plan (plan.days)}
                                            <option value={plan.days} selected={ad.requestedDurationDays === plan.days}>
                                                {plan.label} — {plan.price} ₪
                                            </option>
                                        {/each}
                                    </select>
                                </label>
                                <button type="submit" class="a-btn approve">
                                    {ad.isExpired
                                        ? '🔄 חדש את הפרסום'
                                        : ad.replacesAdId && shown.some((o) => o.id === ad.replacesAdId && o.status === 'approved' && !o.isExpired)
                                          ? '✅ אשר והחלף את הישנה'
                                          : '✅ אשר ופרסם'}
                                </button>
                            </form>
                            <!-- מפרסם שבאמת רוצה שתי מודעות במקביל, ולא שדרג את הקיימת -->
                            {#if ad.replacesAdId && shown.some((o) => o.id === ad.replacesAdId && o.status === 'approved' && !o.isExpired)}
                                <form method="POST" action="?/approve" use:enhance class="approve-form">
                                    <input type="hidden" name="id" value={ad.id} />
                                    <input type="hidden" name="keepPrevious" value="1" />
                                    <input type="hidden" name="durationDays" value={ad.requestedDurationDays} />
                                    <button type="submit" class="a-btn" title="הישנה תישאר על האתר וזו תתווסף לידה">
                                        ➕ אשר כמודעה נוספת
                                    </button>
                                </form>
                            {/if}
                        {/if}
                        {#if ad.status !== 'rejected'}
                            <form method="POST" action="?/reject" use:enhance class="reject-form">
                                <input type="hidden" name="id" value={ad.id} />
                                <input type="text" name="reason" placeholder="סיבת דחייה (לא חובה)" class="reject-input" />
                                <button type="submit" class="a-btn reject">❌ דחה</button>
                            </form>
                        {/if}
                    </div>
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    /* קופסה כהה על הרקע הוורוד — כמו שאר כרטיסי האדמין */
    .ads-admin {
        max-width: 56rem;
        margin: 0 auto;
        padding: 1.25rem 1rem 2rem;
        background: #16264d;
        border: 1px solid #3b5794;
        border-radius: 1rem;
    }
    .ads-admin h1 {
        font-size: 1.75rem;
        font-weight: 900;
        color: #fff;
        margin: 0 0 1.25rem;
        text-align: center;
    }

    .admin-alert {
        border-radius: 0.75rem;
        padding: 0.75rem 1rem;
        font-size: 0.9rem;
        font-weight: 700;
        margin-bottom: 1rem;
        text-align: center;
    }
    .admin-alert.ok {
        background: rgba(34, 197, 94, 0.12);
        border: 1px solid rgba(34, 197, 94, 0.35);
        color: #86efac;
    }
    .admin-alert.error {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.35);
        color: #fca5a5;
    }

    .sec-title {
        font-size: 1.05rem;
        font-weight: 900;
        color: #fff;
        margin: 1.5rem 0 0.75rem;
    }

    /* ═══ לוח המלאי ═══ */
    .inv-tiles {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.6rem;
    }
    @media (max-width: 560px) {
        .inv-tiles { grid-template-columns: repeat(2, 1fr); }
    }
    .inv-tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.15rem;
        padding: 0.75rem 0.5rem;
        border-radius: 0.75rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        text-align: center;
    }
    .inv-tile.occupied { border-color: rgba(96, 165, 250, 0.4); }
    .inv-tile.occupied .inv-num { color: #93c5fd; }
    .inv-tile.free { border-color: rgba(34, 197, 94, 0.4); }
    .inv-tile.free .inv-num { color: #86efac; }
    .inv-tile.warn { border-color: rgba(245, 158, 11, 0.5); }
    .inv-tile.warn .inv-num { color: #fcd34d; }
    .inv-num {
        font-size: 1.6rem;
        font-weight: 900;
        color: #fff;
        font-variant-numeric: tabular-nums;
        line-height: 1;
    }
    .inv-label { font-size: 0.7rem; font-weight: 700; color: #9ca3af; }

    .inv-note {
        margin: 0.75rem 0 0;
        border-radius: 0.75rem;
        padding: 0.6rem 0.9rem;
        font-size: 0.85rem;
        font-weight: 700;
    }
    .inv-note.free {
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.3);
        color: #86efac;
    }
    .inv-note.full {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
    }

    /* לוח התפוסה */
    .occ-list { display: flex; flex-direction: column; gap: 0.6rem; }
    .occ-row {
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.03);
        border-radius: 0.75rem;
        padding: 0.65rem 0.85rem;
    }
    .occ-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-bottom: 0.4rem;
    }
    .occ-title { font-weight: 900; color: #fff; font-size: 0.9rem; }
    .occ-who { font-size: 0.72rem; color: #9ca3af; direction: ltr; }
    .occ-bar {
        height: 0.45rem;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.08);
        overflow: hidden;
    }
    .occ-bar-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    }
    /* שבוע אחרון לתקופה — הפס מאדים כדי למשוך את העין לחידוש */
    .occ-bar-fill.ending { background: linear-gradient(90deg, #f59e0b, #ef4444); }
    .occ-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 1rem;
        margin-top: 0.4rem;
        font-size: 0.72rem;
        color: #9ca3af;
        font-weight: 700;
    }
    .occ-meta .soon { color: #fcd34d; }

    /* ═══ המפרסמים ═══ */
    .advs { margin-bottom: 0.5rem; }
    .adv-card {
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.03);
        border-radius: 0.9rem;
        padding: 0.85rem 1rem;
        margin-bottom: 0.75rem;
    }
    .adv-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
    }
    .adv-id { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
    .adv-name { font-weight: 900; color: #fff; font-size: 0.95rem; }
    .adv-mail { font-size: 0.75rem; color: #93c5fd; text-decoration: none; }
    .adv-mail:hover { text-decoration: underline; }
    .adv-flags { display: flex; gap: 0.4rem; flex-wrap: wrap; }

    .adv-stats {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 0.5rem;
        margin-top: 0.7rem;
    }
    @media (max-width: 560px) {
        .adv-stats { grid-template-columns: repeat(3, 1fr); }
    }
    .adv-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.1rem;
        border-radius: 0.6rem;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.07);
        padding: 0.45rem 0.3rem;
        text-align: center;
    }
    .adv-stat .n {
        font-size: 1.05rem;
        font-weight: 900;
        color: #fff;
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
    }
    .adv-stat .l { font-size: 0.62rem; font-weight: 700; color: #9ca3af; }
    .adv-stat.leads .n { color: #86efac; }

    .adv-ads { margin-top: 0.7rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .promo-adv {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
        font-size: 0.75rem;
        color: #d1d5db;
        border-top: 1px dashed rgba(255, 255, 255, 0.08);
        padding-top: 0.45rem;
    }
    .adv-ad-title { font-weight: 800; color: #fff; }
    .adv-ad-left { font-weight: 700; color: #9ca3af; }
    .adv-ad-left.soon { color: #fcd34d; }
    .adv-ad-nums { color: #9ca3af; font-variant-numeric: tabular-nums; }
    .adv-ad-link { color: #93c5fd; text-decoration: none; margin-inline-start: auto; }
    .adv-ad-link:hover { text-decoration: underline; }

    .tabs {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.25rem;
        flex-wrap: wrap;
        justify-content: center;
    }
    .tab-btn {
        padding: 0.5rem 1.1rem;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.05);
        color: #d1d5db;
        font-weight: 700;
        font-size: 0.9rem;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.15s;
    }
    .tab-btn:hover { color: #fff; }
    .tab-btn.active {
        background: #f59e0b;
        border-color: #f59e0b;
        color: #000;
    }

    .empty {
        text-align: center;
        color: #9ca3af;
        padding: 2rem 0;
    }

    .promo-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .promo-card {
        display: flex;
        gap: 1rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        padding: 1rem;
        scroll-margin-top: 6rem;
    }
    /* נחיתה מהעוגן שבהתראת הפרופיל — הכרטיס המבוקש מודגש */
    .promo-card:target {
        border-color: rgba(244, 63, 94, 0.6);
        box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.25);
    }
    @media (max-width: 640px) {
        .promo-card { flex-direction: column; }
    }
    .ad-card-img {
        width: 120px;
        flex-shrink: 0;
        border-radius: 0.6rem;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.3);
        /* עוגן לתמונה הממוקמת אבסולוטית ע"י adImgFit + גובה שלא יקרוס */
        position: relative;
        min-height: 160px;
    }
    @media (max-width: 640px) {
        .ad-card-img { width: 100%; height: 180px; max-height: 180px; }
    }
    .ad-card-img img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }
    .no-img {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-height: 100px;
        color: #9ca3af;
        font-size: 0.75rem;
    }
    .ad-card-body {
        flex: 1;
        min-width: 0;
    }
    .ad-card-head {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.25rem;
        flex-wrap: wrap;
    }
    .ad-card-head h2 {
        font-size: 1.1rem;
        font-weight: 900;
        color: #fff;
        margin: 0;
    }
    .status-pill {
        font-size: 0.7rem;
        font-weight: 900;
        padding: 0.15rem 0.6rem;
        border-radius: 999px;
    }
    .status-pill.pending {
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.4);
        color: #fcd34d;
    }
    .status-pill.approved {
        background: rgba(34, 197, 94, 0.15);
        border: 1px solid rgba(34, 197, 94, 0.4);
        color: #86efac;
    }
    .status-pill.rejected {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
    }
    /* עדכון למודעה קיימת — נבדל מ"ממתינה" רגילה כדי שהמנהל יראה מיד
       שזו אותה מודעה בגרסה חדשה ולא בקשה שנייה של אותו מפרסם */
    .status-pill.update {
        background: rgba(59, 130, 246, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.45);
        color: #bfdbfe;
    }
    .ad-update-note {
        margin: 0 0 0.5rem;
        font-size: 0.78rem;
        line-height: 1.4;
        color: #bfdbfe;
        background: rgba(59, 130, 246, 0.08);
        border: 1px solid rgba(59, 130, 246, 0.25);
        border-radius: 0.6rem;
        padding: 0.4rem 0.6rem;
    }
    .ad-sub {
        color: #d1d5db;
        font-size: 0.9rem;
        margin: 0 0 0.35rem;
    }
    .ad-hover {
        color: #9ca3af;
        font-size: 0.8rem;
        margin: 0 0 0.35rem;
    }
    .ad-meta {
        color: #9ca3af;
        font-size: 0.75rem;
        margin: 0 0 0.25rem;
    }
    .ad-meta a { color: #93c5fd; }
    .ad-reject-reason {
        color: #fca5a5;
        font-size: 0.8rem;
        font-weight: 700;
        margin: 0.25rem 0;
    }

    .ad-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.75rem;
    }
    /* שורת המשבצת בטור + חצי החלפת מקום */
    .slot-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.75rem;
        padding-top: 0.6rem;
        border-top: 1px solid #3b5794;
    }
    .slot-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 0.5rem;
        background: #1e3a8a;
        border: 1px solid #60a5fa;
        color: #dbeafe;
        font-weight: 900;
        font-size: 0.8rem;
    }
    .slot-label {
        color: #b6c6ea;
        font-size: 0.75rem;
        font-weight: 700;
        margin-inline-end: auto;
    }
    /* בורר "⇄ העבר" — מקום מספרי ישיר בלוח, ליד חצי ההחלפה */
    .slot-jump-form {
        display: flex;
        gap: 0.4rem;
        align-items: center;
    }
    .a-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }
    .a-btn {
        padding: 0.45rem 1rem;
        border-radius: 0.6rem;
        border: none;
        font-weight: 800;
        font-size: 0.8rem;
        cursor: pointer;
        font-family: inherit;
        text-decoration: none;
        transition: all 0.15s;
        display: inline-flex;
        align-items: center;
    }
    .a-btn.approve { background: #16a34a; color: #fff; }
    .a-btn.approve:hover { background: #22c55e; }
    .a-btn.reject { background: rgba(239, 68, 68, 0.85); color: #fff; }
    .a-btn.reject:hover { background: #ef4444; }
    .a-btn.ghost {
        background: rgba(255, 255, 255, 0.08);
        color: #d1d5db;
        border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .a-btn.ghost:hover { color: #fff; }
    .approve-form,
    .reject-form {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        flex-wrap: wrap;
    }
    .duration-label {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.75rem;
        color: #9ca3af;
        font-weight: 700;
    }
    .duration-select {
        padding: 0.4rem 0.5rem;
        border-radius: 0.5rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #fff;
        font-size: 0.75rem;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
    }
    .reject-input {
        padding: 0.4rem 0.7rem;
        border-radius: 0.5rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #fff;
        font-size: 0.75rem;
        outline: none;
        font-family: inherit;
        width: 170px;
    }
    .reject-input:focus { border-color: rgba(239, 68, 68, 0.5); }
</style>
