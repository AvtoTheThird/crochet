/**
 * Public gallery: list/preview, publish from studio, clone into own projects.
 */
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { getSupabase } from './client.js';
import { auth } from './session.svelte.js';
import {
	assertCanCreateProject,
	isPaid,
	markFreeProjectUsed
} from './entitlements.js';

const BUCKET = 'project-images';

/**
 * @param {string} path
 * @param {number} [expiresIn]
 */
export async function signedProjectImageUrl(path, expiresIn = 3600) {
	if (!path) return null;
	const supabase = getSupabase();
	const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
	if (error) {
		console.warn('signed url:', error.message);
		return null;
	}
	return data?.signedUrl ?? null;
}

/**
 * @param {number} [limit]
 * @param {number} [offset]
 */
export async function listGallery(limit = 48, offset = 0) {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('list_gallery', {
		limit_count: limit,
		offset_count: offset
	});
	if (error) throw error;
	const rows = data || [];
	return Promise.all(
		rows.map(async (row) => ({
			...row,
			imageSrc: await signedProjectImageUrl(row.image_url)
		}))
	);
}

/**
 * @param {string} projectId
 */
export async function getGalleryItem(projectId) {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('get_gallery_item', { project_id: projectId });
	if (error) throw error;
	if (!data) return null;
	const imageSrc = await signedProjectImageUrl(data.image_url);
	return { ...data, imageSrc };
}

/**
 * Publish (or update description of) an owned project in the gallery.
 * @param {string} projectId
 * @param {string} description
 */
export async function publishProjectToGallery(projectId, description) {
	const userId = auth.user?.id;
	if (!userId) throw new Error('Log in to publish.');

	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('projects')
		.update({
			is_published: true,
			gallery_description: (description || '').trim(),
			published_at: new Date().toISOString()
		})
		.eq('id', projectId)
		.eq('user_id', userId)
		.select('id, is_published, gallery_description, published_at')
		.single();
	if (error) throw error;
	return data;
}

/**
 * @param {string} projectId
 */
export async function unpublishProjectFromGallery(projectId) {
	const userId = auth.user?.id;
	if (!userId) throw new Error('Log in to unpublish.');

	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('projects')
		.update({
			is_published: false,
			published_at: null
		})
		.eq('id', projectId)
		.eq('user_id', userId)
		.select('id, is_published')
		.single();
	if (error) throw error;
	return data;
}

/**
 * Copy a gallery project into the current user's projects (counts toward create limit).
 * Requires Maker (full access) unless the listing is your own.
 * @param {string} galleryProjectId
 */
export async function addGalleryProjectToMine(galleryProjectId) {
	const userId = auth.user?.id;
	if (!userId) {
		if (browser) await goto(resolve('/login'));
		throw Object.assign(new Error('Log in to add gallery projects.'), { code: 'NOT_LOGGED_IN' });
	}

	const item = await getGalleryItem(galleryProjectId);
	if (!item) throw new Error('Gallery project not found.');

	const isOwner = item.user_id === userId;
	if (!isOwner && item.access !== 'full' && !isPaid()) {
		if (browser) await goto(resolve('/pricing'));
		throw Object.assign(new Error('A paid plan is required for full gallery access.'), {
			code: 'GALLERY_LOCKED'
		});
	}

	if (item.access !== 'full' && !isOwner) {
		if (browser) await goto(resolve('/pricing'));
		throw Object.assign(new Error('A paid plan is required for full gallery access.'), {
			code: 'GALLERY_LOCKED'
		});
	}

	await assertCanCreateProject();

	const supabase = getSupabase();
	const { data: file, error: dlError } = await supabase.storage
		.from(BUCKET)
		.download(item.image_url);
	if (dlError) throw dlError;

	const newId = crypto.randomUUID();
	const newPath = `${userId}/${newId}.png`;
	const { error: upError } = await supabase.storage.from(BUCKET).upload(newPath, file, {
		contentType: 'image/png',
		upsert: false,
		cacheControl: '3600'
	});
	if (upError) throw upError;

	const row = {
		id: newId,
		user_id: userId,
		name: item.name || 'Gallery pattern',
		image_url: newPath,
		image_width: item.image_width,
		image_height: item.image_height,
		pixel_width: item.pixel_width ?? 8,
		pixel_height: item.pixel_height ?? 8,
		color_tolerance: item.color_tolerance ?? 20,
		start_direction: item.start_direction === 'right' ? 'right' : 'left',
		palette: item.palette ?? [],
		count_results: item.count_results ?? [],
		grid_opacity: item.grid_opacity ?? 35,
		current_row: 0,
		completed_rows: [],
		studio_step: item.studio_step ?? 5,
		walk_index: 0,
		is_published: false,
		gallery_description: '',
		published_at: null,
		cloned_from_id: galleryProjectId
	};

	const { data, error } = await supabase.from('projects').insert(row).select().single();
	if (error) throw error;

	await markFreeProjectUsed();
	return data;
}
