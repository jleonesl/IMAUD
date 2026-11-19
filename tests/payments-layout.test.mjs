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
 assert.match(view,/<details class="card panel official-operations-details"/);
});
test('debtors come only from official pending obligations and respect partial amounts',()=>{
 assert.match(fin,/a\.is_demo===false/);
 assert.match(fin,/\['pending','partially_paid'\]/);
 assert.match(fin,/x\.payments\?\.status==='confirmed'/);
 assert.match(fin,/data-official-register-person/);
 assert.match(fin,/c\.service_account_type==='condominio'/);
 assert.doesNotMatch(fin.slice(fin.indexOf('async function loadDebtors()'),fin.indexOf('async function loadPayments()')),/insert\(|\.rpc\('register_/);
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
