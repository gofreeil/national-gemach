<script lang="ts">
    // ============================================================
    // MobileAdCard — כרטיס הפרסומת בנייד, מקור אחד לשני מקומות:
    //   • הפופ-אפ האמיתי באתר (MobileAdPopup) - קריאה בלבד
    //   • התצוגה בשלב 7 בבילדר - עריכה במקום + גרירה (editable)
    // כל המידות ב-cqw (אחוזי רוחב הכרטיס), כך שהכרטיס נראה אותו דבר
    // ברוחב 240px בבילדר וברוחב 384px באתר, וההזזה נשמרת באחוזים.
    // ============================================================
    import { adImgFit, type AdImageFit } from '$lib/adImageFit';
    import { bandCorners, logoBgStyle, MOB_OFFSET_MIN, MOB_OFFSET_MAX, type AdStyle } from '$lib/adStyle';
    import { inlineText } from '$lib/actions/inlineText';
    import { adGradientPaint } from '$lib/adGradient';

    type Key = 'title' | 'sub' | 'cta';

    let {
        title, subtitle, cta, image, imageFit, logo = '', gradient = '', st,
        showCta = true, countdown = 5, placeholder = '',
        editable = false, onedit, onmove, onclose,
        href, target, rel, onctaclick,
    }: {
        title: string; subtitle: string; cta: string; image: string; imageFit: AdImageFit;
        logo?: string; gradient?: string; st: AdStyle;
        showCta?: boolean; countdown?: number; placeholder?: string;
        editable?: boolean;
        onedit?: (field: Key, value: string) => void;
        onmove?: (key: Key, x: number, y: number) => void;
        onclose?: () => void;
        href?: string; target?: string; rel?: string; onctaclick?: () => void;
    } = $props();

    let cardEl: HTMLElement | undefined = $state();
    let corners = $derived(bandCorners(st.bandHeight));
    // gradient = מחרוזת CSS (כמו בשאר האתר); מצויר באותן מחלקות/style של הטור
    let bandPaint = $derived(adGradientPaint(gradient, 'br'));
    let stripPaint = $derived(adGradientPaint(gradient, 'r'));

    const clamp = (v: number) => Math.min(MOB_OFFSET_MAX, Math.max(MOB_OFFSET_MIN, v));
    function pos(k: Key): [number, number] {
        return k === 'title' ? [st.mobTitleX, st.mobTitleY]
            : k === 'sub' ? [st.mobSubX, st.mobSubY]
            : [st.mobCtaX, st.mobCtaY];
    }

    // גרירה: תנועה קטנה מ-4px נחשבת לחיצה ופותחת עריכה; מעבר לזה - הזזה.
    function movable(node: HTMLElement, key: Key) {
        let id = -1, sx = 0, sy = 0, bx = 0, by = 0, moved = false;
        const editingInside = () => {
            const a = document.activeElement as HTMLElement | null;
            return !!a && node.contains(a) && a.isContentEditable;
        };
        const down = (e: PointerEvent) => {
            if (!editable || editingInside() || e.button > 0) return;
            e.preventDefault();
            id = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false;
            [bx, by] = pos(key);
            node.setPointerCapture(id);
        };
        const move = (e: PointerEvent) => {
            if (e.pointerId !== id) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (!moved && Math.hypot(dx, dy) < 4) return;
            moved = true;
            const w = cardEl?.getBoundingClientRect().width || 1;
            onmove?.(key, clamp(bx + (dx / w) * 100), clamp(by + (dy / w) * 100));
        };
        const up = (e: PointerEvent) => {
            if (e.pointerId !== id) return;
            id = -1;
            if (moved) return;
            const t = node.querySelector<HTMLElement>('[contenteditable]');
            if (!t) return;
            t.focus();
            const r = document.createRange();
            r.selectNodeContents(t); r.collapse(false);
            const s = getSelection(); s?.removeAllRanges(); s?.addRange(r);
        };
        node.addEventListener('pointerdown', down);
        node.addEventListener('pointermove', move);
        node.addEventListener('pointerup', up);
        node.addEventListener('pointercancel', up);
        return {
            destroy() {
                node.removeEventListener('pointerdown', down);
                node.removeEventListener('pointermove', move);
                node.removeEventListener('pointerup', up);
                node.removeEventListener('pointercancel', up);
            },
        };
    }
</script>

