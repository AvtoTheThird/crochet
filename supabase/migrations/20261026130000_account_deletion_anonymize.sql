-- Allow account deletion while retaining anonymized payment / commission
-- records required for tax and affiliate accounting.

alter table public.payments
	alter column user_id drop not null;

alter table public.payments
	drop constraint if exists payments_user_id_fkey;

alter table public.payments
	add constraint payments_user_id_fkey
	foreign key (user_id) references public.users (id) on delete set null;

alter table public.affiliate_commissions
	alter column user_id drop not null;

alter table public.affiliate_commissions
	drop constraint if exists affiliate_commissions_user_id_fkey;

alter table public.affiliate_commissions
	add constraint affiliate_commissions_user_id_fkey
	foreign key (user_id) references public.users (id) on delete set null;
