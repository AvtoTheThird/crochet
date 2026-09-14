-- Storage for cropped working-canvas PNGs

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'project-images',
	'project-images',
	false,
	10485760, -- 10 MB
	array['image/png']::text[]
)
on conflict (id) do nothing;

-- Path convention: {user_id}/{project_id}.png
create policy "project_images_select_own"
	on storage.objects for select
	using (
		bucket_id = 'project-images'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

create policy "project_images_insert_own"
	on storage.objects for insert
	with check (
		bucket_id = 'project-images'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

create policy "project_images_update_own"
	on storage.objects for update
	using (
		bucket_id = 'project-images'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

create policy "project_images_delete_own"
	on storage.objects for delete
	using (
		bucket_id = 'project-images'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

-- Published gallery previews (and maker clone downloads).
-- Uses security-definer helper so projects RLS (owner-only) does not block
-- anon/other users from createSignedUrl / download of published images.
create or replace function public.is_published_project_image(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1
		from public.projects p
		where p.is_published = true
		  and p.image_url = object_name
	);
$$;

revoke all on function public.is_published_project_image(text) from public;
grant execute on function public.is_published_project_image(text) to anon, authenticated, service_role;

drop policy if exists "project_images_select_published" on storage.objects;
create policy "project_images_select_published"
	on storage.objects for select
	using (
		bucket_id = 'project-images'
		and public.is_published_project_image(name)
	);
