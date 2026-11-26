-- SITMAUD: catálogo territorial y separación entre propietario y responsable de pago.
-- Los condominios consolidados conservan su flujo y sus tablas actuales.

create table if not exists public.territorial_areas (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete restrict,
  name text not null,
  area_type text not null check (area_type in ('sector','comunidad','urbanizacion_privada','villa_privada')),
  typology_code text not null check (typology_code in ('TIPO I','TIPO II','TIPO III')),
  is_active boolean not null default true,
  created_by uuid,
  typology_assigned_by uuid,
  typology_assigned_at timestamptz not null default now(),
  typology_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists territorial_areas_name_unique_idx
  on public.territorial_areas(parish_id,area_type,lower(name));
create index if not exists territorial_areas_parish_type_idx
  on public.territorial_areas(parish_id,area_type) where is_active;

alter table public.territorial_areas enable row level security;
alter table public.properties
  add column if not exists territorial_area_id uuid references public.territorial_areas(id) on delete restrict;
create index if not exists properties_territorial_area_idx
  on public.properties(territorial_area_id);

-- El propietario puede no ser el contribuyente que recibe la cuenta y paga el servicio.
-- Se conserva como ficha propia sin obligarlo a crear un usuario ciudadano.
create table if not exists public.property_owners (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  owner_name text not null,
  identification_type text not null,
  identification_number text not null,
  phone text,
  email text,
  is_current boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (length(btrim(owner_name))>=3),
  check (length(btrim(identification_number))>=4)
);
create unique index if not exists property_owners_one_current_idx
  on public.property_owners(property_id) where is_current;
create index if not exists property_owners_identity_idx
  on public.property_owners(upper(identification_type),upper(identification_number));

create table if not exists public.property_owner_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  previous_owner_id uuid references public.property_owners(id),
  new_owner_id uuid references public.property_owners(id),
  changed_on date not null default current_date,
  reason text not null,
  changed_by uuid,
  recorded_at timestamptz not null default now()
);
create index if not exists property_owner_history_property_idx
  on public.property_owner_history(property_id,recorded_at desc);

alter table public.property_owners enable row level security;
alter table public.property_owner_history enable row level security;

drop policy if exists territorial_areas_read on public.territorial_areas;
create policy territorial_areas_read on public.territorial_areas
  for select to authenticated
  using (public.has_permission('properties.read') or public.has_permission('properties.create'));

drop policy if exists property_owners_read on public.property_owners;
create policy property_owners_read on public.property_owners
  for select to authenticated using (public.has_permission('properties.read'));
drop policy if exists property_owner_history_read on public.property_owner_history;
create policy property_owner_history_read on public.property_owner_history
  for select to authenticated using (public.has_permission('properties.read'));

grant select on public.territorial_areas,public.property_owners,public.property_owner_history to authenticated;
revoke insert,update,delete on public.territorial_areas,public.property_owners,public.property_owner_history from anon,authenticated;

