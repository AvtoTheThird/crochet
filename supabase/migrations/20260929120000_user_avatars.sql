-- User avatars: profile column + public storage bucket.
-- Idempotent for scripts/apply-migration.mjs re-runs.

begin;

-- ========== users.avatar_url ==========
alter table public.users add column if not exists avatar_url text;

-- Clients may set their own avatar (column grants block other paid/reserved fields).
grant update (avatar_url) on table public.users to authenticated;

-- ========== avatars storage bucket ==========
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'avatars',
	'avatars',
	true, -- public read so <img src> works without signed URLs
	2097152, -- 2 MB
	array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do nothing;

-- Path convention: {user_id}/{file}. Owner-only writes; owner list/select.
drop policy if exists "avatars_select_own" on storage.objects;
create policy "avatars_select_own"
	on storage.objects for select
	to authenticated
	using (
		bucket_id = 'avatars'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
	on storage.objects for insert
	to authenticated
	with check (
		bucket_id = 'avatars'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
	on storage.objects for update
	to authenticated
	using (
		bucket_id = 'avatars'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
	on storage.objects for delete
	to authenticated
	using (
		bucket_id = 'avatars'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

-- Public read for the bucket (anyone can view an avatar via its public URL).
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
	on storage.objects for select
	to anon, authenticated
	using (bucket_id = 'avatars');

commit;
