import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const sql=read('supabase/migrations/20261120203000_udc_rate_institutional_contingency.sql');
const ui=read('udc-contingency.js');
const app=read('app.js');
const html=read('index.html');
const workflow=read('.github/workflows/pages.yml');

test('financial database must preserve authentic UCD source, and only accept explicitly verified matching value',()=>{
 assert.match(sql,/create table if not exists private\.udc_rate_manual_checks/);
 assert.match(sql,/verified_value = public\.udc_rates\.udc_value/);
 assert.match(sql,/verified_currency = public\.udc_rates\.udc_currency_code/);
 assert.match(sql,/verified_at timestamptz/);
 assert.match(sql,/verified_by uuid/);
 assert.match(sql,/on conflict \(rate_id\) do nothing/);
 assert.match(sql,/public\.is_sitmaud_master\(\)/);
 assert.match(sql,/round\(p_confirmed_value,8\)<>round\(r\.udc_value,8\)/);
 assert.match(sql,/evidence_notes text not null/);
 assert.match(sql,/from public,anon/);
 for(const name of ['quote_official_udc_payment','quote_citizen_udc_payment',
   'register_official_udc_payment_core','register_citizen_udc_payment_core']) {
  assert.ok(sql.includes("'"+name+"'"),name);
 }
});

test('institutional UI never auto-approves third-party values',()=>{
 assert.match(ui,/get_udc_rate_readiness/);
 assert.match(ui,/r\.can_approve===true/);
 assert.match(ui,/confirmed_value/);
 assert.match(ui,/notes/);
 assert.match(ui,/window\.confirm/);
 assert.match(ui,/approve_udc_rate_contingency/);
 assert.doesNotMatch(ui,/value="'+esc\(r\.value_bs\)/);
 assert.match(app,/id="udcContingencyPanel"/);
 assert.match(app,/verified_manually===true/);
 assert.match(html,/udc-contingency\.js\?v=20261120-contingency1/);
 assert.match(workflow,/app\.js udc-contingency\.js territorial-map\.js/);
});

test('institutional rate verification uses auditable financial log, not navigation events',()=>{
 const patch=read('supabase/migrations/20261120210000_udc_contingency_financial_audit_fix.sql');
 assert.match(patch,/insert into public\.audit_log/);
 assert.match(patch,/udc_rate_contingency_verified/);
 assert.match(patch,/evidence_notes/);
});
test('receipts use local Caracas date for citizen and staff flows',()=>{
 const patch=read('supabase/migrations/20261120212000_receipts_use_caracas_local_date.sql');
 assert.match(patch,/America\/Caracas/);
 assert.match(patch,/register_official_udc_payment_core/);
 assert.match(patch,/register_citizen_udc_payment_core/);
 assert.match(patch,/register_official_payment/);
});
