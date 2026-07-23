<!--
  AdInterstitial.svelte — שכבת פרסומת-הביניים.
  ממותגת פעם אחת ב-+layout.svelte. מאזינה ל-store `interstitial` ומציגה
  את הפרסומת + מחוון "התוכן נטען…" עם ספירה-לאחור ופס התקדמות.
  כשהמתג כבוי (adsReady=false) ה-store אף פעם לא נפתח, והרכיב לא מצייר כלום.
-->
<script lang="ts">
    import { interstitial } from '$lib/adGate';

    // נעילת גלילת הרקע כל עוד הפרסומת פתוחה
    $effect(() => {
        if (typeof document === 'undefined') return;
        if (!$interstitial.open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    });

    const pct = $derived(Math.round($interstitial.progress * 100));
    const remainLabel = $derived(
        $interstitial.remaining <= 1 ? 'עוד שנייה' : `עוד ${$interstitial.remaining} שניות`
    );
</script>

{#if $interstitial.open && $interstitial.ad}
    {@const ad = $interstitial.ad!}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="ad-int-backdrop" role="dialog" aria-modal="true"
         aria-label="פרסומת — התוכן נטען" tabindex="-1" dir="rtl">
        <div class="ad-int-card">
            <span class="ad-int-badge">פרסומת</span>

            <!-- הקריאייטיב — קליק פותח את המפרסם בלשונית חדשה, בלי לעצור את הספירה -->
            <a href={ad.href} target="_blank" rel="noopener noreferrer"
               class="ad-int-creative bg-gradient-to-br {ad.color}">
                {#if ad.image}
                    <img class="ad-int-img" src={ad.image} alt={ad.title} draggable="false"
                         style={`${ad.imageHeight ? `max-height:${ad.imageHeight};` : ''}${ad.imageScale ? `transform:scale(${ad.imageScale});` : ''}`} />
                {/if}
                <h3 class="ad-int-title">{ad.title}</h3>
                <p class="ad-int-desc">{ad.description}</p>
                <span class="ad-int-cta">{ad.cta} ←</span>
            </a>

            <!-- מחוון טעינה + ספירה-לאחור: הסימן למשתמש שהתוכן נטען וכמה זמן נשאר -->
            <div class="ad-int-loader" aria-live="polite">
                <div class="ad-int-loader-row">
                    <span class="ad-int-spinner" aria-hidden="true"></span>
                    <span class="ad-int-loading">התוכן נטען…</span>
                    <span class="ad-int-count" dir="rtl">{remainLabel}</span>
                </div>
                <div class="ad-int-bar" aria-hidden="true">
                    <div class="ad-int-bar-fill" style="width:{pct}%"></div>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .ad-int-backdrop {
        position: fixed;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(6, 10, 24, 0.82);
        -webkit-backdrop-filter: blur(6px);
        backdrop-filter: blur(6px);
        animation: ad-int-fade 0.18s ease-out;
    }

    .ad-int-card {
        position: relative;
        width: 100%;
        max-width: 26rem;
        border-radius: 1.25rem;
        border: 1px solid #3b5794;
        background: linear-gradient(160deg, #16264d 0%, #0f1c3d 100%);
        box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        padding: 1.25rem;
    }

    .ad-int-badge {
        position: absolute;
        top: 0.75rem;
        inset-inline-end: 0.9rem;
        z-index: 1;
        border-radius: 999px;
        padding: 0.15rem 0.6rem;
        font-size: 0.65rem;
        font-weight: 900;
        letter-spacing: 0.03em;
        color: #3a2a06;
        background: linear-gradient(145deg, #f3d68b, #d4af37);
        box-shadow: 0 2px 6px -2px rgba(212, 175, 55, 0.8);
    }

    /* הקריאייטיב — כרטיס צבעוני (הגרדיאנט מגיע מ-ad.color) עם טקסט לבן */
    .ad-int-creative {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        text-align: center;
        border-radius: 1rem;
        padding: 1.5rem 1.25rem 1.25rem;
        color: #fff;
        text-decoration: none;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 12px 26px -18px rgba(0, 0, 0, 0.9);
        transition: transform 0.18s ease, filter 0.18s ease;
    }
    .ad-int-creative:hover { transform: translateY(-2px); filter: brightness(1.05); }

    .ad-int-img {
        max-height: 130px;
        max-width: 100%;
        object-fit: contain;
        border-radius: 0.75rem;
        -webkit-user-drag: none;
    }
    .ad-int-title { font-size: 1.25rem; font-weight: 900; line-height: 1.2; }
    .ad-int-desc { font-size: 0.9rem; line-height: 1.4; opacity: 0.95; }
    .ad-int-cta {
        margin-top: 0.35rem;
        display: inline-block;
        border-radius: 999px;
        padding: 0.45rem 1.1rem;
        font-size: 0.85rem;
        font-weight: 800;
        color: #fff;
        background: rgba(0, 0, 0, 0.28);
        border: 1px solid rgba(255, 255, 255, 0.35);
    }

    /* ═══ מחוון הטעינה ═══ */
    .ad-int-loader { margin-top: 1.1rem; }
    .ad-int-loader-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
        justify-content: center;
        margin-bottom: 0.6rem;
    }
    .ad-int-spinner {
        width: 1.05rem;
        height: 1.05rem;
        border-radius: 999px;
        border: 2px solid rgba(212, 175, 55, 0.28);
        border-top-color: #d4af37;
        animation: ad-int-spin 0.8s linear infinite;
        flex-shrink: 0;
    }
    .ad-int-loading { font-size: 0.9rem; font-weight: 700; color: #dbe4fb; }
    .ad-int-count {
        font-size: 0.9rem;
        font-weight: 900;
        color: #f0d089;
        font-variant-numeric: tabular-nums;
        margin-inline-start: auto;
    }

    .ad-int-bar {
        height: 0.5rem;
        border-radius: 999px;
        background: #0f1c3d;
        box-shadow: inset 0 0 0 1px #3b5794;
        overflow: hidden;
    }
    .ad-int-bar-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #d4af37, #7fa0e8);
        box-shadow: 0 0 10px -2px rgba(127, 160, 232, 0.7);
        /* התקדמות חלקה בין פריימי ה-rAF */
        transition: width 0.12s linear;
    }

    @keyframes ad-int-spin { to { transform: rotate(360deg); } }
    @keyframes ad-int-fade { from { opacity: 0; } to { opacity: 1; } }

    @media (prefers-reduced-motion: reduce) {
        .ad-int-backdrop { animation: none; }
        .ad-int-spinner { animation: none; border-top-color: rgba(212, 175, 55, 0.6); }
        .ad-int-bar-fill { transition: none; }
        .ad-int-creative:hover { transform: none; }
    }
</style>
