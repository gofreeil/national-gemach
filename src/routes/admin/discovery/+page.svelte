<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();

	let tab = $state<'drafts' | 'rejected'>('drafts');
	let scanning = $state(false);

	const catByKey = $derived(new Map(data.categories.map((c: { key: string; label: string; icon: string }) => [c.key, c])));

	const JOB_LABELS: Record<string, string> = {
		queued: 'בתור',
		running: 'רצה עכשיו',
		done: 'הסתיימה',
		failed: 'נכשלה',
		cancelled: 'בוטלה',
	};

	const SOURCE_LABELS: Record<string, string> = {
		'google-search': 'חיפוש Google',
		'google-local': 'Google מקומי',
	};

	function fmtDate(iso: string): string {
		if (!iso) return '';
		try {
			return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(iso));
		} catch {
			return iso;
		}
	}

	function catLabel(key: string): string {
		const c = catByKey.get(key) as { label?: string } | undefined;
		return c?.label ?? key;
	}

	function catIcon(key: string, fallback?: string): string {
		const c = catByKey.get(key) as { icon?: string } | undefined;
		return fallback || c?.icon || '🤝';
	}
</script>

<svelte:head><title>גילוי חכם – פאנל ניהול</title></svelte:head>

<div class="space-y-5">
	<!-- כותרת -->
	<div>
		<h2 class="text-xl font-black text-white flex items-center gap-2">
			<span aria-hidden="true">🛰️</span> גילוי חכם
		</h2>
		<p class="mt-1 text-sm text-gray-300">
			האוטומציה מאתרת גמ"חים חדשים מ-Google, מדלגת על כל מה שכבר קיים אצלנו, ומייבאת רק
			חדשים כטיוטות. טיוטה לא מופיעה באתר עד שמאשרים אותה כאן.
		</p>
	</div>

	{#if form?.message}
		<div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">{form.message}</div>
	{/if}
	{#if form?.error}
		<div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">{form.error}</div>
	{/if}

	<!-- הפעלת סריקה -->
	<div class="card p-4 sm:p-5">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="min-w-0">
				<h3 class="font-black text-white">הפעלת סריקה</h3>
				<p class="mt-1 text-xs text-gray-400">
					הסריקה נכנסת לתור ומבוצעת ע"י עובד האוטומציה —
					<code class="rounded bg-[#1e293b] px-1.5 py-0.5 text-[11px] text-purple-300" dir="ltr">npm run discovery:worker</code>
					(פירוט ב-automation/README.md).
				</p>
			</div>
			<form
				method="POST"
				action="?/scan"
				use:enhance={() => {
					scanning = true;
					return async ({ update }) => {
						await update();
						scanning = false;
					};
				}}
				class="flex items-center gap-2"
			>
				<label class="text-xs font-bold text-gray-300" for="maxQueries">היקף:</label>
				<select
					id="maxQueries"
					name="maxQueries"
					class="rounded-xl border border-[#3b5794] bg-[#1e293b] px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
				>
					<option value="10">מהירה (10 שאילתות)</option>
					<option value="20" selected>רגילה (20 שאילתות)</option>
					<option value="40">מעמיקה (40 שאילתות)</option>
				</select>
				<button
					type="submit"
					disabled={data.queueBusy || scanning}
					class="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-black text-white shadow-lg transition-opacity disabled:opacity-40"
				>
					{scanning ? 'שולח…' : data.queueBusy ? 'סריקה כבר פעילה' : '🛰️ הפעל סריקה חכמה'}
				</button>
			</form>
		</div>

		{#if data.jobs.length > 0}
			<div class="mt-4 border-t border-[#3b5794] pt-3">
				<div class="flex items-center justify-between">
					<h4 class="text-sm font-black text-gray-200">סריקות אחרונות</h4>
					<button type="button" class="text-xs font-bold text-blue-300 hover:text-blue-200" onclick={() => invalidateAll()}>🔄 רענון</button>
				</div>
				<ul class="mt-2 space-y-2">
					{#each data.jobs as job (job.id)}
						<li class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-[#101d3d] px-3 py-2 text-xs">
							<span class="status-pill {job.status}">{JOB_LABELS[job.status] ?? job.status}</span>
							<span class="text-gray-300">{fmtDate(job.createdAt)}</span>
							{#if job.requestedBy}<span class="text-gray-500">ע"י {job.requestedBy}</span>{/if}
							{#if job.stats}
								<span class="text-gray-300">
									{job.stats.rawResults ?? 0} תוצאות · {job.stats.imported ?? 0} יובאו · {job.stats.duplicates ?? 0} כפולים
								</span>
							{/if}
							{#if job.stats?.blocked}
								<span class="w-full text-amber-300">
									⚠️ הסריקה נעצרה באמצע — {job.stats.blockedReason || 'Google ביקש אימות'}
									השאילתות שלא הספיקו לרוץ יחזרו בסריקה הבאה.
								</span>
							{/if}
							{#if job.error}<span class="text-red-300">{job.error}</span>{/if}
							{#if job.status === 'queued' || job.status === 'running'}
								<form method="POST" action="?/cancel" use:enhance class="mr-auto">
									<input type="hidden" name="id" value={job.id} />
									<button type="submit" class="rounded-lg border border-red-500/30 bg-red-900/30 px-2.5 py-1 font-bold text-red-300 hover:bg-red-900/60">בטל</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<!-- לשוניות -->
	<div class="flex gap-2">
		<button
			type="button"
			class="rounded-xl px-4 py-2 text-sm font-black transition-all {tab === 'drafts'
				? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
				: 'bg-[#16264d] text-gray-300 hover:bg-[#213569] hover:text-white'}"
			onclick={() => (tab = 'drafts')}
		>
			📝 טיוטות ממתינות ({data.drafts.length})
		</button>
		<button
			type="button"
			class="rounded-xl px-4 py-2 text-sm font-black transition-all {tab === 'rejected'
				? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
				: 'bg-[#16264d] text-gray-300 hover:bg-[#213569] hover:text-white'}"
			onclick={() => (tab = 'rejected')}
		>
			🚫 נדחו ({data.rejected.length})
		</button>
	</div>

	{#if tab === 'drafts'}
		{#if data.drafts.length === 0}
			<div class="card p-6 text-center text-sm text-gray-300">
				אין טיוטות ממתינות. הפעילו סריקה — כל גמ"ח חדש שיימצא יופיע כאן לאישור.
			</div>
		{:else}
			<div class="space-y-3">
				{#each data.drafts as item (item.gemach.id)}
					<div class="card p-4 sm:p-5">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="text-2xl" aria-hidden="true">{catIcon(item.gemach.category, item.gemach.icon)}</span>
									<h3 class="truncate text-lg font-black text-white">{item.gemach.name}</h3>
								</div>
								<div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
									<span class="rounded-full bg-[#1c2f5a] px-2.5 py-0.5 font-bold text-gray-200">{catLabel(item.gemach.category)}</span>
									{#if item.gemach.city}<span class="rounded-full bg-[#1c2f5a] px-2.5 py-0.5 font-bold text-gray-200">📍 {item.gemach.city}</span>{/if}
									{#if item.gemach.phone}<span class="rounded-full bg-[#1c2f5a] px-2.5 py-0.5 font-bold text-gray-200" dir="ltr">📞 {item.gemach.phone}</span>{/if}
									{#if item.discovery}
										<span class="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 font-bold text-purple-300">
											התאמה {Math.round(item.discovery.confidence * 100)}%
										</span>
									{/if}
								</div>
								{#if item.gemach.description}
									<p class="mt-2 text-sm leading-relaxed text-gray-300 line-clamp-3">{item.gemach.description}</p>
								{/if}
								{#if item.discovery}
									<p class="mt-2 text-[11px] text-gray-500">
										מקור: {SOURCE_LABELS[item.discovery.source] ?? item.discovery.source}
										{#if item.discovery.query}· שאילתה: "{item.discovery.query}"{/if}
										· נמצא {fmtDate(item.discovery.foundAt || item.createdAt)}
										{#if item.discovery.sourceUrl}
											· <a href={item.discovery.sourceUrl} target="_blank" rel="noopener noreferrer" class="text-blue-300 hover:text-blue-200 underline">לעמוד המקור ↗</a>
										{/if}
									</p>
								{/if}
							</div>
						</div>

						<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-[#3b5794] pt-3">
							<form method="POST" action="?/approve" use:enhance>
								<input type="hidden" name="id" value={item.gemach.id} />
								<button type="submit" class="rounded-xl border border-emerald-500/40 bg-emerald-600/20 px-3.5 py-2 text-sm font-black text-emerald-200 hover:bg-emerald-600/40 transition-colors">
									✅ אשר ופרסם
								</button>
							</form>
							<a
								href={`/admin/gemachim/${item.gemach.id}`}
								class="rounded-xl border border-[#3b5794] bg-[#1c2f5a] px-3.5 py-2 text-sm font-bold text-gray-100 hover:bg-[#2a4379] transition-colors"
							>
								✏️ עריכה לפני אישור
							</a>
							<form method="POST" action="?/reject" use:enhance class="flex items-center gap-2">
								<input type="hidden" name="id" value={item.gemach.id} />
								<input
									type="text"
									name="reason"
									placeholder="סיבת דחייה (לא חובה)"
									class="w-44 rounded-xl border border-[#3b5794] bg-[#1e293b] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none"
								/>
								<button type="submit" class="rounded-xl border border-red-500/30 bg-red-900/30 px-3.5 py-2 text-sm font-bold text-red-300 hover:bg-red-900/60 transition-colors">
									❌ דחה
								</button>
							</form>
							<form
								method="POST"
								action="?/remove"
								use:enhance={({ cancel }) => {
									if (!confirm(`למחוק את הטיוטה "${item.gemach.name}" לצמיתות?`)) cancel();
								}}
								class="mr-auto"
							>
								<input type="hidden" name="id" value={item.gemach.id} />
								<button type="submit" class="rounded-xl px-3 py-2 text-sm font-bold text-gray-500 hover:text-red-300 transition-colors">🗑️</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		{#if data.rejected.length === 0}
			<div class="card p-6 text-center text-sm text-gray-300">אין פריטים שנדחו.</div>
		{:else}
			<div class="space-y-3">
				{#each data.rejected as item (item.gemach.id)}
					<div class="card p-4">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div class="min-w-0">
								<h3 class="truncate font-black text-white">{item.gemach.name}</h3>
								<p class="mt-0.5 text-xs text-gray-400">
									{catLabel(item.gemach.category)}{#if item.gemach.city} · {item.gemach.city}{/if}
									{#if item.discovery?.rejectionReason}· סיבה: {item.discovery.rejectionReason}{/if}
								</p>
							</div>
							<div class="flex items-center gap-2">
								<form method="POST" action="?/restore" use:enhance>
									<input type="hidden" name="id" value={item.gemach.id} />
									<button type="submit" class="rounded-xl border border-[#3b5794] bg-[#1c2f5a] px-3 py-1.5 text-xs font-bold text-gray-100 hover:bg-[#2a4379] transition-colors">↩️ החזר לטיוטות</button>
								</form>
								<form
									method="POST"
									action="?/remove"
									use:enhance={({ cancel }) => {
										if (!confirm(`למחוק את "${item.gemach.name}" לצמיתות?`)) cancel();
									}}
								>
									<input type="hidden" name="id" value={item.gemach.id} />
									<button type="submit" class="rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-500 hover:text-red-300 transition-colors">🗑️</button>
								</form>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.status-pill {
		border-radius: 9999px;
		padding: 0.15rem 0.65rem;
		font-weight: 800;
	}
	.status-pill.queued {
		background: rgb(245 158 11 / 0.12);
		border: 1px solid rgb(245 158 11 / 0.35);
		color: #fcd34d;
	}
	.status-pill.running {
		background: rgb(59 130 246 / 0.12);
		border: 1px solid rgb(59 130 246 / 0.35);
		color: #93c5fd;
	}
	.status-pill.done {
		background: rgb(16 185 129 / 0.12);
		border: 1px solid rgb(16 185 129 / 0.35);
		color: #6ee7b7;
	}
	.status-pill.failed {
		background: rgb(239 68 68 / 0.12);
		border: 1px solid rgb(239 68 68 / 0.35);
		color: #fca5a5;
	}
	.status-pill.cancelled {
		background: rgb(148 163 184 / 0.12);
		border: 1px solid rgb(148 163 184 / 0.35);
		color: #cbd5e1;
	}
	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
