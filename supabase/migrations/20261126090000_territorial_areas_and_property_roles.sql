-- SITMAUD: catalogo territorial y datos de titularidad separados del responsable de pago.
-- No altera las reglas ni las tablas de cuentas consolidadas de condominios.
create table if not exists public.territorial_areas (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete restrict,
  name text not null,
  area_type text not null check (area_type in ('sector','comunidad','urbanizacion_privada','villa_privada')),
  typology_code text not null check (typology_code in ('I','II','III')),
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parish_id, area_type, lower(name))
);
create index if not exists territorial_areas_parish_type_idx
  on public.territorial_areas(parish_id,area_type) where is_active;

alter table public.territorial_areas enable row level security;

alter table public.properties
  add column if not exists territorial_area_id uuid references public.territorial_areas(id) on delete restrict;

alter table public.property_relationships
  add column if not exists identity_document text,
  add column if not exists phone text;

create index if not exists properties_territorial_area_idx
  on public.properties(territorial_area_id);

comment on table public.territorial_areas is
  'Catalogo territorial institucional: sectores, comunidades, urbanizaciones y villas. Las urbanizaciones/villas individuales no se convierten en cuentas de condominio.';
comment on column public.territorial_areas.typology_code is
  'Tipologia I/II/III asignada al crear o actualizar el registro territorial conforme a la ordenanza vigente.';
comment on column public.properties.territorial_area_id is
  'Ubicacion territorial opcional del inmueble; separado de residential_organizations y de la cuenta matriz de condominios.';
comment on column public.property_relationships.relationship_role is
  'Distingue propietario, ocupante/arrendatario y responsable de pago. El historial de cambios se conserva en property_ownership_history.';
