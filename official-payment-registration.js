/* SITMAUD · Recaudación bancaria oficial · pago UCD a tasa del día.
   Los importes se cotizan y recalculan de nuevo en PostgreSQL. */
(function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const bs=n=>'Bs. '+new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0));
 const ucd=n=>new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:4}).format(Number(n||0))+' UCD';
 let contributor=null,debts=[],quote=null,busy=false;
 const root=()=>document.getElementById('officialRegisterUdcPanel');
 function markup(){
  return '<div class="official-cashier-backdrop" id="officialCashierBackdrop" hidden><section class="card panel official-cashier-modal" id="officialRegisterUdcPanel" role="dialog" aria-modal="true" aria-labelledby="officialCashierTitle">'+
    '<div class="panel-head"><div><h3 id="officialCashierTitle">Registrar pago</h3><p>Localiza el expediente, selecciona uno o varios meses y carga los datos bancarios. La confirmación del pago se realiza por separado.</p></div><button type="button" class="btn btn-light" data-official-close-register aria-label="Cerrar registro de pago">✕ Cerrar</button></div>'+
    '<div id="udcCashierMessage" role="status">Verificando permiso de recaudación…</div>'+
    '<form id="udcPaymentLookup" hidden><div class="form-grid"><div class="field"><label>Contrato, cédula o RIF del contribuyente</label><input name="identity" minlength="3" required placeholder="Ej. CD-2027-000001"></div></div><div class="form-actions"><button type="submit" class="btn btn-light">Consultar obligaciones</button></div></form>'+
    '<div id="udcPaymentContributor"></div>'+
    '<form id="udcPaymentRegister" hidden>'+
    '<div id="udcPaymentMonths" class="payment-debt-table"></div>'+
    '<div id="udcPaymentQuote"></div>'+
    '<div class="form-grid">'+
    '<div class="field"><label>Método bancario *</label><select name="method" required><option value="transferencia">Transferencia</option><option value="pago_movil">Pago móvil</option><option value="punto_venta">Punto de venta</option></select></div>'+
    '<div class="field"><label>Banco *</label><select id="udcPayBank" name="bank" required><option value="">Cargando bancos…</option></select></div>'+
    '<div class="field"><label>Referencia de la operación *</label><input name="reference" required minlength="3" maxlength="110" autocomplete="off" placeholder="Referencia bancaria"></div>'+
    '<div class="field"><label id="udcProofLabel">Comprobante (PDF o imagen) *</label><input id="udcProofFile" name="proof" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required><small id="udcProofHelp">Obligatorio para transferencias y pago móvil. Opcional para punto de venta.</small></div>'+
    '</div><div class="form-actions"><button class="btn btn-primary" id="udcPaySubmit" type="submit" disabled>Registrar pago y emitir factura</button></div>'+
    '<p class="panel-hint">Importes en VES. Solo meses oficiales íntegros, sin pagos anteriores ni exoneraciones pendientes de conciliar. El banco debe acreditar los fondos; registrar no equivale a liquidar.</p></form>'+
    '<div id="udcPaymentConfirmation" aria-live="polite"></div>'+
  '</section></div>';
 }
 const native=window.sitmaudOfficialFinance;
 if(!native)return;
 const oldView=native.view.bind(native),oldMount=native.mount.bind(native);
 native.view=function(v){return oldView(v)+(v==='pagos'?markup():'');};
 native.mount=async function(v){
   await oldMount(v);
   if(v==='pagos')await init();
 };

 let lastFocus=null;
 function close(){
   const layer=document.getElementById('officialCashierBackdrop');
   if(layer)layer.hidden=true;
   document.body.classList.remove('modal-open');
   lastFocus?.focus?.();
 }
 async function open(identity=''){
   const layer=document.getElementById('officialCashierBackdrop');
   if(!layer){window.alert('Abre la sección Recaudación y pagos antes de registrar.');return;}
   lastFocus=document.activeElement;
   layer.hidden=false;document.body.classList.add('modal-open');
   const input=layer.querySelector('#udcPaymentLookup [name="identity"]');
   if(input){input.value=identity||'';input.focus();}
   if(identity){
     try{await showLookup(identity);}catch(e){tell('No se pudo consultar el expediente: '+(e.message||'Intenta otra búsqueda'));}
   }
 }
 window.sitmaudUdcPayment={open,close};
 document.addEventListener('click',e=>{
   if(e.target.closest('[data-official-close-register]'))close();
   if(e.target.id==='officialCashierBackdrop')close();
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('officialCashierBackdrop')?.hidden)close();});
 function tell(message){const e=document.getElementById('udcCashierMessage');if(e)e.textContent=message;}
 async function init(){
   const can=await imaudClient.rpc('has_permission',{permission_code:'payments.register'});
   if(!root())return;
   if(can.error||can.data!==true){tell('Solo funcionarios con permiso de registrar pagos pueden utilizar este formulario.');return;}
   tell('Consulta el expediente por contrato, cédula o RIF. Ninguna operación se contabilizará antes de la validación de Tesorería.');
   document.getElementById('udcPaymentLookup').hidden=false;
   const b=await imaudClient.from('payment_banks').select('code,name').eq('is_active',true).order('name');
   const sel=document.getElementById('udcPayBank');if(!sel)return;
   if(b.error){sel.innerHTML='<option value="">Catálogo bancario no disponible</option>';tell('Error al consultar bancos: '+b.error.message);return;}
   sel.innerHTML='<option value="">Selecciona banco</option>'+b.data.map(x=>'<option value="'+esc(x.code)+'">'+esc(x.code)+' · '+esc(x.name)+'</option>').join('');
 }
 async function lookup(identity){
   const val=identity.trim();const raw=val.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
   const possibilities=[
     ['contract_number',val],['rif',val.toUpperCase()],
     ['identification_number',raw.replace(/^[VEJGP]/,'')]
   ];
   let found=null;
   for(const [field,value] of possibilities){
     if(!value)continue;
     const res=await imaudClient.from('contributors')
       .select('id,contract_number,legal_name,first_name,last_name,identification_type,identification_number,service_account_type,status')
       .eq(field,value).limit(1).maybeSingle();
     if(res.error)throw res.error;
     if(res.data){found=res.data;break;}
   }
   if(!found)throw Error('No se encontró un contribuyente con esa identificación.');
   if(found.status==='inactive')throw Error('La cuenta del contribuyente está inactiva.');
   const props=await imaudClient.from('properties')
     .select('id,address,is_active,is_consolidated_master,consolidated_units')
     .eq('contributor_id',found.id).eq('is_active',true);
   if(props.error)throw props.error;
   const ids=(props.data||[]).map(x=>x.id);
   if(!ids.length)throw Error('El contribuyente no tiene inmuebles o cuentas matrices activos.');
   const r=await imaudClient.from('assessments')
     .select('id,property_id,period_start,total_amount,status,is_demo,coefficient_snapshot,consolidated_unit_count_snapshot')
     .in('property_id',ids).eq('is_demo',false).eq('status','pending')
     .gte('period_start','2027-01-01').order('period_start').limit(101);
   if(r.error)throw r.error;
   if(r.data.length>100)throw Error('Se encontraron más de 100 obligaciones; requiere atención administrativa.');
   return {found,properties:props.data||[],items:r.data||[]};
 }
 async function showLookup(identity){
   const result=await lookup(identity);
   contributor=result.found;debts=result.items;quote=null;
   const name=contributor.legal_name||[contributor.first_name,contributor.last_name].filter(Boolean).join(' ');
   document.getElementById('udcPaymentContributor').innerHTML='<div class="notice"><b>'+esc(name)+'</b> · '+esc(contributor.contract_number)+'<p>Obligaciones oficiales pendientes: '+debts.length+'</p></div>';
   const form=document.getElementById('udcPaymentRegister'),months=document.getElementById('udcPaymentMonths');
   document.getElementById('udcPaymentConfirmation').textContent='';
   if(!debts.length){form.hidden=true;tell('No existen obligaciones oficiales pendientes para este contribuyente.');return;}
   const names=new Map(result.properties.map(p=>[p.id,p]));
   form.reset();form.hidden=false;adjustProofRequirement();
   months.innerHTML='<div class="table-toolbar"><b>Selecciona los meses a cobrar</b><span id="udcPaySelectedCount">0 meses</span></div>'+
    '<div class="payment-debt-scroll"><table><thead><tr><th>Selección</th><th>Mes</th><th>Cuenta o inmueble</th><th>Base UCD</th></tr></thead><tbody>'+
    debts.map(x=>{
      const p=names.get(x.property_id)||{};
      const units=Number(x.consolidated_unit_count_snapshot||1);
      const base=Number(x.coefficient_snapshot)*units;
      const date=new Date(x.period_start+'T12:00:00Z').toLocaleDateString('es-VE',{month:'long',year:'numeric',timeZone:'UTC'});
      return '<tr><td><input type="checkbox" class="udc-month" value="'+esc(x.id)+'"></td>'+
      '<td>'+esc(date)+'</td><td>'+esc(p.is_consolidated_master?'Cuenta matriz · '+units+' viviendas':p.address||'Inmueble')+'</td>'+
      '<td>'+esc(ucd(base))+'</td></tr>';
    }).join('')+'</tbody></table></div>';
   document.getElementById('udcPaymentQuote').innerHTML='<p class="panel-hint">Selecciona los meses para obtener el importe vigente desde el servidor.</p>';
   document.getElementById('udcPaySubmit').disabled=true;
   tell('Comprueba los meses seleccionados antes de registrar la operación.');
 }
 async function updateQuote(){
   quote=null;
   const selected=[...document.querySelectorAll('#udcPaymentRegister .udc-month:checked')].map(x=>x.value);
   const button=document.getElementById('udcPaySubmit');
   const host=document.getElementById('udcPaymentQuote');
   if(!button||!host)return;
   button.disabled=true;
   document.getElementById('udcPaySelectedCount').textContent=selected.length+' meses';
   if(!selected.length){host.textContent='Selecciona uno o varios meses para calcular el pago.';return;}
   host.textContent='Consultando tasa y obligaciones oficiales…';
   const r=await imaudClient.rpc('quote_official_udc_payment',{
     p_contributor_id:contributor.id,p_assessment_ids:selected
   });
   if(!host.isConnected)return;
   if(r.error){host.textContent='No se pudo cotizar: '+r.error.message;return;}
   quote=r.data;
   host.innerHTML='<div class="card" style="padding:14px;margin:12px 0"><div><b>Total: '+bs(quote.total_bs)+'</b> · '+esc(ucd(quote.total_udc))+'</div>'+
   '<p>Tasa '+esc(quote.currency)+' / UCD: '+esc(quote.rate)+' Bs. · Fecha valor: '+esc(quote.effective_date)+
   '</p><p>Origen: '+esc(quote.source_url)+'</p><small>El servidor recalcula al registrar; si la tasa cambia, no se guardará un importe elegido manualmente.</small></div>';
   button.disabled=false;
 }
 function adjustProofRequirement(){
   const form=document.getElementById('udcPaymentRegister');
   if(!form)return;
   const proof=form.elements.proof;
   const required=form.elements.method.value!=='punto_venta';
   proof.required=required;
   const lbl=document.getElementById('udcProofLabel');
   if(lbl)lbl.textContent=required?'Comprobante (PDF o imagen) *':'Comprobante (opcional para punto de venta)';
 }
 document.addEventListener('submit',async event=>{
   if(event.target.id==='udcPaymentLookup'){
     event.preventDefault();if(busy)return;
     const form=event.target,b=form.querySelector('button');b.disabled=true;
     try {await showLookup(form.elements.identity.value);}
     catch(e){tell(e.message||'No se pudo consultar la cuenta');document.getElementById('udcPaymentRegister').hidden=true;}
     finally{b.disabled=false;}
   }
   if(event.target.id==='udcPaymentRegister'){
     event.preventDefault();if(busy||!quote||!contributor)return;
     if(!event.target.reportValidity())return;
     const selected=[...event.target.querySelectorAll('.udc-month:checked')].map(x=>x.value);
     if(!selected.length)return;
     const form=event.target,b=document.getElementById('udcPaySubmit');
     const file=form.elements.proof.files?.[0];
     if((form.elements.method.value!=='punto_venta'&&!file)||(file&&(file.size>10*1024*1024||!['image/png','image/jpeg','image/webp','application/pdf'].includes(file.type)))){
       tell('Comprobante inválido. Se admite PDF, JPG, PNG o WebP, hasta 10 MB.');return;
     }
     if(!window.confirm('Registrar '+selected.length+' mes(es) por '+bs(quote.total_bs)+
       ' como pago PENDIENTE de Tesorería? La acreditación bancaria se verificará posteriormente.'))return;
     busy=true;b.disabled=true;b.textContent='Registrando y guardando comprobante…';
     let path='',saved=false;
     try{
       if(file){
         const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/pdf':'pdf'}[file.type];
         path=contributor.id+'/'+crypto.randomUUID()+'.'+ext;
         const up=await imaudClient.storage.from('imaud-payment-proofs').upload(path,file,{
           contentType:file.type,cacheControl:'3600',upsert:false
         });
         if(up.error)throw up.error;
       }
       const rpc=await imaudClient.rpc('register_official_udc_payment',{
         p_contributor_id:contributor.id,p_assessment_ids:selected,
         p_payment_method:form.elements.method.value,
         p_external_reference:form.elements.reference.value.trim(),
         p_bank_code:form.elements.bank.value,
         p_evidence_path:path||null,p_paid_at:new Date().toISOString(),
         p_expected_rate_id:quote.rate_id,p_expected_total_bs:Number(quote.total_bs)
       });
       if(rpc.error)throw rpc.error;
       saved=true;
       const data=rpc.data;
       form.hidden=true;
       document.getElementById('udcPaymentConfirmation').innerHTML=
        '<div class="notice"><b>Pago registrado correctamente · '+esc(data.receipt_number)+'</b>'+
        '<p>Total: '+bs(data.amount_bs)+' · '+esc(ucd(data.udc_total))+
        ' · Fecha de la tasa: '+esc(data.rate_date)+
        '</p><p><strong>PENDIENTE de validación y liquidación por Tesorería.</strong></p></div>';
       tell('Pago registrado y factura emitida. Tesorería verificará el ingreso para efectos de solvencia.');
       // La factura nace al registrar el pago. La validación de Tesorería
       // es posterior y solo condiciona solvencias e ingresos liquidados.
       await window.sitmaudOfficialFinance.mount('pagos');
       close();
       if(data.payment_id && window.sitmaudOfficialFinance?.showDocument){
         await window.sitmaudOfficialFinance.showDocument(data.payment_id);
       }
     }catch(e){
       tell('No se pudo registrar el pago: '+(e.message||'Error de validación'));
     }finally{
       if(path&&!saved)await imaudClient.storage.from('imaud-payment-proofs').remove([path]).catch(()=>{});
       busy=false;if(b?.isConnected){b.disabled=!quote;b.textContent='Registrar pago y emitir factura';}
     }
   }
 });
 document.addEventListener('change',e=>{
   if(e.target.matches('#udcPaymentRegister .udc-month'))updateQuote();
   if(e.target.matches('#udcPaymentRegister [name="method"]'))adjustProofRequirement();
 });
})();