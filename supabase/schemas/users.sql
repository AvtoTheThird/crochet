-- Application user profile (1:1 with auth.users)

create table public.users (
	id uuid primary key references auth.users (id) on delete cascade,
	first_name text not null default '',
	last_name text not null default '',
	username text,
	email text,
	auth_provider public.auth_provider not null default 'email',
	auth_provider_token text,
	subscription_tier text not null default 'free'
		check (subscription_tier in ('free', 'maker', 'lifetime')),
	free_project_used boolean not null default false,
	subscription_updated_at timestamptz,
	is_active boolean not null default true,
	promo_code_used text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index users_subscription_tier_idx on public.users (subscription_tier);
create index users_is_active_idx on public.users (is_active);
create unique index users_username_lower_idx on public.users (lower(username)) where username is not null;
create unique index users_email_lower_idx on public.users (lower(email)) where email is not null;
