import type { RequestHandler } from './$types';
import { getStrapiMe } from '$lib/server/strapiAuth';
import { myAvatarResponse } from '$lib/server/userAvatar';

/** GET /api/me/avatar — תמונת פרופיל שהועלתה ידנית של המשתמש המחובר (ראה userAvatar.ts) */
export const GET: RequestHandler = async ({ locals }) => {
    const session = await locals.auth();
    const jwt = (session?.user as { strapiJwt?: string } | undefined)?.strapiJwt;
    const me = jwt ? await getStrapiMe(jwt) : null;
    return myAvatarResponse(me?.avatar_url);
};
