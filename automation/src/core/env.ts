// ============================================================
// env.ts — קריאת משתני סביבה עמידה ל-BOM
// ============================================================
//
// PowerShell 5.1 (ברירת המחדל ב-Windows) כותב קבצים עם BOM גם כשמבקשים
// -Encoding utf8. קובץ .env כזה נטען ע"י Node עם BOM דבוק לשם המשתנה
// הראשון, כך ש-process.env.STRAPI_TOKEN הוא undefined בזמן שהערך יושב
// תחת "﻿STRAPI_TOKEN" — כשל מבלבל במיוחד, כי הקובץ נראה תקין לגמרי.

const BOM = '﻿';

/** מחזיר משתנה סביבה, גם אם שמו נטען עם BOM מקדים */
export function readEnv(name: string): string | undefined {
	const direct = process.env[name];
	if (direct !== undefined && direct !== '') return direct;
	const bommed = process.env[BOM + name];
	if (bommed !== undefined && bommed !== '') return bommed;
	return direct ?? bommed;
}
