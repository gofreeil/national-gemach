// Svelte action: גרירת קבצי תמונה אל תוך אלמנט (בדרך כלל ה-<label> של ההעלאה).
// בזמן הגרירה מתווסף `.drag-over` להדגשה, ובשחרור מסוננים קבצי תמונה בלבד.
//
// זהה למימוש ב"קהילה בשכונה" (src/lib/imageDrop.ts) — לשמור מסונכרן.
//
// שימוש:
//   <label use:imageDrop={handleFiles}> ... <input type="file" ... /> </label>

export function imageDrop(node: HTMLElement, onFiles: (files: File[]) => void) {
    let handler = onFiles;

    function over(e: DragEvent) {
        if (!e.dataTransfer) return;
        e.preventDefault();
        node.classList.add('drag-over');
    }
    function leave(e: DragEvent) {
        // ההדגשה נשארת כשעוברים מעל אלמנטים פנימיים
        if (e.relatedTarget instanceof Node && node.contains(e.relatedTarget)) return;
        node.classList.remove('drag-over');
    }
    function drop(e: DragEvent) {
        e.preventDefault();
        node.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
        if (files.length) handler(files);
    }

    node.addEventListener('dragover', over);
    node.addEventListener('dragleave', leave);
    node.addEventListener('drop', drop);

    return {
        update(next: (files: File[]) => void) {
            handler = next;
        },
        destroy() {
            node.removeEventListener('dragover', over);
            node.removeEventListener('dragleave', leave);
            node.removeEventListener('drop', drop);
        }
    };
}
