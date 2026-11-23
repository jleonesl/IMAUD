import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('index.html','utf8');
const styles=readFileSync('styles.css','utf8');
const app=readFileSync('app.js','utf8');

test('Bitácora exists in the staff sidebar, and is mapped to an accessible view',()=>{
 assert.match(html,/<nav id="mainNav" aria-label="Opciones institucionales desplazables" tabindex="0">/);
 assert.match(html,/data-view="bitacora"/);
 assert.match(html,/Bitácora<\/button>/);
 assert.match(app,/bitacora:officialAudit/);
 assert.match(app,/bitacora:\['audit.read'\]/);
});
test('staff sidebar has independent visible vertical scrollbar and does not clip lower options',()=>{
 assert.match(styles,/\.sidebar #mainNav\{[\s\S]*?flex:1 1 auto;/);
 assert.match(styles,/\.sidebar #mainNav\{[\s\S]*?min-height:0;/);
 assert.match(styles,/\.sidebar #mainNav\{[\s\S]*?overflow-y:scroll;/);
 assert.match(styles,/\.sidebar #mainNav::-webkit-scrollbar\{width:10px\}/);
 assert.match(styles,/scrollbar-color:#94b5c5 #e0eaf0/);
 assert.match(styles,/\.sidebar \.brand,[\s\S]*?\.sidebar \.sidebar-bottom\{[\s\S]*?flex-shrink:0/);
 assert.match(styles,/touch-action:pan-y/);
});
test('browser is instructed to load updated navigation stylesheet',()=>{
 assert.match(html,/styles\.css\?v=20261123-treasury1/);
});
