# IMAUD — Product vision and experience principles

## Product identity

IMАUD (Sistema Integral de Recaudación de Aseo Domiciliario) is a new municipal digital service for the Alcaldía del Municipio Miranda, Coro, estado Falcón. It is not a replica, reskin, or continuation of SUTRAMIRANDA.

SUTRAMIRANDA exports are strictly a source of historical records, reference catalogs, legacy identifiers, and evidence about existing administrative relationships. They do not define IMAUD's navigation, visual design, user experience, workflow, or future product scope.

## Product promise

A modern, clear, auditable and citizen-centered municipal platform that makes residential sanitation contributions easier to manage for residents and easier to administer for municipal teams.

## Experience principles

1. **Task-first, not database-first.** Organize the interface around what a staff member needs to accomplish (locate an account, understand its status, resolve a balance, record a payment, issue proof, follow up), rather than exposing database tables as the product.
2. **One resident / organization, one unified account.** A contributor has one consolidated profile with all linked properties, representatives, historical relationships, obligations, payments, documents and communications.
3. **Multiple properties, clear responsibility.** Model ownership, co-ownership, occupancy, representation and payment responsibility as separate relationships with dates and evidence.
4. **Residential groups are first-class relationships, not a separate tax identity by default.** Condominiums, villas and gated communities are represented as legal contributors/organizations where applicable, with an organization profile and individually traceable units. The organization can aggregate payment workflows without hiding unit-level detail. A legal ordinance determines who is liable and how fees are calculated.
5. **Smart geographic hierarchy.** A property belongs to a parish and sector. A private development or residential complex can exist inside a sector without creating a fake “sector inside a sector.” Its organization boundary and typology override must be explicit, documented and ordinance-authorized.
6. **Transparent financial timeline.** Every assessment, payment, allocation, reversal, receipt and solvency certificate is traceable. Distinguish transaction from allocations to multiple periods. Never silently rewrite historical balances.
7. **Rules before rates.** The ordinance engine is versioned by legal source, effective dates, geographic scope, property class, unit basis, exchange-rate source and approval. No rate is activated without verified ordinance support and authorized approval.
8. **Auditability by design.** Record actor, time, action, affected record, reason, before/after state and approval where relevant. Audit events are append-only.
9. **Role-based workspaces.** Up to five intendentes with full control. Only intendentes create staff and assign granular permissions. Analyst permissions are individually granted. Collectors receive narrowly scoped operational permissions.
10. **Citizen self-service.** A resident portal should offer account summary, linked properties, balances, payment history, receipts, notifications, requests and support. Do not use identity number as a default password; use secure invitation and credential setup with recovery and MFA options.
11. **Accessible and responsive.** Prioritize fast desktop workflows for municipal staff and simple mobile experiences for citizens and field staff. Clear language, keyboard access, visible statuses and low-bandwidth resilience.
12. **Privacy and security.** Minimize personal data exposure, isolate environments, apply server-side authorization, encrypt sensitive data, back up regularly and never place real personal/financial exports in public repositories.

## New modules and capabilities beyond the legacy system

- Executive dashboard with collections today/month, active contributors, linked properties, arrears, collection rate, delinquency aging, parish/sector comparisons, cash desk performance and trends.
- Unified contributor 360° profile.
- Property and relationship registry with change history.
- Residential organization workspace with unit roster, aggregate balance and per-unit traceability.
- Ordinance and tariff rule studio with effective-date simulation and approval workflow.
- Batch assessment generation and consolidated multi-period settlements.
- Payment desk with split allocation across periods, reconciliation queue and controlled reversals.
- Half-letter receipt and digital receipt validation.
- Solvency certificate lifecycle with verifiable code/QR and revocation status.
- Geographic operations map for private developments, condominiums and residential groups, including debt status and location.
- Collections follow-up queue and communication history.
- Staff permission matrix and immutable audit explorer.
- Reports with filters, scheduled exports and reconciliation snapshots.
- Citizen portal and secure account onboarding.
- Data migration center with staging, duplicate detection, exception queues, dry runs and signed reconciliation reports.

## Visual design direction

Maintain the approved IMAUD identity: official logo exactly as supplied by the municipality; deep navy, white, turquoise and green palette; clean premium institutional visual language; consistent left navigation and component system. The visual design should be more modern and legible than the legacy application, with restrained cards, clear information hierarchy, meaningful whitespace, accessible contrast and polished responsive states. Do not copy SUTRAMIRANDA screens or its layout.

## Data migration boundary

Import historical facts only where useful and validated:
- preserve legacy identifiers and source values;
- retain contributor/property relationship history;
- retain assessments, payment records and allocation semantics;
- retain historical exchange rates and source references;
- retain receipt/certificate identifiers and statuses;
- archive legacy activity history separately.

Do not import legacy passwords, reset tokens, active sessions, caches, queue internals or secrets. Never assume historical typologies/rates are current law. Historical records must remain visibly marked as imported legacy records and must not be treated as new assessments.

## Acceptance criteria

- A new user can understand the dashboard and locate a contributor quickly.
- A contributor's complete account is visible from one profile.
- More than one property can be linked to a contributor, and a property can have multiple dated relationships.
- Residential organizations aggregate collections while retaining unit-level traceability.
- Every amount can be traced to a versioned rule and legal source.
- Payment transactions and allocations are distinct.
- Staff cannot exceed their assigned permissions; only intendentes manage users and grants.
- Reports reconcile with source records and explain differences.
- Every module shares the same visual system and works on desktop/mobile.
- No live personal/financial data is exposed in demo or public environments.
