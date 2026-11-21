import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(p,'utf8');
const staff=read('supabase/functions/invite-sitmaud-staff/index.ts');
const citizen=read('supabase/functions/invite-sitmaud-citizen/index.ts');
const staffLogin=read('funcionario.html');
const staffSetup=read('staff-password-setup.js');
const citizenLogin=read('contribuyente-v2.html');
const citizenSetup=read('activar-contribuyente.html');
const citizenAccount=read('contribuyente-cuenta.html');

test('every new provisional password is uniquely randomized with cryptographic entropy',()=>{
 for(const source of [staff,citizen]){
  assert.match(source,/crypto\.getRandomValues\(bytes\)/);
  assert.match(source,/new Uint8Array\(12\)/);
  assert.match(source,/temporaryPassword/);
  assert.doesNotMatch(source,/password:\s*(?:identity|c\.identification_number|citizenUsername)/);
 }
});
test('institutional welcome emails include username, password, and domain-aware portal link',()=>{
 assert.match(staff,/Usuario:<\/strong>/);
 assert.match(staff,/Clave provisional:<\/strong>/);
 assert.match(staff,/portalBase \+ "\/funcionario\.html"/);
 assert.match(citizen,/Usuario \(cédula o RIF\):<\/strong>/);
 assert.match(citizen,/Clave provisional individual:<\/strong>/);
 assert.match(citizen,/PORTAL_BASE\+"\/contribuyente-v2\.html"/);
 assert.match(staff,/SITMAUD_PUBLIC_BASE_URL/);
 assert.match(citizen,/SITMAUD_PUBLIC_BASE_URL/);
});
test('first login does not force expiration or password change, future changes are optional',()=>{
 assert.match(staff,/El cambio de contraseña es voluntario/);
 assert.match(citizen,/No estás obligado a modificarla en tu primer ingreso/);
 assert.doesNotMatch(staff,/temporaryPassword.*expiresAt/);
 assert.doesNotMatch(citizen,/temporaryPassword.*expiresAt/);
 assert.match(citizenAccount,/No es obligatorio modificarla después de iniciar sesión/);
 assert.match(staffSetup,/Este cambio es voluntario/);
});
test('personal passwords accept eight characters or more, with max 128',()=>{
 assert.match(staffLogin,/id="staffNewPassword"[^>]*minlength="8"/);
 assert.match(staffLogin,/id="staffConfirmPassword"[^>]*minlength="8"/);
 assert.match(staffSetup,/password\.length<8/);
 assert.match(citizenSetup,/id="password"[^>]*minlength="8"/);
 assert.match(citizenSetup,/p\.length<8/);
 assert.match(citizenAccount,/id="citizenNewPassword"[^>]*minlength="8"/);
 assert.match(citizenAccount,/next\.length<8/);
});
test('welcome passwords are not returned through API or recorded in administrative audit',()=>{
 assert.doesNotMatch(staff,/after_data:\s*\{[^}]*temporaryPassword/);
 assert.doesNotMatch(citizen,/after_data:\s*\{[^}]*temporaryPassword/);
 assert.match(staff,/RESEND_API_KEY/);
 assert.match(citizen,/RESEND_API_KEY/);
 assert.match(citizen,/delivery_mode:canSendCredentials\?"temporary_password_email":"activation_link"/);
 assert.match(citizenLogin,/clave provisional recibida en el correo de bienvenida/);
});
