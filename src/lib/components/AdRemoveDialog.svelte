<script lang="ts">
    // ============================================================
    // AdRemoveDialog - חלון האישור של "מחק" במסך ניהול הפרסומות: מציג את
    // כרטיס הפרסומת שנמחקת (כמו בטור, מוקטן), כדי לראות בדיוק מה מוחקים
    // לפני ההעברה לאשפה. מקור: קהילה בשכונה (admin/ads-review).
    // ============================================================
    import type { ComponentProps } from 'svelte';
    import AdCardPreview from './AdCardPreview.svelte';

    let { ad, onremove, onclose }: {
        ad: ComponentProps<typeof AdCardPreview>['ad'];
        onremove: () => void;
        onclose: () => void;
    } = $props();
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onclose(); }} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="rm-backdrop" role="presentation" onclick={onclose}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="rm-dialog" dir="rtl" role="dialog" aria-modal="true" aria-label="מחיקת פרסומת" tabindex="-1"
         onclick={(e) => e.stopPropagation()}>
        <!-- הכרטיס ברוחב 144px מוקטן ל-80px; ה-transform לא משנה את מידות
             הפריסה שהכרטיס מודד, ולכן העטיפה עצמה בגודל המוקטן -->
        <div class="rm-card">
            <div class="rm-card-scale">
                <AdCardPreview {ad} />
            </div>
        </div>
        <div class="rm-body">
            <p class="rm-title">🗑 להעביר את "{ad.title}" לאשפה?</p>
            <p class="rm-note">אפשר לשחזר אותה משם.</p>
            <button type="button" class="rm-btn rm-danger" onclick={onremove}>🗑 העבר לאשפה</button>
            <button type="button" class="rm-btn rm-ghost" onclick={onclose}>✕ סגור</button>
        </div>
    </div>
</div>

<style>
    .rm-backdrop {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
    }
    .rm-dialog {
        width: 100%;
        max-width: 380px;
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 12px;
        border-radius: 16px;
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        text-align: right;
        color: #fff;
    }
    .rm-card {
        flex-shrink: 0;
        width: 80px;
        height: 270px;
        overflow: hidden;
        border-radius: 8px;
    }
    .rm-card-scale {
        transform: scale(0.555);
        transform-origin: top right;
    }
    .rm-body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .rm-title {
        margin: 0;
        font-size: 14px;
        font-weight: 900;
        color: #fff;
        overflow-wrap: anywhere;
    }
    .rm-note {
        margin: 0;
        font-size: 12px;
        color: #d1d5db;
    }
    .rm-btn {
        width: 100%;
        padding: 8px 12px;
        border-radius: 12px;
        font: inherit;
        font-size: 14px;
        font-weight: 900;
        white-space: nowrap;
        cursor: pointer;
    }
    .rm-danger {
        background: #dc2626;
        border: 1px solid #dc2626;
        color: #fff;
    }
    .rm-danger:hover { background: #ef4444; }
    .rm-ghost {
        padding: 6px 12px;
        font-size: 12px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #e5e7eb;
    }
    .rm-ghost:hover { background: rgba(255, 255, 255, 0.2); }
</style>
