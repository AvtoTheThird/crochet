-- Affiliate / content creators
-- Referral codes live in referral_codes (normalized); creators do not store a code column.

create table public.creators (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	channel_url text,
	commission_percentage_cut numeric(5, 2) not null
		check (commission_percentage_cut >= 0 and commission_percentage_cut <= 100),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index creators_name_idx on public.creators (lower(name));
