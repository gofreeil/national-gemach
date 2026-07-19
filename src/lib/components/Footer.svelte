<script lang="ts">
    import { t, locale } from "svelte-i18n";
    import { get } from "svelte/store";
    let _loc = $state(get(locale));
    $effect(() => locale.subscribe(l => (_loc = l)));
    const tFn = (k: string) => { void _loc; return get(t)(k); };
</script>

<footer class="bg-[#0d1117] border-t border-white/10 py-0 md:py-2 mt-1 md:mt-0">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
            class="flex flex-col md:flex-row items-center justify-between gap-0 md:gap-6"
        >
            <!-- Right: Brand image + text (ימין) -->
            <a
                href="https://gofreeil.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="יוצאים לחירות – לכלל פעילות התנועה החברתית (נפתח בחלון חדש)"
                style="cursor: pointer;"
                class="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
                <img
                    src="/images/yotzim-lecherut.webp"
                    alt="יוצאים לחירות"
                    class="h-28 w-28 md:h-32 md:w-32 object-contain rounded-lg hover:scale-105 transition-transform flex-shrink-0"
                />

                <!-- Mobile: horizontal layout -->
                <div
                    class="flex md:hidden flex-col text-right leading-tight text-sm"
                >
                    <p class="text-yellow-400 font-black text-sm">
                        יוצאים לחירות
                    </p>
                    <p class="text-gray-300 font-normal text-xs">
                        לכלל פעילות התנועה החברתית
                    </p>
                </div>

                <!-- Desktop: original layout -->
                <div
                    class="hidden md:flex md:flex-col text-right leading-tight gap-1"
                >
                    <p
                        class="text-base md:text-lg text-gray-300 font-normal"
                    >
                        לכלל פעילות התנועה החברתית
                    </p>
                    <p
                        class="text-lg md:text-xl font-black flex items-center gap-2 justify-end text-yellow-500"
                    >
                        <span>👉</span> יוצאים לחירות
                    </p>
                </div>
            </a>

            <!-- Center: Links -->
            <nav
                aria-label="ניווט תחתון"
                class="flex items-center gap-4 text-base md:text-lg text-gray-300 font-bold flex-wrap justify-center"
            >
                <a href="https://community.gofreeil.com/about/legal" target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">
                    <span class="md:hidden block">תנאי שימוש<br />הצהרת נגישות וכו'</span>
                    <span class="hidden md:inline-block whitespace-nowrap">תנאי שימוש, הצהרת נגישות וכו'</span>
                </a>
                <span class="text-gray-600 font-black" aria-hidden="true">|</span>
                <a
                    href="mailto:freedomhasbegun@gmail.com"
                    class="hover:text-white transition-colors"
                    aria-label="צור קשר – שלח אימייל"
                >{tFn("contact_us")}</a
                >
                <span class="text-gray-600 font-black" aria-hidden="true">|</span>
                <a href="https://community.gofreeil.com/about/advertise" target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">פרסם אצלנו</a>
            </nav>

            <!-- Left: Copyright -->
            <p class="text-gray-400 font-bold text-[10px] md:text-lg text-center md:text-right pb-4 md:pb-0">
                &copy; {new Date().getFullYear()} {tFn("all_rights_reserved")}
            </p>
        </div>
    </div>
</footer>
