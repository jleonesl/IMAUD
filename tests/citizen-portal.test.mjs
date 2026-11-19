import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(path, 'utf8');
const login = read('contribuyente-v2.html');
const account = read('contribuyente-cuenta.html');
const activate = read('activar-contribuyente.html');
const citizenDocs = read('contributor-documents.js');
const citizenRegistration = read('app.js');
const registrationServer = read('supabase/functions/register-sitmaud-contributor/index.ts');
const invitationService = read('supabase/functions/invite-sitmaud-citizen/index.ts');
const receipt = read('citizen-receipts.js');
const workflow = read('.github/workflows/pages.yml');
const officialPortal = read('supabase/migrations/20261119030000_citizen_canonical_identity.sql');
const serverReceipt = read('supabase/migrations/20261119024500_citizen_verified_paid_receipt.sql');

test('citizen login uses identity service and does not expose registered email', () => {
  assert.match(login, /citizen-identity-login/);
  assert.match(login, /identityType|citizenType/);
  assert.doesNotMatch(login, /from\(['"]contributors['"]\)/);
});
test('citizen recovery is separate from staff authentication', () => {
  assert.match(login, /recover-sitmaud-citizen/);
  assert.match(activate, /updateUser\(\{password:/);
  assert.match(activate, /get_my_citizen_portal/);
});
test('official account only shows real payments and permitted bank accounts', () => {
  assert.match(account, /get_my_citizen_portal/);
  assert.match(account, /get_municipal_payment_instructions/);
  assert.doesNotMatch(account, /demo_payments|demo_assessments/);
});
test('recipient receives an email invitation, not a national ID as password', () => {
  assert.match(citizenDocs, /invite-sitmaud-citizen/);
  assert.doesNotMatch(citizenDocs, /password:\s*identification_number/);
});
test('receipt is server verified and requires liquidated payment', () => {
  assert.match(serverReceipt, /status='confirmed'/);
  assert.match(serverReceipt, /liquidated_at is not null/);
  assert.match(serverReceipt, /contributor_id=v_owner/);
  assert.match(receipt, /get_my_citizen_receipt/);
  assert.match(account, /p\.status==='confirmed'&&p\.liquidated_at/);
});
test('normalize existing national IDs exactly once and publish all portal files', () => {
  assert.match(officialPortal, /regexp_replace\(upper\(v_c\.identification_number\)/);
  for(const asset of ['activar-contribuyente.html','citizen-receipts.js','contribuyente-v2.html','contribuyente-cuenta.html']){
    assert.ok(workflow.includes(asset), 'Missing deployment asset: ' + asset);
  }
});
test('automatic email request after contributor creation; employee only resends', () => {
  assert.match(citizenRegistration, /register-sitmaud-contributor/);
  assert.match(registrationServer, /action:\"automatic\"/);
  assert.match(registrationServer, /invite-sitmaud-citizen/);
  assert.match(citizenDocs, /action:'resend'/);
  assert.match(citizenDocs, /Reenviar acceso al correo/);
  assert.match(invitationService, /action==="resend"/);
  assert.match(invitationService, /resetPasswordForEmail/);
  assert.match(invitationService, /inviteUserByEmail/);
  assert.match(invitationService, /allow_citizen_access_email/);
  assert.doesNotMatch(citizenDocs, /data-activate-citizen[^]*?Enviar correo de activación/);
});
