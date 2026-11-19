import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(file,'utf8');
const page=read('funcionario.html');
const setup=read('staff-password-setup.js');
const edge=read('supabase/functions/invite-sitmaud-staff/index.ts');
const workflow=read('.github/workflows/pages.yml');

test('invited staff create their own password, not one assigned by management',()=>{
 assert.match(page,/id="staffSetPassword"/);
 assert.match(page,/id="staffNewPassword"/);
 assert.match(page,/id="staffConfirmPassword"/);
 assert.match(setup,/client\.auth\.updateUser\(\{password\}\)/);
 assert.match(setup,/password\.length<12/);
 assert.match(setup,/password!==confirmation/);
 assert.match(setup,/client\.auth\.signOut\(\)/);
 assert.doesNotMatch(edge,/password:\s*['"]/);
});

test('invitation and recovery deep link to the password setup page',()=>{
 assert.match(edge,/funcionario\.html\?setup=invite/);
 assert.match(page,/\?setup=recovery/);
 assert.match(setup,/mode==='invite'/);
 assert.match(setup,/mode==='recovery'/);
 assert.match(setup,/staff_profiles/);
 assert.match(setup,/is_active/);
});

test('administrative invite remains master-only and JWT protected',()=>{
 assert.match(edge,/is_sitmaud_master/);
 assert.match(edge,/auth\.getUser\(jwt\)/);
 assert.match(edge,/staff_pending_activation: true/);
 assert.match(edge,/new Response\(null, \{ status: 204/);
});

test('GitHub Pages bundles and syntax-checks the password workflow',()=>{
 assert.match(workflow,/auth\.js staff-password-setup\.js/);
 assert.match(workflow,/node --check dist\/staff-password-setup\.js/);
 assert.match(page,/staff-password-setup\.js/);
});

test('institutional credential delivery uses a server secret and preserves fallback',()=>{
 assert.match(edge,/RESEND_API_KEY/);
 assert.match(edge,/SITMAUD_MAIL_FROM/);
 assert.match(edge,/crypto\.getRandomValues/);
 assert.match(edge,/admin\.auth\.admin\.createUser/);
 assert.match(edge,/https:\/\/api\.resend\.com\/emails/);
 assert.match(edge,/delivery_mode:"temporary_password_email"/);
 assert.match(edge,/delivery_mode:"activation_link"/);
 assert.match(edge,/inviteUserByEmail/);
 assert.doesNotMatch(edge,/after_data:\s*\{[^}]*temporaryPassword/);
});
test('temporary password can later be changed optionally by an authenticated employee',()=>{
 assert.match(setup,/mode==='change'/);
 assert.match(page,/staff-password-setup\.js/);
 const home=read('index.html');
 assert.match(home,/funcionario\.html\?setup=change/);
});
