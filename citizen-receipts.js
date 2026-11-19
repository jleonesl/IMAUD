/* SITMAUD · Facturas: el portal ciudadano utiliza exactamente el mismo renderer oficial del funcionario. */
(function(){
'use strict';
const validId=id=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(id||''));
function normalize(response){
 const periods=response.periods||[];
 const identity=String(response.identity||'');
 const kind=/^J-?/i.test(identity)?'juridico':'natural';
 const number=identity.replace(/^[VEJ]-?/i,'').replace(/^[VEJ]-/i,'');
 const contributor={
  kind,
  first_name:kind==='natural'?response.contributor_name:'',
  last_name:'',
  legal_name:kind==='juridico'?response.contributor_name:'',
  contract_number:response.contract,
  identification_type:identity[0]||'',
  identification_number:number
 };
 const payment={
  id:response.payment_id,receipt_number:response.receipt_number,amount:response.amount_bs,
  currency_code:response.currency||'VES',created_at:response.issued_at,
  invoice_issued_at:response.issued_at,liquidated_at:response.liquidated_at,
  status:response.status,paid_at:response.issued_at,
  payment_method:response.payment_method,external_reference:response.reference,
  bank_code:response.bank,payment_udc_total:response.udc_total,
  rate:response.udc_rate_bs==null?null:{
   udc_value:response.udc_rate_bs,effective_date:response.rate_date,source_url:response.rate_source_url||'No registrado'
  },
  contributor
 };
 const allocations=periods.map(v=>({
   amount:v.amount_bs,assessment:{
    period_start:v.period,period_end:v.end,is_demo:false,
    property:{
     address:v.address||'',sector_name:v.sector||'',parish_name:v.parish||'',
     typology_override:v.typology||'',sector:{default_typology:v.typology||''}
    }
   }
 }));
 return {payment,allocations};
}
async function show(client,id){
 if(!validId(id))return;
 document.getElementById('billModal')?.remove();
 const overlay=document.createElement('div');overlay.id='billModal';overlay.className='bill-backdrop';
 overlay.innerHTML='<div class="bill-dialog"><div class="bill-toolbar"><div><b>Recibo de operación · SITMAUD</b><small>Factura institucional</small></div><div><button type="button" id="citizenReceiptClose">Cerrar</button><button type="button" id="citizenReceiptPrint" disabled>Imprimir</button></div></div><div id="billContent" role="status">Verificando factura oficial…</div></div>';
 document.body.appendChild(overlay);
 const host=overlay.querySelector('#billContent'),print=overlay.querySelector('#citizenReceiptPrint');
 const close=()=>overlay.remove();
 overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('#citizenReceiptClose'))close();});
 let response;
 try{
  const {data,error}=await client.rpc('get_my_citizen_receipt',{p_payment_id:id});
  if(error)throw error;
  if(!data||!['pending','confirmed'].includes(data.status))throw Error('La factura no está disponible: el pago fue anulado o no pertenece a tu expediente');
  if(!Array.isArray(data.periods)||!data.periods.length)throw Error('La factura no contiene meses registrados');
  const {payment,allocations}=normalize(data);
  const sum=allocations.reduce((t,v)=>t+Number(v.amount||0),0);
  if(Math.abs(sum-Number(payment.amount))>0.01)throw Error('El importe del documento no coincide con los meses pagados');
  if(!window.sitmaudOfficialReceipt)throw Error('La plantilla oficial no está disponible');
  if(!overlay.isConnected)return;
  host.innerHTML=window.sitmaudOfficialReceipt.render({payment,allocations,preview:false});
  print.disabled=false;
  print.addEventListener('click',()=>window.print());
 }catch(error){if(overlay.isConnected)host.textContent='No fue posible verificar la factura: '+(error.message||'Error de consulta');}
}
window.sitmaudCitizenReceipt={show};
})();