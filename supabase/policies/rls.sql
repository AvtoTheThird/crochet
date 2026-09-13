-- Row Level Security

alter table public.users enable row level security;
alter table public.projects enable row level security;

-- users: read/update own row only
create policy "users_select_own"
	on public.users for select
	using (auth.uid() = id);

create policy "users_update_own"
	on public.users for update
	using (auth.uid() = id)
	with check (auth.uid() = id);

-- inserts happen via trigger (security definer); block direct client inserts
create policy "users_no_direct_insert"
	on public.users for insert
	with check (false);

-- projects: full CRUD for owner
create policy "projects_select_own"
	on public.projects for select
	using (auth.uid() = user_id);

create policy "projects_insert_own"
	on public.projects for insert
	with check (auth.uid() = user_id);

create policy "projects_update_own"
	on public.projects for update
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

create policy "projects_delete_own"
	on public.projects for delete
	using (auth.uid() = user_id);
