import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('app.js','utf8');
const migration=readFileSync('supabase/migrations/20261126090000_territorial_areas_and_property_roles.sql','utf8');
const styles=readFileSync('styles.css','utf8');
const index=readFileSync('index.html','utf8');

test('individual contributor registration captures legal owner separately from payer',()=>{
 assert.match(app,/id="propertyOwnerFlag"/);
 assert.match(app,/id="propertyOwnerDetails" hidden/);
 assert.match(app,/name="owner_name"/);
 assert.match(app,/name="owner_identification_number"/);
 assert.match(app,/name="occupant_relationship"/);
 assert.match(app,/state\.pendingPropertyOwner=/);
 assert.match(app,/p_is_property_owner:isOwner/);
 assert.match(migration,/create table if not exists public\.property_owners/);
 assert.match(migration,/create table if not exists public\.property_owner_history/);
 assert.match(migration,/relationship_role,starts_on,is_current,is_payment_responsible/);
});

test('territorial catalog supports sectors, communities, private developments and typology',()=>{
 for(const kind of ['sector','comunidad','urbanizacion_privada','villa_privada'])assert.ok(app.includes('value="'+kind+'"')||app.includes("('"+kind+"'"));
 assert.match(app,/name="typology_code"/);
 assert.match(app,/create_sitmaud_territorial_area/);
 assert.match(migration,/create or replace function public\.create_sitmaud_territorial_area/);
 assert.match(migration,/default_typology/);
 assert.match(migration,/territorial_area_id uuid references public\.territorial_areas/);
 assert.match(migration,/territorial_catalog_created/);
});

test('individual property registration is atomic and keeps condominiums in their existing flow',()=>{
 assert.match(app,/register_sitmaud_individual_property/);
 assert.match(migration,/create or replace function public\.register_sitmaud_individual_property/);
 assert.match(migration,/service_account_type,'individual'\)='condominio'/);
 assert.match(migration,/Los condominios deben registrarse desde su módulo de cuenta matriz/);
 assert.match(migration,/public\.property_relationships/);
 assert.match(migration,/individual_property_registered/);
});

test('new territorial location and owner appear in the property directory and detail view',()=>{
 assert.match(app,/territorial_areas!properties_territorial_area_id_fkey/);
 assert.match(app,/property_owners!property_owners_property_id_fkey/);
 assert.match(app,/Tipo de ubicación/);
 assert.match(styles,/territorial-area-creator/);
 assert.match(index,/app\.js\?v=20261126-owner-territory1/);
});
