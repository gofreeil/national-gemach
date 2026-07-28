// ============================================================
// fingerprint.ts — טביעות אצבע לזיהוי כפילויות בין מועמדים לקיים
// ============================================================
//
// שלושה סוגי טביעות, מהחזק לחלש:
//   phone:<9 ספרות אחרונות>  — אותו טלפון = אותו גמ"ח, בכל פורמט כתיבה
//   name:<שם מנורמל>|city:<עיר מנורמלת> — אותו שם באותה עיר
//   url:<host+path מנורמל>   — אותו עמוד מקור
// התאמה של טביעה אחת מספיקה כדי להיחשב כפילות.

import { normalizeHebrew, normalizeName, phoneTail } from './text.ts';

export interface Fingerprintable {
	name?: string;
	city?: string;
	phone?: string;
	link?: string;
}

export function fingerprintsFor(entry: Fingerprintable): string[] {
	const fps: string[] = [];

	if (entry.phone) {
		const tail = phoneTail(entry.phone);
		if (tail.length >= 8) fps.push('phone:' + tail);
	}

	const name = entry.name ? normalizeName(entry.name) : '';
	if (name) {
		fps.push(`name:${name}|city:${normalizeHebrew(entry.city ?? '')}`);
	}

	const url = entry.link ? normalizeUrl(entry.link) : undefined;
	if (url) fps.push('url:' + url);

	return fps;
}

/** host+path בלי www, בלי query/fragment, בלי / סוגר — משווה קישורים שקולים */
export function normalizeUrl(link: string): string | undefined {
	try {
		const u = new URL(link);
		if (!u.protocol.startsWith('http')) return undefined;
		const host = u.hostname.toLowerCase().replace(/^www\./, '');
		const path = u.pathname.replace(/\/+$/, '').toLowerCase();
		return host + path;
	} catch {
		return undefined;
	}
}
