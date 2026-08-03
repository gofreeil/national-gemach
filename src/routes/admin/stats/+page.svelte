<script lang="ts">
    import VisitorStatsCard from '$lib/components/VisitorStatsCard.svelte';
    let { data } = $props();
</script>

<svelte:head><title>סטטיסטיקת כניסות – פאנל ניהול</title></svelte:head>

<VisitorStatsCard months={data.months} updatedAt={data.updatedAt} />
