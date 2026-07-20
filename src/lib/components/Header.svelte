<script lang="ts">
    import { locale } from 'svelte-i18n';
    import { onMount } from 'svelte';

    // משתמש מחובר (מגיע מ-+layout.server דרך +layout.svelte); null = אנונימי
    let {
        user = null,
        adminRole = null
    }: {
        user?: { name: string; email: string } | null;
        adminRole?: 'super_admin' | 'admin' | null;
    } = $props();

    let languages = [
        { name: "עברית", code: "he", flag: "il" },
        { name: "English", code: "en", flag: "us" },
        { name: "русский", code: "ru", flag: "ru" },
    ];

    let showLangDropdown = $state(false);

    function changeLang(code: string) {
        locale.set(code);
        try { localStorage.setItem('lang', code); } catch {}
        showLangDropdown = false;
    }

    onMount(() => {
        try {
            const saved = localStorage.getItem('lang');
            if (saved) locale.set(saved);
        } catch {}
        document.addEventListener('click', (e) => {
            if (!(e.target as HTMLElement).closest('.lang-dropdown')) {
                showLangDropdown = false;
            }
        });
    });
</script>

<header
    class="sticky top-0 z-50 border-b-2 md:border-b-4 border-blue-600 shadow-lg backdrop-blur-lg"
    style="background: linear-gradient(to bottom, rgba(135,75,144,0.92) 0%, rgba(135,75,144,0.88) 66%, rgba(135,75,144,0.1) 100%);"
