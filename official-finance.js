/* SITMAUD institutional financial views. No legacy simulation records are read. */
(function(){
  'use strict';
  const money=(v,c='VES')=>new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0))+' '+(c==='VES'?'Bs.':c);
    const safe=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=(v)=>v?new Date(v).toLocaleString('es-VE',{timeZone:'America/Caracas',dateStyle:'short',timeStyle:'short'}):'—';
  const label=(status)=>({pending:'Por liquidar',confirmed:'Liquidado',reversed:'Rechazado / reversado'})[status]||status||'—';
  const contributor=(p)=>p?.kind==='juridico'?(p?.legal_name||'Persona jurídica'):([p?.first_name,p?.last_name].filter(Boolean).join(' ')||'Contribuyente');
  const byCurrency=(obj)=>{const x=Object.entries(obj||{});return x.length?x.map(([c,v])=>money(v,c)).join(' · '):'Bs. 0,00'};
  let payments=[],currentReport=[],limited=false;
  function header(t,sub){return '<div class="page-head"><div><div class="eyebrow">SITMAUD · CONTROL ADMINISTRATIVO</div><h1>'+t+'</h1><p>'+sub+'</p></div></div>';}
  const metrics='<section class="card panel" id="financialOverview"><div class="contributors-loading">Consultando indicadores institucionales…</div></section>';
  function financeKpis(){return metrics}
  function paymentView(){
    return header('Recaudación y Tesorería','Registro, verificación y liquidación de pagos institucionales.')+financeKpis()+
      '<section class="card panel"><div class="panel-head"><div><h3>Operaciones registradas</h3><p>Un pago registrado no se considera recaudado hasta su liquidación por Tesorería.</p></div><button class="btn btn-light" data-official-action="refresh">Actualizar</button></div>'+
      '<div class="payment-debt-toolbar"><input type="search" class="search" id="officialPaySearch" placeholder="Buscar contribuyente, referencia o comprobante"><select class="filter-select" id="officialPayStatus"><option value="">Todos los estados</option><option value="pending">Por liquidar</option><option value="confirmed">Liquidados</option><option value="reversed">Rechazados</option></select></div>'+
      '<div id="officialPaymentRows"><div class="contributors-loading">Consultando pagos…</div></div></section>'+
      '<section class="card panel"><h3>Registro de pagos</h3><p>El registro de una operación oficial requiere obligaciones verificadas, datos bancarios y comprobante cuando corresponda. Nunca se contabilizará como ingreso hasta su liquidación.</p><div id="officialPaymentReadiness">Validando condiciones para registrar…</div></section>';
  }
  function invoiceView(){
    return header('Facturación','Documentos basados exclusivamente en pagos registrados en el sistema institucional.')+
      '<section class="card panel"><div class="panel-head"><div><h3>Recibos y pagos reportados</h3><p>El documento muestra claramente si el ingreso está pendiente o liquidado.</p></div><button class="btn btn-light" data-official-action="refresh">Actualizar</button></div><div id="officialInvoiceRows">Consultando…</div></section>';
  }
  function reportView(){
    return header('Reportes financieros','Recaudación por fecha, parroquia, sector y tipología territorial.')+financeKpis()+
      '<section class="card panel"><form id="officialFinancialFilter"><div class="form-grid">'+
      '<div class="field"><label>Tipo de reporte</label><select name="group" id="officialReportGroup"><option value="operations">Operaciones financieras</option><option value="parish">Recaudación por parroquia</option><option value="sector">Recaudación por sector</option><option value="typology">Recaudación por tipología I, II y III</option></select></div>'+
      '<div class="field"><label>Período</label><select name="period" id="officialReportPeriod"><option value="day">Día</option><option value="week">Semana</option><option value="month" selected>Mes</option><option value="year">Año</option><option value="custom">Rango personalizado</option></select></div>'+
      '<div class="field"><label>Desde</label><input type="date" name="from" required></div>'+
      '<div class="field"><label>Hasta</label><input type="date" name="to" required></div>'+
      '<div class="field" id="officialReportStatusField"><label>Estado de operación</label><select name="status"><option value="">Todos</option><option value="pending">Por liquidar</option><option value="confirmed">Liquidado</option><option value="reversed">Rechazado / reversado</option></select></div>'+
      '</div><div class="form-actions"><button type="submit" class="btn btn-primary">Consultar</button><button type="button" class="btn btn-light" data-official-action="export">Exportar CSV</button></div></form>'+
      '<p id="officialReportBasis" style="color:#687e90;font-size:11px;margin:8px 0 14px">Los importes por territorio se calculan exclusivamente con liquidaciones autorizadas por Tesorería, según la ubicación de las obligaciones pagadas.</p>'+
      '<div id="officialReportRows"></div></section>';
  }
  let territorialRows=[],territorialGroup='',territorialLoaded=false,territorialTotals={};
  const caracasDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const toISO=(dt)=>dt.toISOString().slice(0,10);
  function changeReportPeriod(form){
    if(!form)return;
    const period=form.elements.period.value;
    if(period==='custom')return;
    const now=caracasDay(),end=new Date(now+'T12:00:00Z');
    let from=now,to=now;
    if(period==='week'){const day=(end.getUTCDay()+6)%7;end.setUTCDate(end.getUTCDate()-day);from=toISO(end);end.setUTCDate(end.getUTCDate()+6);to=toISO(end);}
    if(period==='month'){from=now.slice(0,7)+'-01';const [y,m]=now.split('-').map(Number);to=toISO(new Date(Date.UTC(y,m,0)));}
    if(period==='year'){from=now.slice(0,4)+'-01-01';to=now.slice(0,4)+'-12-31';}
    form.elements.from.value=from;form.elements.to.value=to;
  }
  function changeReportGrouping(form){
    if(!form)return;
    const geographic=form.elements.group.value!=='operations';
    const field=document.getElementById('officialReportStatusField');
    if(field)field.hidden=geographic;
    const help=document.getElementById('officialReportBasis');
    if(help)help.textContent=geographic
      ?'Recaudación territorial: únicamente pagos LIQUIDADOS, agrupados según los inmuebles y cuentas matrices. Se usa la fecha de liquidación en Coro y se respetan las tipologías propias de condominios.'
      :'Operaciones financieras por fecha de registro y estado. Para recaudo efectivamente ingresado selecciona “Liquidado”.';
  }
  async function loadTerritorialReport(form){
    const host=document.getElementById('officialReportRows');if(!host||!form)return;
    const f=new FormData(form),from=String(f.get('from')||''),to=String(f.get('to')||''),group=String(f.get('group')||'');
    if(!from||!to||from>to){host.innerHTML='<div class="contributors-empty">Selecciona un rango de fechas válido.</div>';return;}
    territorialLoaded=false;territorialRows=[];territorialGroup=group;territorialTotals={};
    host.innerHTML='<div class="contributors-loading">Calculando recaudación territorial…</div>';
    const {data,error}=await imaudClient.rpc('get_official_territorial_revenue',{p_from:from,p_to:to,p_group:group});
    if(!host.isConnected||form.elements.group.value!==group||form.elements.from.value!==from||form.elements.to.value!==to)return;
    if(error){host.innerHTML='<div class="contributors-empty">No se pudo generar el reporte territorial: '+safe(error.message)+'</div>';return;}
    territorialRows=Array.isArray(data?.rows)?data.rows:[];territorialTotals=data?.totals_by_currency||{};territorialLoaded=true;
    const names={parish:'Parroquia',sector:'Sector',typology:'Tipología'};
    const tot=Object.entries(territorialTotals);
    host.innerHTML='<div class="panel-head"><div><h3>Recaudación por '+safe((names[group]||group).toLowerCase())+'</h3><p>Del '+safe(from)+' al '+safe(to)+' · por fecha de liquidación de Tesorería</p></div></div>'+
      '<p><strong>Total liquidado y aplicado:</strong> '+safe(tot.length?tot.map(([currency,n])=>money(n,currency)).join(' · '):'Bs. 0,00')+'</p>'+
      (territorialRows.length?
      '<div class="payment-debt-scroll"><table><thead><tr><th>'+safe(names[group]||'Clasificación')+'</th>'+(group==='sector'?'<th>Parroquia</th>':'')+'<th>Moneda</th><th>Liquidaciones</th><th>Recaudado</th></tr></thead><tbody>'+
      territorialRows.map(x=>'<tr><td><b>'+safe(x.name)+'</b></td>'+(group==='sector'?'<td>'+safe(x.parent||'—')+'</td>':'')+'<td>'+safe(x.currency)+'</td><td>'+safe(x.payment_count)+'</td><td><strong>'+safe(money(x.amount,x.currency))+'</strong></td></tr>').join('')+'</tbody></table></div>':
      '<div class="contributors-empty">No hay importes liquidados para los filtros seleccionados.</div>')+
      '<p style="color:#75899b;font-size:11px;margin-top:12px">Se suman las aplicaciones a obligaciones oficiales, sin contar dos veces una cuenta matriz de condominio. El número de liquidaciones por grupo puede repetirse entre territorios si un mismo pago cubre varios inmuebles.</p>';
  }
  function exportTerritorialReport(){
    if(!territorialLoaded){window.alert('Consulta primero el reporte territorial.');return;}
    const cols=['Agrupación','Nombre','Parroquia del sector','Moneda','Operaciones liquidadas','Monto liquidado','Fecha desde','Fecha hasta'];
    const form=document.getElementById('officialFinancialFilter'),from=form?.elements.from.value||'',to=form?.elements.to.value||'';
    const rows=territorialRows.map(x=>[territorialGroup,x.name,x.parent||'',x.currency,x.payment_count,x.amount,from,to]);
    const csv=[cols,...rows].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
    a.href=url;a.download='SITMAUD-recaudacion-'+territorialGroup+'-'+from+'-'+to+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
  }
  async function loadOverview(){
    const host=document.getElementById('financialOverview');if(!host)return;
    const {data,error}=await imaudClient.rpc('get_official_financial_overview');
    if(!host.isConnected)return;
    if(error){host.innerHTML='<div class="contributors-empty">No se pudieron consultar los indicadores: '+safe(error.message)+'</div>';return;}
    const items=[
      ['Por cobrar','Bs. '+new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(data.amount_to_collect||0)),'Obligaciones oficiales menos importes liquidados'],
      ['Por liquidar',byCurrency(data.pending_by_currency),(data.pending_count||0)+' operaciones sin liquidar'],
      ['Liquidado hoy',byCurrency(data.liquidated_today_by_currency),'Fecha de liquidación · Coro'],
      ['Liquidado este mes',byCurrency(data.liquidated_month_by_currency),'Fecha de liquidación · Coro']
    ];
    host.innerHTML='<h3>Control financiero institucional</h3><div class="grid kpis">'+items.map(([t,v,n])=>'<article class="card kpi"><div class="kpi-top"><span>'+safe(t)+'</span></div><div class="kpi-value" style="font-size:20px;overflow-wrap:anywhere">'+safe(v)+'</div><div class="kpi-note">'+safe(n)+'</div></article>').join('')+'</div>';
  }
  async function loadPayments(){
    if(!document.getElementById('officialPaymentRows')&&!document.getElementById('officialInvoiceRows')&&!document.getElementById('officialReportRows'))return;
    const {data,error}=await imaudClient.from('payments').select('id,receipt_number,amount,currency_code,paid_at,created_at,liquidated_at,payment_method,external_reference,status,registration_channel,evidence_path,contributor:contributors!payments_contributor_id_fkey(kind,legal_name,first_name,last_name,contract_number,identification_type,identification_number)').order('created_at',{ascending:false}).limit(500);
    if(error){for(const h of ['officialPaymentRows','officialInvoiceRows','officialReportRows']){const node=document.getElementById(h);if(node)node.innerHTML='<div class="contributors-empty">Error al consultar operaciones oficiales: '+safe(error.message)+'</div>';}return;}
    payments=data||[];limited=payments.length>=500;
    renderPaymentRows();renderInvoiceRows();
    const form=document.getElementById('officialFinancialFilter');if(form)renderReportRows(form);
  }
  function renderPaymentRows(){
    const node=document.getElementById('officialPaymentRows');if(!node)return;
    const term=(document.getElementById('officialPaySearch')?.value||'').toLowerCase().trim(),status=document.getElementById('officialPayStatus')?.value||'';
    const records=payments.filter(p=>(!status||p.status===status)&&(!term||[p.receipt_number,p.external_reference,contributor(p.contributor),p.contributor?.contract_number].join(' ').toLowerCase().includes(term)));
    if(!records.length){node.innerHTML='<div class="contributors-empty"><b>No hay operaciones registradas para este filtro.</b></div>';return;}
    node.innerHTML='<div class="payment-debt-scroll"><table><thead><tr><th>Fecha</th><th>Comprobante</th><th>Contribuyente</th><th>Referencia</th><th>Monto</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+
      records.map(p=>'<tr><td>'+safe(fmtDate(p.created_at))+'</td><td><b>'+safe(p.receipt_number)+'</b></td><td>'+safe(contributor(p.contributor))+'</td><td>'+safe(p.external_reference||'—')+'</td><td>'+safe(money(p.amount,p.currency_code))+'</td><td>'+safe(label(p.status))+'</td><td><button class="btn btn-light btn-sm" data-official-invoice="'+safe(p.id)+'">Ver documento</button> '+(p.status==='pending'?'<button class="btn btn-primary btn-sm" data-official-liquidate="'+safe(p.id)+'">Liquidar (Tesorería)</button>':'')+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function renderInvoiceRows(){
    const node=document.getElementById('officialInvoiceRows');if(!node)return;
    if(!payments.length){node.innerHTML='<div class="contributors-empty"><b>Sin pagos institucionales registrados.</b><span>Los documentos aparecerán aquí cuando se registren operaciones oficiales.</span></div>';return;}
    node.innerHTML='<div class="payment-debt-scroll"><table><thead><tr><th>Número</th><th>Contribuyente</th><th>Fecha del registro</th><th>Estado</th><th>Monto</th><th></th></tr></thead><tbody>'+
    payments.map(p=>'<tr><td><b>'+safe(p.receipt_number)+'</b></td><td>'+safe(contributor(p.contributor))+'</td><td>'+safe(fmtDate(p.created_at))+'</td><td>'+safe(label(p.status))+'</td><td>'+safe(money(p.amount,p.currency_code))+'</td><td><button class="btn btn-light" data-official-invoice="'+safe(p.id)+'">Consultar</button></td></tr>').join('')+'</tbody></table></div>';
  }
  function renderReportRows(form){
    const node=document.getElementById('officialReportRows');if(!node)return;
    if(form.elements.group?.value!=='operations'){loadTerritorialReport(form);return;}
    const f=new FormData(form),from=String(f.get('from')||''),to=String(f.get('to')||''),status=String(f.get('status')||'');
    if(!from||!to){node.innerHTML='<div class="contributors-empty">Selecciona el rango de fechas.</div>';return;}
    if(from>to){node.innerHTML='<div class="contributors-empty">La fecha de inicio debe ser anterior al final.</div>';return;}
    currentReport=payments.filter(p=>{
      const day=p.created_at?new Date(p.created_at).toLocaleDateString('en-CA',{timeZone:'America/Caracas'}):'';
      return day>=from&&day<=to&&(!status||p.status===status);
    });
    node.innerHTML='<p><b>'+currentReport.length+'</b> operaciones registradas en el rango seleccionado. Se filtra por fecha de registro de Coro.</p>'+(limited?'<p class="notice">La consulta alcanzó el límite de 500 operaciones. Este listado no es un reporte completo; exportación deshabilitada hasta incorporar paginación.</p>':'')+
      (currentReport.length?'<div class="payment-debt-scroll"><table><thead><tr><th>Fecha</th><th>N.º</th><th>Contribuyente</th><th>Estado</th><th>Monto</th></tr></thead><tbody>'+currentReport.map(p=>'<tr><td>'+safe(fmtDate(p.created_at))+'</td><td>'+safe(p.receipt_number)+'</td><td>'+safe(contributor(p.contributor))+'</td><td>'+safe(label(p.status))+'</td><td>'+safe(money(p.amount,p.currency_code))+'</td></tr>').join('')+'</tbody></table></div>':'<div class="contributors-empty">No se encontraron operaciones para el rango indicado.</div>');
  }
  async function verifyReadiness(){
    const node=document.getElementById('officialPaymentReadiness');if(!node)return;
    const [rates,debt]=await Promise.all([
      imaudClient.from('tariff_schedules').select('id',{count:'exact',head:true}).eq('is_approved',true),
      imaudClient.from('assessments').select('id',{count:'exact',head:true}).eq('is_demo',false).in('status',['pending','partially_paid'])
    ]);
    if(rates.error||debt.error){node.textContent='No se pudo verificar la disponibilidad de obligaciones y tarifas. Comprueba tus permisos.';return;}
    if(!rates.count||!debt.count){node.innerHTML='<p><b>Registro de pagos no habilitado:</b> todavía no hay obligaciones oficiales exigibles con tabulador aprobado. No se emitirán cobros sin respaldo normativo.</p>';return;}
    node.innerHTML='<p>Existen obligaciones oficiales. El registro desde taquilla se habilitará una vez validados los controles de comprobantes bancarios y aplicación de pagos. Actualmente puedes consultar y dar seguimiento a operaciones registradas.</p>';
  }
  function showDocument(id){
    const p=payments.find(p=>p.id===id);if(!p)return;
    document.getElementById('billModal')?.remove();
    const c=p.contributor||{},verified=p.status==='confirmed';
    const text=verified?'PAGO LIQUIDADO POR TESORERÍA':p.status==='pending'?'PAGO REGISTRADO · PENDIENTE DE LIQUIDACIÓN':'OPERACIÓN RECHAZADA / REVERSADA';
    const doc='<div class="bill-paper"><div class="bill-watermark">IMAUD</div><div class="bill-header"><div class="bill-brand bill-miranda"><div class="bill-logo-window"><img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/2fb94317-165c-4058-ba6f-8d7b39165bc1.png" alt="Alcaldía Bolivariana del Municipio Miranda"></div></div><div class="bill-heading"><h1>IMAUD · SITMAUD</h1><h2>INSTITUTO MUNICIPAL DE ASEO URBANO Y DOMICILIARIO</h2><b>'+safe(text)+'</b></div><div class="bill-brand bill-imaud"><div class="bill-logo-window bill-logo-right"><img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/c48697a7-2c1f-4f88-aa38-2f8bb991ada2.png" alt="Instituto Municipal de Aseo Urbano y Domiciliario"></div></div></div>'+
      '<div class="bill-ref"><div class="bill-field"><span>N.º de comprobante</span><b>'+safe(p.receipt_number)+'</b></div><div class="bill-field"><span>Contrato</span><b>'+safe(c.contract_number||'—')+'</b></div><div class="bill-field"><span>Registro</span><b>'+safe(fmtDate(p.created_at))+'</b></div><div class="bill-field"><span>Liquidación</span><b>'+safe(fmtDate(p.liquidated_at))+'</b></div></div>'+
      '<div class="bill-parties"><div><h3>Contribuyente</h3><div class="bill-field"><span>Nombre / razón social</span><b>'+safe(contributor(c))+'</b></div><div class="bill-field"><span>Identificación</span><b>'+safe((c.identification_type||'')+'-'+(c.identification_number||''))+'</b></div></div><div><h3>Operación bancaria</h3><div class="bill-field"><span>Método</span><b>'+safe(p.payment_method||'—')+'</b></div><div class="bill-field"><span>Referencia</span><b>'+safe(p.external_reference||'—')+'</b></div></div></div>'+
      '<div class="bill-items"><table><thead><tr><th>Concepto</th><th>Fecha del pago</th><th>Estado</th><th>Importe</th></tr></thead><tbody><tr><td>Servicio municipal de aseo urbano y domiciliario</td><td>'+safe(fmtDate(p.paid_at))+'</td><td>'+safe(label(p.status))+'</td><td>'+safe(money(p.amount,p.currency_code))+'</td></tr></tbody></table></div>'+
      '<div class="bill-bottom"><div><small>Documento generado desde el registro administrativo del sistema. La confirmación bancaria corresponde a Tesorería.</small></div><div class="bill-paid"><span>MONTO REGISTRADO</span><strong>'+safe(money(p.amount,p.currency_code))+'</strong></div></div>'+
      '<div class="bill-foot">'+safe(verified?'Ingreso verificado y liquidado por Tesorería.':'No acredita recaudación efectiva mientras se encuentre sin liquidar.')+'</div></div>';
    const wrap=document.createElement('div');wrap.id='billModal';wrap.className='bill-backdrop';wrap.innerHTML='<div class="bill-dialog"><div class="bill-toolbar"><div><b>Comprobante de operación institucional</b><small>'+safe(p.receipt_number)+'</small></div><div><button class="btn btn-light" data-official-action="close-document">Cerrar</button><button class="btn btn-primary" data-official-action="print">Imprimir</button></div></div><div id="billContent">'+doc+'</div></div>';
    document.body.appendChild(wrap);
  }
  async function liquidate(id,btn){
    const p=payments.find(p=>p.id===id);if(!p||p.status!=='pending')return;
    const ok=window.confirm('¿Has verificado en la cuenta bancaria de la Alcaldía el ingreso del pago '+p.receipt_number+' y su referencia '+(p.external_reference||'SIN REFERENCIA')+'? Al confirmar se reconocerá como recaudación.');
    if(!ok)return;
    const note=window.prompt('Indica banco, fecha de verificación y observación de Tesorería (obligatorio):','');
    if(!note||note.trim().length<20){window.alert('Debes documentar la verificación bancaria con al menos 20 caracteres.');return;}
    btn.disabled=true;
    try{
      const {error}=await imaudClient.rpc('liquidate_official_payment',{p_payment_id:id,p_treasury_note:note.trim()});
      if(error)throw error;
      window.alert('Operación liquidada. Se actualizarán los indicadores.');
      await Promise.all([loadPayments(),loadOverview()]);
    }catch(e){window.alert('La liquidación no se completó: '+(e.message||'Error de permisos o validación'));btn.disabled=false;}
  }
  function exportCSV(){
    if(document.getElementById('officialFinancialFilter')?.elements.group.value!=='operations'){exportTerritorialReport();return;}
    if(limited){window.alert('La consulta alcanzó el máximo de 500 operaciones. No es seguro exportar un reporte incompleto.');return;}
    const cols=['N.º comprobante','Contribuyente','Identificación','Contrato','Fecha registro','Fecha liquidación','Banco / referencia','Método','Estado','Moneda','Monto'];
    const rows=currentReport.map(p=>[p.receipt_number,contributor(p.contributor),(p.contributor?.identification_type||'')+'-'+(p.contributor?.identification_number||''),p.contributor?.contract_number,fmtDate(p.created_at),fmtDate(p.liquidated_at),p.external_reference,p.payment_method,label(p.status),p.currency_code,p.amount]);
    const csv=[cols,...rows].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const a=document.createElement('a');const u=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.href=u;a.download='SITMAUD-pagos-institucionales.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),2500);
  }
  document.addEventListener('click',e=>{
    const action=e.target.closest('[data-official-action]');
    if(action){
      if(action.dataset.officialAction==='refresh'){loadPayments();loadOverview();verifyReadiness();}
      if(action.dataset.officialAction==='close-document')document.getElementById('billModal')?.remove();
      if(action.dataset.officialAction==='print')window.print();
      if(action.dataset.officialAction==='export')exportCSV();
      return;
    }
    const invoice=e.target.closest('[data-official-invoice]');if(invoice){showDocument(invoice.dataset.officialInvoice);return;}
    const pay=e.target.closest('[data-official-liquidate]');if(pay){liquidate(pay.dataset.officialLiquidate,pay);return;}
  });
  document.addEventListener('input',e=>{if(e.target.id==='officialPaySearch')renderPaymentRows();});
  document.addEventListener('change',e=>{if(e.target.id==='officialPayStatus')renderPaymentRows();if(e.target.id==='officialReportPeriod')changeReportPeriod(e.target.form);if(e.target.id==='officialReportGroup')changeReportGrouping(e.target.form);});
  document.addEventListener('submit',e=>{if(e.target.id==='officialFinancialFilter'){e.preventDefault();renderReportRows(e.target);}});
  window.sitmaudOfficialFinance={
    overviewPlaceholder:()=>metrics,
    loadOverview,
    view(v){return v==='pagos'?paymentView():v==='facturacion'?invoiceView():reportView();},
    async mount(v){
      if(v==='reportes'){const form=document.getElementById('officialFinancialFilter');if(form){changeReportPeriod(form);changeReportGrouping(form);}}
      if(v==='pagos'||v==='reportes')loadOverview();
      if(v==='pagos')verifyReadiness();
      await loadPayments();
    }
  };
})();
