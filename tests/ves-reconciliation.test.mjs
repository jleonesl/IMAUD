import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(file)=>readFileSync(file,'utf8');
const migration=read('supabase/migrations/20261120235500_cashier_received_bolivares_reconciliation.sql');
const cashier=read('official-payment-registration.js');
const finance=read('official-finance.js');
const receipt=read('official-receipt-template.js');
const index=read('index.html');
const app=read('app.js');

test('income is not equated to the UCD tax debt in the database',()=>{
 assert.match(migration,/add column if not exists received_amount_bs numeric\(18,2\)/);
 assert.match(migration,/register_official_pos_received_payment/);
 assert.match(migration,/register_official_udc_received_payment/);
 assert.match(migration,/p_received_bs/);
 assert.match(migration,/update public\.payments set received_amount_bs/);
 assert.match(migration,/payments\.register/);
 assert.match(migration,/greater than|0\.99/i);
 assert.match(migration,/sum\(coalesce\(received_amount_bs,amount\)\)/);
 assert.match(migration,/sum\(coalesce\(py\.received_amount_bs,py\.amount\)\)/);
 assert.match(migration,/sum\(coalesce\(p\.received_amount_bs,p\.amount\)\)/);
 assert.match(migration,/revoke all on function public\.register_official_pos_received_payment/);
});

test('cashier captures actual VES and sends exactly the selected payment method arguments',()=>{
 assert.match(cashier,/name="received_bs"/);
 assert.match(cashier,/updateReceivedDifference/);
 assert.match(cashier,/p_received_bs:receivedBs/);
 assert.match(cashier,/register_official_pos_received_payment/);
 assert.match(cashier,/register_official_udc_received_payment/);
 assert.match(cashier,/\.\.\.\(!isPos\?\{p_payment_method:/);
 assert.match(cashier,/\.\.\.\(isPos\?\{p_pos_terminal_id:/);
 assert.match(cashier,/data\.received_bs/);
 assert.match(cashier,/data\.assessed_bs/);
 assert.match(cashier,/data\.excess_bs/);
});

test('receipts and Treasury reconcile received cash without changing monthly allocations',()=>{
 assert.match(finance,/receipt_number,amount,received_amount_bs,currency_code/);
 assert.match(finance,/p\.received_amount_bs\?\?p\.amount/);
 assert.match(finance,/deuda tributaria:/);
 assert.match(receipt,/MONTO REALMENTE RECIBIDO/);
 assert.match(receipt,/DIFERENCIA NO APLICADA A DEUDA/);
 assert.match(receipt,/Monto aplicado a mensualidades/);
 assert.match(app,/payment_actual_ves_recorded:'Registró el monto realmente recibido en bolívares'/);
});

test('production HTML refreshes all financial assets',()=>{
 for(const path of ['styles.css','official-finance.js','official-payment-registration.js','official-receipt-template.js','app.js']){
  assert.ok(index.includes(path+'?v=20261120-ves-ledger1'),path);
 }
});
