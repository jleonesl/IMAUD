-- SITMAUD · Paso 7: titularidad del superusuario, permisos y auditoría de solo anexado.
create table if not exists private.sitmaud_master_owner(
 singleton boolean primary key default true check(singleton),
 user_id uuid not null unique references auth.users(id),
 registered_at timestamptz not null default now()
);
revoke all on table private.sitmaud_master_owner from public,anon,authenticated;
do $$
declare v_count int; v_owner uuid;
begin
 select count(*),(array_agg(user_id))[1] into v_count,v_owner
 from public.staff_profiles where role='intendente' and is_active=true;
 if not exists(select 1 from private.sitmaud_master_owner) then
   if v_count<>1 then raise exception 'No es posible identificar un superusuario maestro único; revisión administrativa requerida.';end if;
   insert into private.sitmaud_master_owner(singleton,user_id) values(true,v_owner);
 end if;
end $$;

create or replace function public.is_sitmaud_master()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from private.sitmaud_master_owner m
 join public.staff_profiles s on s.user_id=m.user_id
 where m.user_id=auth.uid() and s.is_active=true and s.role='intendente'); $$;
revoke all on function public.is_sitmaud_master() from public,anon;
grant execute on function public.is_sitmaud_master() to authenticated;

create or replace function public.has_permission(permission_code text)
returns boolean language sql stable security definer set search_path=''
as $$ select coalesce(
 public.is_sitmaud_master()
 or exists(select 1 from public.staff_permissions p
 join public.staff_profiles s on s.user_id=p.user_id and s.is_active=true
 where p.user_id=auth.uid() and p.permission_code=permission_code
   and permission_code not in ('staff.manage','permissions.manage','settings.manage')),
 false); $$;
revoke all on function public.has_permission(text) from public,anon;
grant execute on function public.has_permission(text) to authenticated;

create or replace function public.set_staff_permission(
 p_user_id uuid,p_code text,p_enabled boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_target public.staff_profiles%rowtype;
begin
 if v_actor is null or not public.is_sitmaud_master() then
   raise exception 'Solo el superusuario maestro puede asignar permisos' using errcode='42501';
 end if;
 select * into v_target from public.staff_profiles where user_id=p_user_id for update;
 if not found or not v_target.is_active then raise exception 'Funcionario activo no encontrado'; end if;
 if p_user_id=v_actor or v_target.role='intendente' then
   raise exception 'Los permisos de intendencia no se modifican mediante la matriz de funcionarios';
 end if;
 if not exists(select 1 from public.permissions where code=p_code) then raise exception 'Permiso no reconocido';end if;
 if p_code in ('staff.manage','permissions.manage','settings.manage',
   'debt_relief.request','debt_relief.review') then
   raise exception 'Permiso reservado al superusuario o procedimiento retirado.';
 end if;
 if p_enabled is null then raise exception 'Especifica si se concede o revoca el permiso';end if;
 if p_enabled then
  insert into public.staff_permissions(user_id,permission_code,granted_by)
  values(p_user_id,p_code,v_actor) on conflict(user_id,permission_code) do nothing;
 else
  delete from public.staff_permissions where user_id=p_user_id and permission_code=p_code;
 end if;
 insert into public.audit_log(actor_user_id,action,entity_table,entity_id,after_data)
 values(v_actor,case when p_enabled then 'staff_permission_granted' else 'staff_permission_revoked' end,
  'staff_permissions',p_user_id::text,jsonb_build_object('permission',p_code,'enabled',p_enabled));
 return jsonb_build_object('user_id',p_user_id,'permission',p_code,'enabled',p_enabled);
end; $$;

create or replace function public.set_staff_job_title(
 p_user_id uuid,p_job_title text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_target public.staff_profiles%rowtype;v_title text:=nullif(btrim(p_job_title),'');
begin
 if v_actor is null or not public.is_sitmaud_master() then
   raise exception 'Solo el superusuario maestro puede cambiar cargos' using errcode='42501';end if;
 if v_title is null or length(v_title)>120 then raise exception 'Cargo obligatorio, máximo 120 caracteres';end if;
 select * into v_target from public.staff_profiles where user_id=p_user_id for update;
 if not found or v_target.role='intendente' then raise exception 'Funcionario no encontrado o intendente protegido';end if;
 update public.staff_profiles set job_title=v_title where user_id=p_user_id;
 insert into public.audit_log(actor_user_id,action,entity_table,entity_id,before_data,after_data)
 values(v_actor,'staff_job_title_updated','staff_profiles',p_user_id::text,
 jsonb_build_object('job_title',v_target.job_title),jsonb_build_object('job_title',v_title));
 return jsonb_build_object('user_id',p_user_id,'job_title',v_title);
end; $$;

-- Eliminamos concesiones legacy de funciones de solicitudes, no los registros históricos.
revoke all on function public.submit_debt_relief_request(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.apply_authorized_debt_exonerations(uuid[]) from public,anon,authenticated;
-- Las operaciones privilegiadas no se pueden reproducir con INSERT/UPDATE directo vía REST.
revoke all on public.audit_log,public.staff_permissions,public.staff_profiles from anon,authenticated;
grant select on public.audit_log,public.staff_permissions,public.staff_profiles to authenticated;
-- La bitácora se escribe solo por funciones de servidor y nunca se puede truncar desde sesiones REST.
