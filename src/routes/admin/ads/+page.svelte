<script lang="ts">
    import { enhance } from '$app/forms';

    // מסך אישור פרסומות לאדמין — ממתינות / מאושרות / נדחות.
    // פורט מקבוצות רכישה; עטוף בקופסה כהה כי הרקע באתר ורוד בהיר.
    let { data, form } = $props();

    let tab = $state<'pending' | 'approved' | 'rejected'>('pending');

    let pending  = $derived(data.ads.filter((a: any) => a.status === 'pending'));
    let approved = $derived(data.ads.filter((a: any) => a.status === 'approved'));
    let rejected = $derived(data.ads.filter((a: any) => a.status === 'rejected'));
    let shown    = $derived(tab === 'pending' ? pending : tab === 'approved' ? approved : rejected);

    function fmtDate(iso: string): string {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
</script>

<svelte:head>
    <title>אישור פרסומות | ניהול</title>
</svelte:head>

<div class="ads-admin" dir="rtl">
    <h1>📢 אישור פרסומות</h1>

    {#if data.backendUnavailable}
        <div class="admin-alert error">שרת התוכן אינו זמין כרגע — נסו לרענן בעוד רגע.</div>
    {/if}
    {#if form?.message}
        <div class="admin-alert ok">{form.message}</div>
    {/if}
    {#if form?.error}
        <div class="admin-alert error">{form.error}</div>
    {/if}

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

    <div class="ads-list">
        {#each shown as ad (ad.id)}
            <div class="ad-card">
                <div class="ad-card-img">
                    {#if ad.mainImage}
                        <img src={ad.mainImage} alt={ad.title} />
                    {:else}
                        <div class="no-img">אין תמונה</div>
                    {/if}
                </div>
                <div class="ad-card-body">
                    <div class="ad-card-head">
                        <h2>{ad.title}</h2>
                        <span class="status-pill {ad.status}">
                            {ad.status === 'pending' ? 'ממתינה' : ad.status === 'approved' ? 'מאושרת' : 'נדחתה'}
                        </span>
                        {#if ad.payment === 'code'}
                            <span class="status-pill approved">💳 קוד תנועה — כמו שולם</span>
                        {:else}
                            <span class="status-pill pending">⌛ תשלום לתיאום</span>
                        {/if}
                    </div>
                    <p class="ad-sub">{ad.subtitle}</p>
                    {#if ad.hoverText}<p class="ad-hover">ריחוף: {ad.hoverText}</p>{/if}
                    <p class="ad-meta">
                        {#if ad.submittedBy?.email}👤 {ad.submittedBy.email} · {/if}
                        📅 נשלחה: {fmtDate(ad.submittedAt)}
                        {#if ad.status === 'approved' && ad.expiresAt} · ⏳ תוקף עד: {fmtDate(ad.expiresAt)}{/if}
                    </p>
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

                    <div class="ad-actions">
                        {#if ad.status === 'approved'}
                            <a href="/ads/{ad.id}" target="_blank" class="a-btn ghost">פתח את דף הנחיתה ↗</a>
                        {/if}
                        {#if ad.status !== 'approved'}
                            <form method="POST" action="?/approve" use:enhance class="approve-form">
                                <input type="hidden" name="id" value={ad.id} />
                                <label class="duration-label">
                                    שולם עבור:
                                    <!-- ברירת המחדל = התקופה שהמפרסם בחר בשליחה -->
                                    <select name="durationDays" class="duration-select">
                                        <option value="30" selected={ad.requestedDurationDays !== 180}>חודש</option>
                                        <option value="180" selected={ad.requestedDurationDays === 180}>חצי שנה</option>
                                    </select>
                                </label>
                                <button type="submit" class="a-btn approve">✅ אשר ופרסם</button>
                            </form>
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

    .ads-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .ad-card {
        display: flex;
        gap: 1rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        padding: 1rem;
    }
    @media (max-width: 640px) {
        .ad-card { flex-direction: column; }
    }
    .ad-card-img {
        width: 120px;
        flex-shrink: 0;
        border-radius: 0.6rem;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.3);
    }
    @media (max-width: 640px) {
        .ad-card-img { width: 100%; max-height: 180px; }
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
