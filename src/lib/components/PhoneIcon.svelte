<!--
  PhoneIcon.svelte — אייקון שפורפרת ירוק (SVG) במקום האימוג'י 📞,
  שנצבע בורדו ע"י מערכת ההפעלה ואי אפשר לשנות לו צבע.
  הצבע נקבע ע"י currentColor — יורש את צבע הטקסט של ההורה,
  או מקבל צבע מפורש דרך class.
-->
<script lang="ts">
    let { class: cls = 'h-4 w-4' }: { class?: string } = $props();
</script>

<svg class="{cls} inline-block flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.32.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"/>
</svg>
