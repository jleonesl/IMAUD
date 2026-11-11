-- IMAUD initial relational model (design migration; review against ordinance before deployment)
create extension if not exists pgcrypto;

create type public.contributor_kind as enum ('natural_venezolano','natural_extranjero','juridico');
create type public.property_use as enum ('residencial','multifamiliar');
create type public.payment_status as enum ('pending','confirmed','reversed');
create type public.staff_role as enum ('intendente','administrador_analista','recaudador');

create table public.parishes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id),
  name text not null,
  default_typology text,
  is_active boolean not null default true,
  unique(parish_id,name)
);
create table public.contributors (
  id uuid primary key default gen_random_uuid(),
  kind public.contributor_kind not null,
  identification_type text not null,
  identification_number text not null,
  legal_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  contact_address text,
  rif text,
  is_property_owner boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique(identification_type, identification_number),
  check ((kind='juridico' and (legal_name is not null or rif is not null)) or
         (kind<>'juridico' and (first_name is not null or last_name is not null)))
);
create table public.residential_organizations (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null unique references public.contributors(id),
  organization_type text not null check (organization_type in ('condominio','villa','urbanizacion_privada','organizacion_residencial','consejo_comunal','otro')),
  display_name text not null,
  representative_name text,
  representative_id text,
  notes text,
  created_at timestamptz not null default now()
);
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.contributors(id),
  organization_id uuid references public.residential_organizations(id),
  parish_id uuid references public.parishes(id),
  sector_id uuid references public.sectors(id),
  cadastral_code text unique,
  address text not null,
  property_type text not null default 'casa',
  property_use public.property_use not null default 'residencial',
  typology_override text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);
create table public.organization_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.residential_organizations(id),
  property_id uuid not null unique references public.properties(id),
  unit_label text not null,
  is_active boolean not null default true
);
create table public.tariff_schedules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  ordinance_reference text not null,
  valid_from date not null,
  valid_until date,
  currency_unit text not null,
  conversion_method text,
  is_approved boolean not null default false,
  approved_by uuid,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from)
);
create table public.tariff_rules (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.tariff_schedules(id),
  parish_id uuid references public.parishes(id),
  sector_id uuid references public.sectors(id),
  typology_code text not null,
  property_type text,
  amount numeric(14,4) not null check (amount >= 0),
  unit_basis text not null check (unit_basis in ('per_property','per_residential_unit','per_organization','fixed')),
  notes text
);
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  tariff_rule_id uuid not null references public.tariff_rules(id),
  period_start date not null,
  period_end date not null,
  base_amount numeric(14,4) not null check (base_amount >= 0),
  adjustment_amount numeric(14,4) not null default 0,
  total_amount numeric(14,4) not null check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending','partially_paid','paid','void')),
  created_at timestamptz not null default now(),
  created_by uuid,
  check (period_end >= period_start),
  unique(property_id,period_start,period_end)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  contributor_id uuid not null references public.contributors(id),
  amount numeric(14,4) not null check (amount > 0),
  currency_code text not null,
  payment_method text not null,
  external_reference text,
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  registered_by uuid,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text
);
create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  assessment_id uuid not null references public.assessments(id),
  amount numeric(14,4) not null check (amount > 0),
  unique(payment_id,assessment_id)
);
create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null,
  role public.staff_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.permissions (
  code text primary key,
  description text not null
);
create table public.staff_permissions (
  user_id uuid not null references public.staff_profiles(user_id),
  permission_code text not null references public.permissions(code),
  granted_by uuid not null references public.staff_profiles(user_id),
  granted_at timestamptz not null default now(),
  primary key(user_id,permission_code)
);
create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  action text not null,
  entity_table text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  request_ip inet,
  user_agent text,
  correlation_id uuid
);

create index contributors_name_idx on public.contributors using gin (to_tsvector('simple',coalesce(legal_name,'')||' '||coalesce(first_name,'')||' '||coalesce(last_name,'')));
create index properties_sector_idx on public.properties(sector_id);
create index properties_contributor_idx on public.properties(contributor_id);
create index assessments_period_idx on public.assessments(period_start,period_end);
create index assessments_status_idx on public.assessments(status);
create index payments_paid_at_idx on public.payments(paid_at);
create index audit_log_occurred_at_idx on public.audit_log(occurred_at desc);

-- RLS is enabled now; policies are intentionally deferred until the final authorization matrix is approved.
do $$
declare t text;
begin
  foreach t in array array['parishes','sectors','contributors','residential_organizations','properties','organization_units','tariff_schedules','tariff_rules','assessments','payments','payment_allocations','staff_profiles','permissions','staff_permissions','audit_log']
  loop execute format('alter table public.%I enable row level security',t); end loop;
end $$;

comment on table public.audit_log is 'Append-only audit events. Add restrictive insert/read policies and prevent update/delete for authenticated roles before production.';
comment on table public.tariff_schedules is 'Only approved ordinance-backed schedules may be used for assessments.';
