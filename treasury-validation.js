/* SITMAUD · Tesorería: validación bancaria independiente del recibo DEMO */
(function(){
'use strict';
const statuses={pending:'Por validar',validated:'Validado',incident:'En incidencia',reversed:'Revertido'};
const moneyLocal=value=>'Bs. '+Number(value||0).toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=value=>escapeHTML(String(value??''));
let activePayment=null,canValidate=false,canReverse=false,waiting=false;
function close(){
 document.getElementById('treasuryReviewBackdrop')?.remove();
 document.body.classList.remove('modal-open');activePayment=null;
}
async function open(id){
 if(!/^[0-9a-f-]{36}$/i.test(id))return;
 close();
 const [paymentQuery,permissionQuery,reverseQuery,eventsQuery]=await Promise.all([
  imaudClient.from('demo_payments').select('id,receipt_number,amount,paid_at,payment_method,external_reference,bank_code,proof_storage_path,treasury_status,treasury_checked_at,treasury_bank_reference,treasury_notes,contributor:contributors!demo_payments_contributor_id_fkey(kind,first_name,last_name,legal_name,contract_number)').eq('id',id).single(),
  imaudClient.rpc('has_permission',{permission_code:'payments.validate'}),
  imaudClient.rpc('has_permission',{permission_code:'payments.reverse'}),
  imaudClient.from('demo_payment_treasury_events').select('prior_status,new_status,reference,notes,created_at').eq('payment_id',id).order('created_at',{ascending:false})
 ]);
 if(paymentQuery.error){toast('No se pudo consultar el pago: '+paymentQuery.error.message);return;}
 const p=paymentQuery.data,method={tarjeta:'Punto de venta',transferencia:'Transferencia',pago_movil:'Pago móvil',efectivo:'Efectivo'}[p.payment_method]||p.payment_method;
 canValidate=permissionQuery.data===true&&!permissionQuery.error;canReverse=reverseQuery.data===true&&!reverseQuery.error;activePayment=p;
 const status=p.treasury_status||'pending';
 const actions=canValidate&&status!=='reversed'?'<form id="treasuryReviewForm">'+
 '<label class="field"><span>Operación de Tesorería</span><select name="action" id="treasuryAction" required>'+
 (status!=='validated'?'<option value="validate">Validar ingreso bancario</option>':'')+
 (status!=='incident'?'<option value="incident">Registrar incidencia bancaria</option>':'')+
 (canReverse&&status==='incident'?'<option value="reverse">Revertir pago y reabrir deuda DEMO</option>':'')+
 '</select></label>'+
 '
 '<label class="field"><span>Observaciones y evidencia de Tesorería</span><textarea name="notes" id="treasuryNotes" rows="3" maxlength="1200" placeholder="Motivo de la incidencia, devolución o conciliación"></textarea></label>'+
 '<p class="treasury-warning" id="treasuryActionWarning"></p>'+
 '<div class="treasury-action-buttons"><button type="button" class="btn btn-light" data-treasury-close>Cancelar</button><button class="btn btn-primary" id="treasurySave" type="submit">Guardar validación</button></div></form>':
 '<div class="treasury-readonly">Las modificaciones de Tesorería requieren el permiso <b>payments.validate</b>; reabrir una deuda requiere adicionalmente <b>payments.reverse</b>. Esta cuenta solo puede consultar.</div>';
 const events=(eventsQuery.data||[]).map(e=>'<div class="treasury-event"><b>'+esc(statuses[e.new_status]||e.new_status)+'</b><span>'+esc(new Date(e.created_at).toLocaleString('es-VE',{timeZone:'America/Caracas'}))+'</span><small>'+esc(e.reference||'')+(e.notes?' · '+esc(e.notes):'')+'</small></div>').join('');
 document.body.insertAdjacentHTML('beforeend','<div class="treasury-backdrop" id="treasuryReviewBackdrop"><section class="treasury-dialog" role="dialog" aria-modal="true" aria-labelledby="treasuryModalTitle">'+
 '<header class="treasury-dialog-head"><div><span>CONCILIACIÓN BANCARIA · ENTORNO DEMO</span><h2 id="treasuryModalTitle">Verificación de pago</h2><p>La emisión del comprobante y la verificación del ingreso son procesos separados.</p></div><button class="modal-close" type="button" data-treasury-close aria-label="Cerrar">×</button></header>'+
 '<div class="treasury-dialog-body"><div class="treasury-payment-facts"><div><small>Comprobante</small><b>'+esc(p.receipt_number)+'</b></div><div><small>Contribuyente</small><b>'+esc(contributorName(p.contributor||{}))+'</b></div><div><small>Contrato</small><b>'+esc(p.contributor?.contract_number||'—')+'</b></div><div><small>Monto</small><b>'+moneyLocal(p.amount)+'</b></div><div><small>Fecha de registro</small><b>'+esc(new Date(p.paid_at).toLocaleString('es-VE',{timeZone:'America/Caracas'}))+'</b></div><div><small>Medio de pago</small><b>'+esc(method)+'</b></div><div><small>Referencia declarada</small><b>'+esc(p.external_reference||'—')+'</b></div><div><small>Estado en Tesorería</small><span class="treasury-badge treasury-'+esc(status)+'">'+esc(statuses[status]||status)+'</span></div></div>'+
 (p.proof_storage_path?'<div class="treasury-proof"><button type="button" class="btn btn-light btn-sm" data-proof-payment-id="'+esc(p.id)+'">Ver comprobante bancario adjunto</button></div>':'')+
 '<div class="treasury-help">El contribuyente recibe su comprobante DEMO inmediatamente. Validar aquí solo confirma el ingreso bancario observado por Tesorería; no genera otro pago. Una incidencia no reabre por sí sola la deuda.</div>'+
 actions+
 '<section class="treasury-history"><h3>Historial de Tesorería</h3>'+(events?events:'<p>Sin verificaciones bancarias anteriores.</p>')+'</section></div></section></div>');
 document.body.classList.add('modal-open');
 updateWarning();
}
function updateWarning(){
 const action=document.getElementById('treasuryAction')?.value;
 const message=document.getElementById('treasuryActionWarning');
 const button=document.getElementById('treasurySave');
 if(!message||!button)return;
 const messages={
  validate:'Confirma únicamente si Tesorería encontró el ingreso en la cuenta municipal.',
  incident:'Registra la discrepancia para investigación, sin alterar todavía la deuda ni cancelar el comprobante entregado.',
  reverse:'Acción excepcional: se conserva el comprobante histórico y se reabre la deuda DEMO. Se requiere justificación y permiso de reversión.'
 };
 message.textContent=messages[action]||'';
 button.textContent=action==='validate'?'Validar pago':action==='incident'?'Registrar incidencia':'Revertir y reabrir deuda';
}
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-treasury-review]');
 if(button){open(button.dataset.treasuryReview);return;}
 if(e.target.closest('[data-treasury-close]')){close();return;}
 if(e.target.id==='treasuryReviewBackdrop')close();
});
document.addEventListener('change',e=>{if(e.target.id==='treasuryAction')updateWarning();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('treasuryReviewBackdrop'))close();});
document.addEventListener('submit',async e=>{
 if(e.target.id!=='treasuryReviewForm')return;
 e.preventDefault();
 if(waiting||!activePayment?.id)return;
 const form=e.target,fd=new FormData(form),action=String(fd.get('action')||''),notes=String(fd.get('notes')||'').trim();
 if(['incident','reverse'].includes(action)&&notes.length<20){toast('Describe la incidencia con al menos 20 caracteres.');return;}
 if(action==='reverse'&&!window.confirm('¿Confirmas que Tesorería documentó que el dinero no ingresó o fue devuelto y que debe reabrirse la deuda DEMO?'))return;
 const button=document.getElementById('treasurySave');waiting=true;button.disabled=true;button.textContent='Guardando…';
 const {data,error}=await imaudClient.rpc('review_demo_payment_treasury',{p_payment_id:activePayment.id,p_action:action,p_reference:null,p_notes:notes||null});
 waiting=false;
 if(error){button.disabled=false;updateWarning();toast('No se pudo aplicar la revisión: '+error.message);return;}
 close();
 toast('Tesorería: '+(statuses[data.treasury_status]||data.treasury_status)+'. Registro auditado.');
 await Promise.allSettled([loadDemoPayments(),loadPaymentDebtors()]);
});
})();