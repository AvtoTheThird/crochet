-- Gallery likes: one like per registered user per published project

alter table public.projects
	add column if not exists likes_count integer not null default 0;

create table if not exists public.gallery_likes (
	project_id uuid not null references public.projects (id) on delete cascade,
	user_id uuid not null references public.users (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (project_id, user_id)
);

create index if not exists gallery_likes_user_id_idx on public.gallery_likes (user_id);
create index if not exists gallery_likes_project_id_idx on public.gallery_likes (project_id);

alter table public.gallery_likes enable row level security;

drop policy if exists "gallery_likes_select" on public.gallery_likes;
create policy "gallery_likes_select"
	on public.gallery_likes for select
	using (true);

drop policy if exists "gallery_likes_insert" on public.gallery_likes;
create policy "gallery_likes_insert"
	on public.gallery_likes for insert
	with check (
		auth.uid() = user_id
		and exists (
			select 1
			from public.projects p
			where p.id = project_id
			  and p.is_published = true
		)
	);

drop policy if exists "gallery_likes_delete" on public.gallery_likes;
create policy "gallery_likes_delete"
	on public.gallery_likes for delete
	using (auth.uid() = user_id);

-- Keep projects.likes_count in sync
create or replace function public.gallery_likes_adjust_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if tg_op = 'INSERT' then
		update public.projects
		set likes_count = likes_count + 1
		where id = new.project_id;
		return new;
	elsif tg_op = 'DELETE' then
		update public.projects
		set likes_count = greatest(0, likes_count - 1)
		where id = old.project_id;
		return old;
	end if;
	return null;
end;
$$;

drop trigger if exists gallery_likes_count_ins on public.gallery_likes;
create trigger gallery_likes_count_ins
	after insert on public.gallery_likes
	for each row execute function public.gallery_likes_adjust_count();

drop trigger if exists gallery_likes_count_del on public.gallery_likes;
create trigger gallery_likes_count_del
	after delete on public.gallery_likes
	for each row execute function public.gallery_likes_adjust_count();

-- Toggle like (authenticated only)
create or replace function public.toggle_gallery_like(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	uid uuid := auth.uid();
	liked boolean;
	cnt integer;
begin
	if uid is null then
		raise exception 'NOT_LOGGED_IN' using errcode = 'P0001';
	end if;

	if not exists (
		select 1 from public.projects p
		where p.id = p_project_id and p.is_published = true
	) then
		raise exception 'NOT_FOUND' using errcode = 'P0002';
	end if;

	if exists (
		select 1 from public.gallery_likes gl
		where gl.project_id = p_project_id and gl.user_id = uid
	) then
		delete from public.gallery_likes
		where project_id = p_project_id and user_id = uid;
		liked := false;
	else
		insert into public.gallery_likes (project_id, user_id)
		values (p_project_id, uid);
		liked := true;
	end if;

	select likes_count into cnt from public.projects where id = p_project_id;

	return jsonb_build_object(
		'likes_count', coalesce(cnt, 0),
		'liked', liked
	);
end;
$$;

revoke all on function public.toggle_gallery_like(uuid) from public;
grant execute on function public.toggle_gallery_like(uuid) to authenticated;

-- Gallery list includes likes_count
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
	author_username text,
	likes_count integer
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
		coalesce(nullif(u.username, ''), 'maker') as author_username,
		p.likes_count
	from public.projects p
	join public.users u on u.id = p.user_id
	where p.is_published = true
	order by p.published_at desc nulls last
	limit greatest(1, least(coalesce(limit_count, 48), 100))
	offset greatest(0, coalesce(offset_count, 0));
$$;

revoke all on function public.list_gallery(integer, integer) from public;
grant execute on function public.list_gallery(integer, integer) to anon, authenticated;

-- Most liked for landing carousel
drop function if exists public.list_gallery_most_liked(integer);
create function public.list_gallery_most_liked(limit_count integer default 24)
returns table (
	id uuid,
	name text,
	gallery_description text,
	image_url text,
	image_width integer,
	image_height integer,
	published_at timestamptz,
	author_username text,
	likes_count integer
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
		coalesce(nullif(u.username, ''), 'maker') as author_username,
		p.likes_count
	from public.projects p
	join public.users u on u.id = p.user_id
	where p.is_published = true
	order by p.likes_count desc, p.published_at desc nulls last
	limit greatest(1, least(coalesce(limit_count, 24), 100));
$$;

revoke all on function public.list_gallery_most_liked(integer) from public;
grant execute on function public.list_gallery_most_liked(integer) to anon, authenticated;

-- Single item: likes_count + liked_by_me
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
