-- Extend IMAUD to preserve SUTRAMIRANDA's multiple contributor/property relationships.
-- This migration adds a normalized relationship table rather than assuming one owner per property.
create table public.property_relationships (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  contributor_id uuid not null references public.contributors(id),
  relationship_role text not null check (relationship_role in ('propietario','copropietario','ocupante','arrendatario','responsable_pago','representante','otro')),
  starts_on date,
  ends_on date,
  is_current boolean not null default true,
  is_payment_responsible boolean not null default false,
  source_legacy_id bigint,
  notes text,
  created_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index property_relationships_property_idx on public.property_relationships(property_id);
create index property_relationships_contributor_idx on public.property_relationships(contributor_id);
create unique index property_relationships_legacy_id_idx on public.property_relationships(source_legacy_id) where source_legacy_id is not null;

create table public.property_ownership_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  previous_contributor_id uuid references public.contributors(id),
  new_contributor_id uuid references public.contributors(id),
  relationship_role text,
  changed_on date,
  reason text,
  reference_document text,
  observations text,
  source_legacy_id bigint,
  recorded_at timestamptz not null default now()
);

create table public.legacy_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_cutoff timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'prepared' check (status in ('prepared','running','validated','failed','rolled_back')),
  source_record_counts jsonb not null default '{}'::jsonb,
  imported_record_counts jsonb not null default '{}'::jsonb,
  reconciliation jsonb not null default '{}'::jsonb,
  notes text
);

create table public.legacy_id_map (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.legacy_import_batches(id),
  source_table text not null,
  source_id text not null,
  target_table text not null,
  target_id uuid not null,
  unique(batch_id,source_table,source_id)
);

create table public.legacy_payment_applications (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.legacy_import_batches(id),
  source_payment_id text,
  source_assessment_id text,
  source_receipt_number text,
  amount_received_bs numeric(16,2),
  amount_applied_tcmmv numeric(16,4),
  payment_date date,
  bank_name text,
  collection_point_code text,
  operator_legacy_id text,
  is_reconciled boolean,
  source_row jsonb not null,
  imported_at timestamptz not null default now()
);

create table public.legacy_assessment_snapshots (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.legacy_import_batches(id),
  source_assessment_id text not null,
  source_contributor_id text,
  source_property_contract text,
  period_date date,
  original_status text,
  issued_tcmmv numeric(16,4),
  paid_applied_tcmmv numeric(16,4),
  balance_tcmmv numeric(16,4),
  due_date date,
  issued_at date,
  source_row jsonb not null,
  imported_at timestamptz not null default now(),
  unique(batch_id,source_assessment_id)
);

alter table public.property_relationships enable row level security;
alter table public.property_ownership_history enable row level security;
alter table public.legacy_import_batches enable row level security;
alter table public.legacy_id_map enable row level security;
alter table public.legacy_payment_applications enable row level security;
alter table public.legacy_assessment_snapshots enable row level security;

comment on table public.property_relationships is 'Many-to-many relationship of contributors and properties, including owner, occupant, tenant and payment-responsible roles.';
comment on table public.legacy_payment_applications is 'Staging archive: a legacy payment export row can represent an allocation, not necessarily a unique bank transaction.';
comment on table public.legacy_assessment_snapshots is 'Immutable historical snapshot for reconciliation; do not automatically convert into newly assessed debts.';
