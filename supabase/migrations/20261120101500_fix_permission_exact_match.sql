-- The prior unqualified predicate "p.permission_code=permission_code" matched
-- the table column against itself instead of the SQL function argument.
-- Never grant undeclared functional permissions through this ambiguity.
create or replace function public.has_permission(permission_code text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
 select coalesce(
   public.is_sitmaud_master()
   or exists (
     select 1
     from public.staff_permissions p
     join public.staff_profiles s on s.user_id=p.user_id and s.is_active=true
     where p.user_id=auth.uid()
       and p.permission_code=$1
       and p.permission_code not in ('staff.manage','permissions.manage','settings.manage')
   ), false
 );
$$;