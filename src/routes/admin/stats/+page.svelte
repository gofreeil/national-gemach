<script lang="ts">
    import VisitorStatsCard from '$lib/components/VisitorStatsCard.svelte';
    let { data } = $props();

    const fmt = new Intl.NumberFormat('he-IL');

    // סיכומי שנה — נגזרים מהנתונים החודשיים שכבר בידינו
    const yearViews = $derived((data.months ?? []).reduce((s, m) => s + m.pageViews, 0));
    const yearVisitors = $derived((data.months ?? []).reduce((s, m) => s + m.visitors, 0));

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

    <!-- פירוט: גמ"חים, ערים, מכשירים ומקורות -->
    {#if data.insightsAvailable}
        <div class="grid items-start gap-3 lg:grid-cols-2">
            {@render rankCard('🏆 הגמ"חים הנצפים ביותר', 'צפיות בדפי הגמ"חים בשנה האחרונה — לחיצה פותחת את הגמ"ח', gemachRows)}
            {@render rankCard('🌍 הערים של הגולשים', 'מאיפה נכנסים לאתר (לפי מיקום הגולש)', cityRows)}
            {@render rankCard('📱 מכשירים', 'ממה גולשים לאתר', deviceRows)}
            {@render rankCard('🧭 מקורות תנועה', 'איך מגיעים לאתר', channelRows)}
        </div>
    {:else}
        <div class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
            נתוני הפירוט (גמ"חים, ערים, מקורות) אינם זמינים כרגע — נסו לרענן בעוד רגע.
        </div>
    {/if}
</div>
