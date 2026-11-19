import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync('app.js','utf8');
const edge=readFileSync('supabase/functions/invite-sitmaud-staff/index.ts','utf8');
test('staff invitation offers exactly three distinct account profiles',()=>{
 const part=ui.slice(ui.indexOf('<label class="field"><span>Perfil de cuenta *'),ui.indexOf('</select></label>',ui.indexOf('<label class="field"><span>Perfil de cuenta *'))+17);
 for(const [code,label] of [['intendente','Intendente'],['recaudador','Recaudador'],['administrador_analista','Administrador / Analista']])
   assert.ok(part.includes('<option value="'+code+'">'+label+'</option>'),label);
 assert.doesNotMatch(part,/Administrador \/ Analista \/ Tesorería/);
});
test('only master creates employees; intendente does not imply master owner',()=>{
 assert.match(edge,/rpc\("is_sitmaud_master"\)/);
 assert.match(edge,/\["intendente","recaudador","administrador_analista"\]/);
 assert.match(edge,/\(count \?\? 0\) >= 5/);
 assert.match(edge,/\.eq\("role","intendente"\)\.eq\("is_active",true\)/);
 assert.doesNotMatch(edge,/insert\(\s*\{[^}]*sitmaud_master_owner/);
 assert.match(edge,/permission_count:0/);
});
