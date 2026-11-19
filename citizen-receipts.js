/* SITMAUD · Recibos ciudadanos oficiales, únicamente liquidados y verificados */
(function(){
 'use strict';
 const cityTime={timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'};
 const esc=value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const amount=value=>new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0));
 const date=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('es-VE',cityTime).format(d);};
 const month=value=>{if(!value)return '—';const dt=new Date(String(value).slice(0,10)+'T12:00:00-04:00');return new Intl.DateTimeFormat('es-VE',{month:'long',year:'numeric',timeZone:'America/Caracas'}).format(dt);};
 async function show(client,id){
  if(!/^[0-9a-f-]{36}$/i.test(String(id||'')))return;
  document.getElementById('sitCitizenReceiptModal')?.remove();
  const overlay=document.createElement('div');overlay.id='sitCitizenReceiptModal';
  overlay.innerHTML='<div class="sit-citizen-receipt-dialog"><div class="sit-citizen-receipt-toolbar"><b>Recibo institucional SITMAUD</b><div><button type="button" id="citizenReceiptPrint" disabled>Imprimir</button><button type="button" id="citizenReceiptClose">Cerrar</button></div></div><div id="citizenReceiptContent" role="status">Verificando el pago en Tesorería…</div></div>';
  document.body.appendChild(overlay);
  const close=()=>overlay.remove();
  overlay.addEventListener('click',event=>{if(event.target===overlay||event.target.closest('#citizenReceiptClose'))close();});
  const print=overlay.querySelector('#citizenReceiptPrint'),host=overlay.querySelector('#citizenReceiptContent');
  const {data:p,error}=await client.rpc('get_my_citizen_receipt',{p_payment_id:id});
  if(!overlay.isConnected)return;
  if(error||!p||p.status!=='confirmed'){host.textContent='No se pudo verificar el recibo liquidado: '+(error?.message||'Operación no disponible');return;}
  const periods=Array.isArray(p.periods)?p.periods:[];
  if(!periods.length){host.textContent='El documento no contiene obligaciones verificadas.';return;}
  host.innerHTML='<article class="sit-citizen-receipt-paper" role="document">'+
   '<header class="sit-citizen-receipt-header">'+
   '<img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/2fb94317-165c-4058-ba6f-8d7b39165bc1.png" alt="Alcaldía Bolivariana del Municipio Miranda">'+
   '<div><h1>RECIBO DE PAGO</h1><p>SITMAUD · Aseo Urbano y Domiciliario</p></div>'+
   '<img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/c48697a7-2c1f-4f88-aa38-2f8bb991ada2.png" alt="Instituto Municipal de Aseo Urbano y Domiciliario"></header>'+
   '<div class="sit-citizen-receipt-status">LIQUIDADO POR TESORERÍA</div>'+
   '<dl class="sit-citizen-receipt-grid">'+
   '<div><dt>N.º de comprobante</dt><dd>'+esc(p.receipt_number)+'</dd></div>'+
   '<div><dt>N.º de contrato</dt><dd>'+esc(p.contract)+'</dd></div>'+
   '<div><dt>Fecha de emisión</dt><dd>'+esc(date(p.issued_at))+'</dd></div>'+
   '<div><dt>Fecha de liquidación</dt><dd>'+esc(date(p.liquidated_at))+'</dd></div>'+
   '<div><dt>Contribuyente</dt><dd>'+esc(p.contributor_name)+'</dd></div>'+
   '<div><dt>Cédula / RIF</dt><dd>'+esc(String(p.identity||'').replace(/^([VEJ])-\1-/,'$1-'))+'</dd></div>'+
   '<div><dt>Banco</dt><dd>'+esc(p.bank||'—')+'</dd></div>'+
   '<div><dt>Referencia</dt><dd>'+esc(p.reference||'—')+'</dd></div>'+
   '<div><dt>Método de pago</dt><dd>'+esc(String(p.payment_method||'').replaceAll('_',' '))+'</dd></div>'+
   '<div><dt>Monto UCD</dt><dd>'+esc(p.udc_total??'—')+'</dd></div>'+
   '<div><dt>Tasa BCV</dt><dd>'+esc(p.udc_rate_bs==null?'—':'Bs. '+amount(p.udc_rate_bs))+'</dd></div>'+
   '<div><dt>Fecha de tasa</dt><dd>'+esc(p.rate_date||'—')+'</dd></div></dl>'+
   '<section class="sit-citizen-receipt-periods"><b>Períodos pagados</b>'+
   periods.map(v=>'<div><span>'+esc(month(v.period))+' · '+esc(v.sector||v.address||'')+'</span><strong>Bs. '+amount(v.amount_bs)+'</strong></div>').join('')+'</section>'+
   '<div class="sit-citizen-receipt-total"><span>MONTO PAGADO (BS.)</span><b>Bs. '+amount(p.amount_bs)+'</b></div>'+
   '<footer>Instituto Municipal de Aseo Urbano y Domiciliario · Municipio Miranda, Coro, Falcón</footer></article>';
  print.disabled=false;print.addEventListener('click',()=>window.print());
 }
 window.sitmaudCitizenReceipt={show};
})();