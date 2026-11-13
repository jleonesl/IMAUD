/* SITMAUD · Registro integral de condominios / formato CD */
(function(){
'use strict';
const coefficient={'TIPO I':3,'TIPO II':1.5,'TIPO III':0.5};
const escape=s=>escapeHTML(s);
const format=n=>new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0);
let parishes=[],sectors=[],rate=null,busy=false;
const input=(name,label,placeholder='',type='text',extra='')=>
 '<label class="condo-reg-field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" placeholder="'+placeholder+'" '+extra+'></label>';
window.renderCondominiumRegistration=function(){
 return head('Registrar condominio','Crea la cuenta jurídica, su ficha matriz y el esquema de cobranza consolidada.','<button class="btn btn-light" type="button" data-go="organizaciones">← Volver al directorio</button>')+
 '<section class="card condo-reg-layout">'+
 '<div class="condo-reg-title"><span class="condo-reg-title-icon">▤</span><div><h2>Ficha de registro de condominio</h2><p>Un expediente jurídico, un contrato CD y una liquidación mensual consolidada para todas sus viviendas.</p></div></div>'+
 '<div class="condo-reg-progress"><div><b>1</b><span>Datos jurídicos</span></div><i></i><div><b>2</b><span>Ficha matriz y administrador</span></div><i></i><div><b>3</b><span>Tipología y cobranza</span></div></div>'+
 '<form id="condoRegistrationForm" autocomplete="off"><div class="condo-reg-columns">'+
 '<section class="condo-reg-column"><div class="condo-reg-column-head"><span>1</span><div><h3>Datos del contribuyente jurídico</h3><p>Información legal de la entidad responsable del condominio.</p></div></div><div class="condo-reg-fields">'+
 input('legal_name','Razón social *','Razón social del condominio','text','required minlength="4" maxlength="180"')+
 input('rif','RIF jurídico *','J-12345678-9','text','required maxlength="15" pattern="[Jj][- ]?[0-9]{8}[- ]?[0-9]" title="Ejemplo: J-12345678-9"')+
 input('email','Correo electrónico','correo@condominio.com','email','maxlength="180"')+
 input('phone','Teléfono de contacto','04XX-XXXXXXX','tel','maxlength="30"')+
 '<div class="condo-reg-field"><span>Estado del contribuyente</span><div class="condo-reg-readonly"><span class="condo-reg-status-dot"></span>Activo</div></div>'+
 '<div class="condo-reg-field"><span>Número de contrato</span><div class="condo-reg-readonly"><b>CD-AÑO-000001</b><small>Se asignará al guardar</small></div></div>'+
 '</div></section>'+
 '<section class="condo-reg-column"><div class="condo-reg-column-head"><span>2</span><div><h3>Ficha matriz del condominio</h3><p>Nombre, ubicación geográfica y administrador responsable.</p></div></div><div class="condo-reg-fields">'+
 input('display_name','Nombre del conjunto residencial *','Ej. Conjunto Residencial Los Médanos','text','required minlength="3" maxlength="180"')+
 '<div class="condo-reg-two"><label class="condo-reg-field"><span>Parroquia *</span><select id="condoRegParish" name="parish_id" required><option value="">Cargando parroquias…</option></select></label><label class="condo-reg-field"><span>Sector geográfico *</span><select id="condoRegSector" name="sector_id" required disabled><option value="">Selecciona parroquia</option></select></label></div>'+
 '<label class="condo-reg-field"><span>Dirección general *</span><textarea name="address" required minlength="5" maxlength="500" rows="2" placeholder="Dirección o referencia del conjunto residencial"></textarea></label>'+
 input('unit_count','Cantidad de viviendas *','Ej. 40','number','required min="1" max="100000" step="1"')+
 input('responsible_name','Administrador o responsable','Nombre y apellido','text','maxlength="160"')+
 '<div class="condo-reg-two">'+input('responsible_id','Cédula del responsable','V-12345678','text','maxlength="35"')+input('responsible_phone','Teléfono del responsable','04XX-XXXXXXX','tel','maxlength="30"')+'</div>'+
 input('responsible_email','Correo del responsable','administracion@condominio.com','email','maxlength="180"')+
 '</div></section>'+
 '<section class="condo-reg-column"><div class="condo-reg-column-head"><span>3</span><div><h3>Clasificación y cobranza</h3><p>Tipología asignada y estimación de obligación DEMO.</p></div></div><div class="condo-reg-fields">'+
 '<div class="condo-reg-field"><span>Tipología del sector</span><div class="condo-reg-readonly" id="condoRegSectorType">Selecciona un sector</div></div>'+
 '<label class="condo-reg-field"><span>Tipología de cobro del condominio *</span><select name="billing_typology" id="condoRegBillingType" required><option value="">Selecciona un sector primero</option><option value="TIPO I">Tipo I · 3,00 UCD / vivienda</option><option value="TIPO II">Tipo II · 1,50 UCD / vivienda</option><option value="TIPO III">Tipo III · 0,50 UCD / vivienda</option></select></label>'+
 '<label class="condo-reg-field" id="condoRegReasonWrap" hidden><span>Justificación de tipología particular *</span><textarea name="typology_reason" rows="3" minlength="15" placeholder="Explica el fundamento normativo o técnico de la clasificación diferente al sector"></textarea><small>El cambio requiere permiso de gestión de tarifas y queda registrado en auditoría.</small></label>'+
 '<div class="condo-reg-summary"><span>Coeficiente por vivienda</span><strong id="condoRegCoefficient">—</strong></div>'+
 '<div class="condo-reg-summary"><span>Total de viviendas</span><strong id="condoRegUnits">—</strong></div>'+
 '<div class="condo-reg-total"><span>Estimación mensual consolidada</span><strong id="condoRegTotal">— UCD</strong><small id="condoRegTotalBs">Se calculará con la tasa de referencia UCD vigente.</small></div>'+
 '<div class="condo-reg-help">La tipología propia puede diferir de la geográfica si existe respaldo y autorización. El pago posterior se registra una sola vez en Recaudación y pagos.</div>'+
 '</div></section>'+
 '</div><div class="condo-reg-footer"><div class="condo-reg-contract"><b>Contrato exclusivo para condominios</b><p>Identificador automático con prefijo <strong>CD</strong>. Por ejemplo, CD-2026-000001. El contrato se genera en el servidor y no puede modificarse manualmente.</p><small>Documentos y soportes administrativos: opcionales; se agregan después desde el expediente.</small></div>'+
 '<div class="condo-reg-buttons"><button type="button" class="btn btn-light" data-go="organizaciones">Cancelar</button><button type="submit" class="btn btn-primary" id="condoRegSubmit">Guardar condominio</button></div></div></form>'+
 '</section>';
};
function sectorSelected(){
 const parish=document.getElementById('condoRegParish')?.value;
 const select=document.getElementById('condoRegSector');
 if(!select)return;
 const old=select.value;
 const choices=sectors.filter(s=>s.parish_id===parish);
 select.disabled=!parish||!choices.length;
 select.innerHTML='<option value="">'+(parish?'Selecciona sector':'Selecciona parroquia')+'</option>'+choices.map(s=>'<option value="'+escape(s.id)+'">'+escape(s.name)+'</option>').join('');
 if(choices.some(s=>s.id===old))select.value=old;
 else select.value='';
 updatePreview(true);
}
function updatePreview(resetType=false){
 const form=document.getElementById('condoRegistrationForm');if(!form)return;
 const sector=sectors.find(s=>s.id===form.elements.sector_id.value);
 const original=sector?.default_typology||'';
 const type=form.elements.billing_typology;
 if(resetType)type.value=original;
 const selected=type.value;
 const override=!!(original&&selected&&original!==selected);
 const reason=document.getElementById('condoRegReasonWrap');
 if(reason){reason.hidden=!override;reason.querySelector('textarea').required=override;}
 document.getElementById('condoRegSectorType').textContent=original||'Selecciona un sector';
 const units=Number(form.elements.unit_count.value||0);
 const valid=Number.isInteger(units)&&units>0&&units<=100000;
 const coef=coefficient[selected]||0;
 document.getElementById('condoRegCoefficient').textContent=coef?format(coef)+' UCD':'—';
 document.getElementById('condoRegUnits').textContent=valid?units.toLocaleString('es-VE'):'—';
 document.getElementById('condoRegTotal').textContent=valid&&coef?format(units*coef)+' UCD':'— UCD';
 document.getElementById('condoRegTotalBs').textContent=valid&&coef&&rate
  ?'Estimado: Bs. '+format(Math.round(units*coef*Number(rate.udc_value)*100)/100)+' · Referencia '+rate.effective_date
  :'La tasa UCD y el total definitivo se verificarán al guardar.';
}
window.initializeCondominiumRegistration=async function(){
 const form=document.getElementById('condoRegistrationForm');if(!form)return;
 const [parishRes,sectorRes,rateRes]=await Promise.all([
  imaudClient.from('parishes').select('id,name').eq('is_active',true).order('name'),
  imaudClient.from('sectors').select('id,name,parish_id,default_typology').eq('is_active',true).order('name'),
  imaudClient.from('udc_rates').select('effective_date,udc_value').order('effective_date',{ascending:false}).limit(1)
 ]);
 if(!document.getElementById('condoRegistrationForm'))return;
 if(parishRes.error||sectorRes.error){
  toast('No se pudo cargar el catálogo territorial. Intenta nuevamente.');
  console.error('Condo catalog:',parishRes.error||sectorRes.error);return;
 }
 parishes=parishRes.data||[];sectors=sectorRes.data||[];rate=rateRes.data?.[0]||null;
 const select=document.getElementById('condoRegParish');
 select.innerHTML='<option value="">Selecciona parroquia</option>'+parishes.map(p=>'<option value="'+escape(p.id)+'">'+escape(p.name)+'</option>').join('');
};
document.addEventListener('change',event=>{
 if(event.target.id==='condoRegParish')sectorSelected();
 if(event.target.id==='condoRegSector')updatePreview(true);
 if(event.target.id==='condoRegBillingType')updatePreview(false);
});
document.addEventListener('input',event=>{
 if(event.target.closest('#condoRegistrationForm')&&event.target.name==='unit_count')updatePreview(false);
});
document.addEventListener('submit',async event=>{
 if(event.target.id!=='condoRegistrationForm')return;
 event.preventDefault();
 if(busy)return;
 const form=event.target;
 if(!form.reportValidity())return;
 const data=new FormData(form),rif=String(data.get('rif')||'').replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
 if(!/^J[0-9]{9}$/.test(rif)){toast('Introduce el RIF jurídico en formato J-12345678-9.');return;}
 const sector=sectors.find(s=>s.id===data.get('sector_id'));
 const typology=String(data.get('billing_typology')||'');
 const reason=String(data.get('typology_reason')||'').trim();
 if(!sector||!coefficient[typology]){toast('Selecciona sector y tipología válidos.');return;}
 if(sector.default_typology!==typology&&reason.length<15){toast('Justifica la clasificación particular del condominio.');return;}
 const button=document.getElementById('condoRegSubmit');
 busy=true;button.disabled=true;button.textContent='Registrando condominio…';
 try{
  const optional=name=>String(data.get(name)||'').trim()||null;
  const {data:record,error}=await imaudClient.rpc('register_demo_condominium_full',{
   p_legal_name:String(data.get('legal_name')||'').trim(),
   p_rif:rif,p_email:optional('email'),p_phone:optional('phone'),
   p_display_name:String(data.get('display_name')||'').trim(),
   p_address:String(data.get('address')||'').trim(),
   p_parish_id:data.get('parish_id'),p_sector_id:data.get('sector_id'),
   p_unit_count:Number(data.get('unit_count')),
   p_responsible_name:optional('responsible_name'),
   p_responsible_id:optional('responsible_id'),
   p_responsible_phone:optional('responsible_phone'),
   p_responsible_email:optional('responsible_email'),
   p_billing_typology:typology,p_typology_reason:reason||null
  });
  if(error)throw error;
  if(!record?.contract_number)throw Error('No llegó la confirmación del contrato. Consulta el directorio antes de repetir.');
  toast('Condominio registrado · Contrato '+record.contract_number);
  go('organizaciones');
 }catch(err){
  console.error('SITMAUD registration:',err);
  toast('No se pudo registrar: '+(err.message||'Error de validación'));
 }finally{busy=false;if(button.isConnected){button.disabled=false;button.textContent='Guardar condominio';}}
});
})();