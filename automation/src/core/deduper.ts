// ============================================================
// deduper.ts — אינדקס טביעות אצבע: מה כבר קיים אצלנו?
// ============================================================
//
// האינדקס נבנה בתחילת כל ריצה משלושה רבדים:
//   strapi — כל הגמ"חים ב-DB (בכל סטטוס: פעיל, טיוטה, נדחה)
//   static — הרשימה הסטטית שטרם יובאה (staticGemachim)
//   memory — זיכרון הייבוא של האוטומציה (Postgres/קובץ) — גם אם
//            האדמין מחק טיוטה, לא נייבא אותה שוב

import type { Candidate, ExistingEntry } from './types.ts';
import { fingerprintsFor } from './fingerprint.ts';

export interface DuplicateHit {
	fingerprint: string;
	ref: string;
	kind: ExistingEntry['kind'] | 'run';
}

export class Deduper {
	private readonly index = new Map<string, DuplicateHit>();

	get size(): number {
		return this.index.size;
	}

	addExisting(entries: ExistingEntry[]): void {
		for (const e of entries) {
			for (const fp of fingerprintsFor(e)) {
				if (!this.index.has(fp)) this.index.set(fp, { fingerprint: fp, ref: e.ref, kind: e.kind });
			}
		}
	}

	addFingerprints(fps: Iterable<string>, ref: string, kind: ExistingEntry['kind']): void {
		for (const fp of fps) {
			if (!this.index.has(fp)) this.index.set(fp, { fingerprint: fp, ref, kind });
		}
	}

	/** null = חדש; אחרת פרטי ההתאמה הקיימת הראשונה */
	check(candidate: Candidate): DuplicateHit | null {
		for (const fp of candidate.fingerprints) {
			const hit = this.index.get(fp);
			if (hit) return hit;
		}
		return null;
	}

	/** רישום מועמד שעבר — מונע כפילויות בתוך אותה ריצה */
	register(candidate: Candidate, ref: string): void {
		for (const fp of candidate.fingerprints) {
			if (!this.index.has(fp)) this.index.set(fp, { fingerprint: fp, ref, kind: 'run' });
		}
	}
}
