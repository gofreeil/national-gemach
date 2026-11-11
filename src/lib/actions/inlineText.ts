// עריכת טקסט במקום (contenteditable) כשדה מחרוזת: מגבלת אורך, בלי שורות חדשות,
// הדבקה כטקסט נקי, ו-Enter מסיים עריכה. משמש את כרטיס הנייד בבילדר.
export interface InlineTextOpts {
    value: string;
    set: (v: string) => void;
    max: number;
}

export function inlineText(node: HTMLElement, opts: InlineTextOpts) {
    let o = opts;
    const sync = () => {
        if (document.activeElement !== node && node.textContent !== o.value) node.textContent = o.value;
    };
    node.textContent = o.value;

    const onInput = () => {
        let t = (node.textContent ?? '').replace(/\n/g, ' ');
        if (t.length > o.max) {
            t = t.slice(0, o.max);
            node.textContent = t;
            const r = document.createRange();
            r.selectNodeContents(node);
            r.collapse(false);
            const s = getSelection();
            s?.removeAllRanges();
            s?.addRange(r);
        }
        o.set(t);
    };
    const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); node.blur(); }
    };
    const onPaste = (e: ClipboardEvent) => {
        e.preventDefault();
        document.execCommand('insertText', false, (e.clipboardData?.getData('text/plain') ?? '').replace(/\s+/g, ' '));
    };
    node.addEventListener('input', onInput);
    node.addEventListener('keydown', onKey);
    node.addEventListener('paste', onPaste);
    return {
        update(n: InlineTextOpts) { o = n; sync(); },
        destroy() {
            node.removeEventListener('input', onInput);
            node.removeEventListener('keydown', onKey);
            node.removeEventListener('paste', onPaste);
        },
    };
}
