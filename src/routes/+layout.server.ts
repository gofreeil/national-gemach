import type { LayoutServerLoad } from './$types';

// חושף את הסשן (אם יש) לכל הדפים — כדי שההאדר יציג מצב מחובר/כפתור התחברות.
export const load: LayoutServerLoad = async ({ locals }) => {
	const session = await locals.auth();
	return {
		user: session?.user
			? { id: session.user.id, name: session.user.name ?? '', email: session.user.email ?? '' }
			: null
	};
};
