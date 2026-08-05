<script lang="ts">
    import { catZoom, type Gemach, type CategoryDef } from '$lib/gemachData';
    import { isExtremeAspect, displayedImageFit, fitStyle } from '$lib/imageFit';

    let {
        gemach,
        categories = [],
        banner = false
    }: {
        gemach: Pick<Gemach, 'category' | 'icon' | 'image' | 'gallery' | 'imageFit'>;
        categories?: CategoryDef[];
        /** תצוגת באנר — התמונה ממלאת את כל המשבצת שההורה קובע (כרטיס גמ"ח) */
        banner?: boolean;
    } = $props();

    // קישור שבור לא משאיר ריבוע ריק — נופלים חזרה לאימוג'י של הפריט/הקטגוריה
    let broken = $state(false);

    const catDef = $derived(categories.find(c => c.key === gemach.category));

    // בבאנר התמונה היא עיקר הכרטיס, ולכן יש שרשרת נפילה ארוכה יותר:
    // לוגו → תמונה ראשונה בגלריה → תמונת-הנושא של הקטגוריה. כך בכל באנר
    // יש תמונה אמיתית ולא אימוג'י בודד על רקע ריק.
    const src = $derived(
        broken
            ? undefined
            : gemach.image || (banner ? (gemach.gallery?.[0] || catDef?.image) : undefined)
    );
    const fallbackIcon = $derived(gemach.icon || catDef?.icon || '📦');

    // מיקום-ותקריב שנבחר ידנית בטופס לתמונה המוצגת (לתמונת קטגוריה אין)
    const fit = $derived(displayedImageFit(gemach, src));

    // כשהבאנר נופל לתמונת-הנושא של הקטגוריה — אותו זום-פנימה כמו באריחי
    // דף הבית חותך את מסגרת הקרם האפויה בקצוות (המיכל בכרטיס overflow-hidden).
    // תמונות אמיתיות של הגמ"ח לא נוגעים בהן.
    const zoom = $derived(src && src === catDef?.image ? catZoom(gemach.category) : 1);

    // תמונה רחבה או גבוהה במיוחד בלי מיקום ידני — object-cover היה משאיר
    // ממנה רצועה צרה במשבצת הבאנר הריבועית-בקירוב. במקום זה היא מוצגת
    // בשלמותה (contain) על רקע המשבצת הכהה. נמדד אחרי הטעינה (naturalWidth).
    // בחירה ידנית של המעלה גוברת על הניחוש האוטומטי — לשני הכיוונים.
    let el = $state<HTMLImageElement | null>(null);
    let autoContain = $state(false);
    const measure = () => {
        if (banner && src && el?.complete) autoContain = isExtremeAspect(el);
    };
    $effect(measure);

    const contain = $derived(fit ? fit.contain === true : autoContain);

    // הסגנון היחיד של התמונה: מיקום ידני גובר; אחריו זום תמונת-הקטגוריה.
    // בבאנר התקריב (transform) נחתך ע"י המיכל; באווטאר הקטן, שאין לו מיכל
    // עוטף, transform היה מנפח את האלמנט עצמו — לכן שם רק object-position.
    const imgStyle = $derived.by(() => {
        if (fit) return banner ? fitStyle(fit) : `object-position:${fit.x}% ${fit.y}%`;
        if (zoom !== 1 && !contain) return `transform:scale(${zoom})`;
        return undefined;
    });
</script>

{#if src}
    <img
        bind:this={el}
        {src}
        alt=""
        loading="lazy"
        decoding="async"
        onload={measure}
        onerror={() => (broken = true)}
        style={imgStyle}
        class={banner
            ? `w-full h-full ${contain ? 'object-contain' : 'object-cover'}`
            : `w-11 h-11 rounded-xl ${fit?.contain ? 'object-contain' : 'object-cover'} border border-[#3b5794] bg-[#0f1c3d]`}
    />
{:else if gemach.category === 'judaism'}
    <img src="/icons/menorah.svg" alt="" class={banner ? 'w-20 h-20 object-contain' : 'w-9 h-9 object-contain'} />
{:else}
    <span class={banner ? 'text-6xl leading-none' : 'text-3xl leading-none'}>{fallbackIcon}</span>
{/if}
