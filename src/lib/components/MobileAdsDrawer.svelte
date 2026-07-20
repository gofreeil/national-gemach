<script lang="ts">
	import { ads } from '$lib/adsData';
	import { page } from '$app/state';

	let isAuthPage = $derived(
		page.url.pathname === '/login' ||
		page.url.pathname === '/register'
	);

	interface Props {
		user?: { name: string; email: string } | null;
	}
	let { user = null }: Props = $props();

	let open = $state(false);
	let collapsed = $state(false);

	function closeAll() {
		open = false;
		collapsed = false;
	}

	// ---- Swipe gestures (Drawer) ----
	let drawerTouchStartX = 0;
	let drawerTouchStartY = 0;

	function onDrawerTouchStart(e: TouchEvent) {
		drawerTouchStartX = e.touches[0].clientX;
		drawerTouchStartY = e.touches[0].clientY;
	}

	// על הדרואר: משיכה שמאלה → סגור
	function onDrawerTouchEnd(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - drawerTouchStartX;
		const dy = e.changedTouches[0].clientY - drawerTouchStartY;
		if (dx < -50 && Math.abs(dx) > Math.abs(dy)) {
			closeAll();
		}
	}

	// ---- לשונית: גרירה אנכית + פתיחה ----
	let tabY = $state(0);
	let tabDragging = $state(false);
	let tabDragStartClientY = 0;
	let tabDragStartTabY = 0;
	let tabTouchStartX = 0;
	let tabTouchStartY = 0;
	let tabSwipeHandled = false;
	let tabAxis: 'h' | 'v' | null = null;

	let drawerSystemEl: HTMLElement | null = null;
	let isDraggingH = false;
	let dragStartLeftPx = -340;
	const DRAWER_WIDTH = 340;
	const OPEN_THRESHOLD = 100;
	const CLOSE_THRESHOLD = -100;
	const COLLAPSE_THRESHOLD = -20;

	$effect(() => {
		if (typeof window !== 'undefined' && tabY === 0) {
			// ברירת מחדל: החלק התחתון של המסך (4/5 מהגובה)
			tabY = Math.round(window.innerHeight * 4 / 5);
		}
	});

	function onTabTouchStart(e: TouchEvent) {
		tabTouchStartX = e.touches[0].clientX;
		tabTouchStartY = e.touches[0].clientY;
		tabDragStartClientY = e.touches[0].clientY;
		tabDragStartTabY = tabY;
		tabDragging = false;
		tabSwipeHandled = false;
		tabAxis = null;
		isDraggingH = false;
		dragStartLeftPx = open ? 0 : -(drawerSystemEl?.offsetWidth ?? DRAWER_WIDTH);
	}

	function onTabTouchMove(e: TouchEvent) {
		const dx = e.touches[0].clientX - tabTouchStartX;
		const dy = e.touches[0].clientY - tabDragStartClientY;
		const absX = Math.abs(dx), absY = Math.abs(dy);

		if (tabAxis === null && (absX > 10 || absY > 10)) {
			tabAxis = absX > absY ? 'h' : 'v';
		}

		if (tabAxis !== null) {
			try { e.preventDefault(); } catch { /* passive */ }
		}

		if (tabAxis === 'h' && drawerSystemEl) {
			isDraggingH = true;
			const w = drawerSystemEl.offsetWidth || DRAWER_WIDTH;
			let newLeft = dragStartLeftPx + dx;
			if (newLeft > 0) newLeft = 0;
			if (newLeft < -w - 20) newLeft = -w - 20;
			drawerSystemEl.style.transition = 'none';
			drawerSystemEl.style.left = newLeft + 'px';

			if (!open) {
				collapsed = dx <= COLLAPSE_THRESHOLD;
			}
		}

		if (tabAxis === 'v' && absY > 20) {
			tabDragging = true;
			let newY = tabDragStartTabY + dy;
			newY = Math.max(60, Math.min(window.innerHeight - 60, newY));
			tabY = newY;
		}
	}

	function nonPassiveTouch(node: HTMLElement) {
		const opts: AddEventListenerOptions = { passive: false };
		node.addEventListener('touchstart', onTabTouchStart, opts);
		node.addEventListener('touchmove',  onTabTouchMove,  opts);
		node.addEventListener('touchend',   onTabTouchEnd,   opts);
		return {
			destroy() {
				node.removeEventListener('touchstart', onTabTouchStart, opts);
				node.removeEventListener('touchmove',  onTabTouchMove,  opts);
				node.removeEventListener('touchend',   onTabTouchEnd,   opts);
			}
		};
	}

	function onTabTouchEnd(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - tabTouchStartX;
		const dy = e.changedTouches[0].clientY - tabTouchStartY;
		const totalMove = Math.sqrt(dx * dx + dy * dy);
		const isTap = totalMove < 15;

		if (isDraggingH && drawerSystemEl) {
			drawerSystemEl.style.transition = '';
			drawerSystemEl.style.left = '';

			if (!open) {
				if (dx >= OPEN_THRESHOLD) {
					open = true;
					collapsed = false;
				}
			} else {
				if (dx <= CLOSE_THRESHOLD) {
					open = false;
					collapsed = false;
				}
			}
			tabSwipeHandled = true;
			e.preventDefault();
		} else if (tabDragging) {
			tabSwipeHandled = true;
		} else if (isTap) {
			if (open) closeAll();
			else open = true;
			tabSwipeHandled = true;
			e.preventDefault();
		}

		isDraggingH = false;
		tabDragging = false;
	}

	function onTabClick() {
		if (tabSwipeHandled) {
			tabSwipeHandled = false;
			return;
		}
		if (open) closeAll();
		else open = true;
	}

	$effect(() => {
		function handleKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape' && open) {
				closeAll();
			}
		}
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});
</script>

