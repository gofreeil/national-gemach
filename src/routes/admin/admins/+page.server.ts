import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAdminContext, requireSuperAdmin, getBootstrapAdmins } from '$lib/server/admin';
import { getAdmins, addAdmin, removeAdmin, setAdminRole, type AdminRole } from '$lib/server/adminStore';

export const load: PageServerLoad = async ({ locals }) => {
	const { role } = await getAdminContext(locals);
	requireSuperAdmin(role);
	return {
		admins: await getAdmins(false),
		bootstrap: getBootstrapAdmins()
	};
};

function asRole(v: FormDataEntryValue | null): AdminRole {
	return v === 'super_admin' ? 'super_admin' : 'admin';
}

export const actions: Actions = {
	add: async ({ locals, request }) => {
		const { role } = await getAdminContext(locals);
		requireSuperAdmin(role);

		const fd = await request.formData();
		const identifier = ((fd.get('identifier') as string) ?? '').trim();
		const display = ((fd.get('display') as string) ?? '').trim();
		const newRole = asRole(fd.get('role'));
		if (!identifier) return fail(400, { error: 'יש להזין מייל / שם משתמש / טלפון' });

		try {
			await addAdmin(identifier, newRole, display || undefined);
		} catch (e) {
			console.error('[admin] addAdmin failed:', e);
			return fail(500, { error: 'הוספת האדמין נכשלה. נסה שוב.' });
		}
		throw redirect(303, '/admin/admins?flash=added');
	},

	setRole: async ({ locals, request }) => {
		const { role } = await getAdminContext(locals);
		requireSuperAdmin(role);
		const fd = await request.formData();
		const id = (fd.get('id') as string) ?? '';
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try {
			await setAdminRole(id, asRole(fd.get('role')));
		} catch (e) {
			console.error('[admin] setAdminRole failed:', e);
			return fail(500, { error: 'עדכון התפקיד נכשל' });
		}
		throw redirect(303, '/admin/admins?flash=updated');
	},

	remove: async ({ locals, request }) => {
		const { role } = await getAdminContext(locals);
		requireSuperAdmin(role);
		const id = ((await request.formData()).get('id') as string) ?? '';
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try {
			await removeAdmin(id);
		} catch (e) {
			console.error('[admin] removeAdmin failed:', e);
			return fail(500, { error: 'הסרת האדמין נכשלה' });
		}
		throw redirect(303, '/admin/admins?flash=removed');
	}
};
