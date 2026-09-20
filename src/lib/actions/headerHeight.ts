/**
 * מודד את גובה ההדר הדביק בזמן אמת וכותב אותו ל---header-height על ה-:root.
 * app.css משתמש בו ל-scroll-padding-top, כך שכל גלילה ליעד (#עוגן / scrollIntoView / :target)
 * נעצרת מתחת להדר עם רווח נשימה ולא מאחוריו — בכל breakpoint ובכל מצב של ההדר.
 * שימוש: <header use:headerHeight>
 */
export function headerHeight(node: HTMLElement) {
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--header-height', `${node.offsetHeight}px`);
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(node);
    return {
        destroy() {
            ro?.disconnect();
            root.style.removeProperty('--header-height');
        }
    };
}
