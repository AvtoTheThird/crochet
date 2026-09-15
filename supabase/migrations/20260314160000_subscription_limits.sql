-- Subscription limits: free lifetime create flag + maker tier

alter table public.users
	add column if not exists free_project_used boolean not null default false,
	add column if not exists subscription_updated_at timestamptz;

-- Normalize unexpected tiers then constrain (include lifetime so re-applies stay compatible)
update public.users
set subscription_tier = 'free'
where subscription_tier is null
   or subscription_tier not in ('free', 'maker', 'lifetime');

alter table public.users
	drop constraint if exists users_subscription_tier_check;

alter table public.users
	add constraint users_subscription_tier_check
	check (subscription_tier in ('free', 'maker', 'lifetime'));

-- Backfill: free users who already have projects have used their free create
update public.users u
set free_project_used = true
where u.subscription_tier = 'free'
  and u.free_project_used = false
  and exists (
	select 1 from public.projects p where p.user_id = u.id
  );
