/* SITMAUD: factual demo payment receipt and half-letter print presentation. */
(function(){
'use strict';
const E=value=>escapeHTML(String(value==null?'':value));
const cash=n=>'Bs. '+money(Number(n||0));
const date=iso=>iso?new Date(iso).toLocaleDateString('es-VE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Caracas'}):'—';
const month=iso=>iso?new Date(iso+'T12:00:00Z').toLocaleDateString('es-VE',{month:'short',year:'numeric',timeZone:'UTC'}):'—';
let latest=[];
function listScreen(){
 return head('Facturación','Historial de comprobantes generados a partir de pagos de prueba.')+
 '<div class="notice">COMPROBANTE DEMO · NO FISCAL. Los documentos no sustituyen facturas fiscales autorizadas.</div>'+
 '<section class="card bill-history"><div class="panel-head"><div><h3>Comprobantes de pago</h3><p>Selecciona un comprobante para imprimirlo en media carta horizontal (21,59 × 13,97 cm).</p></div><span class="status">Media carta</span></div><input id="billSearch" class="search" placeholder="Buscar por contribuyente, contrato, referencia o comprobante" aria-label="Buscar comprobantes"><div id="billResults"><div class="contributors-loading">Consultando historial…</div></div></section>';
}
async function loadHistory(){
 const host=document.getElementById('billResults');if(!host)return;
 const {data,error}=await imaudClient.from('demo_payments').select('id,receipt_number,amount,paid_at,payment_method,external_reference,contributor:contributors!demo_payments_contributor_id_fkey(kind,first_name,last_name,legal_name,contract_number)').order('paid_at',{ascending:false}).limit(200);
 if(!document.getElementById('billResults'))return;
 if(error){host.innerHTML='<div class="payment-debt-empty"><b>No se pudieron cargar los comprobantes.</b><span>'+E(error.message)+'</span></div>';return;}
 latest=data||[];paintHistory();
}
function paintHistory(){
 const host=document.getElementById('billResults');if(!host)return;
 const q=(document.getElementById('billSearch')?.value||'').toLocaleLowerCase('es-VE').trim();
 const rows=latest.filter(p=>[p.receipt_number,p.external_reference,p.contributor?.contract_number,contributorName(p.contributor||{})].join(' ').toLocaleLowerCase('es-VE').includes(q));
 if(!rows.length){host.innerHTML='<div class="payment-debt-empty"><b>'+(latest.length?'No hay coincidencias.':'Aún no se han registrado pagos de prueba.')+'</b><span>Los comprobantes aparecerán aquí después del pago.</span></div>';return;}
 host.innerHTML='<div class="payment-debt-scroll"><table><thead><tr><th>Comprobante</th><th>Contribuyente</th><th>Contrato</th><th>Fecha</th><th>Monto pagado</th><th>Acciones</th></tr></thead><tbody>'+rows.map(p=>
  '<tr><td><b>'+E(p.receipt_number)+'</b></td><td>'+E(contributorName(p.contributor||{}))+'</td><td>'+E(p.contributor?.contract_number||'—')+'</td><td>'+date(p.paid_at)+'</td><td><b>'+cash(p.amount)+'</b></td><td><div class="bill-actions"><button type="button" class="btn btn-light btn-sm" data-bill-view="'+E(p.id)+'">Ver</button><button type="button" class="btn btn-primary btn-sm" data-bill-print="'+E(p.id)+'">Imprimir</button></div></td></tr>'
 ).join('')+'</tbody></table></div>';
}
async function getRecord(id){
 const {data:payment,error:paymentError}=await imaudClient.from('demo_payments').select('id,receipt_number,contributor_id,amount,paid_at,payment_method,external_reference,bank_code').eq('id',id).single();
 if(paymentError||!payment)throw Error(paymentError?.message||'Comprobante no encontrado');
 const [cp,alloc]=await Promise.all([
  imaudClient.from('contributors').select('id,kind,first_name,last_name,legal_name,identification_type,identification_number,contract_number,phone,email').eq('id',payment.contributor_id).single(),
  imaudClient.from('demo_payment_allocations').select('assessment_id,amount').eq('demo_payment_id',id)
 ]);
 if(cp.error||alloc.error)throw Error(cp.error?.message||alloc.error?.message);
 const allocations=alloc.data||[];if(!allocations.length)throw Error('No se encontraron los períodos vinculados al pago');
 const {data:assessments,error:ae}=await imaudClient.from('assessments').select('id,property_id,period_start,period_end,total_amount,coefficient_snapshot').in('id',allocations.map(a=>a.assessment_id));
 if(ae)throw Error(ae.message);
 const {data:properties,error:pe}=await imaudClient.from('properties').select('id,address,parish_name,sector_name,typology_override,parish:parishes!properties_parish_id_fkey(name),sector:sectors!properties_sector_id_fkey(name,default_typology)').in('id',[...new Set((assessments||[]).map(a=>a.property_id))]);
 if(pe)throw Error(pe.message);
 const props=new Map((properties||[]).map(x=>[x.id,x]));
 const amounts=new Map(allocations.map(x=>[x.assessment_id,Number(x.amount)]));
 const lines=(assessments||[]).map(a=>({assessment:a,property:props.get(a.property_id)||{},amount:amounts.get(a.id)||0})).sort((a,b)=>a.assessment.period_start.localeCompare(b.assessment.period_start));
 return {payment,person:cp.data,lines};
}
function field(label,value){return '<div class="bill-field"><span>'+label+'</span><b>'+E(value||'—')+'</b></div>'}
function paper(rec){
 const p=rec.payment,c=rec.person||{},lines=rec.lines,first=lines[0]?.property||{};
 const one=lines.every(line=>line.assessment.property_id===lines[0]?.assessment.property_id);
 const name=contributorName(c);
 const textMethod={tarjeta:'Punto de venta / Tarjeta',efectivo:'Efectivo',transferencia:'Transferencia',pago_movil:'Pago móvil'}[p.payment_method]||p.payment_method;
 const rawIdent=String(c.identification_number||'');const prefix=String(c.identification_type||'');const ident=(prefix&&rawIdent.toUpperCase().startsWith(prefix.toUpperCase()+'-'))?rawIdent:[prefix,rawIdent].filter(Boolean).join('-');
 const rows=lines.map(l=>{
  const a=l.assessment,sector=l.property.sector?.name||l.property.sector_name||'Inmueble';
  const period=month(a.period_start)+(a.period_end&&a.period_end.slice(0,7)!==a.period_start.slice(0,7)?' – '+month(a.period_end):'');
  return '<tr><td>Servicio de Aseo Urbano y Domiciliario'+(one?'':' · '+E(sector))+'</td><td>'+E(period)+'</td><td>'+cash(a.total_amount)+'</td><td><b>'+cash(l.amount)+'</b></td></tr>';
 }).join('');
 return '<article id="billPaper" class="bill-paper">'+
 '<div class="bill-watermark">DEMO</div>'+
 '<header class="bill-header"><div class="bill-brand bill-miranda"><div class="bill-logo-window"><img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/2fb94317-165c-4058-ba6f-8d7b39165bc1.png" alt="Alcaldía Bolivariana del Municipio Miranda"></div></div><div class="bill-heading"><h1>COMPROBANTE DE PAGO</h1><h2>Sistema Integral Tributario Municipal<br>de Aseo Urbano y Domiciliario (SITMAUD)</h2><b>DOCUMENTO DEMO · NO FISCAL</b></div><div class="bill-brand bill-imaud"><div class="bill-logo-window bill-logo-right"><img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/c48697a7-2c1f-4f88-aa38-2f8bb991ada2.png" alt="Instituto Municipal de Aseo Urbano y Domiciliario"></div></div></header>'+
 '<section class="bill-ref">'+field('N.º de comprobante DEMO',p.receipt_number)+field('N.º de contrato',c.contract_number)+field('Fecha de emisión',date(p.paid_at))+field('Fecha de pago',date(p.paid_at))+'</section>'+
 '<section class="bill-parties"><div><h3>Datos del Contribuyente</h3>'+field('Nombre / Razón social',name)+field('Cédula / RIF',ident)+field('Teléfono',c.phone)+field('Correo',c.email)+'</div><div><h3>Datos del Inmueble</h3>'+field('Dirección',one?first.address:'Varios inmuebles; ver detalle')+field('Sector',one?(first.sector?.name||first.sector_name):'Ver desglose')+field('Parroquia',one?(first.parish?.name||first.parish_name):'Ver desglose')+field('Tipología',one?({'3':'TIPO I','1.5':'TIPO II','0.5':'TIPO III'}[String(Number(lines[0]?.assessment?.coefficient_snapshot))]||first.typology_override||first.sector?.default_typology):'Según cada inmueble')+'</div></section>'+
 '<div class="bill-items"><table><thead><tr><th>Concepto</th><th>Período</th><th>Tarifa (Bs.)</th><th>Monto pagado (Bs.)</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 '<section class="bill-bottom"><div class="bill-qrwrap"><div id="billQr" class="bill-qr">DEMO<br>QR</div><div><b>Consulta del comprobante</b><p>QR informativo de prueba, no verifica autenticidad fiscal.</p></div></div><div class="bill-paid"><span>MONTO PAGADO</span><strong>'+cash(p.amount)+'</strong><small>'+E(textMethod)+' · Ref. '+E(p.external_reference||'No aplica')+'</small></div></section>'+
 '<footer class="bill-foot">DOCUMENTO DE PRUEBA SIN VALIDEZ FISCAL · NO ACREDITA TRANSFERENCIA BANCARIA REAL.<br>Formato media carta horizontal · requisitos fiscales definitivos pendientes de validación.</footer></article>';
}
function printBillOnly(){
 const article=document.getElementById('billPaper');
 if(!article){toast('Primero abre un comprobante para imprimir.');return;}
 document.getElementById('billPrintFrame')?.remove();
 const frame=document.createElement('iframe');
 frame.id='billPrintFrame';
 frame.title='Impresión exclusiva del comprobante SITMAUD';
 frame.setAttribute('aria-hidden','true');
 frame.style.cssText='position:fixed;left:-10000px;top:0;width:816px;height:528px;border:0;opacity:0;pointer-events:none;';
 document.body.appendChild(frame);
 const safeHTML=article.outerHTML;
 const documentHTML='<!doctype html><html lang="es"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width, initial-scale=1">'+
 '<base href="'+location.origin+location.pathname.replace(/[^/]*$/,'')+'">'+
 '<link rel="stylesheet" href="billing.css?v=20261113-print-isolated1">'+
 '<style>@page{size:8.5in 5.5in;margin:0} @media print{ html,body{box-sizing:border-box!important;width:8.5in!important;height:5.5in!important;min-height:0!important;max-height:5.5in!important;margin:0!important;padding:0!important;overflow:hidden!important;background:white!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important} #billModal,#billModal .bill-dialog,#billModal #billContent{box-sizing:border-box!important;position:static!important;inset:auto!important;display:flex!important;justify-content:center!important;align-items:flex-start!important;width:8.5in!important;max-width:8.5in!important;min-height:0!important;height:5.5in!important;max-height:5.5in!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;overflow:hidden!important;background:white!important} #billModal .bill-toolbar{display:none!important} #billModal .bill-paper{box-sizing:border-box!important;display:block!important;flex:none!important;width:8.5in!important;max-width:8.5in!important;min-width:0!important;height:5.5in!important;min-height:5.5in!important;max-height:5.5in!important;margin:0 auto!important;padding:.17in .17in .12in!important;overflow:hidden!important;box-shadow:none!important;break-inside:avoid!important;page-break-inside:avoid!important;page-break-after:avoid!important} #billModal .bill-header{grid-template-columns:1.05fr 2fr 1.12fr!important;gap:9px!important;min-height:82px!important} #billModal .bill-ref{grid-template-columns:1.35fr 1fr .8fr .8fr!important} #billModal .bill-parties{grid-template-columns:1fr 1fr!important;gap:12px!important} #billModal .bill-parties .bill-field{display:grid!important;grid-template-columns:39% minmax(0,1fr)!important;gap:6px!important;align-items:baseline!important} #billModal .bill-parties .bill-field span{display:inline!important} #billModal .bill-parties .bill-field b{display:inline!important} #billModal .bill-bottom{grid-template-columns:1fr 1.35fr!important;gap:10px!important} }'+
 '</style>'+
 '</head><body><div id="billModal" class="bill-backdrop"><div class="bill-dialog"><div id="billContent">'+safeHTML+'</div></div></div></body></html>';
 frame.onload=async()=>{
  try{
   const doc=frame.contentDocument;
   await (doc.fonts?.ready||Promise.resolve());
   await Promise.all([...doc.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve})));
   frame.contentWindow.focus();
   frame.contentWindow.print();
  }catch(err){console.error('Impresión aislada de factura:',err);toast('No se pudo preparar la impresión. Intenta nuevamente.');}
 };
 frame.srcdoc=documentHTML;
}
async function openBill(id,print){
 document.getElementById('billModal')?.remove();
 const backdrop=document.createElement('div');backdrop.id='billModal';backdrop.className='bill-backdrop';
 backdrop.innerHTML='<div class="bill-dialog"><div class="bill-toolbar"><div><b>SITMAUD · Comprobante de pago</b><small>Media carta horizontal · Vista previa para impresión</small></div><div><button type="button" class="btn btn-light" data-bill-close="1">Cerrar</button><button type="button" class="btn btn-primary" data-bill-go-print="1" disabled>Imprimir / Guardar PDF</button></div></div><div id="billContent" class="bill-loading">Cargando datos del comprobante…</div></div>';
 document.body.appendChild(backdrop);document.body.classList.add('modal-open');
 try{
  const record=await getRecord(id);const target=document.getElementById('billContent');if(!target)return;
  target.innerHTML=paper(record);const btn=document.querySelector('[data-bill-go-print]');if(btn)btn.disabled=false;
  if(typeof window.QRCode==='function'){
   const qr=document.getElementById('billQr');qr.textContent='';
   new window.QRCode(qr,{text:'SITMAUD COMPROBANTE DEMO | '+record.payment.receipt_number+' | '+cash(record.payment.amount)+' | NO FISCAL',width:72,height:72,colorDark:'#062e62',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
  }
  if(print)printBillOnly();
 }catch(e){console.error(e);const target=document.getElementById('billContent');if(target)target.innerHTML='<div class="payment-debt-empty"><b>No se pudo preparar el comprobante.</b><span>'+E(e.message)+'</span></div>';}
}
function closeBill(){document.getElementById('billModal')?.remove();document.body.classList.remove('modal-open');}
const previousRender=render;
invoices=listScreen;
render=function(){previousRender();if(state.view==='facturacion')loadHistory();};
showDemoReceipt=function(payment){openBill(payment.payment_id,false);toast('Pago DEMO registrado · '+payment.receipt_number);};
document.addEventListener('click',event=>{
 const view=event.target.closest('[data-bill-view]'),print=event.target.closest('[data-bill-print]');
 if(view){openBill(view.dataset.billView,false);return;}
 if(print){openBill(print.dataset.billPrint,true);return;}
 if(event.target.closest('[data-bill-close]')){closeBill();return;}
 if(event.target.closest('[data-bill-go-print]')){printBillOnly();}
});
document.addEventListener('input',event=>{if(event.target.id==='billSearch')paintHistory();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.getElementById('billModal'))closeBill();});
})();