-- Alta de sector/comunidad/urbanización/villa con tipología y auditoría.
-- Los sectores se mantienen sincronizados con public.sectors para no romper el motor tarifario.
create or replace function public.create_sitmaud_territorial_area(
  p_parish_id uuid,p_name text,p_area_type text,p_typology_code text,p_typology_reason text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  v_name text:=btrim(coalesce(p_name,''));
  v_type text:=lower(btrim(coalesce(p_area_type,'')));
  v_typology text:=upper(btrim(coalesce(p_typology_code,'')));
  v_sector_id uuid;
  v_area_id uuid;
  v_parish public.parishes%rowtype;
begin
  if auth.uid() is null or not public.has_permission('properties.create') then
    raise exception 'No tienes permisos para crear registros territoriales' using errcode='42501';
  end if;
  if v_name !~ '^.{3,120}$' then raise exception 'El nombre debe tener entre 3 y 120 caracteres'; end if;
  if v_type not in ('sector','comunidad','urbanizacion_privada','villa_privada') then
    raise exception 'Tipo de registro territorial no válido';
  end if;
  if v_typology not in ('TIPO I','TIPO II','TIPO III') then
    raise exception 'Selecciona una tipología válida: Tipo I, II o III';
  end if;
  select * into v_parish from public.parishes where id=p_parish_id and is_active=true;
  if v_parish.id is null then raise exception 'Selecciona una parroquia activa'; end if;
  if exists(select 1 from public.sectors s where s.parish_id=p_parish_id and lower(btrim(s.name))=lower(v_name))
     or exists(select 1 from public.territorial_areas a where a.parish_id=p_parish_id and lower(btrim(a.name))=lower(v_name) and a.is_active) then
    raise exception 'Ya existe un registro con ese nombre en la parroquia seleccionada';
  end if;
  if v_type='sector' then
    insert into public.sectors(parish_id,name,default_typology,is_active)
    values(p_parish_id,v_name,v_typology,true) returning id into v_sector_id;
  else
    insert into public.territorial_areas(
      parish_id,name,area_type,typology_code,is_active,created_by,
      typology_assigned_by,typology_assigned_at,typology_reason
    ) values(
      p_parish_id,v_name,v_type,v_typology,true,auth.uid(),
      auth.uid(),now(),nullif(btrim(coalesce(p_typology_reason,'')),'')
    ) returning id into v_area_id;
  end if;
  insert into public.audit_log(actor_user_id,action,entity_table,entity_id,after_data)
  values(auth.uid(),'territorial_catalog_created',
    case when v_type='sector' then 'sectors' else 'territorial_areas' end,
    coalesce(v_sector_id,v_area_id)::text,
    jsonb_build_object('name',v_name,'type',v_type,'parish',v_parish.name,'typology',v_typology));
  return jsonb_build_object('id',coalesce(v_sector_id,v_area_id),'sector_id',v_sector_id,
    'territorial_area_id',v_area_id,'name',v_name,'area_type',v_type,
    'parish_id',p_parish_id,'typology_code',v_typology);
end;
$function$;
revoke all on function public.create_sitmaud_territorial_area(uuid,text,text,text,text) from public,anon;
grant execute on function public.create_sitmaud_territorial_area(uuid,text,text,text,text) to authenticated;

-- Registro atómico del inmueble individual, propietario y responsable de pago.
-- El flujo de cuenta matriz de condominios no utiliza esta función.
create or replace function public.register_sitmaud_individual_property(
  p_contributor_id uuid,
  p_address text,
  p_property_type text,
  p_parish_id uuid,
  p_area_type text,
  p_sector_id uuid default null,
  p_territorial_area_id uuid default null,
  p_is_property_owner boolean default true,
  p_owner_name text default null,
  p_owner_identification_type text default null,
  p_owner_identification_number text default null,
  p_owner_phone text default null,
  p_owner_email text default null,
  p_occupant_role text default 'arrendatario',
  p_reference text default null,
  p_notes text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  v_contributor public.contributors%rowtype;
  v_parish public.parishes%rowtype;
  v_sector public.sectors%rowtype;
  v_area public.territorial_areas%rowtype;
  v_property_id uuid;
  v_owner_id uuid;
  v_owner_name text;
  v_owner_type text;
  v_owner_number text;
  v_owner_phone text;
  v_owner_email text;
  v_sector_name text;
  v_organization_name text;
  v_typology text;
  v_role text;
begin
  if auth.uid() is null or not public.has_permission('properties.create') then
    raise exception 'No tienes permisos para registrar inmuebles' using errcode='42501';
  end if;
  select * into v_contributor from public.contributors where id=p_contributor_id and coalesce(status,'active')='active';
  if v_contributor.id is null then raise exception 'No se encontró un contribuyente activo'; end if;
  if coalesce(v_contributor.service_account_type,'individual')='condominio' then
    raise exception 'Los condominios deben registrarse desde su módulo de cuenta matriz. Esta operación no modifica sus reglas.';
  end if;
  if coalesce(v_contributor.is_property_owner,true) is distinct from coalesce(p_is_property_owner,true) then
    raise exception 'La condición de propietario del contribuyente no coincide con el registro. Vuelve a revisar el formulario.';
  end if;
  if length(btrim(coalesce(p_address,'')))<5 then raise exception 'Indica la dirección completa del inmueble'; end if;
  select * into v_parish from public.parishes where id=p_parish_id and is_active=true;
  if v_parish.id is null then raise exception 'Selecciona una parroquia activa'; end if;

  if p_area_type='sector' then
    select * into v_sector from public.sectors
      where id=p_sector_id and parish_id=p_parish_id and is_active=true;
    if v_sector.id is null then raise exception 'Selecciona un sector de la parroquia elegida'; end if;
    v_sector_name:=v_sector.name;
    v_typology:=nullif(upper(btrim(coalesce(v_sector.default_typology,''))),'');
    v_organization_name:=null;
  elsif p_area_type in ('comunidad','urbanizacion_privada','villa_privada') then
    select * into v_area from public.territorial_areas
      where id=p_territorial_area_id and parish_id=p_parish_id
        and area_type=p_area_type and is_active=true;
    if v_area.id is null then raise exception 'Selecciona una ubicación territorial activa de la parroquia elegida'; end if;
    v_typology:=v_area.typology_code;
    v_organization_name:=v_area.name;
    v_sector_name:=null;
    p_sector_id:=null;
  else
    raise exception 'Selecciona un tipo de ubicación válido';
  end if;

  if p_is_property_owner then
    v_owner_name:=coalesce(nullif(btrim(concat_ws(' ',v_contributor.first_name,v_contributor.last_name)),''),v_contributor.legal_name);
    v_owner_type:=v_contributor.identification_type;
    v_owner_number:=v_contributor.identification_number;
    v_owner_phone:=v_contributor.phone;
    v_owner_email:=v_contributor.email;
    v_role:='propietario';
  else
    v_owner_name:=btrim(coalesce(p_owner_name,''));
    v_owner_type:=upper(btrim(coalesce(p_owner_identification_type,'')));
    v_owner_number:=btrim(coalesce(p_owner_identification_number,''));
    v_owner_phone:=nullif(btrim(coalesce(p_owner_phone,'')),'');
    v_owner_email:=nullif(lower(btrim(coalesce(p_owner_email,''))),'');
    if length(v_owner_name)<3 or v_owner_type not in ('V','E','J','G','P') or length(v_owner_number)<5 then
      raise exception 'Completa nombre, tipo y número de identificación del propietario';
    end if;
    if p_occupant_role not in ('arrendatario','ocupante') then
      raise exception 'Selecciona si el responsable es arrendatario u ocupante';
    end if;
    if v_owner_email is not null and v_owner_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      raise exception 'El correo del propietario no tiene un formato válido';
    end if;
    v_role:=p_occupant_role;
  end if;

  insert into public.properties(
    contributor_id,address,property_type,property_use,parish_id,sector_id,territorial_area_id,
    parish_name,sector_name,organization_name,reference,notes,typology_override,
    typology_override_reason,is_active
  ) values(
    p_contributor_id,btrim(p_address),coalesce(nullif(p_property_type,''),'casa'),'residencial',
    p_parish_id,p_sector_id,case when p_area_type='sector' then null else p_territorial_area_id end,
    v_parish.name,v_sector_name,v_organization_name,
    nullif(btrim(coalesce(p_reference,'')),''),nullif(btrim(coalesce(p_notes,'')),''),
    case when p_area_type='sector' then null else v_typology end,case when p_area_type='sector' then null else 'Tipología heredada del catálogo territorial' end,true
  ) returning id into v_property_id;

  insert into public.property_owners(
    property_id,owner_name,identification_type,identification_number,phone,email,is_current,created_by
  ) values(v_property_id,v_owner_name,v_owner_type,v_owner_number,v_owner_phone,v_owner_email,true,auth.uid())
  returning id into v_owner_id;

  insert into public.property_owner_history(property_id,previous_owner_id,new_owner_id,reason,changed_by)
  values(v_property_id,null,v_owner_id,'Registro inicial del propietario',auth.uid());

  insert into public.property_relationships(
    property_id,contributor_id,relationship_role,starts_on,is_current,is_payment_responsible,notes
  ) values(
    v_property_id,p_contributor_id,v_role,current_date,true,true,
    case when p_is_property_owner then 'Propietario y responsable de pago inicial'
      else 'Responsable de pago; propietario registrado por separado' end
  );

  insert into public.audit_log(actor_user_id,action,entity_table,entity_id,after_data)
  values(auth.uid(),'individual_property_registered','properties',v_property_id::text,
    jsonb_build_object('contributor_id',p_contributor_id,'owner_id',v_owner_id,
      'is_property_owner',p_is_property_owner,'responsible_role',v_role,
      'parish_id',p_parish_id,'sector_id',p_sector_id,'territorial_area_id',p_territorial_area_id,
      'typology',v_typology));

  return jsonb_build_object('property_id',v_property_id,'owner_id',v_owner_id,
    'contributor_id',p_contributor_id,'responsible_role',v_role,
    'is_property_owner',p_is_property_owner,'typology',v_typology);
end;
$function$;
revoke all on function public.register_sitmaud_individual_property(uuid,text,text,uuid,text,uuid,uuid,boolean,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.register_sitmaud_individual_property(uuid,text,text,uuid,text,uuid,uuid,boolean,text,text,text,text,text,text,text,text) to authenticated;

-- El cambio posterior de responsable se implementará con una regla explícita para
-- separar las deudas históricas de las obligaciones generadas desde la fecha efectiva.

comment on table public.territorial_areas is
  'Comunidades, urbanizaciones privadas y villas; los sectores conservan public.sectors para compatibilidad con las reglas tarifarias.';
comment on table public.property_owners is
  'Titularidad legal del inmueble, separada del contribuyente responsable del pago.';
comment on table public.property_owner_history is
  'Historial de titulares de inmuebles. No modifica cuentas, contratos ni deudas.';
