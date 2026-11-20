import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const fin=readFileSync('official-finance.js','utf8');
const cashier=readFileSync('official-payment-registration.js','utf8');
const styles=readFileSync('styles.css','utf8');
test('payments home is a debtor directory, not duplicated financial dashboard',()=>{
 const view=fin.slice(fin.indexOf('function paymentView()'),fin.indexOf('function invoiceView()'));
 assert.match(view,/Contribuyentes con deudas/);
 assert.match(view,/data-official-open-register/);
 assert.match(view,/officialDebtorRows/);
 assert.match(view,/officialDebtorSearch/);
 assert.match(view,/officialDebtorType/);
 assert.doesNotMatch(view,/financeKpis\(/);
 assert.doesNotMatch(view,/financialOverview/);
 assert.doesNotMatch(view,/<details class="card panel official-operations-details"/);
 assert.match(view,/data-official-payment-tab="deudas"/);
 assert.match(view,/data-official-payment-tab="pagos"/);
 assert.match(view,/id="officialPaymentsView" hidden/);
 assert.match(view,/id="officialReliefBackdrop" hidden/);
 assert.doesNotMatch(view,/section class="card panel" id="officialDebtReliefPanel"/);

});
test('debtors use secure server pagination, not a 500-person snapshot',()=>{
 const sql=readFileSync('supabase/migrations/20261119212000_official_debtors_server_side_pagination.sql','utf8');
 const latest=readFileSync('supabase/migrations/20261119213000_normalize_debtor_search_and_identity.sql','utf8');
 assert.match(fin,/list_official_debtors/);
 assert.match(fin,/p_offset:debtorPage\*50/);
 assert.match(fin,/data-official-debtor-page/);
 assert.match(fin,/data-official-register-person/);
 assert.match(fin,/reliefAllowed/);
 assert.match(sql,/a\.is_demo=false/);
 assert.match(sql,/a\.status in \('pending','partially_paid'\)/);
 assert.match(sql,/py\.status='confirmed'/);
 assert.match(latest,/translate\(lower\(name\)/);
 assert.doesNotMatch(fin.slice(fin.indexOf('async function loadDebtors('),fin.indexOf('async function loadPayments()')),/\.limit\(500\)|insert\(/);
});
test('registration opens existing server-backed official cashier instead of legacy demo',()=>{
 assert.match(cashier,/id="officialCashierBackdrop"/);
 assert.match(cashier,/window\.sitmaudUdcPayment=\{open,close\}/);
 assert.match(cashier,/showLookup\(identity\)/);
 assert.match(cashier,/quote_official_udc_payment/);
 assert.match(cashier,/register_official_udc_payment/);
 assert.doesNotMatch(cashier,/register_demo_payment_with_proof/);
 assert.match(styles,/\.official-cashier-backdrop\[hidden\]\{display:none!important\}/);
});

test('exoneration is contextual and always checked against permission',()=>{
 assert.match(fin,/reliefAllowed\?'<button type="button" class="btn btn-light btn-sm" data-official-relief-person=/);
 assert.match(fin,/if\(!reliefAllowed\)return;/);
 assert.match(fin,/data-official-relief-close/);
 assert.match(fin,/openReliefFor\(relief\.dataset\.officialReliefPerson\)/);
 assert.match(fin,/exonerate_official_assessments/);
});
test('treasury actions remain per pending payment with permission gate',()=>{
 assert.match(fin,/p\.status==='pending'&&treasuryAllowed/);
 assert.match(fin,/data-official-liquidate/);
 assert.match(fin,/data-official-reject/);
 assert.match(fin,/data-official-invoice/);
 assert.match(fin,/id="officialPaymentRows"/);
 assert.match(styles,/#officialDebtsView\[hidden\],#officialPaymentsView\[hidden\]/);
});

test('cashier sees authorized September-November 2026 debts and matches V-prefixed cedula',()=>{
 assert.match(cashier,/\.gte\('period_start','2026-09-01'\)/);
 assert.doesNotMatch(cashier,/\.gte\('period_start','2027-01-01'\)/);
 assert.match(cashier,/identities\.map\(value=>\['identification_number',value\]\)/);
 assert.match(cashier,/raw\[0\]\+'-'\+bare/);
});
test('general billing action is hidden from officials without billing authorization',()=>{
 assert.match(fin,/const permitted=canManage\.data===true&&canGenerate\.data===true/);
 assert.match(fin,/if\(!permitted\)\{panel\.hidden=true;return;\}/);
});
test('payment operators get read-only access; role checks match exact permission codes',()=>{
 const migration=readFileSync('supabase/migrations/20261120100000_cashier_read_official_assessments.sql','utf8');
 const fix=readFileSync('supabase/migrations/20261120101500_fix_permission_exact_match.sql','utf8');
 assert.match(migration,/on public\.assessments for select/);
 assert.match(migration,/public\.has_permission\('payments\.read'\)/);
 assert.match(migration,/on public\.tariff_schedules for select/);
 assert.match(migration,/is_approved=true/);
 assert.match(fix,/p\.permission_code=\$1/);
 assert.doesNotMatch(fix,/p\.permission_code=permission_code/);
});
