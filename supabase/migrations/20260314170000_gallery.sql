-- Gallery: publish personal projects + public preview; full data for makers via RPC

alter table public.projects
	add column if not exists is_published boolean not null default false,
	add column if not exists gallery_description text not null default '',
	add column if not exists published_at timestamptz,
	add column if not exists cloned_from_id uuid references public.projects (id) on delete set null;

create index if not exists projects_published_idx
	on public.projects (published_at desc)
	where is_published = true;

-- Anyone can read published project images (preview + maker clone download)
drop policy if exists "project_images_select_published" on storage.objects;
create policy "project_images_select_published"
	on storage.objects for select
	using (
		bucket_id = 'project-images'
		and exists (
			select 1
			from public.projects p
			where p.is_published = true
			  and p.image_url = name
		)
	);

-- Gallery list (preview fields only)
drop function if exists public.list_gallery(integer, integer);
create function public.list_gallery(limit_count integer default 48, offset_count integer default 0)
returns table (
	id uuid,
	name text,
	gallery_description text,
	image_url text,
	image_width integer,
	image_height integer,
	published_at timestamptz,
	author_username text
)
language sql
stable
security definer
set search_path = public
as $$
	select
		p.id,
		p.name,
		p.gallery_description,
		p.image_url,
		p.image_width,
		p.image_height,
		p.published_at,
		coalesce(nullif(u.username, ''), 'maker') as author_username
	from public.projects p
	join public.users u on u.id = p.user_id
	where p.is_published = true
	order by p.published_at desc nulls last
	limit greatest(1, least(coalesce(limit_count, 48), 100))
	offset greatest(0, coalesce(offset_count, 0));
$$;

revoke all on function public.list_gallery(integer, integer) from public;
grant execute on function public.list_gallery(integer, integer) to anon, authenticated;

-- Single gallery item: preview for everyone; full row JSON for owner or maker
create or replace function public.get_gallery_item(project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
	row public.projects%rowtype;
	author text;
	tier text;
	preview jsonb;
	full_row jsonb;
begin
	select p.* into row
	from public.projects p
	where p.id = project_id
	  and p.is_published = true;

	if not found then
		return null;
	end if;

	select coalesce(nullif(u.username, ''), 'maker') into author
	from public.users u
	where u.id = row.user_id;

	preview := jsonb_build_object(
		'id', row.id,
		'name', row.name,
		'gallery_description', row.gallery_description,
		'image_url', row.image_url,
		'image_width', row.image_width,
		'image_height', row.image_height,
		'published_at', row.published_at,
		'author_username', author,
		'access', 'preview'
	);

	if auth.uid() is null then
		return preview;
	end if;

	if auth.uid() = row.user_id then
		full_row := to_jsonb(row);
		full_row := full_row || jsonb_build_object('author_username', author, 'access', 'full');
		return full_row;
	end if;

	select u.subscription_tier into tier
	from public.users u
	where u.id = auth.uid();

	if tier = 'maker' then
		full_row := to_jsonb(row);
		full_row := full_row || jsonb_build_object('author_username', author, 'access', 'full');
		return full_row;
	end if;

	return preview;
end;
$$;

revoke all on function public.get_gallery_item(uuid) from public;
grant execute on function public.get_gallery_item(uuid) to anon, authenticated;
