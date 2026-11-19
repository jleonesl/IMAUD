-- SITMAUD: login limiter must not increase counts after a request is denied.
-- Keep the existing limit of eight attempts in a rolling 15-minute window.
create or replace function public.check_citizen_login_limit(p_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_id text;
begin
 if auth.role() is distinct from 'service_role' then
  raise exception 'No autorizado' using errcode='42501';
 end if;
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then return false; end if;
 insert into private.citizen_auth_attempts(key_hash,period_start,attempts)
 values(p_hash,now(),1)
 on conflict(key_hash) do update set
 period_start=case when private.citizen_auth_attempts.period_start<=now()-interval '15 minutes'
   then now() else private.citizen_auth_attempts.period_start end,
 attempts=case when private.citizen_auth_attempts.period_start<=now()-interval '15 minutes'
   then 1 else private.citizen_auth_attempts.attempts+1 end
 where private.citizen_auth_attempts.period_start<=now()-interval '15 minutes'
    or private.citizen_auth_attempts.attempts<8
 returning key_hash into v_id;
 return v_id is not null;
end; $$;
revoke all on function public.check_citizen_login_limit(text) from public,anon,authenticated;
grant execute on function public.check_citizen_login_limit(text) to service_role;