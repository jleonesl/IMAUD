import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(path, 'utf8');
const login = read('contribuyente-v2.html');
const landing = read('index.html');
const recoveryTemplate = read('supabase/templates/sitmaud-citizen-recovery.html');
const inviteTemplate = read('supabase/templates/sitmaud-citizen-invite.html');
const recoveryService = read('supabase/functions/recover-sitmaud-citizen/index.ts');
const account = read('contribuyente-cuenta.html');
const activate = read('activar-contribuyente.html');
const citizenDocs = read('contributor-documents.js');
const citizenRegistration = read('app.js');
const registrationServer = read('supabase/functions/register-sitmaud-contributor/index.ts');
const invitationService = read('supabase/functions/invite-sitmaud-citizen/index.ts');
const receipt = read('citizen-receipts.js');
const sharedInvoice = read('official-receipt-template.js');
const officialFinance = read('official-finance.js');
const citizenDashboard = read('citizen-dashboard.js');
const citizenDashboardCss = read('citizen-dashboard.css');
const treasurySql = read('supabase/migrations/20261119050000_treasury_payment_audit_and_evidence.sql');
const workflow = read('.github/workflows/pages.yml');
const officialPortal = read('supabase/migrations/20261119030000_citizen_canonical_identity.sql');
const serverReceipt = read('supabase/migrations/20261119024500_citizen_verified_paid_receipt.sql');
const loginThrottle = read('supabase/migrations/20261119041500_citizen_login_throttle.sql');
const citizenPayments = read('citizen-payment-registration.js');
const citizenPaymentSql = read('supabase/migrations/20261119043000_citizen_official_udc_payment_submission.sql');
const citizenPaymentOptions = read('supabase/migrations/20261119043500_citizen_payment_options.sql');

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

test('citizen may optionally change password after current-password verification', () => {
  assert.match(account, /Seguridad de mi cuenta/);
  assert.match(account, /Cambiar mi contrase(?:ñ|\u00f1)a/);
  assert.match(account, /citizenChangePasswordForm/);
  assert.match(account, /signInWithPassword/);
  assert.match(account, /updateUser\(\{password:next\}\)/);
  assert.match(account, /next\.length<12/);
});

test('citizen login, activation and account use isolated session storage, separate from staff', () => {
  for (const page of [login,activate,account]) {
    assert.match(page, /storageKey:"sitmaud-citizen-auth"/);
  }
});

