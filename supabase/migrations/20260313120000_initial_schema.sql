-- Initial schema: enums, users, projects, triggers, RLS, storage
-- Generated from supabase/schemas, policies, storage

begin;

-- ========== enums ==========
do $$ begin
	create type public.auth_provider as enum ('google');
exception
	when duplicate_object then null;
end $$;

-- ========== users ==========
create table if not exists public.users (
	id uuid primary key references auth.users (id) on delete cascade,
	first_name text not null default '',
	last_name text not null default '',
	auth_provider public.auth_provider not null default 'google',
	auth_provider_token text,
	subscription_tier text not null default 'free',
	is_active boolean not null default true,
	promo_code_used text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists users_subscription_tier_idx on public.users (subscription_tier);
create index if not exists users_is_active_idx on public.users (is_active);

-- ========== projects ==========
create table if not exists public.projects (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users (id) on delete cascade,
	name text not null,
	image_url text not null,
	image_width integer not null,
	image_height integer not null,
	pixel_width integer not null,
	pixel_height integer not null,
	color_tolerance integer not null default 20,
	start_direction text not null default 'left'
		check (start_direction in ('left', 'right')),
	palette jsonb not null default '[]'::jsonb,
	count_results jsonb not null default '[]'::jsonb,
	grid_opacity integer not null default 35,
	current_row integer not null default 0,
	completed_rows integer[] not null default '{}'::integer[],
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_updated_at_idx on public.projects (updated_at desc);

-- ========== triggers ==========
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
	before update on public.users
	for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
	before update on public.projects
	for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	full_name text;
	given_name text;
	family_name text;
	provider text;
	provider_token text;
begin
	full_name := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');
	given_name := coalesce(
		new.raw_user_meta_data ->> 'given_name',
		new.raw_user_meta_data ->> 'first_name',
		split_part(full_name, ' ', 1),
		''
	);
	family_name := coalesce(
		new.raw_user_meta_data ->> 'family_name',
		new.raw_user_meta_data ->> 'last_name',
		nullif(trim(both from substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''),
		''
	);
	provider := coalesce(new.raw_app_meta_data ->> 'provider', 'google');
	provider_token := new.raw_user_meta_data ->> 'provider_token';

	insert into public.users (
		id,
		first_name,
		last_name,
		auth_provider,
		auth_provider_token,
		subscription_tier,
		is_active
	) values (
		new.id,
		given_name,
		family_name,
		'google'::public.auth_provider,
		provider_token,
		'free',
		true
	)
	on conflict (id) do nothing;

	return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function public.handle_new_user();

-- ========== RLS ==========
alter table public.users enable row level security;
alter table public.projects enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
	on public.users for select
	using (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
	on public.users for update
	using (auth.uid() = id)
	with check (auth.uid() = id);

drop policy if exists "users_no_direct_insert" on public.users;
create policy "users_no_direct_insert"
	on public.users for insert
	with check (false);

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
	on public.projects for select
	using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
	on public.projects for insert
	with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
	on public.projects for update
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
	on public.projects for delete
	using (auth.uid() = user_id);

-- ========== storage ==========
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'project-images',
	'project-images',
	false,
	10485760,
	array['image/png']::text[]
)
on conflict (id) do update set
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project_images_select_own" on storage.objects;
create policy "project_images_select_own"
	on storage.objects for select
	using (
		bucket_id = 'project-images'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

drop policy if exists "project_images_insert_own" on storage.objects;
create policy "project_images_insert_own"
	on storage.objects for insert
	with check (
		bucket_id = 'project-images'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

drop policy if exists "project_images_update_own" on storage.objects;
create policy "project_images_update_own"
	on storage.objects for update
	using (
		bucket_id = 'project-images'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

drop policy if exists "project_images_delete_own" on storage.objects;
create policy "project_images_delete_own"
	on storage.objects for delete
	using (
		bucket_id = 'project-images'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

commit;
