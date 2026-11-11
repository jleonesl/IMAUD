-- IMAUD hardening baseline. Production RLS policies must be completed before any live data.
create or replace function public.prevent_audit_log_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'La bitácora de auditoría es inmutable';
end;
$$;
create trigger audit_log_no_update
before update or delete on public.audit_log
for each row execute function public.prevent_audit_log_mutation();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger contributors_set_updated_at before update on public.contributors
for each row execute function public.set_updated_at();
create trigger properties_set_updated_at before update on public.properties
for each row execute function public.set_updated_at();

insert into public.permissions(code,description) values
('dashboard.read','Consultar panel principal'),
('contributors.read','Consultar contribuyentes'),
('contributors.create','Registrar contribuyentes'),
('contributors.update','Editar contribuyentes'),
('properties.read','Consultar inmuebles'),
('properties.create','Registrar inmuebles'),
('properties.update','Editar inmuebles'),
('organizations.manage','Administrar organizaciones residenciales'),
('assessments.read','Consultar liquidaciones'),
('assessments.create','Generar liquidaciones'),
('payments.read','Consultar pagos'),
('payments.register','Registrar pagos'),
('payments.reverse','Reversar pagos con justificación'),
('invoices.read','Consultar comprobantes'),
('invoices.issue','Emitir comprobantes'),
('reports.read','Consultar reportes'),
('reports.export','Exportar reportes'),
('tariffs.read','Consultar tarifas'),
('tariffs.manage','Administrar tarifas y vigencias'),
('staff.read','Consultar funcionarios'),
('staff.manage','Crear funcionarios'),
('permissions.manage','Asignar y revocar permisos'),
('audit.read','Consultar bitácora'),
('settings.manage','Administrar configuración')
on conflict(code) do nothing;

-- No demo credentials, passwords, sample citizen records or tariff amounts are inserted.
