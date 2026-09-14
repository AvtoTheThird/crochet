-- Add lifetime subscription tier (20 concurrent projects)

alter table public.users
	drop constraint if exists users_subscription_tier_check;

alter table public.users
	add constraint users_subscription_tier_check
	check (subscription_tier in ('free', 'maker', 'lifetime'));

-- Gallery full access for maker and lifetime
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

	if tier in ('maker', 'lifetime') then
		full_row := to_jsonb(row);
		full_row := full_row || jsonb_build_object('author_username', author, 'access', 'full');
		return full_row;
	end if;

	return preview;
end;
$$;
