// ============================================================
// rateLimiter.ts — השהיה מנומסת בין בקשות (עם ג'יטר אקראי)
// ============================================================

export class RateLimiter {
	private lastAt = 0;

	constructor(
		private readonly minMs: number,
		private readonly maxMs: number,
	) {}

	/** ממתין עד שעבר לפחות minMs..maxMs (אקראי) מאז הקריאה הקודמת */
	async wait(): Promise<void> {
		const gap = this.minMs + Math.random() * (this.maxMs - this.minMs);
		const due = this.lastAt + gap;
		const now = Date.now();
		if (due > now) await sleep(due - now);
		this.lastAt = Date.now();
	}
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
