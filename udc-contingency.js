/* SITMAUD · Verificación manual institucional de UCD (no modifica fuente original). */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false;
function format(n){return new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:8}).format(Number(n||0));}
async function mount(){
 const host=document.getElementById('udcContingencyPanel');if(!host)return;
 host.hidden=false;host.textContent='Verificando disponibilidad de la tasa para recaudación…';
 const {data:r,error}=await imaudClient.rpc('get_udc_rate_readiness');
 if(!host.isConnected)return;
 if(error){host.textContent='No se pudo consultar el estado de la tasa: '+error.message;return;}
 if(!r?.available){host.innerHTML='<h3>Tasa del día</h3><p>No hay tasas registradas. Revisa la sincronización automática.</p>';return;}
 const good=r.ready===true;
 const label=good?(r.verified_directly?'Tasa obtenida directamente del BCV':'Tasa contrastada y validada por la administración')
   :'Tasa pendiente de validación para cobrar';
 const desc=good?'La tasa está habilitada para cotizaciones durante su vigencia. Los importes son calculados de nuevo al registrar cada pago.'
   :'Las mensualidades están registradas, pero el cobro espera una tasa válida. Si el BCV no responde automáticamente, el superusuario puede verificar la cifra manualmente contra su publicación oficial.';
 let markup='<div class="udc-contingency-head"><div><div class="eyebrow">CONTROL FINANCIERO · UCD</div><h3>Estado de la tasa para Recaudación</h3></div><span class="status '+(good?'active':'pending')+'">'+(good?'Habilitada':'Pendiente')+'</span></div>'+
  '<p class="udc-contingency-desc"><strong>'+esc(label)+'</strong>. '+esc(desc)+'</p>'+
  '<div class="udc-contingency-data"><span>Fecha valor: <strong>'+esc(r.effective_date||'—')+'</strong></span><span>UCD: <strong>'+esc(r.currency)+' · Bs. '+esc(format(r.value_bs))+'</strong></span></div>';
 if(r.can_approve===true&&!good&&r.eligible_date===true){
  markup+='<form id="udcManualVerifyForm" class="udc-manual-verify">'+
   '<h4>Contingencia: comprobación institucional del BCV</h4>'+
   '<p>Abre el <a href="https://www.bcv.org.ve/" target="_blank" rel="noopener noreferrer">sitio oficial del BCV</a> y compara moneda, fecha valor y cifra. Esta opción no transforma una fuente externa en una consulta directa: documenta tu comprobación como superusuario.</p>'+
   '<input type="hidden" name="rate_id" value="'+esc(r.rate_id)+'">'+
   '<div class="form-grid"><div class="field"><label for="udcManualValue">Valor comprobado en el BCV (Bs. por '+esc(r.currency)+')</label><input id="udcManualValue" name="confirmed_value" type="number" min="0.00000001" step="0.00000001" required placeholder="Escribe el importe publicado, no se autocompleta"></div>'+
   '<div class="field full"><label for="udcManualEvidence">Constancia de la comprobación *</label><textarea id="udcManualEvidence" name="notes" rows="3" required minlength="30" maxlength="1000" placeholder="Describe la fecha valor, pantalla o documento oficial consultado, y la hora de la verificación."></textarea></div></div>'+
   '<label class="udc-manual-attestation"><input name="confirm" type="checkbox" required> Confirmo que consulté la publicación oficial y que la fecha, moneda y valor coinciden exactamente.</label>'+
   '<div class="form-actions"><button type="submit" class="btn btn-primary">Registrar verificación y habilitar tasa</button></div>'+
   '<div id="udcManualResult" role="status"></div></form>';
 }
 if(r.can_approve!==true&&!good){
  markup+='<p class="udc-contingency-note">La comprobación de contingencia corresponde exclusivamente al superusuario maestro.</p>';
 }
 host.innerHTML=markup;
}
document.addEventListener('submit',async e=>{
 if(e.target.id!=='udcManualVerifyForm')return;
 e.preventDefault();if(busy)return;
 const form=e.target,button=form.querySelector('[type="submit"]'),result=form.querySelector('#udcManualResult');
 if(!form.reportValidity())return;
 if(!window.confirm('Vas a registrar una comprobación institucional con efectos sobre los pagos. ¿Confirmas que verificaste personalmente la tasa en la publicación del BCV?'))return;
 busy=true;button.disabled=true;button.textContent='Registrando verificación…';result.textContent='';
 try{
  const payload={p_rate_id:form.elements.rate_id.value,
   p_confirmed_value:Number(form.elements.confirmed_value.value),
   p_evidence_notes:form.elements.notes.value.trim(),p_confirm:form.elements.confirm.checked};
  const {data,error}=await imaudClient.rpc('approve_udc_rate_contingency',payload);
  if(error||!data?.ok)throw new Error(error?.message||'No se pudo registrar la comprobación');
  await mount();
  await window.loadUdcRate?.();
 }catch(error){result.textContent='No se completó la verificación: '+(error.message||'Error');}
 finally{busy=false;if(button.isConnected){button.disabled=false;button.textContent='Registrar verificación y habilitar tasa';}}
});
window.sitmaudRateContingency={mount};
})();