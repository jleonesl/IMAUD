-- SITMAUD · Personal autorizado: datos de contacto del funcionario.
alter table public.staff_profiles add column if not exists identification_number text;
alter table public.staff_profiles add column if not exists contact_phone text;
create unique index if not exists staff_profiles_identification_unique
on public.staff_profiles(upper(btrim(identification_number)))
where identification_number is not null and btrim(identification_number)<>'';
-- No se concede capacidad de crear usuarios mediante las tablas.
revoke all on public.staff_profiles from anon,authenticated;
grant select on public.staff_profiles to authenticated;
