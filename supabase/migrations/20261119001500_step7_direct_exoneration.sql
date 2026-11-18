-- SITMAUD · Paso 7: exoneración directa, sin solicitud, doble autorización ni contador de exoneraciones.
-- El permiso debt_relief.apply es la única autorización de esta operación.
create or replace function public.exonerate_official_assessments(
 p_assessment_ids uuid[],p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();
 v_reason text:=nullif(btrim(p_reason),'');
 v_id uuid;v_a public.assessments%rowtype;v_contributor uuid;v_this uuid;
 v_grant uuid;v_confirmed numeric(18,2);v_remainder numeric(18,2);
 v_applied int:=0;
begin
 if v_actor is null or not public.has_permission('debt_relief.apply') then
   raise exception 'No tienes permiso de exoneración' using errcode='42501';
 end if;
 if v_reason is null or length(v_reason)<12 or length(v_reason)>500 then
   raise exception 'Indica el fundamento de la exoneración (12 a 500 caracteres).';
 end if;
 if p_assessment_ids is null or cardinality(p_assessment_ids) not between 1 and 100
    or cardinality(p_assessment_ids)<>(select count(distinct a) from unnest(p_assessment_ids) a) then
   raise exception 'Selecciona de 1 a 100 meses distintos.';
 end if;
 -- Bloqueos ordenados garantizan que la operación sea atómica.
 for v_id in select unnest(p_assessment_ids) order by 1 loop
   select * into v_a from public.assessments where id=v_id and is_demo=false for update;
   if not found or v_a.status not in ('pending','partially_paid')
      or v_a.period_start<date '2027-01-01' then
     raise exception 'No es posible exonerar el período %: inexistente o no pendiente.',v_id;
   end if;
   select p.contributor_id into v_this from public.properties p
   where p.id=v_a.property_id and p.is_active=true;
   if v_this is null then raise exception 'Inmueble inactivo o sin contribuyente.';end if;
   if v_contributor is null then v_contributor:=v_this;
   elsif v_contributor<>v_this then raise exception 'Selecciona meses de un mismo contribuyente.';end if;
   if exists(select 1 from public.debt_relief_grants g where g.assessment_id=v_id) then
      raise exception 'La obligación % tiene un antecedente de exoneración; requiere revisión.',v_id;
   end if;
   if exists(select 1 from public.payment_allocations pa
      join public.payments py on py.id=pa.payment_id
      where pa.assessment_id=v_id and py.status='pending') then
      raise exception 'El mes % tiene un pago pendiente de Tesorería.',v_id;
   end if;
   select coalesce(sum(pa.amount),0) into v_confirmed
    from public.payment_allocations pa join public.payments py on py.id=pa.payment_id
    where pa.assessment_id=v_id and py.status='confirmed';
   v_remainder:=greatest(0,v_a.total_amount-v_confirmed);
   if v_remainder<=0 then raise exception 'El período % ya está totalmente pagado.',v_id;end if;
   insert into public.debt_relief_grants(assessment_id,legal_reference,approved_by)
   values(v_id,v_reason,v_actor) returning id into v_grant;
   insert into public.audit_log(actor_user_id,action,entity_table,entity_id,after_data)
   values(v_actor,'debt_exonerated_direct','debt_relief_grants',v_grant::text,
     jsonb_build_object('assessment_id',v_id,'contributor_id',v_contributor,
       'period_start',v_a.period_start,'period_end',v_a.period_end,
       'outstanding_exonerated_bs',v_remainder,'confirmed_before_exoneration_bs',v_confirmed,
       'reason',v_reason,'approved_by',v_actor,'revenue_added',0));
   v_applied:=v_applied+1;
 end loop;
 return jsonb_build_object('applied',v_applied,'status','exonerated',
   'contributor_id',v_contributor,'revenue_added',0);
end; $$;
revoke all on function public.exonerate_official_assessments(uuid[],text) from public,anon;
grant execute on function public.exonerate_official_assessments(uuid[],text) to authenticated;

-- Las consultas y solicitudes heredadas no vuelven a estar disponibles desde el navegador.
revoke all on function public.submit_debt_relief_request(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.apply_authorized_debt_exonerations(uuid[]) from public,anon,authenticated;

-- La bitácora debe ser visible al auditor, no modificable desde la API.
revoke all on public.audit_log from anon,authenticated;
grant select on public.audit_log to authenticated;
