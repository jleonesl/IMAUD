/* SITMAUD institutional financial views. No legacy simulation records are read. */
(function(){
  'use strict';
  const money=(v,c='VES')=>new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v||0))+' '+(c==='VES'?'Bs.':c);
    const safe=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=(v)=>v?new Date(v).toLocaleString('es-VE',{timeZone:'America/Caracas',dateStyle:'short',timeStyle:'short'}):'—';
  const label=(status)=>({pending:'Por liquidar',confirmed:'Liquidado',reversed:'Rechazado / reversado'})[status]||status||'—';
  const contributor=(p)=>p?.kind==='juridico'?(p?.legal_name||'Persona jurídica'):([p?.first_name,p?.last_name].filter(Boolean).join(' ')||'Contribuyente');
  const byCurrency=(obj)=>{const x=Object.entries(obj||{});return x.length?x.map(([c,v])=>money(v,c)).join(' · '):'Bs. 0,00'};
  let payments=[],currentReport=[],limited=false,treasuryAllowed=false,reliefAllowed=false,reliefCandidates=[];
  function header(t,sub){return '<div class="page-head"><div><div class="eyebrow">SITMAUD · CONTROL ADMINISTRATIVO</div><h1>'+t+'</h1><p>'+sub+'</p></div></div>';}
  const metrics='<section class="card panel" id="financialOverview"><div class="contributors-loading">Consultando indicadores institucionales…</div></section>';
  function financeKpis(){return metrics}
  function paymentView(){
    return header('Recaudación y Tesorería','Registro, verificación y liquidación de pagos institucionales.')+financeKpis()+
      '<section class="card panel"><div class="panel-head"><div><h3>Operaciones registradas</h3><p>Un pago registrado no se considera recaudado hasta su liquidación por Tesorería.</p></div><button class="btn btn-light" data-official-action="refresh">Actualizar</button></div>'+
      '<div class="payment-debt-toolbar"><input type="search" class="search" id="officialPaySearch" placeholder="Buscar contribuyente, referencia o comprobante"><select class="filter-select" id="officialPayStatus"><option value="">Todos los estados</option><option value="pending">Por liquidar</option><option value="confirmed">Liquidados</option><option value="reversed">Rechazados</option></select></div>'+
      '<div id="officialPaymentRows"><div class="contributors-loading">Consultando pagos…</div></div></section>'+
      '<section class="card panel"><h3>Registro de pagos</h3><p>El registro de una operación oficial requiere obligaciones verificadas, datos bancarios y comprobante cuando corresponda. Nunca se contabilizará como ingreso hasta su liquidación.</p><div id="officialPaymentReadiness">Validando condiciones para registrar…</div></section>'+
      '<section class="card panel" id="officialDebtReliefPanel" hidden><div class="panel-head"><div><h3>Exonerar deudas</h3><p>Selecciona meses pendientes de un contribuyente. Solo funcionarios con permiso de exoneración.</p></div></div>'+
      '<form id="officialDebtReliefLookup"><div class="form-grid"><div class="field"><label for="reliefContributorLookup">N.º de contrato, cédula o RIF</label><input id="reliefContributorLookup" name="identity" required placeholder="Buscar contribuyente"></div></div><div class="form-actions"><button class="btn btn-light" type="submit">Buscar obligaciones</button></div></form>'+
      '<div id="officialReliefObligations" aria-live="polite"></div></section>';
  }
  function invoiceView(){
    return header('Facturación','Documentos basados exclusivamente en pagos registrados en el sistema institucional.')+
      '<section class="card panel"><div class="panel-head"><div><h3>Recibos y pagos reportados</h3><p>El documento muestra claramente si el ingreso está pendiente o liquidado.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-light" data-official-invoice="template">Ver formato aprobado</button><button class="btn btn-light" data-official-action="refresh">Actualizar</button></div></div><div id="officialInvoiceRows">Consultando…</div></section>';
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
    const {data,error}=await imaudClient.from('payments').select('id,receipt_number,amount,currency_code,paid_at,created_at,invoice_issued_at,liquidated_at,payment_method,external_reference,status,registration_channel,evidence_path,contributor:contributors!payments_contributor_id_fkey(kind,legal_name,first_name,last_name,contract_number,identification_type,identification_number)').order('created_at',{ascending:false}).limit(500);
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
      records.map(p=>'<tr><td>'+safe(fmtDate(p.created_at))+'</td><td><b>'+safe(p.receipt_number)+'</b></td><td>'+safe(contributor(p.contributor))+'</td><td>'+safe(p.external_reference||'—')+'</td><td>'+safe(money(p.amount,p.currency_code))+'</td><td>'+safe(label(p.status))+'</td><td><button class="btn btn-light btn-sm" data-official-invoice="'+safe(p.id)+'">Ver documento</button> '+(p.status==='pending'&&treasuryAllowed?'<button class="btn btn-primary btn-sm" data-official-liquidate="'+safe(p.id)+'">Liquidar (Tesorería)</button> <button class="btn btn-light btn-sm" data-official-reject="'+safe(p.id)+'">Anular registro</button>':'')+'</td></tr>').join('')+'</tbody></table></div>';
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
  const receiptMonth=(x)=>x?new Date(x+'T12:00:00Z').toLocaleDateString('es-VE',{timeZone:'UTC',month:'long',year:'numeric'}):'—';
  const receiptDate=(x)=>x?new Date(x).toLocaleDateString('es-VE',{timeZone:'America/Caracas',day:'2-digit',month:'2-digit',year:'numeric'}):'—';
  const receiptMoney=(value)=>'Bs. '+new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0));
  // The receipt is generated from existing payment + officially allocated assessments.
  // No fabricated UCD, invoice sequence, bank, verification QR or exchange-rate values.
  async function showDocument(id){
    const preview=id==='template';
    if(!preview)imaudClient.rpc('record_staff_activity',{p_action:'receipt_opened',p_module:'facturacion',p_reference:id}).then(({error})=>{if(error)console.warn('Bitácora:',error.message)});
    const p=preview?{id:'template',receipt_number:'—',amount:0,currency_code:'VES',created_at:null,invoice_issued_at:null,status:'pending',paid_at:null,payment_method:'—',external_reference:'—',contributor:{kind:'natural',first_name:'—',last_name:'',contract_number:'—',identification_type:'',identification_number:'—'}}:payments.find(row=>row.id===id);if(!p)return;
    document.getElementById('billModal')?.remove();
    const container=document.createElement('div');
    container.id='billModal';container.className='bill-backdrop';
    container.innerHTML='<div class="bill-dialog"><div class="bill-toolbar"><div><b>Recibo de operación · SITMAUD</b><small>'+safe(p.receipt_number)+'</small></div><div><button class="btn btn-light" data-official-action="close-document">Cerrar</button><button class="btn btn-primary" id="officialReceiptPrint" data-official-action="print" disabled>Imprimir</button></div></div><div id="billContent" style="padding:16px;text-align:center">Cargando información del recibo institucional…</div></div>';
    document.body.appendChild(container);
    const {data:allocations,error}=preview?{data:[{assessment:{is_demo:false,period_start:null,property:{address:'—',parish_name:'—',sector_name:'—',typology_override:'—'}}}],error:null}:await imaudClient.from('payment_allocations')
      .select('amount,assessment:assessments!payment_allocations_assessment_id_fkey(period_start,period_end,is_demo,property:properties!assessments_property_id_fkey(address,parish_name,sector_name,typology_override,organization:residential_organizations!properties_organization_id_fkey(billing_typology,display_name),sector:sectors!properties_sector_id_fkey(default_typology)))')
      .eq('payment_id',id);
    if(!container.isConnected)return;
    const host=container.querySelector('#billContent'),print=container.querySelector('#officialReceiptPrint');
    if(error){host.innerHTML='<div class="contributors-empty">No se pudo verificar el detalle del recibo: '+safe(error.message)+'</div>';return;}
    if(!allocations?.length||allocations.some(a=>!a.assessment||a.assessment.is_demo)){
      host.innerHTML='<div class="contributors-empty"><b>No se puede emitir este recibo.</b><span>El pago no tiene aplicaciones a obligaciones oficiales verificables.</span></div>';
      return;
    }
    const c=p.contributor||{},first=allocations[0].assessment,property=first.property||{};
    const periodLabels=[...new Set(allocations.map(a=>a.assessment.period_start).filter(Boolean).map(receiptMonth))];
    const billedPeriod=preview?'—':periodLabels.length<=3?periodLabels.join(' · '):periodLabels.slice(0,3).join(' · ')+' y '+(periodLabels.length-3)+' período(s) adicionales';
    const typology=property.organization?.billing_typology||property.typology_override||property.sector?.default_typology||'Sin clasificación';
    const address=property.address||'No registrada';
    const parish=property.parish_name||'No registrada';
    const sector=property.sector_name||'No registrado';
    const isVES=p.currency_code==='VES',paid=!preview&&p.status==='confirmed',pending=!preview&&p.status==='pending';
    const title=preview?'RECIBO DE PAGO':paid?'RECIBO DE PAGO':pending?'COMPROBANTE DE PAGO REPORTADO':'OPERACIÓN REVERSADA';
    const status=preview?'PLANTILLA SIN DATOS · NO ES UN RECIBO EMITIDO':paid?'LIQUIDADO POR TESORERÍA':pending?'PENDIENTE DE LIQUIDACIÓN':'SIN VALIDEZ COMO PAGO';
    const doc='<article class="bill-paper sit-receipt" role="document">'+
      '<header class="sit-receipt-header">'+
        '<div class="sit-receipt-logo"><img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/2fb94317-165c-4058-ba6f-8d7b39165bc1.png" alt="Alcaldía Bolivariana del Municipio Miranda"></div>'+
        '<div class="sit-receipt-heading"><h1>'+safe(title)+'</h1><p>SERVICIO MUNICIPAL DE ASEO URBANO Y DOMICILIARIO</p></div>'+
        '<div class="sit-receipt-logo"><img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/c48697a7-2c1f-4f88-aa38-2f8bb991ada2.png" alt="Instituto Municipal de Aseo Urbano y Domiciliario"></div>'+
      '</header>'+
      '<div class="sit-receipt-state '+(paid?'is-liquidated':pending?'is-pending':'is-reversed')+'">'+safe(status)+'</div>'+
      '<div class="sit-receipt-numbers"><div><span>N.º DE CONTRATO</span><b>'+safe(c.contract_number||'No registrado')+'</b></div><div><span>N.º DE COMPROBANTE</span><b>'+safe(p.receipt_number)+'</b></div><div><span>FECHA DE EMISIÓN</span><b>'+safe(receiptDate(p.invoice_issued_at||p.created_at))+'</b></div></div>'+
      '<div class="sit-receipt-mid"><div class="sit-receipt-data">'+
        '<div><span>Contribuyente:</span><b>'+safe(contributor(c))+'</b></div>'+
        '<div><span>Cédula / RIF:</span><b>'+safe((c.identification_type||'')+'-'+(c.identification_number||''))+'</b></div>'+
        '<div><span>Dirección:</span><b>'+safe(address)+'</b></div>'+
        '<div><span>Sector / Parroquia:</span><b>'+safe(sector+' / '+parish)+'</b></div>'+
        '<div><span>Tipología:</span><b>'+safe(typology)+'</b></div>'+
      '</div><div class="sit-receipt-side"><div class="sit-receipt-period"><strong>PERÍODO FACTURADO</strong><span>'+safe(billedPeriod||'No definido')+'</span></div>'+
        '<div class="sit-receipt-verification"><strong>Identificación del documento</strong><span>'+safe(p.receipt_number)+'</span><small>Consultar en SITMAUD. La verificación digital mediante QR todavía no está habilitada.</small></div></div></div>'+
      '<div class="sit-receipt-charge"><div><strong>Concepto</strong><span>Servicio de aseo urbano y domiciliario</span></div><div><strong>'+(paid?'Monto pagado (Bs.)':'Monto registrado (Bs.)')+'</strong><b>'+safe(preview?'—':isVES?receiptMoney(p.amount):'Sin conversión a bolívares')+'</b></div></div>'+
      '<div class="sit-receipt-payment"><div><span>MÉTODO DE PAGO</span><b>'+safe(p.payment_method||'No registrado')+'</b></div><div><span>BANCO</span><b>No consignado en este registro</b></div><div><span>REFERENCIA</span><b>'+safe(p.external_reference||'No registrada')+'</b></div></div>'+
      '<footer class="sit-receipt-footer">Cuida la ciudad, cumple con tu servicio de aseo.</footer>'+
      '</article>';
    host.style.cssText='';host.innerHTML=doc;
    if(preview){print.disabled=true;return;}
    if(!isVES){
      host.insertAdjacentHTML('beforeend','<div class="notice" style="margin-top:12px">No se puede imprimir un recibo con monto en bolívares: el registro está en '+safe(p.currency_code)+'. Debe existir una conversión institucional documentada.</div>');
      return;
    }
    // The status is always visible; a pending operation does not claim treasury clearance.
    print.disabled=false;
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

  async function loadFinancialPrivileges(){
    const [treasury,relief]=await Promise.all([
      imaudClient.rpc('has_permission',{permission_code:'payments.validate'}),
      imaudClient.rpc('has_permission',{permission_code:'debt_relief.apply'})
    ]);
    treasuryAllowed=!treasury.error&&treasury.data===true;
    reliefAllowed=!relief.error&&relief.data===true;
    const panel=document.getElementById('officialDebtReliefPanel');
    if(panel)panel.hidden=!reliefAllowed;
    renderPaymentRows();
  }
  async function rejectPendingPayment(id,button){
    const payment=payments.find(p=>p.id===id);
    if(!treasuryAllowed||!payment||payment.status!=='pending')return;
    if(!window.confirm('¿Anular el registro pendiente '+payment.receipt_number+'? La operación no será borrada y el sistema guardará el funcionario, la fecha y la acción en la bitácora.'))return;
    const reason=window.prompt('Motivo concreto del rechazo o anulación (obligatorio, mínimo 8 caracteres):','');
    if(reason===null)return;
    if(reason.trim().length<8){window.alert('Escribe un motivo verificable de al menos 8 caracteres.');return;}
    button.disabled=true;
    const {error}=await imaudClient.rpc('reject_official_payment',{
      p_payment_id:id,
      p_reason:reason.trim()
    });
    if(error){window.alert('No se pudo anular: '+error.message);button.disabled=false;return;}
    await Promise.all([loadPayments(),loadOverview()]);
  }

  async function findReliefObligations(form){
    const node=document.getElementById('officialReliefObligations');if(!node||!reliefAllowed)return;
    node.textContent='Consultando deuda oficial…';reliefCandidates=[];
    const query=String(new FormData(form).get('identity')||'').trim().toUpperCase();
    if(query.length<5){node.textContent='Escribe la cédula, el RIF o el contrato completo.';return;}
    const id=query.replace(/[^0-9]/g,'');
    const lookups=[imaudClient.from('contributors').select('id,contract_number,first_name,last_name,legal_name,kind').eq('contract_number',query).limit(2)];
    if(id.length>=6)lookups.push(imaudClient.from('contributors').select('id,contract_number,first_name,last_name,legal_name,kind').eq('identification_number',id).limit(3));
    const found=await Promise.all(lookups);
    const failure=found.find(x=>x.error);
    if(failure){node.textContent='Error de consulta: '+failure.error.message;return;}
    const foundContributors=[...new Map(found.flatMap(x=>x.data||[]).map(c=>[c.id,c])).values()];
    if(foundContributors.length!==1){node.textContent=foundContributors.length?'Se encontraron varias cuentas. Introduce el número de contrato exacto.':'No se encontró el contribuyente.';return;}
    const c=foundContributors[0],properties=await imaudClient.from('properties').select('id,address,contributor_id').eq('contributor_id',c.id);
    if(properties.error){node.textContent='No se pudieron consultar los inmuebles: '+properties.error.message;return;}
    if(!properties.data?.length){node.textContent='No existen inmuebles asociados a este contribuyente.';return;}
    const assessment=await imaudClient.from('assessments')
       .select('id,property_id,period_start,period_end,total_amount,status')
       .in('property_id',properties.data.map(x=>x.id))
       .eq('is_demo',false).in('status',['pending','partially_paid'])
       .order('period_start',{ascending:false}).limit(100);
    if(assessment.error){node.textContent='Error al consultar deudas: '+assessment.error.message;return;}
    const rows=assessment.data||[];
    if(!rows.length){node.textContent='Este contribuyente no tiene obligaciones oficiales pendientes.';return;}
    // Verify registered legal authorizations indirectly through an authorized server-side
    // action. Do not show sensitive legal records in the client.
    reliefCandidates=rows;
    const addresses=new Map(properties.data.map(p=>[p.id,p.address]));
    node.innerHTML='<div class="panel-head"><div><h3>Meses pendientes · '+safe(contributor(c))+'</h3><p>Contrato '+safe(c.contract_number||'—')+' · selecciona uno, varios o todos los períodos.</p></div></div>'+
       '<div class="payment-debt-scroll"><table><thead><tr><th><input id="reliefSelectAll" type="checkbox" aria-label="Seleccionar todos los meses"></th><th>Mes</th><th>Inmueble</th><th>Saldo original</th><th>Estado</th></tr></thead><tbody>'+
       rows.map(x=>'<tr><td><input class="relief-month-check" type="checkbox" value="'+safe(x.id)+'" aria-label="Exonerar '+safe(x.period_start)+'"></td><td><b>'+safe(x.period_start)+'</b></td><td>'+safe(addresses.get(x.property_id)||'Cuenta matriz')+'</td><td>'+safe(money(x.total_amount,'VES'))+'</td><td>'+safe(x.status)+'</td></tr>').join('')+
       '</tbody></table></div><p class="panel-hint">Las exoneraciones requieren autorización legal institucional previa; no crean ingresos ni borran registros.</p>'+
       '<div class="form-actions"><button type="button" class="btn btn-primary" id="applyReliefMonths" data-relief-apply disabled>Exonerar meses seleccionados</button></div>';
    const all=document.getElementById('reliefSelectAll');
    if(all)all.checked=false;
  }
  function updateReliefSelection(){
    const all=[...document.querySelectorAll('.relief-month-check')];
    const selected=all.filter(x=>x.checked);
    const button=document.getElementById('applyReliefMonths'),select=document.getElementById('reliefSelectAll');
    if(button){button.disabled=!selected.length;button.textContent='Exonerar '+selected.length+' mes'+(selected.length===1?'':'es');}
    if(select){select.checked=all.length>0&&selected.length===all.length;select.indeterminate=selected.length>0&&selected.length<all.length;}
  }
  async function applySelectedRelief(button){
    if(!reliefAllowed)return;
    const ids=[...document.querySelectorAll('.relief-month-check:checked')].map(x=>x.value);
    if(!ids.length||ids.length>100)return;
    if(!window.confirm('¿Exonerar los '+ids.length+' mes(es) seleccionados? El sistema verificará las autorizaciones legales y registrará cada operación en la bitácora.'))return;
    button.disabled=true;
    const {data,error}=await imaudClient.rpc('apply_authorized_debt_exonerations',{p_assessment_ids:ids});
    if(error){
      window.alert('No se aplicó ninguna exoneración: '+error.message);
      button.disabled=false;return;
    }
    const host=document.getElementById('officialReliefObligations');
    if(host)host.innerHTML='<div class="notice">Se exoneraron '+safe(data.applied)+' períodos autorizados. Los movimientos quedaron en la bitácora del funcionario y no se sumaron a recaudación.</div>';
    reliefCandidates=[];await loadOverview();
  }
  function exportCSV(){
    imaudClient.rpc('record_staff_activity',{p_action:'report_exported',p_module:'reportes',p_reference:null}).then(({error})=>{if(error)console.warn('Bitácora:',error.message)});
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
    const reject=e.target.closest('[data-official-reject]');if(reject){rejectPendingPayment(reject.dataset.officialReject,reject);return;}
    const apply=e.target.closest('[data-relief-apply]');if(apply){applySelectedRelief(apply);return;}
    const invoice=e.target.closest('[data-official-invoice]');if(invoice){showDocument(invoice.dataset.officialInvoice);return;}
    const pay=e.target.closest('[data-official-liquidate]');if(pay){liquidate(pay.dataset.officialLiquidate,pay);return;}
  });
  document.addEventListener('input',e=>{if(e.target.id==='officialPaySearch')renderPaymentRows();});
  document.addEventListener('change',e=>{if(e.target.id==='reliefSelectAll'){document.querySelectorAll('.relief-month-check').forEach(x=>x.checked=e.target.checked);updateReliefSelection();}if(e.target.matches('.relief-month-check'))updateReliefSelection();if(e.target.id==='officialPayStatus')renderPaymentRows();if(e.target.id==='officialReportPeriod')changeReportPeriod(e.target.form);if(e.target.id==='officialReportGroup')changeReportGrouping(e.target.form);});
  document.addEventListener('submit',e=>{if(e.target.id==='officialFinancialFilter'){e.preventDefault();renderReportRows(e.target);}if(e.target.id==='officialDebtReliefLookup'){e.preventDefault();findReliefObligations(e.target);}});
  window.sitmaudOfficialFinance={
    overviewPlaceholder:()=>metrics,
    loadOverview,
    view(v){return v==='pagos'?paymentView():v==='facturacion'?invoiceView():reportView();},
    async mount(v){
      if(v==='reportes'){const form=document.getElementById('officialFinancialFilter');if(form){changeReportPeriod(form);changeReportGrouping(form);}}
      if(v==='pagos'||v==='reportes')loadOverview();
      if(v==='pagos'){verifyReadiness();loadFinancialPrivileges();}
      await loadPayments();
    }
  };
})();
