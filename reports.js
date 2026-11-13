/* SITMAUD · Reportes DEMO filtrados, verificados en America/Caracas */
(function(){
'use strict';
const reportMeta={
 collection:{title:'Recaudación diaria',description:'Movimientos DEMO registrados por fecha de pago.',file:'recaudacion',headers:['Fecha de pago (Coro)','Comprobante DEMO','Contrato','Contribuyente','Método','Banco','Referencia','Moneda','Monto (Bs.)'],keys:['day_local','receipt_number','contract_number','contributor_name','payment_method','bank_name','external_reference','currency_code','amount']},
 territory:{title:'Por parroquia y sector',description:'Montos y períodos DEMO pagados, agrupados territorialmente.',file:'parroquia_sector',headers:['Parroquia','Sector','Operaciones','Períodos pagados','Monto DEMO (Bs.)'],keys:['parish','sector','operations','paid_periods','amount']},
 accounts:{title:'Estado de cuenta',description:'Obligaciones DEMO cuyo período comienza dentro del rango o que tuvieron un pago durante ese rango.',file:'estado_cuenta',headers:['Período','Contrato','Contribuyente','Parroquia','Sector','Estado','Obligación (Bs.)','Monto pagado (Bs.)','Saldo (Bs.)','Fecha de pago','Comprobante DEMO'],keys:['period_start','contract_number','contributor_name','parish','sector','status','total_amount','paid_amount','outstanding','payment_date','receipt_number']}
};
let preset='today', currentKind='collection', currentData=null, selectedDates=null, loading=false, loadedView=false;
const esc=value=>escapeHTML(value==null?'':String(value));
const formatCash=value=>'Bs. '+new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0));
const formatNumber=value=>new Intl.NumberFormat('es-VE').format(Number(value||0));
const dayParts=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=t=>parts.find(p=>p.type===t)?.value;return {y:Number(get('year')),m:Number(get('month')),d:Number(get('day'))}};
const iso=(y,m,d)=>[y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
const plusDays=(str,days)=>{const d=new Date(str+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return iso(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate())};
function presetDates(v){
 const t=dayParts(),today=iso(t.y,t.m,t.d);
 if(v==='today')return {from:today,to:today};
 if(v==='yesterday')return {from:plusDays(today,-1),to:plusDays(today,-1)};
 if(v==='week'){const utc=new Date(today+'T12:00:00Z'),dow=(utc.getUTCDay()+6)%7;return {from:plusDays(today,-dow),to:today};}
 if(v==='month')return {from:iso(t.y,t.m,1),to:today};
 return selectedDates||{from:today,to:today};
}
function reportsView(){
 return head('Reportes','Consulta y exportación de información de las pruebas de SITMAUD.')+
 '<div class="notice">ENTORNO DEMO · Los resultados reflejan operaciones simuladas, no ingresos fiscales reales.</div>'+
 '<section class="card report-filter-panel"><div class="report-filter-head"><div><h3>Filtrar por período</h3><p>Selecciona las fechas que necesitas consultar. Se usa el calendario local de Coro, Venezuela.</p></div></div>'+
 '<div class="report-filter-controls"><div class="field"><label for="reportPreset">Período</label><select id="reportPreset"><option value="today">Hoy</option><option value="yesterday">Ayer</option><option value="week">Esta semana</option><option value="month">Este mes</option><option value="custom">De una fecha a otra</option></select></div>'+
 '<div class="field"><label for="reportFrom">Desde</label><input id="reportFrom" type="date"></div>'+
 '<div class="field"><label for="reportTo">Hasta</label><input id="reportTo" type="date"></div>'+
 '<button type="button" class="btn btn-primary" id="reportApply">Aplicar filtro</button></div><div id="reportFilterNote" class="report-filter-note"></div></section>'+
 '<div class="grid module-grid report-type-grid">'+
 '<div class="card module-card report-type-card" data-report-kind="collection"><div class="module-icon">▥</div><h3>Recaudación diaria</h3><p>Operaciones, montos y medios de pago dentro del período.</p><div class="report-card-actions"><button type="button" class="btn btn-light" data-report-view="collection">Consultar</button><button type="button" class="btn btn-light" data-report-export="collection">Descargar CSV</button></div></div>'+
 '<div class="card module-card report-type-card" data-report-kind="territory"><div class="module-icon">⌖</div><h3>Por parroquia y sector</h3><p>Distribución de pagos DEMO según ubicación de los inmuebles.</p><div class="report-card-actions"><button type="button" class="btn btn-light" data-report-view="territory">Consultar</button><button type="button" class="btn btn-light" data-report-export="territory">Descargar CSV</button></div></div>'+
 '<div class="card module-card report-type-card" data-report-kind="accounts"><div class="module-icon">▤</div><h3>Estado de cuenta</h3><p>Obligaciones DEMO y pagos asociados al intervalo consultado.</p><div class="report-card-actions"><button type="button" class="btn btn-light" data-report-view="accounts">Consultar</button><button type="button" class="btn btn-light" data-report-export="accounts">Descargar CSV</button></div></div></div>'+
 '<section class="card report-results"><div class="report-results-title"><div><h3 id="reportResultTitle">Recaudación diaria</h3><p id="reportResultPeriod">Selecciona el período para consultar los movimientos.</p></div><div class="report-result-tools"><span class="status" id="reportResultCount">—</span><button type="button" class="btn btn-primary" id="reportExportCurrent">Descargar este reporte</button></div></div><div id="reportResultSummary" class="report-summary"></div><div id="reportResultTable" class="report-table-holder"><div class="contributors-loading">Preparando el reporte…</div></div></section>';
}
function applyPreset(){
 const vals=presetDates(preset);const inputFrom=document.getElementById('reportFrom'),inputTo=document.getElementById('reportTo');
 if(inputFrom)inputFrom.value=vals.from;
 if(inputTo)inputTo.value=vals.to;
 const note=document.getElementById('reportFilterNote');
 if(note)note.textContent=preset==='custom'?'Selecciona ambos días y presiona «Aplicar filtro».':'Mostrando '+vals.from+' al '+vals.to+' · Fecha local de Coro';
}
function readDates(){
 const from=document.getElementById('reportFrom')?.value,to=document.getElementById('reportTo')?.value;
 if(!from||!to){toast('Debes seleccionar las fechas Desde y Hasta.');return null}
 if(from>to){toast('La fecha de inicio no puede ser posterior a la fecha final.');return null}
 const days=(Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000;
 if(days>3660){toast('Selecciona un rango menor de diez años.');return null}
 selectedDates={from,to};return selectedDates;
}
async function getReport(kind,forExport=false){
 const range=readDates();if(!range)return null;
 const {data,error}=await imaudClient.rpc('get_filtered_demo_report',{p_kind:kind,p_from:range.from,p_to:range.to,p_export:forExport});
 if(error)throw Error(error.message||'No se pudo consultar el reporte');
 return data;
}
function reportTable(kind,rows){
 const meta=reportMeta[kind];
 if(!rows.length)return '<div class="payment-debt-empty"><b>No hay registros para este período.</b><span>Puedes cambiar las fechas o seleccionar otro reporte.</span></div>';
 const display=(v,key)=>{
  if(v==null||v==='')return '—';
  if(['amount','total_amount','paid_amount','outstanding'].includes(key))return formatCash(v);
  if(key==='status')return ({paid:'Pagado',pending:'Pendiente',partially_paid:'Pago parcial',void:'Anulado'})[v]||String(v);
  if(key==='payment_method')return ({tarjeta:'Tarjeta / Punto de venta',efectivo:'Efectivo',pago_movil:'Pago móvil',transferencia:'Transferencia'})[v]||String(v);
  if(key==='day_local'||key==='payment_date'||key==='period_start')return String(v);
  return String(v);
 };
 return '<div class="report-table-scroll"><table><thead><tr>'+meta.headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
 rows.map(row=>'<tr>'+meta.keys.map(k=>'<td>'+esc(display(row[k],k))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function paintReport(kind,data){
 const title=document.getElementById('reportResultTitle'),period=document.getElementById('reportResultPeriod'),count=document.getElementById('reportResultCount'),summary=document.getElementById('reportResultSummary'),table=document.getElementById('reportResultTable');
 if(!title||!table)return;
 const rows=Array.isArray(data.rows)?data.rows:[];
 title.textContent=reportMeta[kind].title;
 period.textContent=reportMeta[kind].description+' · '+data.date_from+' al '+data.date_to;
 count.textContent=formatNumber(data.count)+' '+(kind==='territory'?'sectores':'registros');
 if(summary)summary.innerHTML='<div><span>Período consultado</span><strong>'+esc(data.date_from)+' — '+esc(data.date_to)+'</strong></div><div><span>'+ (kind==='territory'?'Sectores con pagos':kind==='accounts'?'Obligaciones encontradas':'Operaciones de prueba')+'</span><strong>'+formatNumber(data.count)+'</strong></div><div><span>'+ (kind==='accounts'?'Pagos asociados':'Monto DEMO del período')+'</span><strong>'+formatCash(data.total_bs)+'</strong></div>';
 table.innerHTML=reportTable(kind,rows);
 document.querySelectorAll('.report-type-card').forEach(card=>card.classList.toggle('selected',card.dataset.reportKind===kind));
}
async function loadReport(kind=currentKind){
 if(loading)return;
 const range=readDates();if(!range)return;
 loading=true;currentKind=kind;
 const table=document.getElementById('reportResultTable');
 if(table)table.innerHTML='<div class="contributors-loading">Consultando registros del período…</div>';
 try{const data=await getReport(kind);if(state.view!=='reportes')return;currentData=data;paintReport(kind,data)}
 catch(e){console.error('SITMAUD filtered report:',e);if(table)table.innerHTML='<div class="payment-debt-empty"><b>No se pudo consultar el reporte.</b><span>'+esc(e.message)+'</span></div>';toast('Error al consultar: '+e.message)}
 finally{loading=false}
}
function makeCSV(kind,report){
 const meta=reportMeta[kind],rows=Array.isArray(report.rows)?report.rows:[];
 const neutralize=value=>{
  let str=String(value==null?'':value).replace(/[\u0000-\u001F]/g,' ').trim();
  if(/^[=+\-@]/.test(str))str="'"+str;
  return '"'+str.replace(/"/g,'""')+'"';
 };
 const all=[meta.headers,...rows.map(row=>meta.keys.map(k=>row[k]??''))];
 return '\ufeff'+all.map(line=>line.map(neutralize).join(';')).join('\r\n');
}
async function downloadReport(kind=currentKind){
 if(loading)return;
 const range=readDates();if(!range)return;
 loading=true;
 try{
  const data=await getReport(kind,true);
  if(!data)return;
  const csv=makeCSV(kind,data),blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='SITMAUD_DEMO_'+reportMeta[kind].file+'_'+range.from+'_a_'+range.to+'.csv';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('Reporte DEMO descargado: '+formatNumber(data.count)+' registros.');
 }catch(e){console.error('SITMAUD report export:',e);toast('No se pudo exportar: '+e.message)}
 finally{loading=false}
}
function showReports(){
 const control=document.getElementById('reportPreset');
 if(!control)return;
 control.value=preset;applyPreset();loadReport(currentKind);
}
const originalRender=render;
reports=reportsView;
render=function(){originalRender();if(state.view==='reportes')showReports()};
document.addEventListener('change',e=>{
 if(e.target.id==='reportPreset'){preset=e.target.value;if(preset!=='custom')selectedDates=null;applyPreset();if(preset!=='custom')loadReport();return;}
 if(e.target.id==='reportFrom'||e.target.id==='reportTo'){
  preset='custom';const el=document.getElementById('reportPreset');if(el)el.value='custom';
  const note=document.getElementById('reportFilterNote');if(note)note.textContent='Haz clic en «Aplicar filtro» para consultar el intervalo seleccionado.';
 }
});
document.addEventListener('click',e=>{
 const view=e.target.closest('[data-report-view]');
 const download=e.target.closest('[data-report-export]');
 if(view){loadReport(view.dataset.reportView);return}
 if(download){downloadReport(download.dataset.reportExport);return}
 if(e.target.closest('#reportApply')){loadReport();return}
 if(e.target.closest('#reportExportCurrent')){downloadReport();return}
});
})();
