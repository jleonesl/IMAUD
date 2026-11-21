import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(path,'utf8');
const home=read('index.html'),staff=read('staff-logout.js');
const citizen=read('contribuyente-cuenta.html');
const styles=read('styles.css');
const workflow=read('.github/workflows/pages.yml');
test('all institutional staff have header and sidebar logout regardless of permissions',()=>{
 assert.match(home,/id="logoutButton" data-staff-signout/);
 assert.match(home,/class="sidebar-signout" data-staff-signout/);
 assert.match(home,/>Cerrar sesión<\/span>/);
 assert.match(styles,/\.staff-signout-btn/);
 assert.match(styles,/\.sidebar-signout/);
 assert.match(styles,/\.topbar \.staff-signout-btn\{display:inline-flex!important/);
 assert.doesNotMatch(home,/getElementById\('logoutButton'\)\?\.addEventListener/);
});
test('logging out does not depend on audit result and navigates away from sensitive views',()=>{
 assert.match(staff,/record_staff_activity/);
 assert.match(staff,/auth\.signOut\(\{scope:'local'\}\)/);
 assert.match(staff,/location\.replace\('\.\/funcionario\.html\?sesion=cerrada'\)/);
 assert.match(staff,/if\(closing\)return/);
 assert.match(staff,/event==='SIGNED_OUT'/);
 assert.match(staff,/event\.persisted/);
});
test('citizen has independent visible logout with safe session invalidation',()=>{
 assert.match(citizen,/id="exit" type="button">Cerrar sesión/);
 assert.match(citizen,/client\.auth\.signOut\(\{scope:'local'\}\)/);
 assert.match(citizen,/sessionStorage\.removeItem\('sitmaud_citizen_view'\)/);
 assert.match(citizen,/location\.replace\('\.\/contribuyente-v2\.html\?sesion=cerrada'\)/);
 assert.match(citizen,/window\.addEventListener\('pageshow'/);
});
test('published app includes mandatory signout script',()=>{
 assert.match(home,/src="staff-logout\.js\?v=20261120-logout1"/);
 assert.match(workflow,/staff-password-setup\.js staff-logout\.js/);
 assert.match(workflow,/node --check dist\/staff-logout\.js/);
});
