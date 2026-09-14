-- Fix gallery images: storage SELECT for published files must not depend on
-- projects RLS (owners-only), or only the uploader can createSignedUrl.

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
