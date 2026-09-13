/**
 * Auth + Supabase helpers.
 */
export { getSupabase } from './client.js';
export {
	getSession,
	getUser,
	signInWithPassword,
	signUpWithPassword,
	signInWithGoogle,
	signOut,
	getUserProfile,
	syncProviderToken
} from './auth.js';
export { auth, initAuth, setAuthSession, isLoggedIn } from './session.svelte.js';