<!-- מוצג רק בנייד / טאבלט -->
<div class="lg:hidden" dir="rtl">

	<!-- Overlay כהה כשפתוח -->
	{#if open}
	<button
		class="overlay"
		onclick={closeAll}
		aria-label="סגור פרסומות"
	></button>
	{/if}

	<!-- ה-Drawer והלשונית נעים יחד כיחידה אחת -->
	<div class="drawer-system" class:is-open={open} bind:this={drawerSystemEl}>

	<!-- Drawer -->
	<div class="drawer"
		role="dialog"
		aria-modal="true"
		aria-label="האזור האישי וההטבות מהקהילה הארצית"
		aria-hidden={!open}
		ontouchstart={onDrawerTouchStart}
		ontouchend={onDrawerTouchEnd}
	>
		<!-- כפתור התחברות / אזור אישי -->
		<div class="section-title section-title-first">
			האזור האישי
			<button
				type="button"
				class="close-btn"
				onclick={closeAll}
				aria-label="סגור"
			>×</button>
		</div>
		<div class="auth-section">
			{#if user}
			<a href="/profile" class="profile-btn" onclick={closeAll}>
				<span class="profile-avatar-placeholder">👤</span>
				<div class="profile-btn-text">
					<span class="profile-btn-name">{user.name || user.email}</span>
					<span class="profile-btn-sub">לאזור האישי שלי ←</span>
				</div>
			</a>
			{:else}
			<a href="/login?redirect=/profile" class="login-btn" onclick={closeAll}>
				<div class="anon-avatar-wrap">
					<span class="anon-avatar">
						<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40">
							<circle cx="20" cy="20" r="20" fill="#374151"/>
							<circle cx="20" cy="16" r="7" fill="#6b7280"/>
							<ellipse cx="20" cy="34" rx="12" ry="8" fill="#6b7280"/>
						</svg>
					</span>
					<span class="login-icon">🔐</span>
				</div>
				<div class="login-btn-text">
					<span class="login-btn-title">התחברות / הרשמה</span>
					<span class="login-btn-sub">לאזור האישי שלך ←</span>
				</div>
			</a>
			{/if}
		</div>

		<!-- רשימת פרסומות -->
		<div class="benefits-list">
			<div class="section-title section-title-benefits">הטבות ארציות <span class="title-gold">יוצאים לחירות</span></div>

			{#each ads as ad (ad.id)}
			<a
				href={ad.href}
				target="_blank"
				rel="noopener noreferrer"
				class="benefit-card"
				onclick={closeAll}
			>
				<div class="benefit-img-wrap">
					<img
						src={ad.image}
						alt={ad.title}
						class="benefit-img"
						loading="lazy"
						decoding="async"
					/>
				</div>
				<div class="benefit-body">
					<p class="benefit-title">{ad.title}</p>
					<p class="benefit-desc">{ad.description}</p>
					<span class="benefit-cta" title={ad.hover ?? undefined}>← {ad.cta}</span>
				</div>
			</a>
			{/each}
		</div>
	</div>

	<!-- לשונית מחוברת לקצה הימני של הבאנר.
	     מרונדרת כבר בשרת (SSR) עם מיקום ברירת-מחדל ב-CSS — כך שהיא מופיעה מיד,
	     גם בחיבור איטי שבו ה-JS עוד לא נטען. tabY מחליף את המיקום ברגע שה-JS רץ. -->
	{#if !isAuthPage}
	<button
		class="tab"
		class:tab-dragging={tabDragging}
		class:tab-collapsed={collapsed && !open}
		style="top: {tabY > 0 ? `${tabY}px` : '80%'}; transform: translateY(-50%);"
		onclick={onTabClick}
		use:nonPassiveTouch
		aria-label="פתח הטבות לקהילה"
	>
		{#if !(collapsed && !open)}
			<span class="tab-text">לאזור האישי ולהטבות</span>
		{/if}
	</button>
	{/if}

	</div>

</div>

<style>
	/* ---- Overlay ---- */
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 1100;
		cursor: pointer;
		border: none;
		padding: 0;
	}

	/* ---- מערכת drawer+tab שזזה כיחידה אחת ---- */
	.drawer-system {
		position: fixed;
		top: 0;
		left: -340px; /* fallback לדפדפנים בלי min() */
		/* במסכים צרים (הגדלת תצוגה במכשיר) הרוחב מוגבל ל-92vw; ההיסט חייב
		   להתאים לרוחב בפועל — אחרת הלשונית גולשת אל מחוץ למסך משמאל */
		left: calc(-1 * min(340px, 92vw));
		height: 100vh; /* fallback לדפדפנים בלי תמיכה ב-dvh */
		height: 100dvh;
		width: 340px;
		max-width: 92vw;
		z-index: 1200;
		transition: left 0.55s cubic-bezier(0.32, 0.72, 0.24, 1);
		pointer-events: none;
	}

	.drawer-system.is-open {
		left: 0px;
	}

	/* ---- Drawer ---- */
	.drawer {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		width: 100%;
		background: linear-gradient(180deg, #241228 0%, #160a19 100%);
		border-left: none;
		border-right: 1px solid rgba(99, 102, 241, 0.2);
		display: flex;
		flex-direction: column;
		box-shadow: 8px 0 32px rgba(0, 0, 0, 0.5);
		pointer-events: auto;
	}

	/* ---- כותרת סקציה ---- */
	.section-title {
		font-size: 1.25rem;
		font-weight: 900;
		background: linear-gradient(90deg, #38bdf8, #818cf8, #a78bfa);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		text-align: center;
		padding: 0.9rem 1.25rem 0.6rem;
		letter-spacing: 0.05em;
		flex-shrink: 0;
		border-top: 2px solid rgba(56, 189, 248, 0.25);
		text-shadow: none;
		position: relative;
	}

	.section-title:first-of-type,
	.section-title-first {
		border-top: none;
	}

	.section-title-first {
		padding-top: 0.5rem;
		padding-bottom: 0.4rem;
	}

	.section-title.section-title-benefits {
		border-top: 2px solid rgba(56, 189, 248, 0.25);
		margin: 0 -0.75rem 0.5rem;
	}

	.close-btn {
		position: absolute;
		top: 50%;
		left: 0.6rem;
		transform: translateY(-50%);
		width: 28px;
		height: 28px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: rgba(99, 102, 241, 0.15);
		border: 1px solid rgba(99, 102, 241, 0.35);
		border-radius: 50%;
		color: #e0e7ff;
		font-size: 1.05rem;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		-webkit-text-fill-color: #e0e7ff;
		background-clip: border-box;
		-webkit-background-clip: border-box;
		transition: background 0.2s, border-color 0.2s;
	}

	.close-btn:hover {
		background: rgba(99, 102, 241, 0.3);
		border-color: rgba(99, 102, 241, 0.6);
	}

	.title-gold {
		color: #fbbf24;
	}

	/* ---- כפתור auth ---- */
	.auth-section {
		padding: 0.5rem 0.75rem 0.65rem;
		margin-bottom: 0.25rem;
		border-bottom: 1px solid rgba(99,102,241,0.15);
		flex-shrink: 0;
	}

	.profile-btn, .login-btn {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		text-decoration: none;
		transition: background 0.2s;
	}

	.profile-btn {
		background: rgba(99,102,241,0.12);
		border: 1px solid rgba(99,102,241,0.3);
	}
	.profile-btn:hover { background: rgba(99,102,241,0.22); }

	.login-btn {
		background: rgba(250,204,21,0.1);
		border: 1px solid rgba(250,204,21,0.3);
	}
	.login-btn:hover { background: rgba(250,204,21,0.18); }

	.profile-avatar-placeholder {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: rgba(99,102,241,0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	.anon-avatar-wrap {
		position: relative;
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}

	.anon-avatar {
		border-radius: 50%;
		overflow: hidden;
		display: flex;
	}

	.login-icon {
		font-size: 0.9rem;
		position: absolute;
		bottom: -2px;
		left: -4px;
	}

	.profile-btn-text, .login-btn-text {
		display: flex;
		flex-direction: column;
		text-align: right;
		flex: 1;
	}

	.profile-btn-name {
		font-size: 0.9rem;
		font-weight: 700;
		color: #e0e7ff;
	}

	.profile-btn-sub, .login-btn-sub {
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.login-btn-title {
		font-size: 0.9rem;
		font-weight: 700;
		color: #fde047;
	}

	/* ---- רשימת פרסומות ---- */
	.benefits-list {
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		flex: 1;
		min-height: 0;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		scrollbar-width: thin;
		scrollbar-color: rgba(99,102,241,0.3) transparent;
	}

	/* ---- כרטיס פרסומת ---- */
	.benefit-card {
		display: flex;
		gap: 0.75rem;
		background: rgba(255,255,255,0.05);
		border: 1px solid rgba(99,102,241,0.15);
		border-radius: 0.75rem;
		text-decoration: none;
		transition: background 0.2s, border-color 0.2s, transform 0.15s;
		padding: 0.75rem;
		align-items: stretch;
	}

	.benefit-card:hover {
		background: rgba(99,102,241,0.12);
		border-color: rgba(99,102,241,0.35);
		transform: scale(1.01);
	}

	.benefit-img-wrap {
		position: relative;
		width: 88px;
		min-height: 88px;
		border-radius: 0.5rem;
		overflow: hidden;
		flex-shrink: 0;
		background: #1e293b;
	}

	.benefit-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.benefit-body {
		flex: 1;
		min-width: 0;
	}

	.benefit-title {
		font-size: 0.9rem;
		font-weight: 700;
		color: #f1f5f9;
		margin: 0 0 0.2rem;
		line-height: 1.3;
		white-space: normal;
		word-break: break-word;
	}

	.benefit-desc {
		font-size: 0.75rem;
		color: #94a3b8;
		margin: 0 0 0.3rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.4;
	}

	.benefit-cta {
		display: inline-block;
		font-size: 0.7rem;
		color: #a5b4fc;
		font-weight: 600;
		background: rgba(99,102,241,0.12);
		border-radius: 4px;
		padding: 0.15rem 0.45rem;
	}

	/* ---- לשונית — מחוברת לקצה הימני של ה-drawer בתוך drawer-system ---- */
	.tab {
		position: absolute;
		left: 100%;
		z-index: 2;
		background: linear-gradient(180deg, rgba(79, 70, 229, 0.78), rgba(124, 58, 237, 0.78));
		backdrop-filter: blur(3px);
		-webkit-backdrop-filter: blur(3px);
		border: none;
		border-radius: 0 9px 9px 0;
		padding: 0.6rem 0.3rem;
		cursor: grab;
		box-shadow: 2px 0 6px rgba(79,70,229,0.25);
		transition: padding 0.2s ease, box-shadow 0.2s, border-radius 0.2s;
		touch-action: none;
		overscroll-behavior: contain;
		user-select: none;
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
	}

	.tab::after {
		content: '';
		width: 0;
		height: 0;
		border-top: 5px solid transparent;
		border-bottom: 5px solid transparent;
		border-left: 6px solid rgba(255, 255, 255, 0.9);
		filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.4));
	}

	.tab:hover {
		box-shadow: 2px 0 10px rgba(79,70,229,0.45);
	}

	.tab-dragging {
		cursor: grabbing;
		opacity: 0.85;
		transition: none;
	}

	.tab.tab-collapsed {
		padding: 0.35rem 0.2rem;
		gap: 0;
		border-radius: 0 6px 6px 0;
	}

	.tab.tab-collapsed::after {
		border-top-width: 4px;
		border-bottom-width: 4px;
		border-left-width: 5px;
	}

	.tab-text {
		writing-mode: vertical-rl;
		text-orientation: mixed;
		transform: rotate(180deg);
		font-size: 0.6rem;
		font-weight: 700;
		color: #fff;
		letter-spacing: 0.05em;
	}
</style>
