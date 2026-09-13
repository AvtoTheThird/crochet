-- Part 2: username/email columns, login helper, updated signup trigger

alter table public.users
	add column if not exists username text,
	add column if not exists email text;

alter table public.users
	alter column auth_provider set default 'email';

create unique index if not exists users_username_lower_idx
	on public.users (lower(username))
	where username is not null;

create unique index if not exists users_email_lower_idx
	on public.users (lower(email))
	where email is not null;

create or replace function public.email_for_login(identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
	id text := lower(trim(identifier));
	found text;
begin
	if id is null or id = '' then
		return null;
	end if;

	if position('@' in id) > 0 then
		return id;
	end if;

	select lower(u.email) into found
	from public.users u
	where u.username is not null
	  and lower(u.username) = id
	limit 1;

	return found;
end;
$$;

revoke all on function public.email_for_login(text) from public;
grant execute on function public.email_for_login(text) to anon, authenticated;

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
	uname text;
	uemail text;
	provider_enum public.auth_provider;
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
	provider := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
	provider_token := new.raw_user_meta_data ->> 'provider_token';
	uname := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
	uemail := lower(coalesce(new.email, new.raw_user_meta_data ->> 'email', ''));

	provider_enum := case
		when provider = 'google' then 'google'::public.auth_provider
		else 'email'::public.auth_provider
	end;

	insert into public.users (
		id,
		first_name,
		last_name,
		username,
		email,
		auth_provider,
		auth_provider_token,
		subscription_tier,
		is_active
	) values (
		new.id,
		given_name,
		family_name,
		uname,
		nullif(uemail, ''),
		provider_enum,
		provider_token,
		'free',
		true
	)
	on conflict (id) do update set
		first_name = excluded.first_name,
		last_name = excluded.last_name,
		username = coalesce(excluded.username, public.users.username),
		email = coalesce(excluded.email, public.users.email),
		auth_provider = excluded.auth_provider;

	return new;
end;
$$;
