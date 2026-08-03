import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// מסך ה"סקירה" בוטל — הוא היה כפילות של פאנל הניהול הפרוס באזור האישי
// (/profile#admin): אותם אריחים, אותו כרטיס GA. הכתובת /admin נשארת חיה
// כהפניה, כי היא מקושרת מהיסטוריה/סימניות ומשמשת fallback לכפתור "חזור".
export const load: PageServerLoad = async () => {
	redirect(302, '/profile#admin');
};