>
    <div class="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">

        <!-- Mobile -->
        <div class="md:hidden flex items-center justify-between h-[72px]">
            <a href="/" class="flex items-center gap-3 min-w-0 flex-1">
                <div class="h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden bg-white border-[3px] border-[#D4AF37] shadow-[0_0_0_1px_rgba(212,175,55,0.25)]">
                    <img
                        src="/images/לוגו-הגמח-הארצי.png"
                        alt="הגמח הארצי לוגו"
                        class="w-full h-full object-contain"
                    />
                </div>
                <div class="min-w-0">
                    <h1 class="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-lg font-black text-transparent leading-tight">
                        הגמ"ח הארצי
                    </h1>
                    <p class="text-xs text-gray-400 leading-tight">כל הגמחים בארץ בכף ידך</p>
                </div>
            </a>
            <div class="flex items-center gap-2">
                <!-- פאנל ניהול (מורשים בלבד) -->
                {#if adminRole}
                    <a
                        href="/admin"
                        class="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white transition-colors"
                        aria-label="פאנל ניהול"
                        title="פאנל ניהול"
                    >
                        <span aria-hidden="true">🛠️</span>
                    </a>
                {/if}
                <!-- התחברות / אזור אישי -->
                {#if user}
                    <a
                        href="/profile"
                        class="flex items-center justify-center w-9 h-9 rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] transition-colors"
                        aria-label="האזור האישי שלי"
                        title={user.name || user.email}
                    >
                        <span class="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-pink-600 text-xs" aria-hidden="true">👤</span>
                    </a>
                {:else}
                    <a
                        href="/login?redirect=/profile"
                        class="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 text-white transition-colors"
                        aria-label="התחברות / אזור אישי"
                        title="התחברות"
                    >
                        <span aria-hidden="true">🕊️</span>
                    </a>
                {/if}
                <!-- Language -->
                <div class="relative lang-dropdown">
                    <button
                        onclick={() => showLangDropdown = !showLangDropdown}
                        class="flex items-center justify-center w-9 h-9 rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] transition-colors"
                        aria-label="בחר שפה"
                    >
                        <span class="fi fi-{languages.find(l => l.code === $locale || $locale?.startsWith(l.code))?.flag || 'il'}" style="font-size:1.3rem"></span>
                    </button>
                    {#if showLangDropdown}
                        <div class="absolute left-0 mt-2 w-36 rounded-lg bg-[#1c2f5a] border border-[#3b5794] shadow-xl z-50">
                            {#each languages as lang}
                                <button
                                    class="flex w-full items-center gap-3 px-3 py-2 text-white hover:bg-[#213569] transition-colors"
                                    onclick={() => changeLang(lang.code)}
                                >
                                    <span class="fi fi-{lang.flag}" style="font-size:1.1rem"></span>
                                    <span class="text-sm">{lang.name}</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Desktop -->
        <div class="hidden md:flex items-center justify-between py-4">
            <!-- Logo + Title -->
            <a href="/" class="brand-link flex items-center gap-4">
                <div class="brand-logo-frame h-20 w-20 rounded-xl overflow-hidden bg-white shadow-lg border-[3px] border-[#D4AF37] shadow-[0_0_0_1px_rgba(212,175,55,0.3),0_10px_15px_-3px_rgba(0,0,0,0.1)]">
                    <img
                        src="/images/לוגו-הגמח-הארצי.png"
                        alt="הגמח הארצי לוגו"
                        class="brand-logo w-full h-full object-contain"
                    />
                </div>
                <div class="brand-text">
                    <h1 class="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-3xl font-black text-transparent">
                        הגמ"ח הארצי
                    </h1>
                    <p class="text-gray-300 text-base font-bold">
                        כל הגמחים בארץ בכף ידך
                    </p>
                </div>
            </a>

            <!-- Right side controls -->
            <div class="flex items-center gap-3">
                <!-- פאנל ניהול (מורשים בלבד) -->
                {#if adminRole}
                    <a
                        href="/admin"
                        class="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-3 py-2 text-sm font-bold text-white transition-all shadow-lg"
                        title={adminRole === 'super_admin' ? 'פאנל ניהול (סופר-אדמין)' : 'פאנל ניהול'}
                    >
                        <span aria-hidden="true">🛠️</span>
                        <span class="hidden sm:inline">ניהול</span>
                        {#if adminRole === 'super_admin'}<span class="text-amber-300" aria-hidden="true">★</span>{/if}
                    </a>
                {/if}

                <!-- התחברות / אזור אישי -->
                {#if user}
                    <a
                        href="/profile"
                        class="flex items-center gap-2 rounded-lg bg-[#1c2f5a] hover:bg-[#2a4379] px-3 py-2 text-sm font-bold text-white transition-colors"
                        title="האזור האישי שלי"
                    >
                        <span class="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-pink-600 text-xs">👤</span>
                        <span class="hidden sm:inline max-w-[120px] truncate">{user.name || user.email}</span>
                    </a>
                {:else}
                    <a
                        href="/login?redirect=/profile"
                        class="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 px-3 py-2 text-sm font-bold text-white transition-all"
                    >
                        <span>🕊️</span>
                        <span class="hidden sm:inline">התחברות</span>
                    </a>
                {/if}

                <!-- Add Gemach button -->
                <a
                    href="https://community.gofreeil.com/gmachim/add"
                    class="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-lg"
                >
                    + הוסף גמח
                </a>

                <!-- Language -->
                <div class="relative lang-dropdown">
                    <button
                        onclick={() => showLangDropdown = !showLangDropdown}
                        class="flex items-center gap-2 rounded-lg bg-[#1c2f5a] hover:bg-[#2a4379] px-3 py-2 text-white transition-colors"
                        aria-label="בחר שפה"
                    >
                        <span class="fi fi-{languages.find(l => l.code === $locale || $locale?.startsWith(l.code))?.flag || 'il'}" style="font-size:1.3rem"></span>
                        <span class="text-sm">{languages.find(l => l.code === $locale || $locale?.startsWith(l.code))?.name || 'עברית'}</span>
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </button>
                    {#if showLangDropdown}
                        <div class="absolute left-0 mt-2 w-40 rounded-lg bg-[#1c2f5a] border border-[#3b5794] shadow-xl z-50">
                            {#each languages as lang}
                                <button
                                    class="flex w-full items-center gap-3 px-4 py-2 text-white hover:bg-[#213569] transition-colors"
                                    onclick={() => changeLang(lang.code)}
                                >
                                    <span class="fi fi-{lang.flag}" style="font-size:1.2rem"></span>
                                    <span class="text-sm">{lang.name}</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</header>

<style>
    .brand-logo-frame {
        transition: scale 300ms ease;
    }
    .brand-logo {
        transition: scale 300ms ease;
    }
    .brand-text {
        transform-origin: right center;
        transition: scale 300ms ease, opacity 300ms ease;
    }
    .brand-link:hover .brand-logo-frame {
        scale: 1.1;
    }
    .brand-link:hover .brand-logo {
        scale: 1.75;
    }
    .brand-link:hover .brand-text {
        scale: 1.08;
        opacity: 0.95;
    }
</style>
