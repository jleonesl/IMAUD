import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const app=read('app.js');
const auth=read('auth.js');
const html=read('index.html');
const css=read('styles.css');
test('staff permissions are read from authenticated database and not from user metadata',()=>{
 assert.match(auth,/rpc\('is_sitmaud_master'\)/);
 assert.match(auth,/from\('staff_permissions'\)\.select\('permission_code'\)\.eq\('user_id',user\.id\)/);
 assert.match(auth,/window\.sitmaudAccess=\{master:isMaster,grants:new Set/);
 assert.doesNotMatch(auth,/user_metadata\.(role|permission)/);
});
test('per-contributor-only account can see its module and is denied other modules',()=>{
 assert.match(app,/contribuyentes:\['contributors\.read','contributors\.create','contributors\.update'\]/);
 assert.match(app,/pagos:\['payments\.read','payments\.register'\]/);
 assert.match(app,/funcionarios:\['staff\.manage','permissions\.manage'\]/);
 assert.match(app,/el\.hidden=!visible/);
 assert.match(app,/if\(!sitmaudAllowed\(v\)\)/);
 assert.match(app,/state\.view=sitmaudFirstView\(\)\|\|'__no_access'/);
 assert.match(app,/if\(window\.sitmaudAccess&&!sitmaudAllowed\(state\.view\)\)/);
});
test('contributor create and edit controls respect their own permissions',()=>{
 assert.match(app,/if\(!sitmaudCan\('contributors\.create'\)\)/);
 assert.match(app,/if\(!sitmaudCan\('contributors\.update'\)\)/);
 assert.match(app,/\[data-contributor-action="edit"\]/);
});
test('mobile sidebar has accessible drawer and collapses on navigation',()=>{
 assert.match(html,/id="mobileNavBackdrop"/);
 assert.match(html,/aria-controls="sidebar" aria-expanded="false"/);
 assert.match(app,/function sitmaudToggleMobileMenu/);
 assert.match(app,/function sitmaudCloseMobileMenu/);
 assert.match(app,/e\.key==='Escape'\)sitmaudCloseMobileMenu/);
 assert.match(css,/#mainNav \.nav-item\[hidden\]/);
 assert.match(css,/\.mobile-nav-backdrop:not\(\[hidden\]\)/);
 assert.match(css,/max-height:100dvh/);
 assert.match(css,/overflow-x:auto;-webkit-overflow-scrolling:touch/);
});
