/* SITMAUD · Solvencias institucionales verificables · documento media carta vertical */
(function(){
'use strict';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fecha=s=>s?new Date(String(s).slice(0,10)+'T12:00:00Z').toLocaleDateString('es-VE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}):'—';
let entries=[];
function panel(){
 return '<section class="card panel" id="sitSolvencyDocuments"><div class="panel-head"><div><h3>Certificados de solvencia emitidos</h3><p>Documentos institucionales, estado vigente o revocado y verificación de código. La emisión está reservada a funcionarios autorizados.</p></div><button type="button" class="btn btn-light" data-sit-solvency-refresh>Actualizar</button></div>'+
 '<div id="sitSolvencyDocumentsList">Consultando certificados…</div>'+
 '<div style="margin-top:14px"><b>Verificar certificado</b><form id="sitSolvencyVerifyForm" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><input class="search" name="number" required placeholder="SOL-2027-000001" pattern="SOL-[0-9]{4}-[0-9]{6}" style="flex:1"><button class="btn btn-light" type="submit">Verificar</button></form><div id="sitSolvencyVerifyResult" role="status"></div></div></section>';
}
async function load(){
 const host=document.getElementById('sitSolvencyDocumentsList');if(!host)return;
 const r=await imaudClient.from('solvency_certificates')
  .select('id,certificate_number,contributor_id,contributor_snapshot,property_snapshot,period_start,period_end,issue_date,issued_at,status,revoked_at,revocation_reason')
  .order('issued_at',{ascending:false}).limit(100);
 if(!host.isConnected)return;
 if(r.error){host.textContent='No se pudieron consultar certificados: '+r.error.message;return;}
 entries=r.data||[];
 if(!entries.length){host.innerHTML='<div class="contributors-empty"><b>Sin certificados emitidos.</b><span>Se mostrarán cuando existan pagos liquidados o exoneraciones autorizadas que respalden todos los meses correspondientes.</span></div>';return;}
 host.innerHTML='<div class="payment-debt-scroll"><table><thead><tr><th>N.º certificado</th><th>Contribuyente</th><th>Período</th><th>Estado</th><th></th></tr></thead><tbody>'+
 entries.map(x=>{const c=x.contributor_snapshot||{},name=c.legal_name||[c.first_name,c.last_name].filter(Boolean).join(' ');
 return '<tr><td><b>'+safe(x.certificate_number)+'</b></td><td>'+safe(name)+'</td><td>'+safe(fecha(x.period_start))+' – '+safe(fecha(x.period_end))+'</td><td>'+safe(x.status==='issued'?'Vigente':'Revocado')+'</td><td><button type="button" class="btn btn-light btn-sm" data-sit-solvency-print="'+safe(x.id)+'">Ver documento</button></td></tr>'}).join('')+'</tbody></table></div>';
}
async function show(entry){
 const x=entry?.certificate_number?entry:entries.find(y=>y.id===entry);
 if(!x)return;
 // Confirmar nuevamente el estado del certificado antes de mostrar la impresión.
 const result=await imaudClient.rpc('verify_solvency_number',{p_number:x.certificate_number});
 if(result.error){window.alert('No se pudo comprobar el estado del certificado: '+result.error.message);return;}
 const current=result.data||{};
 if(current.status!=='issued'){window.alert('Este certificado no está vigente y no puede imprimirse como solvencia.');return;}
 const c=x.contributor_snapshot||{};
 const name=c.legal_name||[c.first_name,c.last_name].filter(Boolean).join(' ');
 const first=Array.isArray(x.property_snapshot)?x.property_snapshot[0]||{}:{};
 document.getElementById('sitSolvencyPrintModal')?.remove();
 const modal=document.createElement('div');modal.id='sitSolvencyPrintModal';
 modal.style.cssText='position:fixed;inset:0;z-index:100001;background:rgba(13,34,50,.7);overflow:auto;padding:20px;display:flex;justify-content:center;align-items:flex-start';
 const verifyUrl=new URL('./verificar-solvencia.html',location.href);
 verifyUrl.searchParams.set('numero',x.certificate_number);
 modal.innerHTML='<style id="sitSolvencyPrintStyles">'+
 '@page{size:5.5in 8.5in;margin:0}'+
 '#sitSolvencyPrintModal .sit-solvency-page{width:5.5in;min-height:8.5in;background:#fff;color:#15354b;padding:.34in .35in;box-sizing:border-box;margin:auto;box-shadow:0 8px 35px #0005;font-family:Arial,sans-serif;font-size:11px;line-height:1.4}'+
 '#sitSolvencyPrintModal .sit-solvency-top{display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:2px solid #0c577b;padding-bottom:13px}'+
 '#sitSolvencyPrintModal .sit-solvency-top img{width:79px;max-height:64px;object-fit:contain}'+
 '#sitSolvencyPrintModal .sit-solvency-top h2{text-align:center;font-size:14px;margin:0;line-height:1.3}'+
 '#sitSolvencyPrintModal .sit-solvency-content h1{text-align:center;font-size:20px;margin:28px 0 20px}'+
 '#sitSolvencyPrintModal .sit-solvency-data{display:grid;grid-template-columns:1fr;gap:9px}'+
 '#sitSolvencyPrintModal .sit-solvency-data div{border-bottom:1px solid #e0e7eb;padding:5px 0}'+
 '#sitSolvencyPrintModal .sit-solvency-data span{display:block;font-size:9px;color:#647586;text-transform:uppercase;letter-spacing:.07em}'+
 '#sitSolvencyPrintModal .sit-solvency-footer{display:flex;justify-content:space-between;align-items:center;margin-top:24px;gap:12px}'+
 '#sitSolvencyPrintModal .sit-solvency-footer small{display:block;font-size:9px;color:#637787}'+
 '#sitSolvencyPrintModal .sit-solvency-controls{max-width:5.5in;margin:0 auto 12px;display:flex;gap:8px;justify-content:end}'+
 '@media print{body>*:not(#sitSolvencyPrintModal){display:none!important}#sitSolvencyPrintModal{position:static!important;padding:0!important;background:#fff!important;display:block!important;overflow:visible!important}#sitSolvencyPrintModal .sit-solvency-controls{display:none!important}#sitSolvencyPrintModal .sit-solvency-page{box-shadow:none!important;margin:0!important;width:5.5in!important;min-height:8.5in!important}#sitSolvencyPrintStyles{display:none!important}}'+
 '</style><div style="max-width:5.5in;width:100%"><div class="sit-solvency-controls"><button type="button" class="btn btn-light" data-solvency-close>Cerrar</button><button type="button" class="btn btn-primary" data-solvency-print>Imprimir media carta</button></div>'+
 '<article class="sit-solvency-page"><div class="sit-solvency-top">'+
 '<img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/2fb94317-165c-4058-ba6f-8d7b39165bc1.png" alt="Alcaldía del Municipio Miranda">'+
 '<h2>ALCALDÍA BOLIVARIANA DEL MUNICIPIO MIRANDA<br>IMAUD · CORO, FALCÓN</h2>'+
 '<img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/c48697a7-2c1f-4f88-aa38-2f8bb991ada2.png" alt="Logo oficial de IMAUD"></div>'+
 '<div class="sit-solvency-content"><h1>CERTIFICADO DE SOLVENCIA</h1>'+
 '<p>Conforme a los registros tributarios verificados de SITMAUD, se certifica que el contribuyente identificado presenta las obligaciones correspondientes al período indicado debidamente canceladas o exoneradas por acto institucional autorizado.</p>'+
 '<div class="sit-solvency-data">'+
 '<div><span>Número de certificado</span><b>'+safe(x.certificate_number)+'</b></div>'+
 '<div><span>Contribuyente</span><b>'+safe(name)+'</b></div>'+
 '<div><span>Cédula o RIF</span><b>'+safe(c.identification_type||'')+'-'+safe(c.identification_number||'')+'</b></div>'+
 '<div><span>Número de contrato</span><b>'+safe(c.contract_number||'—')+'</b></div>'+
 '<div><span>Ubicación</span><b>'+safe(first.address||'—')+'</b></div>'+
 '<div><span>Sector / Parroquia</span><b>'+safe(first.sector||'—')+' / '+safe(first.parish||'—')+'</b></div>'+
 '<div><span>Tipología</span><b>'+safe(first.typology||'—')+'</b></div>'+
 '<div><span>Período certificado</span><b>'+safe(fecha(x.period_start))+' al '+safe(fecha(x.period_end))+'</b></div>'+
 '<div><span>Fecha de emisión</span><b>'+safe(fecha(x.issue_date))+'</b></div>'+
 '</div><div class="sit-solvency-footer"><div><b>Certificado verificable</b><small>Escanea el código QR para consultar su vigencia.</small><small>Sin firma o sello manuscrito simulado.</small><small>Emitido exclusivamente por funcionario autorizado.</small></div><div id="sitSolvencyQR"></div></div></div></article></div>';
 document.body.appendChild(modal);
 if(typeof QRCode==='function'){new QRCode(modal.querySelector('#sitSolvencyQR'),{text:verifyUrl.toString(),width:92,height:92,correctLevel:QRCode.CorrectLevel.M});}
 else modal.querySelector('#sitSolvencyQR').textContent=x.certificate_number;
}
document.addEventListener('click',event=>{
 if(event.target.closest('[data-sit-solvency-refresh]'))load();
 const print=event.target.closest('[data-sit-solvency-print]');if(print)show(print.dataset.sitSolvencyPrint);
 if(event.target.closest('[data-solvency-close]'))document.getElementById('sitSolvencyPrintModal')?.remove();
 if(event.target.closest('[data-solvency-print]'))window.print();
});
document.addEventListener('submit',async event=>{
 if(event.target.id!=='sitSolvencyVerifyForm')return;
 event.preventDefault();
 const target=document.getElementById('sitSolvencyVerifyResult');target.textContent='Verificando…';
 const value=String(new FormData(event.target).get('number')||'').trim().toUpperCase();
 const r=await imaudClient.rpc('verify_solvency_number',{p_number:value});
 if(!target.isConnected)return;
 target.textContent=r.error?'No fue posible verificar el certificado: '+r.error.message:
   r.data?.valid?'Certificado vigente · '+r.data.certificate_number+' · Período: '+fecha(r.data.period_start)+' al '+fecha(r.data.period_end):
   'Certificado inexistente o revocado. Verifica el número y su estado.';
});
window.sitmaudSolvencyDocuments={panel,load,show};
})();