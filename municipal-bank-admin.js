/* SITMAUD · Publicación controlada de cuentas bancarias municipales */
(function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const panel=()=>'<section id="sitMunicipalBanksAdmin" class="card panel" style="margin-top:16px" hidden>'+
 '<div class="panel-head"><div><h3>Cuentas oficiales para pagos de contribuyentes</h3><p>Solo el superusuario maestro puede publicar o modificar las cuentas que se muestran en el Portal del Contribuyente.</p></div></div>'+
 '<div id="sitOfficialBanksStatus" class="panel-hint">Verificando autorización…</div>'+
 '<div id="sitOfficialBanksList"></div>'+
 '<form id="sitOfficialBanksForm"><input name="id" type="hidden">'+
 '<div class="form-grid">'+
 '<label class="field">Método de pago<select name="method" required><option value="transferencia">Transferencia</option><option value="pago_movil">Pago móvil</option></select></label>'+
 '<label class="field">Banco oficial<input name="bank" required minlength="3" maxlength="120" placeholder="Nombre del banco"></label>'+
 '<label class="field">Titular de la cuenta<input name="holder" required minlength="3" maxlength="180" placeholder="Razón social oficial"></label>'+
 '<label class="field">RIF del titular<input name="rif" required minlength="8" maxlength="20" placeholder="J-00000000-0"></label>'+
 '<label class="field">Número de cuenta (20 dígitos)<input name="account" inputmode="numeric" pattern="[0-9]{20}" maxlength="20" placeholder="Solo transferencias"></label>'+
 '<label class="field">Teléfono pago móvil<input name="phone" inputmode="numeric" pattern="[0-9]{10,15}" maxlength="15" placeholder="Solo pago móvil"></label>'+
 '</div><label class="field"><input type="checkbox" name="published"> Publicar en el Portal del Contribuyente tras verificar estos datos con Tesorería</label>'+
 '<div class="form-actions"><button class="btn btn-primary" type="submit">Guardar cuenta oficial</button><button class="btn btn-light" id="sitOfficialBanksReset" type="button">Nueva cuenta</button></div></form></section>';
 let saved=[];
 async function load(){
  const host=document.getElementById('sitMunicipalBanksAdmin');if(!host)return;
  const check=await imaudClient.rpc('is_sitmaud_master');
  if(!host.isConnected||check.error||check.data!==true){host.hidden=true;return;}
  host.hidden=false;
  const label=document.getElementById('sitOfficialBanksStatus'),list=document.getElementById('sitOfficialBanksList');
  const r=await imaudClient.rpc('list_municipal_payment_accounts_admin');
  if(r.error){label.textContent='No se pudieron leer las cuentas oficiales: '+r.error.message;return;}
  saved=Array.isArray(r.data)?r.data:[];
  label.textContent=saved.length?saved.length+' cuenta(s) configuradas. Verifica los datos antes de publicarlos.':'Todavía no hay cuentas oficiales cargadas. La sección ciudadana no muestra números bancarios.';
  list.innerHTML=saved.length?'<div class="payment-debt-scroll"><table><thead><tr><th>Banco</th><th>Modalidad</th><th>Estado</th><th></th></tr></thead><tbody>'+
   saved.map(b=>'<tr><td>'+esc(b.bank_name)+'</td><td>'+esc(b.method==='pago_movil'?'Pago móvil':'Transferencia')+'</td><td>'+esc(b.is_published?'Publicada':'No publicada')+'</td><td><button type="button" class="btn btn-light btn-sm" data-bank-edit="'+esc(b.id)+'">Editar</button></td></tr>').join('')+'</tbody></table></div>':'';
 }
 function edit(id){
  const b=saved.find(x=>x.id===id),form=document.getElementById('sitOfficialBanksForm');if(!b||!form)return;
  form.elements.id.value=b.id;form.elements.method.value=b.method;form.elements.bank.value=b.bank_name;
  form.elements.holder.value=b.holder_name;form.elements.rif.value=b.holder_rif;
  form.elements.account.value=b.account_number||'';form.elements.phone.value=b.mobile_number||'';
  form.elements.published.checked=!!b.is_published;form.scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-bank-edit]');if(btn){edit(btn.dataset.bankEdit);return;}
  if(e.target.closest('#sitOfficialBanksReset'))document.getElementById('sitOfficialBanksForm')?.reset();
 });
 document.addEventListener('submit',async e=>{
  if(e.target.id!=='sitOfficialBanksForm')return;e.preventDefault();
  const form=e.target,values=form.elements,method=values.method.value;
  if(!form.reportValidity())return;
  const account=values.account.value.trim(),phone=values.phone.value.trim();
  if(method==='transferencia'?!/^\d{20}$/.test(account):!/^\d{10,15}$/.test(phone)){
   window.alert(method==='transferencia'?'El número de cuenta debe tener 20 dígitos.':'El teléfono para pago móvil debe tener de 10 a 15 dígitos.');return;
  }
  if(values.published.checked&&!window.confirm('¿Confirmas que Tesorería verificó la titularidad y los datos bancarios? Esta cuenta será visible para los contribuyentes.'))return;
  const submit=form.querySelector('[type=submit]');submit.disabled=true;
  try{
   const {data,error}=await imaudClient.rpc('manage_municipal_payment_account',{
    p_id:values.id.value||null,p_method:method,p_bank:values.bank.value,p_holder:values.holder.value,
    p_rif:values.rif.value,p_account:method==='transferencia'?account:null,
    p_phone:method==='pago_movil'?phone:null,p_published:values.published.checked
   });
   if(error)throw error;
   form.reset();values.id.value='';
   await load();document.getElementById('sitOfficialBanksStatus').textContent=data?.published?
    'Cuenta bancaria oficial publicada y auditada.':'Cuenta guardada sin publicar; permanece invisible para los contribuyentes.';
  }catch(err){window.alert('No se pudo guardar la cuenta oficial: '+(err.message||'Error de servidor'));}
  finally{if(submit.isConnected)submit.disabled=false;}
 });
 window.sitmaudBankAdmin={panel,load};
})();