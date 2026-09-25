-- Admin helpers for referral attribution corrections (service role / dashboard)

create or replace function public.admin_unlock_user_referral(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
	perform set_config('app.bypass_referral_lock', 'true', true);

	update public.user_referrals
	set locked_at = null,
		updated_at = now()
	where id = p_id;

	if not found then
		return jsonb_build_object('ok', false, 'reason', 'not_found');
	end if;

	return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

revoke all on function public.admin_unlock_user_referral(uuid) from public;

create or replace function public.admin_reassign_user_referral(p_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	normalized text := public.normalize_referral_code(p_code);
	rc record;
begin
	if normalized is null then
		return jsonb_build_object('ok', false, 'reason', 'invalid_code');
	end if;

	select id, creator_id, code into rc
	from public.referral_codes
	where lower(code) = normalized
	  and active = true
	limit 1;

	if not found then
		return jsonb_build_object('ok', false, 'reason', 'code_not_found');
	end if;

	perform set_config('app.bypass_referral_lock', 'true', true);

	update public.user_referrals
	set creator_id = rc.creator_id,
		referral_code_id = rc.id,
		source = 'manual',
		updated_at = now()
	where id = p_id;

	if not found then
		return jsonb_build_object('ok', false, 'reason', 'not_found');
	end if;

	return jsonb_build_object(
		'ok', true,
		'id', p_id,
		'creator_id', rc.creator_id,
		'referral_code_id', rc.id,
		'code', rc.code
	);
end;
$$;

revoke all on function public.admin_reassign_user_referral(uuid, text) from public;
