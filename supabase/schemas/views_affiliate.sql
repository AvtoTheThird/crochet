-- Analytics: referred user counts derived from attribution (not stored on creators)

create or replace view public.creator_referral_stats
with (security_invoker = true)
as
select
	c.id as creator_id,
	c.name,
	c.commission_percentage_cut,
	count(ur.id)::integer as users_referred,
	count(ur.id) filter (where ur.locked_at is not null)::integer as users_referred_locked
from public.creators c
left join public.user_referrals ur on ur.creator_id = c.id
group by c.id, c.name, c.commission_percentage_cut;