test('homepage forwards recovery authorization tokens to citizen password setup', () => {
 assert.match(landing, /location\.replace\('\.\/activar-contribuyente\.html'/);
 assert.match(landing, /hasAuthToken/);
 assert.match(landing, /hasTokenHash/);
});
test('emails use direct token-hash activation links and recovery reports send failures', () => {
 assert.match(recoveryTemplate, /activar-contribuyente\.html\?token_hash=\{\{ \.TokenHash \}\}&amp;type=recovery/);
 assert.match(inviteTemplate, /activar-contribuyente\.html\?token_hash=\{\{ \.TokenHash \}\}&amp;type=invite/);
 assert.match(activate, /verifyOtp\(\{token_hash:tokenHash,type:tokenType\}\)/);
 assert.match(recoveryService, /mailError\.status===429/);
});

test('login lockout does not increase rejected-attempt counter', () => {
  assert.match(loginThrottle, /citizen_auth_attempts\.attempts<8/);
  assert.match(loginThrottle, /return v_id is not null/);
});
test('citizen account access relies on confirmed auth and verified owner, not sessionStorage flags', () => {
  assert.match(account, /client\.auth\.getUser\(\)/);
  assert.match(account, /client\.rpc\('get_my_citizen_portal'\)/);
  assert.doesNotMatch(account, /sessionStorage\.getItem\('sitmaud_citizen_view'\)/);
});

test('payment UI is included in published portal and quotes official months on server', () => {
 assert.match(account,/id="citizenPaymentRegistration"/);
 assert.match(account,/citizen-payment-registration\.js/);
 assert.ok(workflow.includes('citizen-payment-registration.js'));
 assert.match(citizenPayments,/quote_citizen_udc_payment/);
 assert.match(citizenPayments,/register_citizen_udc_payment/);
 assert.match(citizenPayments,/get_citizen_payment_options/);
 assert.match(citizenPayments,/status!=="reversed"/);
});
test('citizen submissions are private, official, owner-restricted and pending treasury', () => {
 assert.match(citizenPaymentSql,/payment_proof_upload_citizen/);
 assert.match(citizenPaymentSql,/citizen_accounts ca/);
 assert.match(citizenPaymentSql,/receiving_account_id/);
 assert.match(citizenPaymentSql,/is_published/);
 assert.match(citizenPaymentSql,/'portal_contribuyente'/);
 assert.match(citizenPaymentSql,/'pending'/);
 assert.match(citizenPaymentSql,/p_expected_total_bs/);
 assert.match(citizenPaymentSql,/register_citizen_udc_payment_core/);
 assert.match(citizenPaymentSql,/revoke all on function public\.register_citizen_udc_payment_core/);
 assert.match(citizenPaymentOptions,/where is_published=true/);
 assert.match(citizenPayments,/10\*1024\*1024/);
 assert.doesNotMatch(citizenPayments,/service_role/);
});

test('institutional and citizen receipts use exactly one approved HTML renderer and CSS', () => {
 assert.match(sharedInvoice,/function render\(\{payment:p,allocations,preview=false\}\)/);
 assert.match(sharedInvoice,/bill-paper sit-receipt/);
 assert.match(officialFinance,/window\.sitmaudOfficialReceipt\.render\(\{payment:p,allocations,preview\}\)/);
 assert.match(receipt,/window\.sitmaudOfficialReceipt\.render\(\{payment,allocations,preview:false\}\)/);
 assert.match(account,/billing\.css\?v=20261119-identical-invoice1/);
 assert.match(account,/official-receipt-template\.js/);
 assert.match(landing,/official-receipt-template\.js/);
 assert.ok(workflow.includes('official-receipt-template.js'));
 assert.doesNotMatch(receipt,/sit-citizen-receipt-paper/);
 assert.doesNotMatch(account,/@page\s*\{\s*size:5\.5in 8\.5in/);
});
test('citizen invoice remains restricted to own confirmed and liquidated payments', () => {
 assert.match(receipt,/get_my_citizen_receipt/);
 assert.match(receipt,/data\.status!=='confirmed'/);
 assert.match(receipt,/data\.liquidated_at/);
 assert.match(receipt,/Math\.abs\(sum-Number\(payment\.amount\)\)>0\.01/);
 assert.match(serverReceipt,/contributor_id=v_owner/);
});

test('treasury payment actions write explicit immutable audit records and require verifiable bank support', () => {
 assert.match(treasurySql,/treasury_payment_liquidated/);
 assert.match(treasurySql,/treasury_payment_rejected/);
 assert.match(treasurySql,/payment_treasury_events/);
 assert.match(treasurySql,/has_permission\('payments.validate'\)/);
 assert.match(treasurySql,/for update/);
 assert.match(treasurySql,/payment_allocations/);
 assert.match(treasurySql,/v_payment\.registration_channel='portal_contribuyente'/);
 assert.match(treasurySql,/imaud-payment-proofs/);
 assert.match(treasurySql,/minimum 20|mínimo 20/);
 assert.match(treasurySql,/status='confirmed'/);
 assert.match(treasurySql,/status='reversed'/);
});
test('treasury renders private proof only through temporary signed URL and does not fake liquidation', () => {
 assert.match(officialFinance,/data-treasury-evidence/);
 assert.match(officialFinance,/createSignedUrl\(p\.evidence_path,60\)/);
 assert.match(officialFinance,/payment_proof_viewed/);
 assert.match(officialFinance,/liquidate_official_payment/);
 assert.match(officialFinance,/reject_official_payment/);
 assert.match(officialFinance,/liquidated_today/);
 assert.match(officialFinance,/liquidated_month/);
 assert.match(officialFinance,/get_official_operations_report/);
 assert.match(officialFinance,/get_official_territorial_revenue/);
});

test('contributor portal uses responsive navigable dashboard without stacking every section', () => {
 const sections=['inicio','obligaciones','cargar-pago','facturas','cuentas','informacion','ayuda'];
 for(const part of sections){
   assert.match(account,new RegExp('data-citizen-view-panel="'+part+'"'));
   assert.match(account,new RegExp('data-citizen-view="'+part+'"'));
 }
 assert.match(account,/id="citizenSidebar"/);
 assert.match(account,/logo-sitmaud-sidebar\.jpg/);
 assert.match(account,/background:#eaf1f5!important/);
 assert.match(account,/mix-blend-mode:multiply!important/);
 assert.match(account,/citizen-nav[^]*?<svg viewBox=/);
 assert.match(account,/\.citizen-brand\{background:transparent!important/);
 assert.match(account,/citizen-dashboard\.css/);
 assert.match(account,/window\.sitmaudCitizenDashboard=\{init,navigate,updateBanks\}/);
 assert.match(citizenDashboard,/window\.sitmaudCitizenDashboard=\{init,navigate,updateBanks\}/);
 assert.match(citizenDashboardCss,/@media\(max-width:790px\)/);
 assert.ok(workflow.includes('citizen-dashboard.js'));
 assert.ok(workflow.includes('citizen-dashboard.css'));
});
test('new homepage displays only genuine citizen data and never assumes solvent status or fictitious bank details', () => {
 assert.match(citizenDashboard,/portal\.obligations/);
 assert.match(citizenDashboard,/portal\.payments/);
 assert.match(citizenDashboard,/getElementById|const \$=id=>document\.getElementById/);
 assert.match(citizenDashboard,/Por determinar/);
 assert.match(citizenDashboard,/No equivale a una solvencia oficial/);
 assert.match(citizenDashboard,/Aún no hay cuentas bancarias oficiales publicadas/);
 assert.doesNotMatch(citizenDashboard,/7890|4567|\.textContent\s*=\s*['\"]Solvente['\"]/);
 assert.doesNotMatch(account,/class="citizen-coro-visual"/);
 assert.doesNotMatch(account,/class="citizen-photo-credit"/);
 assert.match(account,/Identidad unificada con el portal institucional/);
 assert.match(account,/get_my_citizen_portal/);
 assert.match(account,/get_municipal_payment_instructions/);
 assert.match(account,/sitmaudCitizenPayment\.init/);
});

test("home dashboard hides bank accounts but standalone official accounts still loads", () => { assert.doesNotMatch(account,/id="citizenHomeBanks"/); assert.match(account,/id="municipalBankList"/); assert.match(account,/data-citizen-view-panel="cuentas"/); });
