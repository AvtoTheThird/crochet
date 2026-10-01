-- Expose palette (colors + stitch counts) on gallery preview so everyone can see which colors a pattern needs.
-- count_results (full pattern data) remains restricted to owners and paid tiers.
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

	select u.subscription_tier into tier
	from public.users u
	where u.id = auth.uid();

	if tier in ('maker', 'lifetime') then
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
