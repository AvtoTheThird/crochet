-- Affiliate referral helpers + lock enforcement

create or replace function public.normalize_referral_code(p_code text)
returns text
language sql
immutable
as $$
	select nullif(lower(trim(p_code)), '');
$$;

/**
 * Public lookup for cookie capture. Returns only non-sensitive fields.
 * Does not create attribution — commissions never trust the cookie alone.
 */
create or replace function public.lookup_active_referral_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
	normalized text := public.normalize_referral_code(p_code);
	rec record;
begin
	if normalized is null then
		return jsonb_build_object('valid', false, 'reason', 'empty');
	end if;

	select
		rc.id as referral_code_id,
		rc.code,
		rc.creator_id,
		c.name as creator_name
	into rec
	from public.referral_codes rc
	join public.creators c on c.id = rc.creator_id
	where lower(rc.code) = normalized
	  and rc.active = true
	limit 1;

	if not found then
		return jsonb_build_object('valid', false, 'reason', 'not_found');
	end if;

	return jsonb_build_object(
		'valid', true,
		'referral_code_id', rec.referral_code_id,
		'code', rec.code,
		'creator_id', rec.creator_id,
		'creator_name', rec.creator_name
	);
end;
$$;

revoke all on function public.lookup_active_referral_code(text) from public;
grant execute on function public.lookup_active_referral_code(text) to anon, authenticated;

/**
 * Apply or update referral attribution for the authenticated user.
 *
 * Rules:
 * - Attribution is unlocked until locked_at is set.
 * - locked_at is set when the first earn commission is created for the user.
 * - source=cookie only inserts when no attribution exists (never overrides manual/prior).
 * - source=manual overrides existing unlocked attribution (including cookie).
 * - After lock, changes are rejected (admin bypass via app.bypass_referral_lock).
 */
create or replace function public.apply_referral_attribution(p_code text, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	uid uuid := auth.uid();
	normalized text := public.normalize_referral_code(p_code);
	src text := lower(trim(p_source));
	rc record;
	existing public.user_referrals%rowtype;
	bypass boolean := coalesce(current_setting('app.bypass_referral_lock', true), '') = 'true';
begin
	if uid is null then
		raise exception 'not_authenticated' using errcode = '42501';
	end if;

	if src is null or src not in ('cookie', 'manual') then
		raise exception 'invalid_source' using errcode = '22023';
	end if;

	if normalized is null then
		raise exception 'invalid_code' using errcode = '22023';
	end if;

	select
		rc0.id,
		rc0.creator_id,
		rc0.code
	into rc
	from public.referral_codes rc0
	where lower(rc0.code) = normalized
	  and rc0.active = true
	limit 1;

	if not found then
		return jsonb_build_object('ok', false, 'reason', 'invalid_code');
	end if;

	select * into existing
	from public.user_referrals ur
	where ur.user_id = uid;

	if found then
		if existing.locked_at is not null and not bypass then
			return jsonb_build_object(
				'ok', false,
				'reason', 'locked',
				'locked_at', existing.locked_at,
				'creator_id', existing.creator_id,
				'referral_code_id', existing.referral_code_id
			);
		end if;

		-- Cookie must not override an existing attribution
		if src = 'cookie' then
			return jsonb_build_object(
				'ok', true,
				'unchanged', true,
				'reason', 'already_attributed',
				'creator_id', existing.creator_id,
				'referral_code_id', existing.referral_code_id,
				'source', existing.source
			);
		end if;

		-- Manual override (or admin bypass)
		update public.user_referrals
		set
			creator_id = rc.creator_id,
			referral_code_id = rc.id,
			source = src,
			updated_at = now()
		where user_id = uid;

		return jsonb_build_object(
			'ok', true,
			'updated', true,
			'creator_id', rc.creator_id,
			'referral_code_id', rc.id,
			'code', rc.code,
			'source', src
		);
	end if;

	insert into public.user_referrals (
		user_id,
		creator_id,
		referral_code_id,
		source
	) values (
		uid,
		rc.creator_id,
		rc.id,
		src
	);

	return jsonb_build_object(
		'ok', true,
		'created', true,
		'creator_id', rc.creator_id,
		'referral_code_id', rc.id,
		'code', rc.code,
		'source', src
	);
end;
$$;

revoke all on function public.apply_referral_attribution(text, text) from public;
grant execute on function public.apply_referral_attribution(text, text) to authenticated;

-- Block client changes to locked attribution rows (service_role still hits triggers)
create or replace function public.enforce_user_referral_lock()
returns trigger
language plpgsql
as $$
declare
	bypass boolean := coalesce(current_setting('app.bypass_referral_lock', true), '') = 'true';
begin
	if tg_op = 'UPDATE'
		and old.locked_at is not null
		and not bypass
		and (
			new.creator_id is distinct from old.creator_id
			or new.referral_code_id is distinct from old.referral_code_id
			or new.source is distinct from old.source
			or (new.locked_at is distinct from old.locked_at and new.locked_at is null)
		)
	then
		raise exception 'referral attribution is locked'
			using errcode = 'P0001';
	end if;
	return new;
end;
$$;

drop trigger if exists user_referrals_enforce_lock on public.user_referrals;
create trigger user_referrals_enforce_lock
	before update on public.user_referrals
	for each row execute function public.enforce_user_referral_lock();

-- Lock attribution when first earn commission is recorded
create or replace function public.lock_referral_on_commission_earn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if new.entry_kind = 'earn' then
		update public.user_referrals
		set locked_at = coalesce(locked_at, now()),
			updated_at = now()
		where user_id = new.user_id
		  and locked_at is null;
	end if;
	return new;
end;
$$;

drop trigger if exists affiliate_commissions_lock_referral on public.affiliate_commissions;
create trigger affiliate_commissions_lock_referral
	after insert on public.affiliate_commissions
	for each row execute function public.lock_referral_on_commission_earn();

create or replace function public.set_creators_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

-- Reuse shared set_updated_at where possible; dedicated triggers below in migration