{#snippet field(key: Key, value: string, max: number, cls: string, tag: 'h3' | 'p' | 'span')}
    {#if editable}
        <svelte:element this={tag} class="{cls} mc-edit" contenteditable="plaintext-only" role="textbox" tabindex="0"
            use:inlineText={{ value, set: (v: string) => onedit?.(key, v), max }}></svelte:element>
    {:else}
        <svelte:element this={tag} class={cls}>{value}</svelte:element>
    {/if}
{/snippet}

<div class="mc" class:editable bind:this={cardEl} dir="rtl"
     style="--tfs:{st.titleFontSize};--sub:{st.subFontSize};--sublh:{st.subLineHeight};--suba:{st.subAlign};--dl:{corners.left}%;--dr:{corners.right}%;">
    <div class="mc-head">
        {#if logo}
            <img src={logo} alt="" class="mc-logo" class:circle={st.logoShape === 'circle'} style={logoBgStyle(st.logoBg)} />
        {/if}
        <div class="mc-mv mc-grow" use:movable={'title'} style="--mx:{st.mobTitleX}cqw;--my:{st.mobTitleY}cqw;">
            <div style="color:{st.titleColor}" class="mc-title-box">
                {@render field('title', title, 40, 'mc-title', 'h3')}
            </div>
        </div>
    </div>

    <div class="mc-img">
        {#if image}
            <img src={image} alt={title} use:adImgFit={imageFit} />
        {:else}
            <div class="mc-ph">{placeholder}</div>
        {/if}
        <div class="mc-diag {bandPaint.cls}" style={bandPaint.style}></div>
        <div class="mc-subwrap">
            <div class="mc-mv" use:movable={'sub'} style="--mx:{st.mobSubX}cqw;--my:{st.mobSubY}cqw;">
                {@render field('sub', subtitle, 70, 'mc-sub', 'p')}
            </div>
        </div>
        {#if onclose}
            <button type="button" class="mc-close" onclick={onclose} aria-label="✕">{countdown}</button>
        {:else}
            <div class="mc-close">{countdown}</div>
        {/if}
    </div>

    {#if showCta}
        <div class="mc-body">
            <div class="mc-mv" use:movable={'cta'} style="--mx:{st.mobCtaX}cqw;--my:{st.mobCtaY}cqw;">
                {#if editable || !href}
                    <div class="mc-cta {stripPaint.cls}" style={stripPaint.style}>
                        <span>←</span>
                        {@render field('cta', cta, 40, 'mc-cta-text', 'span')}
                    </div>
                {:else}
                    <a {href} {target} {rel} onclick={onctaclick} class="mc-cta {stripPaint.cls}" style={stripPaint.style}>
                        <span>←</span><span class="mc-cta-text">{cta}</span>
                    </a>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .mc {
        container-type: inline-size;
        position: relative; width: 100%; background: #0f172a; color: #fff;
        border-radius: 1rem; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.5);
    }
    .mc-head {
        display: flex; align-items: center; gap: 2.5cqw; padding: 3.5cqw 3.75cqw;
        background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
        border-bottom: 2px solid rgba(255,255,255,0.08);
    }
    .mc-logo {
        width: 18cqw; height: 18cqw; border-radius: 3.3cqw; background: #fff; padding: 1.6cqw;
        object-fit: contain; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    }
    .mc-logo.circle { border-radius: 50%; }
    .mc-mv { position: relative; transform: translate(var(--mx, 0cqw), var(--my, 0cqw)); }
    .mc-grow { flex: 1; min-width: 0; }
    .mc-title {
        margin: 0; text-align: center; font-weight: 900; line-height: 1.15; letter-spacing: 0.005em;
        font-size: calc(var(--tfs) * 9cqw);
        text-shadow: 0 2px 10px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.6);
        overflow-wrap: anywhere;
    }
    .mc-img { position: relative; aspect-ratio: 384 / 176; overflow: hidden; }
    .mc-img > img { width: 100%; height: 100%; object-fit: cover; }
    .mc-ph {
        width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
        background: rgba(255,255,255,0.03); color: rgb(107,114,128); font-weight: 700; font-size: 5cqw;
    }
    .mc-diag {
        position: absolute; inset: 0; opacity: 0.96; pointer-events: none;
        clip-path: polygon(0 var(--dl, 88%), 100% var(--dr, 78%), 100% 100%, 0 100%);
    }
    .mc-diag::after {
        content: ""; position: absolute; inset: 0;
        background: linear-gradient(125deg, transparent 30%, rgba(255,255,255,0.18) 45%, transparent 60%);
    }
    .mc-subwrap {
        position: absolute; left: 0; right: 0; bottom: 0; z-index: 4;
        padding: 2.7cqw 3.5cqw 5.2cqw; text-align: var(--suba, right);
    }
    .mc-sub {
        margin: 0; color: rgba(255,255,255,0.95); font-weight: 600;
        font-size: calc(var(--sub) * 7.6cqw); line-height: var(--sublh);
        text-shadow: 0 1px 4px rgba(0,0,0,0.6); overflow-wrap: anywhere;
    }
    .mc-sub::before {
        content: ''; float: left; width: 32%; height: 1.4em;
        shape-outside: polygon(0 0, 100% 0, 0 100%);
    }
    .mc-close {
        position: absolute; top: 3.3cqw; left: 3.3cqw; z-index: 6;
        width: clamp(28px, 9cqw, 36px); height: clamp(28px, 9cqw, 36px); border-radius: 9999px;
        background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.25);
        color: #fff; font-size: 12px; font-weight: 700; cursor: default;
        display: flex; align-items: center; justify-content: center;
    }
    button.mc-close { cursor: pointer; }
    .mc-body { padding: 3.5cqw; }
    .mc-cta {
        display: flex; justify-content: center; align-items: center; gap: 1.2cqw; width: 100%;
        padding: 2.5cqw; border-radius: 2.5cqw; color: #fff; font-weight: 700;
        font-size: 5.2cqw; text-align: center; text-decoration: none; box-sizing: border-box;
    }

    /* מצב עריכה: גרירה להזזה, לחיצה לכתיבה */
    .editable .mc-mv { cursor: grab; touch-action: none; user-select: none; }
    .editable .mc-mv:hover { outline: 1px dashed rgba(251,191,36,0.7); outline-offset: 2px; border-radius: 4px; }
    .editable .mc-mv:active { cursor: grabbing; }
    .mc-edit { cursor: text; outline: none; min-width: 1ch; user-select: text; }
    .mc-edit:focus { outline: 2px solid #fbbf24; outline-offset: 2px; border-radius: 4px; }
</style>
