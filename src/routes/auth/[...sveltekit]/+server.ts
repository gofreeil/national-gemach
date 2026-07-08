// כל בקשות /auth/* מטופלות ע"י ה-handle hook (src/hooks.server.ts) המבוסס על
// SvelteKitAuth. קובץ זה placeholder בלבד — ה-handle מיירט לפני שמגיעים לכאן.
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => { throw error(404); };
export const POST: RequestHandler = async () => { throw error(404); };
