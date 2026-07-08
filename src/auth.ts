import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';
import Facebook from '@auth/sveltekit/providers/facebook';
import Credentials from '@auth/sveltekit/providers/credentials';
import type { Handle } from '@sveltejs/kit';
import {
	strapiLogin,
	getStrapiMe,
	getOrCreateStrapiJwt,
	readCookie
} from '$lib/server/strapiAuth';

const AUTH_SECRET          = process.env.AUTH_SECRET          ?? '';
const AUTH_GOOGLE_ID       = process.env.AUTH_GOOGLE_ID       ?? '';
const AUTH_GOOGLE_SECRET   = process.env.AUTH_GOOGLE_SECRET   ?? '';
const AUTH_FACEBOOK_ID     = process.env.AUTH_FACEBOOK_ID     ?? '';
const AUTH_FACEBOOK_SECRET = process.env.AUTH_FACEBOOK_SECRET ?? '';

// ============================================================
// אם AUTH_SECRET חסר — לא לאתחל SvelteKitAuth (מונע 500 בכל בקשה).
// כל הדפים ייטענו כמשתמש אנונימי.
// ============================================================
const noOpHandle: Handle = async ({ event, resolve }) => {
	event.locals.auth = async () => null;
	return resolve(event);
};
const noOpAction = async (): Promise<never> => {
	throw new Error('Auth disabled: AUTH_SECRET not configured');
};

// ספקי OAuth נטענים רק אם הוגדרו (אחרת Auth.js זורק על clientId ריק)
const providers = [
	Credentials({
		id: 'credentials',
		name: 'Email & Password',
		credentials: { email: {}, password: {} },
		async authorize(credentials) {
			if (!credentials?.email || !credentials?.password) return null;
			const emailLc = (credentials.email as string).trim().toLowerCase();
			try {
				const { jwt, user } = await strapiLogin(emailLc, credentials.password as string);
				return {
					id: String(user.id),
					name: user.username ?? '',
					email: user.email ?? emailLc,
					strapiJwt: jwt
				} as { id: string; name: string; email: string; strapiJwt: string };
			} catch {
				return null;
			}
		}
	}),
	// יוצאים לחירות (SSO) — זיהוי לפי העוגייה המשותפת gofreeil-auth
	Credentials({
		id: 'gofreeil-sso',
		name: 'יוצאים לחירות',
		credentials: {},
		async authorize(_credentials, request) {
			const jwt = readCookie(request?.headers?.get('cookie'), 'gofreeil-auth');
			if (!jwt) return null;
			const me = await getStrapiMe(jwt);
			if (!me?.email) return null;
			return {
				id: String(me.id),
				name: me.username ?? '',
				email: me.email,
				strapiJwt: jwt
			} as { id: string; name: string; email: string; strapiJwt: string };
		}
	})
];

if (AUTH_GOOGLE_ID && AUTH_GOOGLE_SECRET) {
	providers.unshift(Google({ clientId: AUTH_GOOGLE_ID, clientSecret: AUTH_GOOGLE_SECRET }) as never);
}
if (AUTH_FACEBOOK_ID && AUTH_FACEBOOK_SECRET) {
	providers.unshift(Facebook({ clientId: AUTH_FACEBOOK_ID, clientSecret: AUTH_FACEBOOK_SECRET }) as never);
}

export const { handle, signIn, signOut } = !AUTH_SECRET
	? (() => {
			console.warn('[auth] AUTH_SECRET missing - auth disabled (no-op fallback)');
			return { handle: noOpHandle, signIn: noOpAction, signOut: noOpAction };
		})()
	: SvelteKitAuth({
			secret: AUTH_SECRET,
			session: { maxAge: 365 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
			cookies: {
				sessionToken: {
					options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 365 * 24 * 60 * 60 }
				}
			},
			providers,
			callbacks: {
				async signIn({ user, account }) {
					if (!account || !user) return false;
					// credentials / SSO — ה-JWT כבר קיים על ה-user
					if (account.provider === 'credentials' || account.provider === 'gofreeil-sso') {
						return true;
					}
					// OAuth — משיג JWT של ה-Strapi המשותף
					const tempId = `${account.provider}_${account.providerAccountId}`;
					const jwt = await getOrCreateStrapiJwt(user.email, tempId, AUTH_SECRET);
					if (jwt) (user as { strapiJwt?: string }).strapiJwt = jwt;
					return true;
				},
				async jwt({ token, user, account }) {
					if (user && account) {
						token.provider = account.provider;
						if (user.email) token.email = user.email;
						if (user.name) token.name = user.name;
						token.dbUserId = user.id;
					}
					if (user && (user as { strapiJwt?: string }).strapiJwt) {
						token.strapiJwt = (user as { strapiJwt?: string }).strapiJwt;
					}
					return token;
				},
				session({ session, token }) {
					if (token.dbUserId) session.user.id = token.dbUserId as string;
					if (token.email) session.user.email = token.email as string;
					if (token.name) session.user.name = token.name as string;
					if (token.provider) (session.user as { provider?: string }).provider = token.provider as string;
					if (token.strapiJwt) (session.user as { strapiJwt?: string }).strapiJwt = token.strapiJwt as string;
					return session;
				}
			},
			pages: { signIn: '/login', error: '/login' },
			trustHost: true
		});
