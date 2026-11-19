-- SITMAUD: búsqueda de identidad solo para servicio de login controlado.
-- Ningún navegador puede obtener el correo asociado a una cédula/RIF.
create or replace function public.resolve_citizen_login_identity(
 p_type text,p_identity text
) returns table(contributor_id uuid,registered_email text,linked_user_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then
  raise exception 'Servicio de autenticación requerido' using errcode='42501';
 end if;
 if p_type not in ('V','E','J','C') or p_identity is null or length(p_identity) not between 5 and 20 then
  return;
 end if;
 return query
 select c.id,c.email,ca.auth_user_id
 from public.contributors c
 join public.citizen_accounts ca on ca.contributor_id=c.id and ca.is_active
 where c.status='active'
 and c.email is not null
 and c.identification_type=case when p_type='C' then 'J' else p_type end
 and (case when p_type='C' then c.service_account_type='condominio' else c.service_account_type<>'condominio' end)
 and (
  case when p_type in ('V','E')
   then regexp_replace(c.identification_number,'[^0-9]','','g')
   else regexp_replace(upper(c.identification_number),'[^A-Z0-9]','','g')
  end
 )=p_identity
 order by c.id limit 2;
end; $$;
revoke all on function public.resolve_citizen_login_identity(text,text) from public,anon,authenticated;
grant execute on function public.resolve_citizen_login_identity(text,text) to service_role;