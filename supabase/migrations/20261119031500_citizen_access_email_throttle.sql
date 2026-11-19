-- SITMAUD: never reveal private account email to the browser and limit repeats.
create table if not exists private.citizen_access_email_limits (
 contributor_id uuid primary key references public.contributors(id) on delete cascade,
 window_start timestamptz not null default now(),
 last_requested_at timestamptz not null default now(),
 attempts integer not null default 1
);
revoke all on private.citizen_access_email_limits from public,anon,authenticated;
create or replace function public.allow_citizen_access_email(p_contributor_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.role() is distinct from 'service_role' then
  raise exception 'Solo servicio institucional de correo' using errcode='42501';
 end if;
 if p_contributor_id is null then return false;end if;
 insert into private.citizen_access_email_limits(contributor_id,window_start,last_requested_at,attempts)
 values(p_contributor_id,now(),now(),1)
 on conflict(contributor_id) do update
 set last_requested_at=now(),
     window_start=case when private.citizen_access_email_limits.window_start<now()-interval '24 hours'
                       then now() else private.citizen_access_email_limits.window_start end,
     attempts=case when private.citizen_access_email_limits.window_start<now()-interval '24 hours'
                   then 1 else private.citizen_access_email_limits.attempts+1 end
 where private.citizen_access_email_limits.last_requested_at<now()-interval '90 seconds'
   and (private.citizen_access_email_limits.window_start<now()-interval '24 hours'
        or private.citizen_access_email_limits.attempts<5)
 returning contributor_id into v_id;
 return v_id is not null;
end; $$;
revoke all on function public.allow_citizen_access_email(uuid) from public,anon,authenticated;
grant execute on function public.allow_citizen_access_email(uuid) to service_role;