import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync('app.js','utf8');
const css=readFileSync('styles.css','utf8');
const index=readFileSync('index.html','utf8');
test('activity log describes authenticated staff activities in Spanish',()=>{
 for(const key of ['session_started','session_finished','module_opened','staff_permission_granted','official_payment_udc_registered','udc_rate_contingency_verified']){
  assert.match(app,new RegExp(key+':'));
 }
 assert.match(app,/Inició sesión en SITMAUD/);
 assert.match(app,/Accedió al módulo/);
 assert.match(app,/Cerró sesión en SITMAUD/);
 assert.match(app,/display_name/);
 assert.match(app,/timeZone:'America\/Caracas'/);
});
test('details are disclosed explicitly and no raw JSON appears in primary activity cells',()=>{
 assert.match(app,/Ver datos técnicos/);
 assert.match(app,/class="sit-audit-technical"/);
 assert.match(app,/escapeHTML\(raw\)/);
 assert.match(app,/Acceso a la sección de Recaudación y pagos; no significa que haya registrado un cobro/);
 assert.match(css,/\.sit-audit-technical pre/);
 assert.doesNotMatch(app,/const displayDetails=\(x\)=>/);
});
test('browser receives refreshed audit presentation',()=>{
 assert.match(index,/app\.js\?v=20261120-treasury-audit2/);
 assert.match(index,/styles\.css\?v=20261120-ves-ledger1/);
});

test('Treasury records are displayed as real Spanish financial operations',()=>{
 assert.match(app,/treasury_payment_liquidated:'Tesorería validó y liquidó un pago'/);
 assert.match(app,/treasury_payment_rejected:'Tesorería rechazó un pago'/);
 assert.match(app,/citizen_payment_udc_submitted:'Un contribuyente presentó un pago para validación'/);
});
