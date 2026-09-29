-- Public storage for user avatars. Path convention: {user_id}/{file}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'avatars',
	'avatars',
	true,
	2097152, -- 2 MB
	array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do nothing;

create policy "avatars_insert_own"
	on storage.objects for insert
	to authenticated
	with check (
		bucket_id = 'avatars'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

create policy "avatars_update_own"
	on storage.objects for update
	to authenticated
	using (
		bucket_id = 'avatars'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

create policy "avatars_delete_own"
	on storage.objects for delete
	to authenticated
	using (
		bucket_id = 'avatars'
		and auth.uid()::text = (storage.foldername(name))[1]
	);

-- Public read (avatars are shown via public URL).
create policy "avatars_public_read"
	on storage.objects for select
	to anon, authenticated
	using (bucket_id = 'avatars');
