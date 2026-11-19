-- SITMAUD: solicitudes de restablecimiento ciudadano con límite por identidad,
-- sin exponer dirección de correo, contraseña ni pertenencia a un expediente.
create table if not exists private.citizen_recovery_throttle (
 identity_hash text primary key check (identity_hash ~ '^[0-9a-f]{64}$'),
 window_started timestamptz not null default now(),
 requests integer not null default 1
);
revoke all on private.citizen_recovery_throttle from public,anon,authenticated;
create or replace function public.allow_citizen_recovery_request(p_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 if auth.role() is distinct from 'service_role' then
   raise exception 'Solo servicio de recuperación' using errcode='42501';
 end if;
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then return false;end if;
 insert into private.citizen_recovery_throttle(identity_hash,window_started,requests)
 values(p_hash,now(),1)
 on conflict(identity_hash) do update
 set window_started=case when private.citizen_recovery_throttle.window_started < now()-interval '1 hour'
   then now() else private.citizen_recovery_throttle.window_started end,
 requests=case when private.citizen_recovery_throttle.window_started < now()-interval '1 hour'
   then 1 else private.citizen_recovery_throttle.requests+1 end
 returning requests into v_count;
 return v_count<=2;
end; $$;
revoke all on function public.allow_citizen_recovery_request(text) from public,anon,authenticated;
grant execute on function public.allow_citizen_recovery_request(text) to service_role;
