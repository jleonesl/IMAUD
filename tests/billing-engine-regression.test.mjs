import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');

test('all four property and condo generators avoid ambiguous period_start conflict targets',()=>{
  const migration=read('supabase/migrations/20261119210000_fix_billing_period_start_ambiguous_upsert.sql');
  assert.equal((migration.match(/on conflict on constraint assessments_property_id_period_start_period_end_key do nothing/g)||[]).length,4);
  assert.doesNotMatch(migration,/on conflict\(property_id,period_start,period_end\)/);
});
test('automatic batches and explicit 2026 authorization remain separate',()=>{
  const migration=read('supabase/migrations/20261119160000_automated_monthly_billing_and_trial_bulk_batches.sql');
  const authorization=read('supabase/migrations/20261119195500_trial_tariff_authorization_and_skip_demo_months.sql');
  assert.match(migration,/run_billing_batch/);
  assert.match(migration,/p_allow_trial boolean default false/);
  assert.match(migration,/date '2027-01-01'/);
  assert.match(migration,/pg_try_advisory_xact_lock/);
  assert.match(authorization,/activate_trial_residential_tariff_2026/);
  assert.match(authorization,/public\.has_permission\('tariffs\.manage'\)/);
  assert.match(authorization,/trial_only/);
});
test('debtors are server searched with pagination and require authorized staff',()=>{
  const finance=read('official-finance.js');
  const list=read('supabase/migrations/20261119213000_normalize_debtor_search_and_identity.sql');
  assert.match(finance,/rpc\('list_official_debtors'/);
  assert.match(finance,/p_limit:50,p_offset:debtorPage\*50/);
  assert.match(finance,/data-official-debtor-page/);
  assert.match(list,/public\.has_permission\('payments\.read'\)/);
  assert.match(list,/a\.is_demo=false/);
  assert.match(list,/translate\(lower\(name\)/);
});
test('financial payment path preserves invoice before treasury validation',()=>{
  const cashier=read('official-payment-registration.js');
  const pos=read('supabase/migrations/20261119150000_pos_terminal_registry_and_reporting.sql');
  assert.match(cashier,/Registrar pago y emitir factura/);
  assert.match(cashier,/register_official_pos_payment/);
  assert.match(cashier,/register_official_udc_payment/);
  assert.match(pos,/register_official_pos_payment/);
  assert.match(pos,/pos_terminal_id/);
});

test('direct exonerations never appear as debt and cannot be charged',()=>{
 const sql=read('supabase/migrations/20261119221000_exoneration_enforced_in_payment_quotes_and_debtor_views.sql');
 for(const name of ['quote_official_udc_payment','quote_citizen_udc_payment','register_official_udc_payment_core','register_citizen_udc_payment_core'])
   assert.match(sql,new RegExp('public\\.'+name+'\\('));
 assert.ok((sql.match(/El mes seleccionado está exonerado/g)||[]).length>=4);
 assert.match(sql,/and g\.revoked_at is null/);
 assert.match(sql,/get_my_citizen_portal/);
});
