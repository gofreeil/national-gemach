<script lang="ts">
    import VisitorStatsCard from '$lib/components/VisitorStatsCard.svelte';
    let { data } = $props();

    const fmt = new Intl.NumberFormat('he-IL');

    // סיכומי שנה — נגזרים מהנתונים החודשיים שכבר בידינו
    const yearViews = $derived((data.months ?? []).reduce((s, m) => s + m.pageViews, 0));
    const yearVisitors = $derived((data.months ?? []).reduce((s, m) => s + m.visitors, 0));

    // סורקים — מהמונה של השרת (GA רץ בדפדפן ולכן לא רואה בוטים בכלל).
    // האחרון ברשימה הוא החודש הנוכחי.
    const thisMonthHits = $derived(data.serverHits.at(-1));
    const botsThisMonth = $derived((thisMonthHits?.searchBots ?? 0) + (thisMonthHits?.aiBots ?? 0));
    const yearSearchBots = $derived(data.serverHits.reduce((s, m) => s + m.searchBots, 0));
    const yearAiBots = $derived(data.serverHits.reduce((s, m) => s + m.aiBots, 0));
    const hasServerHits = $derived(data.serverHits.some((m) => m.count > 0));

    // גידול המאגר — 12 החודשים האחרונים, האחרון הוא החודש הנוכחי
    const addedThisMonth = $derived(data.growth.at(-1)?.added ?? 0);
    const yearAdded = $derived(data.growth.reduce((s, m) => s + m.added, 0));
    const maxAdded = $derived(Math.max(1, ...data.growth.map((m) => m.added)));
    const currentYm = $derived(data.growth.at(-1)?.yearMonth ?? '');

    /** "202608" → "אוגוסט 2026" */
    function monthLabel(ym: string): string {
        const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)) - 1, 1);
        return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(d);
    }

    /** "202608" → "8/26" (לציר החודשים של הגרף) */
    function monthShort(ym: string): string {
        return `${Number(ym.slice(4, 6))}/${ym.slice(2, 4)}`;
    }

    // GA מחזיר שמות ערים/ערוצים באנגלית — מתרגמים את הנפוצים, השאר כמו שהם
    const CITY_HE: Record<string, string> = {
        'Jerusalem': 'ירושלים', 'Tel Aviv-Yafo': 'תל אביב-יפו', 'Tel Aviv': 'תל אביב',
        'Haifa': 'חיפה', 'Bnei Brak': 'בני ברק', 'Beersheba': 'באר שבע', "Be'er Sheva": 'באר שבע',
        'Ashdod': 'אשדוד', 'Petah Tikva': 'פתח תקווה', 'Netanya': 'נתניה',
        'Rishon LeZion': 'ראשון לציון', "Modi'in Illit": 'מודיעין עילית', 'Modiin Illit': 'מודיעין עילית',
        'Beit Shemesh': 'בית שמש', 'Elad': 'אלעד', 'Ramat Gan': 'רמת גן', 'Bat Yam': 'בת ים',
        'Holon': 'חולון', 'Rehovot': 'רחובות', 'Ashkelon': 'אשקלון', 'Lod': 'לוד',
        'Safed': 'צפת', 'Tiberias': 'טבריה', 'Netivot': 'נתיבות', 'Ofakim': 'אופקים',
        'Kiryat Gat': 'קריית גת', "Modi'in-Maccabim-Re'ut": 'מודיעין', 'Herzliya': 'הרצליה',
        'Kfar Saba': 'כפר סבא', "Ra'anana": 'רעננה', 'Givat Shmuel': 'גבעת שמואל',
        'Beitar Illit': 'ביתר עילית', 'Beersheba South District': 'באר שבע'
    };
    const DEVICE_HE: Record<string, string> = {
        mobile: '📱 נייד', desktop: '💻 מחשב', tablet: 'טאבלט', 'smart tv': 'טלוויזיה חכמה'
    };
    const CHANNEL_HE: Record<string, string> = {
        // ערוץ סינתטי שנשלף מתוך המקורות בשרת — לא שם של GA
        'WhatsApp': '💬 שיתופים בוואטסאפ',
        'Organic Search': 'חיפוש אורגני (גוגל)', 'Direct': 'כניסה ישירה', 'Referral': 'הפניות מאתרים',
        'Organic Social': 'רשתות חברתיות', 'Paid Search': 'חיפוש ממומן', 'Email': 'מייל',
        'Display': 'באנרים', 'Cross-network': 'רשתות מעורבות', 'Organic Video': 'וידאו',
        'Organic Shopping': 'שופינג', 'Unassigned': 'לא משויך'
    };

    interface Row { label: string; sub?: string; count: number; href?: string }
    const gemachRows: Row[] = $derived(data.topGemachim.map((g) => ({
        label: `${g.icon} ${g.name}`, sub: g.city, count: g.count, href: `/gemach/${g.id}`
    })));
    const cityRows: Row[] = $derived(data.cities
        .filter((c) => c.key !== '(not set)')
        .map((c) => ({ label: CITY_HE[c.key] ?? c.key, count: c.count })));
    const deviceRows: Row[] = $derived(data.devices.map((d) => ({
        label: DEVICE_HE[d.key] ?? d.key, count: d.count
    })));
    const channelRows: Row[] = $derived(data.channels.map((c) => ({
        label: CHANNEL_HE[c.key] ?? c.key, count: c.count
    })));
