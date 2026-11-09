-- Timed admin entitlements: optional expiry on users.subscription_tier.
-- null subscription_expires_at = no expiry (permanent paid / free).
-- When set and in the past, access should be treated as free.

alter table public.users
	add column if not exists subscription_expires_at timestamptz;

comment on column public.users.subscription_expires_at is
	'When set, paid subscription_tier ends at this time (admin grants). Null = permanent.';

create index if not exists users_subscription_expires_at_idx
	on public.users (subscription_expires_at)
	where subscription_expires_at is not null;

-- Shared paid-access check (tier + optional expiry).
create or replace function public.user_has_paid_access(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1
		from public.users u
		where u.id = p_user_id
		  and u.subscription_tier in ('maker', 'lifetime')
		  and (
			u.subscription_expires_at is null
			or u.subscription_expires_at > now()
		  )
	);
$$;

revoke all on function public.user_has_paid_access(uuid) from public;
grant execute on function public.user_has_paid_access(uuid) to anon, authenticated, service_role;

-- Gallery full access must respect timed grants.
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
	preview jsonb;
	full_row jsonb;
	liked boolean := false;
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

	if auth.uid() is not null then
		select exists (
			select 1 from public.gallery_likes gl
			where gl.project_id = row.id and gl.user_id = auth.uid()
		) into liked;
	end if;

	preview := jsonb_build_object(
		'id', row.id,
		'name', row.name,
		'gallery_description', row.gallery_description,
		'image_url', row.image_url,
		'image_width', row.image_width,
		'image_height', row.image_height,
		'palette', row.palette,
		'published_at', row.published_at,
		'author_username', author,
		'likes_count', row.likes_count,
		'liked_by_me', liked,
		'access', 'preview'
	);

	if auth.uid() is null then
		return preview;
	end if;

	if auth.uid() = row.user_id then
		full_row := to_jsonb(row);
		full_row := full_row || jsonb_build_object(
			'author_username', author,
			'likes_count', row.likes_count,
			'liked_by_me', liked,
			'access', 'full'
		);
		return full_row;
	end if;

	if public.user_has_paid_access(auth.uid()) then
		full_row := to_jsonb(row);
		full_row := full_row || jsonb_build_object(
			'author_username', author,
			'likes_count', row.likes_count,
			'liked_by_me', liked,
			'access', 'full'
		);
		return full_row;
	end if;

	return preview;
end;
$$;

revoke all on function public.get_gallery_item(uuid) from public;
grant execute on function public.get_gallery_item(uuid) to anon, authenticated;
