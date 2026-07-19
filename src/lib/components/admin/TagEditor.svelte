<script lang="ts">
    // עורך תגים — צ'יפים עם הוספה/הסרה. שולח את הערכים כשדה מוסתר
    // (מופרד בשורות חדשות) כדי שיישלח יחד עם הטופס.
    let {
        tags = $bindable([]),
        name = 'tags'
    }: { tags?: string[]; name?: string } = $props();

    let draft = $state('');

    function add() {
        const parts = draft.split(',').map(t => t.trim()).filter(Boolean);
        for (const p of parts) {
            if (!tags.includes(p)) tags = [...tags, p];
        }
        draft = '';
    }
    function remove(t: string) {
        tags = tags.filter(x => x !== t);
    }
    function onKey(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
        } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
            tags = tags.slice(0, -1);
        }
    }
</script>

<input type="hidden" {name} value={tags.join('\n')} />

<div class="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#1e293b] px-3 py-2.5 focus-within:border-purple-500">
    {#each tags as t (t)}
        <span class="inline-flex items-center gap-1 rounded-full bg-blue-900/50 border border-blue-500/30 px-2.5 py-1 text-sm text-blue-200">
            {t}
            <button
                type="button"
                onclick={() => remove(t)}
                class="text-blue-300 hover:text-white leading-none"
                aria-label={`הסר תג ${t}`}
            >×</button>
        </span>
    {/each}
    <input
        bind:value={draft}
        onkeydown={onKey}
        onblur={add}
        placeholder={tags.length ? 'עוד תג...' : 'הוסף תג ואנטר...'}
        class="flex-1 min-w-[8rem] bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm py-1"
    />
</div>
<p class="text-xs text-gray-500 mt-1">הפרד תגים באנטר או פסיק. התגים משמשים לחיפוש באתר.</p>