</script>

<svelte:head><title>סטטיסטיקה מלאה – פאנל ניהול</title></svelte:head>

{#snippet rankCard(title: string, subtitle: string, rows: Row[])}
    <div class="card p-4">
        <h3 class="font-bold text-white">{title}</h3>
        <p class="mt-0.5 text-xs text-gray-400">{subtitle}</p>
        {#if rows.length === 0}
            <p class="mt-3 text-sm text-gray-400">אין עדיין נתונים.</p>
        {:else}
            {@const max = Math.max(...rows.map((r) => r.count))}
            <ul class="mt-3 space-y-2.5">
                {#each rows as r, i (r.href ?? r.label)}
                    <li>
                        <svelte:element this={r.href ? 'a' : 'div'} href={r.href ?? undefined} class="group block">
                            <span class="flex items-baseline justify-between gap-2 text-sm">
                                <span class="min-w-0 truncate font-bold text-white {r.href ? 'group-hover:text-blue-300' : ''}">
                                    <span class="tabular-nums text-gray-500">{i + 1}.</span>
                                    {r.label}
                                    {#if r.sub}<span class="text-[11px] font-normal text-gray-400">· 📍 {r.sub}</span>{/if}
                                </span>
                                <span class="flex-shrink-0 text-xs font-black tabular-nums text-emerald-300">{fmt.format(r.count)}</span>
                            </span>
                            <span class="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#1c2f5a]">
                                <span
                                    class="block h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-400"
                                    style="width:{Math.max(3, Math.round((r.count / max) * 100))}%"
                                ></span>
                            </span>
                        </svelte:element>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
{/snippet}

<div class="space-y-4">
    <h2 class="text-xl font-black text-white">📈 סטטיסטיקה מלאה</h2>

    <!-- סיכומי השנה האחרונה -->
    {#if data.months && data.months.length > 0}
        <div class="grid grid-cols-2 gap-3">
            <div class="card p-4">
                <div class="text-2xl font-black text-emerald-400">{fmt.format(yearViews)}</div>
                <div class="mt-1 text-xs text-gray-400">צפיות בשנה האחרונה</div>
            </div>
            <div class="card p-4">
                <div class="text-2xl font-black text-blue-400">{fmt.format(yearVisitors)}</div>
                <div class="mt-1 text-xs text-gray-400">כניסות בשנה האחרונה</div>
            </div>
        </div>
    {/if}

    <!-- הגרף החודשי -->
    <VisitorStatsCard months={data.months} updatedAt={data.updatedAt} />

    <!-- סורקים — פרמטר נפרד מהכניסות של בני אדם -->
    <div class="card space-y-3 p-4">
        <div>
            <h3 class="font-bold text-white">🤖 סריקות מנועי חיפוש ו-AI</h3>
            <p class="mt-0.5 text-xs text-gray-400">
                Google Analytics רץ בדפדפן ולכן סופר רק בני אדם. הסורקים נספרים בשרת עצמו,
                בנפרד — כך רואים שהאתר נסרק ומוזן לגוגל ולכלי ה-AI.
            </p>
        </div>

        {#if !hasServerHits}
            <p class="text-sm text-gray-400">
                אין עדיין נתונים — הספירה בשרת מתחילה מרגע העלאת הגרסה הזו לאוויר.
            </p>
        {:else}
            <div class="grid grid-cols-3 gap-3">
                <div class="rounded-xl border border-[#3b5794] bg-[#1c2f5a] p-3 text-center">
                    <div class="text-2xl font-black text-sky-300">{fmt.format(thisMonthHits?.searchBots ?? 0)}</div>
                    <div class="mt-1 text-[11px] text-gray-300">מנועי חיפוש וסורקים</div>
                </div>
                <div class="rounded-xl border border-[#3b5794] bg-[#1c2f5a] p-3 text-center">
                    <div class="text-2xl font-black text-purple-300">{fmt.format(thisMonthHits?.aiBots ?? 0)}</div>
                    <div class="mt-1 text-[11px] text-gray-300">בוטים של AI</div>
                </div>
                <div class="rounded-xl border border-[#3b5794] bg-[#1c2f5a] p-3 text-center">
                    <div class="text-2xl font-black text-emerald-300">{fmt.format(thisMonthHits?.count ?? 0)}</div>
                    <div class="mt-1 text-[11px] text-gray-300">סה"כ פניות (כולל סריקות)</div>
                </div>
            </div>
            <p class="text-xs text-gray-400">
                המספרים הם של החודש הנוכחי · מתוכם {fmt.format(botsThisMonth)} סריקות.
                בשנה האחרונה: {fmt.format(yearSearchBots)} סריקות של מנועי חיפוש
                ו-{fmt.format(yearAiBots)} של בוטי AI.
            </p>
        {/if}
    </div>

    <!-- גידול המאגר — גמ"חים חדשים לפי חודש -->
    <div class="card space-y-3 p-4">
        <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div class="min-w-0">
                <h3 class="font-bold text-white">🆕 גמ"חים חדשים</h3>
                <p class="mt-0.5 text-xs text-gray-400">
                    כמה גמ"חים נוספו לאתר בכל חודש — כך רואים את הצמיחה.
                    {fmt.format(yearAdded)} נוספו בשנה האחרונה, וסה"כ {fmt.format(data.totalGemachim)} גמ"חים באתר.
                </p>
            </div>
            <div class="text-left">
                <div class="text-2xl font-black text-sky-400">+{fmt.format(addedThisMonth)}</div>
                <div class="text-[11px] text-gray-400">נוספו החודש</div>
            </div>
        </div>

        <div class="flex items-stretch justify-center gap-1.5">
            {#each data.growth as m (m.yearMonth)}
                <div
                    class="flex min-w-0 max-w-16 flex-1 flex-col items-center"
                    title="{monthLabel(m.yearMonth)}: {fmt.format(m.added)} גמ״חים חדשים"
                >
                    <div class="mb-1 text-[10px] font-bold tabular-nums text-gray-300">{fmt.format(m.added)}</div>
                    <div class="flex h-24 w-full items-end">
                        <div
                            class="w-full rounded-t-md transition-all {m.added > 0
                                ? 'bg-gradient-to-t from-blue-600 to-sky-400'
                                : 'bg-white/10'} {m.yearMonth === currentYm ? 'shadow-[0_0_12px_rgba(56,189,248,0.5)]' : ''}"
                            style="height: {m.added > 0 ? Math.max(6, Math.round((m.added / maxAdded) * 100)) : 4}%"
                        ></div>
                    </div>
                    <div class="mt-1 whitespace-nowrap text-[10px] {m.yearMonth === currentYm ? 'font-bold text-sky-300' : 'text-gray-400'}">
                        {monthShort(m.yearMonth)}
                    </div>
                </div>
            {/each}
        </div>
    </div>

    <!-- פירוט: גמ"חים, ערים, מכשירים ומקורות -->
    {#if data.insightsAvailable}
        <div class="grid items-start gap-3 lg:grid-cols-2">
            {@render rankCard('🏆 הגמ"חים הנצפים ביותר', 'צפיות בדפי הגמ"חים בשנה האחרונה — לחיצה פותחת את הגמ"ח', gemachRows)}
            {@render rankCard('🌍 הערים של הגולשים', 'מאיפה נכנסים לאתר (לפי מיקום הגולש)', cityRows)}
            {@render rankCard('📱 מכשירים', 'ממה גולשים לאתר', deviceRows)}
            {@render rankCard('🧭 מקורות תנועה', 'איך מגיעים לאתר · שיתוף בוואטסאפ שלא מוסר מקור נספר ככניסה ישירה', channelRows)}
        </div>
    {:else}
        <div class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
            נתוני הפירוט (גמ"חים, ערים, מקורות) אינם זמינים כרגע — נסו לרענן בעוד רגע.
        </div>
    {/if}
</div>
