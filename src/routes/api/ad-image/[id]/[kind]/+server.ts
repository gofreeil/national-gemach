import type { RequestHandler } from './$types';
import { getApprovedAdImage, isAdImageKind } from '$lib/server/adsStore';
import { immutableImageResponse } from '$lib/server/inlineImage';

/**
 * תמונות הפרסומות - במקום base64 מוטבע בנתונים שנשלחים לדפדפן.
 *
 * הכתובת נושאת ?v=<חותם תוכן>, ולכן היא ייחודית לתמונה הזו: אם התמונה
 * מוחלפת משתנה גם החותם וגם הכתובת. זה מה שמאפשר קאש "לנצח" (immutable)
 * גם בדפדפן וגם בקצה - אחרי הבקשה הראשונה התמונה כבר לא יוצאת שוב מהשרת.
 *
 * מוגש מפרסומות מאושרות בלבד, כך שתמונות של פרסומת ממתינה/נדחית אינן
 * נחשפות דרך ניחוש מזהה.
 */
export const GET: RequestHandler = async ({ params }) => {
    if (!isAdImageKind(params.kind)) {
        return new Response(null, { status: 404 });
    }

    const img = await getApprovedAdImage(params.id, params.kind);
    if (!img) {
        return new Response(null, { status: 404 });
    }

    return immutableImageResponse(img);
};
