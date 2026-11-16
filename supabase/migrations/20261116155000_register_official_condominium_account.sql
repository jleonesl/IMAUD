create or replace function public.register_official_condominium(
  p_legal_name text,p_rif text,p_email text,p_phone text,p_display_name text,p_address text,
  p_parish_id uuid,p_sector_id uuid,p_unit_count integer,p_responsible_name text,
  p_responsible_id text,p_responsible_phone text,p_responsible_email text,
  p_billing_typology text,p_typology_reason text
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  v_rif_compact text; v_rif_number text; v_contributor_id uuid; v_contract text;
  v_org_id uuid; v_property_id uuid; v_parish public.parishes%rowtype;
  v_sector public.sectors%rowtype; v_typology text;
begin
  if auth.uid() is null or not public.has_permission('contributors.create')
     or not public.has_permission('properties.create') then
    raise exception 'No tienes permisos para registrar un condominio institucional' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_legal_name,'')))<4 or length(btrim(coalesce(p_display_name,'')))<3
     or length(btrim(coalesce(p_address,'')))<5 or length(btrim(coalesce(p_responsible_name,'')))<3 then
    raise exception 'Completa razón social, nombre del condominio, dirección y responsable';
  end if;
  v_rif_compact:=upper(regexp_replace(coalesce(p_rif,''),'[^A-Za-z0-9]','','g'));
  if v_rif_compact !~ '^J[0-9]{9}$' then raise exception 'El RIF jurídico debe tener formato J-12345678-9'; end if;
  v_rif_number:=substring(v_rif_compact from 2);
  if nullif(btrim(coalesce(p_email,'')),'') is not null and p_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Correo jurídico inválido'; end if;
  if nullif(btrim(coalesce(p_responsible_email,'')),'') is not null and p_responsible_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Correo del administrador inválido'; end if;
  if p_unit_count is null or p_unit_count<1 or p_unit_count>100000 then raise exception 'La cantidad de viviendas debe estar entre 1 y 100.000'; end if;
  select * into v_parish from public.parishes where id=p_parish_id and is_active=true;
  select * into v_sector from public.sectors where id=p_sector_id and parish_id=p_parish_id and is_active=true;
  if v_parish.id is null or v_sector.id is null then raise exception 'La parroquia y el sector deben corresponder a registros territoriales activos'; end if;
  v_typology:=coalesce(nullif(btrim(p_billing_typology),''),v_sector.default_typology);
  if v_typology not in ('TIPO I','TIPO II','TIPO III') then raise exception 'El sector no tiene una tipología válida. Clasifícalo antes de registrar el condominio'; end if;
  if v_typology is distinct from v_sector.default_typology then
    if not public.has_permission('tariffs.manage') then raise exception 'Solo un funcionario autorizado puede asignar una tipología distinta a la del sector' using errcode='42501'; end if;
    if length(btrim(coalesce(p_typology_reason,'')))<15 then raise exception 'Justifica la tipología particular del condominio (mínimo 15 caracteres)'; end if;
  end if;
  if exists(select 1 from public.contributors where identification_type='J' and identification_number=v_rif_number) then raise exception 'Ya existe un contribuyente registrado con este RIF'; end if;
  insert into public.contributors(kind,service_account_type,identification_type,identification_number,rif,legal_name,email,phone,contact_address,is_property_owner,created_by,status,responsible_name,responsible_identification,responsible_phone,responsible_email)
  values('juridico','condominio','J',v_rif_number,'J-'||substring(v_rif_number,1,8)||'-'||substring(v_rif_number,9,1),btrim(p_legal_name),nullif(btrim(coalesce(p_email,'')),''),nullif(btrim(coalesce(p_phone,'')),''),btrim(p_address),false,auth.uid(),'active',btrim(p_responsible_name),nullif(btrim(coalesce(p_responsible_id,'')),''),nullif(btrim(coalesce(p_responsible_phone,'')),''),nullif(btrim(coalesce(p_responsible_email,'')),''))
  returning id,contract_number into v_contributor_id,v_contract;
  insert into public.residential_organizations(contributor_id,organization_type,display_name,representative_name,representative_id,unit_count,consolidated_billing,representative_phone,representative_email,billing_typology,billing_typology_reason,billing_typology_assigned_by,billing_typology_assigned_at,notes)
  values(v_contributor_id,'condominio',btrim(p_display_name),btrim(p_responsible_name),nullif(btrim(coalesce(p_responsible_id,'')),''),p_unit_count,true,nullif(btrim(coalesce(p_responsible_phone,'')),''),nullif(btrim(coalesce(p_responsible_email,'')),''),v_typology,coalesce(nullif(btrim(coalesce(p_typology_reason,'')),''),'Tipología heredada del sector'),auth.uid(),now(),'Cuenta matriz institucional consolidada; no representa un inmueble individual')
  returning id into v_org_id;
  insert into public.condominium_typology_history(organization_id,previous_typology,new_typology,sector_typology,reason,changed_by)
  values(v_org_id,null,v_typology,v_sector.default_typology,coalesce(nullif(btrim(coalesce(p_typology_reason,'')),''),'Clasificación inicial conforme a la tipología del sector'),auth.uid());
  insert into public.properties(contributor_id,organization_id,parish_id,sector_id,address,property_type,property_use,parish_name,sector_name,organization_name,is_active,is_consolidated_master,consolidated_units,notes)
  values(v_contributor_id,v_org_id,p_parish_id,p_sector_id,btrim(p_address),'edificio','residencial',v_parish.name,v_sector.name,btrim(p_display_name),true,true,p_unit_count,'CUENTA MATRIZ CONTABLE · '||p_unit_count::text||' viviendas · no es inmueble individual')
  returning id into v_property_id;
  return jsonb_build_object('contributor_id',v_contributor_id,'contract_number',v_contract,'organization_id',v_org_id,'property_account_id',v_property_id,'unit_count',p_unit_count,'sector_typology',v_sector.default_typology,'billing_typology',v_typology,'billing_typology_override',v_typology is distinct from v_sector.default_typology,'assessment_created',false,'billing_notice','La cuenta matriz quedó registrada. La generación de obligaciones se habilitará cuando exista un tabulador institucional aprobado y vigente.');
end;
$function$;
revoke all on function public.register_official_condominium(text,text,text,text,text,text,uuid,uuid,integer,text,text,text,text,text,text) from public,anon;
grant execute on function public.register_official_condominium(text,text,text,text,text,text,uuid,uuid,integer,text,text,text,text,text,text) to authenticated;
