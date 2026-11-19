import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const payments=read('supabase/migrations/20261119060000_official_payment_direct_bcv_only.sql');
const pages=read('.github/workflows/pages.yml');
const guide=read('docs/PLAN_QA_HOSTING_MIGRACION_2026.md');
const citizen=read('contribuyente-cuenta.html');
test('Official financial rates are accepted only from the directly verifiable central bank source',()=>{
 for(const name of ['quote_official_udc_payment','quote_citizen_udc_payment','register_official_udc_payment_core','register_citizen_udc_payment_core'])
   assert.ok(payments.includes('public.'+name+'('),name+' must be guarded');
 assert.equal((payments.match(/source_url = 'https:\/\/www\.bcv\.org\.ve\/'/g)||[]).length,4);
 assert.doesNotMatch(payments,/bcv\.today/);
});
test('Hosted deliverable excludes internal and demo sources and is packaged for controlled import',()=>{
 assert.match(pages,/sitmaud-hosting-ready\.zip/);
 assert.match(pages,/upload-artifact@v4/);
 assert.match(pages,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.doesNotMatch(pages,/cp -R supabase\//);
 assert.match(pages,/node --test tests\/citizen-portal\.test\.mjs/);
});
test('QA payments and personal identities require separate backend, never production',()=>{
 assert.match(guide,/Supabase independiente del principal/);
 assert.match(guide,/SIN VALIDEZ FISCAL/);
 assert.match(guide,/Nunca ejecutar|Jamás ejecutar/);
 assert.match(guide,/hosting definitivo/);
 assert.match(guide,/antes del dominio final aprobado/);
});
test('Public citizen portal does not present a fictional paid account or official bank account',()=>{
 assert.doesNotMatch(citizen,/id="citizenHomeBanks"/);
 assert.match(citizen,/data-citizen-view-panel="cuentas"/);
 assert.match(citizen,/id="citizenDebtValue"/);
});
