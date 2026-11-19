-- SITMAUD: los intentos denegados no incrementan el contador.
-- Conserva la ventana vigente y el umbral de 2 solicitudes por hora.
create or replace function public.allow_citizen_recovery_request(p_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_id text;
begin
 if auth.role() is distinct from 'service_role' then
  raise exception 'Solo servicio de recuperación' using errcode='42501';
 end if;
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then return false;end if;
 insert into private.citizen_recovery_throttle(identity_hash,window_started,requests)
 values(p_hash,now(),1)
 on conflict(identity_hash) do update
 set window_started=case when private.citizen_recovery_throttle.window_started <= now()-interval '1 hour'
                         then now() else private.citizen_recovery_throttle.window_started end,
     requests=case when private.citizen_recovery_throttle.window_started <= now()-interval '1 hour'
                   then 1 else private.citizen_recovery_throttle.requests+1 end
 where private.citizen_recovery_throttle.window_started <= now()-interval '1 hour'
    or private.citizen_recovery_throttle.requests<2
 returning identity_hash into v_id;
 return v_id is not null;
end; $$;
revoke all on function public.allow_citizen_recovery_request(text) from public,anon,authenticated;
grant execute on function public.allow_citizen_recovery_request(text) to service_role;