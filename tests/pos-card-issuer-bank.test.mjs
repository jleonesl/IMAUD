import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const cashier=readFileSync('official-payment-registration.js','utf8');
const finance=readFileSync('official-finance.js','utf8');
const receipt=readFileSync('official-receipt-template.js','utf8');
const sql=readFileSync('supabase/migrations/20261121021000_pos_issuer_bank_separate_from_terminal.sql','utf8');
const index=readFileSync('index.html','utf8');

test('terminal bank is saved from registered municipal POS, independently from card issuer',()=>{
 assert.match(sql,/add column if not exists payer_bank_code/);
 assert.match(sql,/public\.payment_banks\(code\)/);
 assert.match(sql,/v_terminal\.bank_code,p_evidence_path/);
 assert.match(sql,/payer_bank_code=p_bank_code/);
 assert.match(sql,/b\.code=p_bank_code and b\.is_active=true/);
 assert.match(sql,/v_terminal public\.pos_terminals%rowtype/);
 assert.match(sql,/where id=p_pos_terminal_id and is_active=true for share/);
});
test('cashier chooses bank of contributor card without inheriting terminal bank',()=>{
 assert.match(cashier,/Banco emisor de la tarjeta del contribuyente/);
 assert.match(cashier,/name="bank" required/);
 assert.match(cashier,/data-bank=/);
 assert.match(cashier,/El banco del terminal se obtiene del registro institucional/);
 assert.doesNotMatch(cashier,/bank\.value=code/);
 assert.match(cashier,/p_bank_code:form\.elements\.bank\.value/);
});
test('invoice and Treasury distinguish issuer from acquiring bank',()=>{
 assert.match(finance,/payer_bank_code,pos_terminal_id/);
 assert.match(finance,/Banco emisor de la tarjeta:/);
 assert.match(finance,/Tarjeta: /);
 assert.match(receipt,/BANCO DE LA TARJETA/);
 assert.match(receipt,/p\.payer_bank_code/);
 assert.match(sql,/get_official_operations_report/);
 assert.match(sql,/get_pos_terminal_report/);
});
test('browser version keys refresh cashier, finance and receipt',()=>{
 for(const script of ['official-payment-registration.js','official-finance.js','official-receipt-template.js'])
  assert.ok(index.includes(script+'?v=20261121-issuer-bank1'),script);
});
