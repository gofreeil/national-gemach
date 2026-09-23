<script lang="ts">
    import { onMount } from 'svelte';
    import { enhance } from '$app/forms';
    import 'leaflet/dist/leaflet.css';
    import type { Map as LMap, Marker } from 'leaflet';

    let { data, form } = $props();

    const f = $derived(form as { saved?: boolean; error?: string; findError?: string; found?: { lat: number; lng: number } } | null | undefined);

    let mapEl: HTMLDivElement | undefined = $state();
    let map: LMap | undefined;
    let marker: Marker | undefined;
    // הנקודה שתישמר; null = עוד לא נדקר (גמ"ח שלא אותר)
    let point = $state<{ lat: number; lng: number } | null>(null);
    let moved = $state(false);
    let busy = $state(false);

    onMount(() => {
        if (data.state !== 'ok') return;
        let cancelled = false;
        (async () => {
            const L = (await import('leaflet')).default;
            if (cancelled || !mapEl) return;
            const c = data.center ?? { lat: 31.6, lng: 34.95 };
            map = L.map(mapEl, { zoomControl: true }).setView([c.lat, c.lng], data.placed ? 17 : data.center ? 14 : 8);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap',
            }).addTo(map);
            // divIcon ולא תמונות ברירת המחדל של Leaflet — אלה נשברות אחרי bundling
            const icon = L.divIcon({ className: 'ng-pin', html: '📍', iconSize: [36, 36], iconAnchor: [18, 34] });
            const place = (lat: number, lng: number) => {
                point = { lat, lng };
                if (!marker) {
                    marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map!);
                    marker.on('dragend', () => {
                        const p = marker!.getLatLng();
                        point = { lat: p.lat, lng: p.lng };
                        moved = true;
                    });
                } else {
                    marker.setLatLng([lat, lng]);
                }
            };
            if (data.placed && data.center) place(data.center.lat, data.center.lng);
            map.on('click', (e) => {
                place(e.latlng.lat, e.latlng.lng);
                moved = true;
            });
            placeFound = (lat, lng) => {
                place(lat, lng);
                moved = true;
                map!.setView([lat, lng], 17);
            };
        })();
        return () => {
            cancelled = true;
            map?.remove();
        };
    });

    let placeFound: ((lat: number, lng: number) => void) | undefined;
    $effect(() => {
        if (f?.found) placeFound?.(f.found.lat, f.found.lng);
    });

    const g = $derived(data.state === 'ok' ? data.gemach : null);
</script>

<svelte:head>
    <title>מיקום הגמ"ח במפה – הגמ"ח הארצי</title>
    <meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-8">
    <div class="rounded-2xl border border-[#3b5794] bg-[#16264d] p-5 space-y-4">
        {#if data.state !== 'ok' || !g}
            <h1 class="text-xl font-black text-white">הקישור אינו תקין</h1>
            <p class="text-sm text-gray-300">ייתכן שהוא נקטע בהעתקה. נסו לפתוח אותו ישירות מההודעה.</p>
        {:else if f?.saved}
            <div class="text-center space-y-2 py-6">
                <div class="text-5xl">🎉</div>
                <h1 class="text-xl font-black text-white">תודה! המיקום נשמר</h1>
                <p class="text-sm text-gray-300">"{g.name}" מופיע עכשיו במקום הנכון במפה של "קהילה בשכונה" ובאתר הגמ"חים הארצי.</p>
                <a href="/gemach/{g.id}" class="inline-block mt-3 text-sm font-bold text-blue-300 hover:underline">לכרטיס הגמ"ח</a>
            </div>
        {:else}
            <div class="flex items-center gap-3">
                <span class="text-3xl" aria-hidden="true">{g.icon}</span>
                <div class="min-w-0">
                    <h1 class="text-lg font-black text-white truncate">{g.name}</h1>
                    <p class="text-xs text-gray-300">{[g.address, g.neighborhood, g.city].filter(Boolean).join(', ') || 'אין כתובת בכרטיס'}</p>
                </div>
            </div>

            <p class="text-sm text-gray-200 leading-relaxed">
                {#if data.confirmed}
                    המיקום כבר אושר. אפשר לדייק אותו שוב בכל עת — גררו את הסיכה או געו במקום הנכון.
                {:else if data.placed}
                    הצבנו את הגמ"ח על המפה{data.approx ? ' במיקום משוער' : ''}. <b class="text-white">האם הסיכה במקום הנכון?</b>
                    אם לא — גררו אותה או געו במקום הנכון במפה, ושמרו.
                {:else}
                    לא הצלחנו לאתר את הכתובת. <b class="text-white">געו במקום הגמ"ח במפה</b> (או חפשו כתובת), ושמרו.
                {/if}
            </p>

            <form method="POST" action="?/find" class="flex gap-2"
                use:enhance={() => { busy = true; return async ({ update }) => { await update({ reset: false }); busy = false; }; }}>
                <input name="q" placeholder="חיפוש כתובת, למשל: הרצל 5, {g.city || 'ירושלים'}"
                    defaultValue={[g.address, g.city].filter(Boolean).join(', ')}
                    class="flex-1 min-w-0 rounded-xl border border-[#3b5794] bg-[#1e293b] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
                <button disabled={busy} class="rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">🔍 חפש</button>
            </form>
            {#if f?.findError}<p class="text-xs font-bold text-amber-300">{f.findError}</p>{/if}

            <div bind:this={mapEl} class="h-[55vh] min-h-[320px] w-full rounded-xl overflow-hidden border border-[#3b5794] bg-[#1e293b]"></div>
            {#if g.hideAddress}
                <p class="text-xs text-amber-200">ביקשתם להסתיר את הכתובת — סיכה מדויקת במפה חושפת אותה. אפשר לסמן נקודה כללית בשכונה.</p>
            {/if}

            {#if f?.error}<p class="text-sm font-bold text-red-300">⚠️ {f.error}</p>{/if}

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label class="block">
                    <span class="block text-[11px] text-gray-300 mb-0.5">רחוב ומספר</span>
                    <input form="geo-save" name="address" defaultValue={g.address} oninput={() => (moved = moved || !!point)}
                        class="w-full rounded-lg border border-[#3b5794] bg-[#1e293b] px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                </label>
                <label class="block">
                    <span class="block text-[11px] text-gray-300 mb-0.5">שכונה</span>
                    <input form="geo-save" name="neighborhood" defaultValue={g.neighborhood} oninput={() => (moved = moved || !!point)}
                        class="w-full rounded-lg border border-[#3b5794] bg-[#1e293b] px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                </label>
            </div>

            <div class="flex flex-wrap gap-2 justify-end">
                {#if data.placed && !moved}
                    <form method="POST" action="?/confirm" use:enhance={() => { busy = true; return async ({ update }) => { await update(); busy = false; }; }}>
                        <button disabled={busy} class="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">✓ המיקום נכון</button>
                    </form>
                {/if}
                <form id="geo-save" method="POST" action="?/save" use:enhance={() => { busy = true; return async ({ update }) => { await update(); busy = false; }; }}>
                    <input type="hidden" name="lat" value={point?.lat ?? ''} />
                    <input type="hidden" name="lng" value={point?.lng ?? ''} />
                    <button disabled={busy || !point || (data.placed && !moved)}
                        class="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40">
                        📍 שמור מיקום {moved ? 'חדש' : ''}
                    </button>
                </form>
            </div>
        {/if}
    </div>
</div>

<style>
    :global(.ng-pin) {
        font-size: 32px;
        line-height: 36px;
        text-align: center;
        background: none;
        border: none;
        filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));
    }
</style>
