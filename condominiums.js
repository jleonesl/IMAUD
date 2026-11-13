/* SITMAUD · Registro de cuentas matrices de condominio (DEMO) */
(function(){
'use strict';
const fhtml=(mode)=>{
 const inline=mode==='inline',id=inline?'condoInline':'condoStandalone';
 return '<form id="'+id+'Form" class="condo-matrix-form" hidden><div class="condo-matrix-heading"><span class="condo-matrix-icon">▦</span><div><h3>Ficha matriz del condominio</h3><p>Un solo contrato jurídico y una liquidación consolidada para todas las viviendas. No se registran apartamentos ficticios.</p></div></div>'+
 '<div class="form-grid">'+
 '<div class="field full"><label>Nombre del conjunto residencial *</label><input name="display_name" required minlength="3" placeholder="Ej. Condominio Los Médanos"></div>'+
 '<div class="field full"><label>Dirección del condominio *</label><textarea name="address" rows="2" minlength="5" required placeholder="Dirección general del condominio o urbanización"></textarea></div>'+
 '<div class="field"><label>Parroquia *</label><select required name="parish_id" id="'+id+'Parish"><option value="">Seleccione parroquia</option></select></div>'+
 '<div class="field"><label>Sector *</label><select required name="sector_id" id="'+id+'Sector" disabled><option value="">Seleccione primero parroquia</option></select></div>'+
 '<div class="field"><label>Cantidad de viviendas *</label><input required name="unit_count" type="number" min="1" max="100000" step="1" placeholder="Ej. 45"></div>'+
 '<div class="field"><label>Tipología del sector</label><input id="'+id+'Typology" disabled value="Automática según sector"></div>'+
 '<div class="field"><label>Representante / Administrador</label><input name="representative_name" placeholder="Nombre y apellido"></div>'+
 '<div class="field"><label>Identificación del representante</label><input name="representative_id" placeholder="Cédula / RIF"></div></div>'+
 '<div class="condo-matrix-estimate" id="'+id+'Estimate">Selecciona sector y cantidad de viviendas para ver la estimación DEMO.</div>'+
 '<p class="condo-matrix-disclaimer">La obligación del mes se registrará como DEMO, a nombre de la persona jurídica del condominio. El importe real requiere ordenanza validada. Un solo pago cancelará la obligación consolidada.</p>'+
 '<div class="form-actions"><button type="submit" class="btn btn-primary" id="'+id+'Submit">Guardar ficha y generar deuda DEMO</button></div>'+
 '<div class="property-success" id="'+id+'Success" hidden></div></form>';
};
const oldContributorModal=contributorModal;
contributorModal=function(){
 const html=oldContributorModal();
 const anchor='<div class="linked-contributor" id="linkedContributor"></div><form id="propertyForm">';
 if(!html.includes(anchor))return html;
 return html.replace(anchor,'<div class="linked-contributor" id="linkedContributor"></div>'+fhtml('inline')+'<form id="propertyForm">');
};
const oldPropertyModal=propertyRegistrationModal;
propertyRegistrationModal=function(){
 const html=oldPropertyModal();
 return html.replace('<form id="standalonePropertyForm">',fhtml('standalone')+'<form id="standalonePropertyForm">');
};
function toggleCondo(mode,enabled){
 const inline=mode==='inline',id=inline?'condoInline':'condoStandalone';
 const normal=document.getElementById(inline?'propertyForm':'standalonePropertyForm');
 const special=document.getElementById(id+'Form');
 if(!normal||!special)return;
 normal.hidden=enabled;special.hidden=!enabled;
 if(enabled){
  if(inline){
   const step=document.getElementById('stepProperty');const stepTitle=step?.querySelector('strong'),stepHint=step?.querySelector('small');if(stepTitle)stepTitle.textContent='Registrar ficha matriz';if(stepHint)stepHint.textContent='Cantidad de viviendas y clasificación del sector';
   const wrap=document.getElementById('propertyFormWrap');
   const h=wrap?.querySelector(':scope > h3'),p=wrap?.querySelector(':scope > p.panel-hint');
   if(h)h.textContent='▦ Registrar condominio';
   if(p)p.textContent='Ficha colectiva: unidades habitacionales bajo una única cuenta matriz jurídica.';
  }else{
   const area=document.getElementById('propertyNewPanel');
   const h=area?.querySelector('.property-add-heading h3');
   if(h)h.textContent='2. Registrar ficha matriz del condominio';
  }
  initializeCondoLocations(mode);
 }
}
function initializeCondoLocations(mode){
 const id=mode==='inline'?'condoInline':'condoStandalone';
 const p=document.getElementById(id+'Parish');
 if(!p)return;
 const rows=state.parishes||[];
 const current=p.value;
 p.innerHTML='<option value="">Seleccione parroquia</option>'+rows.map(x=>'<option value="'+escapeHTML(x.id)+'">'+escapeHTML(x.name)+'</option>').join('');
 p.value=current;
 updateCondoSectors(mode);
}
function updateCondoSectors(mode){
 const id=mode==='inline'?'condoInline':'condoStandalone';
 const parish=document.getElementById(id+'Parish')?.value;
 const sectors=document.getElementById(id+'Sector');
 if(!sectors)return;
 const choices=(state.sectors||[]).filter(x=>x.parish_id===parish);
 sectors.disabled=!parish||!choices.length;
 const prev=sectors.value;
 sectors.innerHTML='<option value="">Seleccione sector</option>'+choices.map(s=>'<option value="'+escapeHTML(s.id)+'">'+escapeHTML(s.name)+'</option>').join('');
 sectors.value=choices.some(x=>x.id===prev)?prev:'';
 updateCondoEstimate(mode);
}
let estimateRate=null;
async function lookupUcd(){
 if(estimateRate)return estimateRate;
 const {data,error}=await imaudClient.from('udc_rates').select('effective_date,udc_value').order('effective_date',{ascending:false}).limit(1);
 if(error){console.warn('Condo UCD preview:',error);return null}
 estimateRate=data?.[0]||null;return estimateRate;
}
async function updateCondoEstimate(mode){
 const id=mode==='inline'?'condoInline':'condoStandalone';
 const container=document.getElementById(id+'Estimate');
 if(!container)return;
 const sectorId=document.getElementById(id+'Sector')?.value;
 const count=Number(document.querySelector('#'+id+'Form [name="unit_count"]')?.value||0);
 const sector=state.sectors?.find(x=>x.id===sectorId);
 const typology=sector?.default_typology;
 const coeff={'TIPO I':3,'TIPO II':1.5,'TIPO III':0.5}[typology];
 const type=document.getElementById(id+'Typology');if(type)type.value=typology||'Selecciona un sector';
 if(!sector||!coeff||!Number.isInteger(count)||count<1){
  container.textContent='Selecciona un sector y especifica la cantidad total de viviendas para calcular la tarifa consolidada.';return;
 }
 const ucds=coeff*count;
 const fmt=v=>new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
 container.innerHTML='<strong>'+count+' viviendas × '+fmt(coeff)+' UCD = '+fmt(ucds)+' UCD mensuales</strong><span>Calculado automáticamente según el sector ('+escapeHTML(typology)+'). Consultando la tasa para el monto DEMO en bolívares…</span>';
 const rate=await lookupUcd();if(!document.getElementById(id+'Estimate'))return;
 container.innerHTML='<strong>'+count+' viviendas × '+fmt(coeff)+' UCD = '+fmt(ucds)+' UCD mensuales</strong>'+
 (rate?'<span>Estimación: <b>Bs. '+fmt(Math.round(ucds*Number(rate.udc_value)*100)/100)+'</b> · Tasa de referencia '+escapeHTML(rate.effective_date)+'. El cálculo definitivo lo confirma el servidor al guardar.</span>':'<span>La tasa UCD no está disponible para la vista previa. El servidor validará la información al registrar.</span>');
}
async function saveCondo(form){
 const mode=form.id==='condoInlineForm'?'inline':'standalone';
 const person=mode==='inline'?state.currentContributor:state.propertySelectedContributor;
 if(!person?.id||person.service_account_type!=='condominio'||person.kind!=='juridico'){toast('Primero selecciona una persona jurídica registrada como condominio.');return;}
 const values=new FormData(form),units=Number(values.get('unit_count'));
 if(!Number.isInteger(units)||units<1){toast('Indica un número válido de viviendas.');return;}
 const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Registrando cuenta matriz…';
 const {data,error}=await imaudClient.rpc('register_demo_condominium',{
  p_contributor_id:person.id,
  p_display_name:String(values.get('display_name')||'').trim(),
  p_address:String(values.get('address')||'').trim(),
  p_parish_id:values.get('parish_id'),
  p_sector_id:values.get('sector_id'),
  p_unit_count:units,
  p_representative_name:String(values.get('representative_name')||'').trim()||null,
  p_representative_id:String(values.get('representative_id')||'').trim()||null
 });
 submit.disabled=false;submit.textContent='Guardar ficha y generar deuda DEMO';
 if(error){console.error('SITMAUD condominium registration:',error);toast('No se pudo crear la cuenta matriz: '+error.message);return;}
 form.querySelectorAll('input,textarea,select,button').forEach(x=>x.disabled=true);
 const confirmation=document.getElementById((mode==='inline'?'condoInline':'condoStandalone')+'Success');
 const fmt=n=>new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n));
 if(confirmation){confirmation.hidden=false;confirmation.innerHTML='<b>✓ Condominio registrado · '+units+' viviendas</b><span>Cuenta matriz a nombre de '+escapeHTML(contributorName(person))+' · Contrato '+escapeHTML(person.contract_number||'—')+'.</span><span>Tipología '+escapeHTML(data.typology)+' · '+fmt(data.total_ucd)+' UCD · Deuda DEMO del período: <b>Bs. '+fmt(data.amount_bs)+'</b>.</span><button type="button" class="btn btn-primary" data-action="'+(mode==='inline'?'close-contributor-modal':'close-property-modal')+'">Finalizar registro</button>';}
 if(mode==='inline')document.getElementById('stepProperty')?.classList.add('complete');
 toast('Ficha matriz guardada. Deuda consolidada DEMO generada para '+units+' viviendas.');
}
const oldSaveContributor=saveContributor;
saveContributor=async function(form){
 await oldSaveContributor(form);
 if(state.currentContributor?.service_account_type==='condominio')toggleCondo('inline',true);
};
const oldFindPropertyContributor=findPropertyContributor;
findPropertyContributor=async function(){
 await oldFindPropertyContributor();
 const person=state.propertySelectedContributor;
 if(!document.getElementById('propertyNewPanel')?.hidden&&person?.service_account_type!=='condominio')toggleCondo('standalone',false);
 if(!document.getElementById('propertyNewPanel')?.hidden&&person?.service_account_type==='condominio'){
  const form=document.getElementById('condoStandaloneForm');
  if(form){form.querySelectorAll('input,textarea,select,button').forEach(x=>x.disabled=false);form.hidden=false;const success=document.getElementById('condoStandaloneSuccess');if(success){success.hidden=true;success.textContent='';}}
  toggleCondo('standalone',true);
  const {data}=await imaudClient.from('residential_organizations').select('id,unit_count').eq('contributor_id',person.id).limit(1);
  if(data?.length){const form=document.getElementById('condoStandaloneForm');if(form){form.hidden=true;const area=document.getElementById('standalonePropertySuccess');if(area){area.hidden=false;area.innerHTML='<b>Este condominio ya tiene una cuenta matriz registrada.</b><span>'+Number(data[0].unit_count||0)+' viviendas asociadas. No se puede generar otra ficha duplicada.</span>';}}}
 }
};
document.addEventListener('submit',event=>{
 if(event.target.id==='condoInlineForm'||event.target.id==='condoStandaloneForm'){
  event.preventDefault();saveCondo(event.target);
 }
});
document.addEventListener('change',event=>{
 if(event.target.id==='condoInlineParish')updateCondoSectors('inline');
 if(event.target.id==='condoStandaloneParish')updateCondoSectors('standalone');
 if(event.target.id==='condoInlineSector')updateCondoEstimate('inline');
 if(event.target.id==='condoStandaloneSector')updateCondoEstimate('standalone');
});
document.addEventListener('input',event=>{
 if(event.target.closest('#condoInlineForm')&&event.target.name==='unit_count')updateCondoEstimate('inline');
 if(event.target.closest('#condoStandaloneForm')&&event.target.name==='unit_count')updateCondoEstimate('standalone');
});
})();
