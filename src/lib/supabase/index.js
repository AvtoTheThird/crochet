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
	syncProviderToken,
	finalizeSignupReferral
} from './auth.js';
export { auth, initAuth, setAuthSession, isLoggedIn } from './session.svelte.js';
export {
	canCreateProject,
	assertCanCreateProject,
	markFreeProjectUsed,
	upgradeToMakerDummy,
	upgradeTierDummy,
	projectQuotaLabel,
	projectLimitForTier,
	MAKER_PROJECT_LIMIT,
	LIFETIME_PROJECT_LIMIT,
	currentTier,
	isMaker,
	isLifetime,
	isPaid
} from './entitlements.js';
export {
	listGallery,
	listGalleryMostLiked,
	getGalleryItem,
	toggleGalleryLike,
	publishProjectToGallery,
	unpublishProjectFromGallery,
	addGalleryProjectToMine,
	signedProjectImageUrl
} from './gallery.js';
export {
	updateDisplayName,
	changePassword,
	uploadAvatar,
	getMySubscription,
	getMyPaddleCustomerId,
	cancelMySubscription
} from './profile.js';
