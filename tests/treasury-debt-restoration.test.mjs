import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const first=readFileSync('supabase/migrations/20261120233000_restore_rejected_assessment_bs_snapshot.sql','utf8');
const second=readFileSync('supabase/migrations/20261120234000_restore_rejected_citizen_bs_snapshot.sql','utf8');
const cashier=readFileSync('official-payment-registration.js','utf8');
const finance=readFileSync('official-finance.js','utf8');
test('before applying a UCD payment, preserve original Bs debt values for staff and citizen channels',()=>{
 assert.match(first,/private\.payment_assessment_prior_amounts/);
 assert.match(first,/base_amount numeric\(18,4\)/);
 assert.match(first,/total_amount numeric\(18,4\)/);
 assert.match(first,/insert into private\.payment_assessment_prior_amounts/);
 assert.match(second,/register_citizen_udc_payment_core/);
 assert.match(second,/insert into private\.payment_assessment_prior_amounts/);
});
test('Treasury rejection returns unpaid debt to its original saved Bs and never deletes audit evidence',()=>{
 assert.match(first,/p\.proname='reject_official_payment'/);
 assert.match(first,/base_amount=old\.base_amount,total_amount=old\.total_amount/);
 assert.match(first,/old\.payment_id=p_payment_id/);
 assert.match(first,/other_payment\.status<>''reversed''/);
 assert.match(first,/enable row level security/);
 assert.match(first,/revoke all on private\.payment_assessment_prior_amounts/);
});
test('cashier invoice remains immediate and Treasury actions preserve separate controls',()=>{
 assert.match(cashier,/Registrar pago y emitir factura/);
 assert.match(cashier,/await window\.sitmaudOfficialFinance\.showDocument/);
 assert.match(finance,/liquidate_official_payment/);
 assert.match(finance,/reject_official_payment/);
 assert.match(finance,/treasuryAllowed/);
});
