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
  const metrics='<section id="financialOverview"><div class="contributors-loading">Consultando indicadores institucionales…</div></section>';
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
    const csv=[cols,...rows].map(r=>r.map(v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
    a.href=url;a.download='SITMAUD-recaudacion-'+territorialGroup+'-'+from+'-'+to+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
  }
  async function loadOverview(){
    const host=document.getElementById('financialOverview');if(!host)return;
    const {data,error}=await imaudClient.rpc('get_official_financial_overview');
    if(!host.isConnected)return;
    if(error){host.innerHTML='<div class="contributors-empty">No se pudieron consultar los indicadores: '+safe(error.message)+'</div>';return;}
    const items=[
      {label:'Por cobrar',icon:'▥',value:'Bs. '+new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(data.amount_to_collect||0)),note:'Saldo registrado de obligaciones pendientes'},
      {label:'Por liquidar',icon:'◷',value:'Bs. '+new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(data.pending_amount||0)),note:(data.pending_count||0)+' operación(es) esperando a Tesorería'},
      {label:'Liquidado hoy',icon:'↗',value:'Bs. '+new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(data.liquidated_today||0)),note:'Ingreso confirmado hoy · hora de Coro'},
      {label:'Liquidado este mes',icon:'▤',value:'Bs. '+new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(data.liquidated_month||0)),note:'Ingreso confirmado durante el mes'},
      {label:'Pagos registrados hoy',icon:'▧',value:String(Number(data.registered_today_count||0)),note:'Operaciones recibidas; no todas están liquidadas'},
      {label:'Pagos liquidados este mes',icon:'✓',value:String(Number(data.liquidated_month_count||0)),note:'Operaciones bancarias confirmadas por Tesorería'}
    ];
    host.classList.add('dashboard-section','financial-dashboard');
    host.innerHTML='<div class="dashboard-section-head"><h2>Control financiero institucional</h2><p>Montos en bolívares · únicamente Tesorería confirma los ingresos</p></div>'+
      '<div class="grid kpis dashboard-kpi-grid financial-kpi-grid">'+items.map(item=>
        '<article class="card kpi home-kpi"><div class="kpi-top"><span>'+safe(item.label)+'</span><span class="kpi-icon">'+safe(item.icon)+'</span></div>'+
        '<div class="kpi-value">'+safe(item.value)+'</div><div class="kpi-note">'+safe(item.note)+'</div></article>'
      ).join('')+'</div>';
  }
  async function loadPayments(){
    if(!document.getElementById('officialPaymentRows')&&!document.getElementById('officialInvoiceRows')&&!document.getElementById('officialReportRows'))return;
    const {data,error}=await imaudClient.from('payments').select('id,receipt_number,amount,currency_code,paid_at,created_at,invoice_issued_at,liquidated_at,payment_method,external_reference,status,registration_channel,evidence_path,bank_code,payment_udc_total,payment_udc_rate_id,rate:udc_rates!payments_payment_udc_rate_id_fkey(effective_date,udc_currency_code,udc_value,source_url),contributor:contributors!payments_contributor_id_fkey(kind,legal_name,first_name,last_name,contract_number,identification_type,identification_number)').order('created_at',{ascending:false}).limit(500);
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
      records.map(p=>'<tr><td>'+safe(fmtDate(p.created_at))+'</td><td><b>'+safe(p.receipt_number)+'</b></td><td>'+safe(contributor(p.contributor))+'</td><td>'+safe(p.external_reference||'—')+'</td><td>'+safe(money(p.amount,p.currency_code))+'</td><td>'+safe(label(p.status))+'</td><td><button class="btn btn-light btn-sm" data-official-invoice="'+safe(p.id)+'">Ver documento</button> '+(p.evidence_path?'<button class="btn btn-light btn-sm" data-treasury-evidence="'+safe(p.id)+'">Ver comprobante</button> ':'')+(p.status==='pending'&&treasuryAllowed?'<button class="btn btn-primary btn-sm" data-official-liquidate="'+safe(p.id)+'">Liquidar (Tesorería)</button> <button class="btn btn-light btn-sm" data-official-reject="'+safe(p.id)+'">Anular registro</button>':'')+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function renderInvoiceRows(){
    const node=document.getElementById('officialInvoiceRows');if(!node)return;
    if(!payments.length){node.innerHTML='<div class="contributors-empty"><b>Sin pagos institucionales registrados.</b><span>Los documentos aparecerán aquí cuando se registren operaciones oficiales.</span></div>';return;}
    node.innerHTML='<div class="payment-debt-scroll"><table><thead><tr><th>Número</th><th>Contribuyente</th><th>Fecha del registro</th><th>Estado</th><th>Monto</th><th></th></tr></thead><tbody>'+
    payments.map(p=>'<tr><td><b>'+safe(p.receipt_number)+'</b></td><td>'+safe(contributor(p.contributor))+'</td><td>'+safe(fmtDate(p.created_at))+'</td><td>'+safe(label(p.status))+'</td><td>'+safe(money(p.amount,p.currency_code))+'</td><td><button class="btn btn-light" data-official-invoice="'+safe(p.id)+'">Consultar</button></td></tr>').join('')+'</tbody></table></div>';
  }
  let reportPage=0,reportPageSize=100,reportData=null,reportQueryId=0;
  async function renderReportRows(form,requestedPage=0){
    const host=document.getElementById('officialReportRows');if(!host||!form)return;
    if(form.elements.group?.value!=='operations'){loadTerritorialReport(form);return;}
    const data=new FormData(form),from=String(data.get('from')||''),to=String(data.get('to')||''),status=String(data.get('status')||'');
    if(!from||!to||from>to){host.innerHTML='<div class="contributors-empty">Selecciona un rango de fechas válido.</div>';return;}
    reportPage=Math.max(0,requestedPage);const request=++reportQueryId;
    host.innerHTML='<div class="contributors-loading">Consultando operaciones oficiales en Supabase…</div>';
    const {data:result,error}=await imaudClient.rpc('get_official_operations_report',{
      p_from:from,p_to:to,p_status:status||null,p_limit:reportPageSize,p_offset:reportPage*reportPageSize
    });
    if(request!==reportQueryId||!host.isConnected||form.elements.group.value!=='operations')return;
    if(error){reportData=null;host.innerHTML='<div class="contributors-empty">No se pudo consultar el reporte: '+safe(error.message)+'</div>';return;}
    reportData={from,to,status,...result};currentReport=result.rows||[];
    const total=Number(result.total_count||0),maxPage=Math.max(1,Math.ceil(total/reportPageSize));
    const stats=result.totals_by_status||{};
    const statsLabels={confirmed:'Liquidados',pending:'Por liquidar',reversed:'Rechazados'};
    const summary=Object.entries(stats).map(([key,x])=>'<span><b>'+safe(statsLabels[key]||key)+':</b> '+safe(x.count)+' · '+safe(money(x.amount_ves,'VES'))+'</span>').join(' · ');
    host.innerHTML='<p><b>'+total.toLocaleString('es-VE')+'</b> operaciones registradas · '+safe(from)+' al '+safe(to)+
      ' (fecha de registro en Coro). <small>Los importes no se suman como recaudación hasta su liquidación.</small></p>'+
      '<p style="font-size:12px;color:#5a7386">'+(summary||'Sin operaciones registradas')+'</p>'+
      (currentReport.length?'<div class="payment-debt-scroll"><table><thead><tr><th>Registro</th><th>N.º</th><th>Contribuyente</th><th>Banco / referencia</th><th>Liquidación</th><th>Estado</th><th>Monto</th></tr></thead><tbody>'+
       currentReport.map(p=>'<tr><td>'+safe(fmtDate(p.created_at))+'</td><td>'+safe(p.receipt_number)+'</td><td>'+safe(p.contributor_name)+'</td><td>'+safe([p.bank_code,p.external_reference].filter(Boolean).join(' / ')||'—')+'</td><td>'+safe(fmtDate(p.liquidated_at))+'</td><td>'+safe(label(p.status))+'</td><td>'+safe(money(p.amount,p.currency_code))+'</td></tr>').join('')+'</tbody></table></div>':
       '<div class="contributors-empty">No existen operaciones oficiales para este período.</div>')+
      '<div class="form-actions"><button class="btn btn-light btn-sm" type="button" data-report-page="prev" '+(reportPage===0?'disabled':'')+'>Anterior</button><span> Página '+(reportPage+1)+' de '+maxPage+' </span><button class="btn btn-light btn-sm" type="button" data-report-page="next" '+(reportPage+1>=maxPage?'disabled':'')+'>Siguiente</button></div>';
  }
  async function verifyReadiness(){
    const node=document.getElementById('officialPaymentReadiness');if(!node)return;
    const [rates,debt]=await Promise.all([
      imaudClient.from('tariff_schedules').select('id',{count:'exact',head:true}).eq('is_approved',true),
      imaudClient.from('assessments').select('id',{count:'exact',head:true}).eq('is_demo',false).in('status',['pending','partially_paid'])
    ]);
    if(rates.error||debt.error){node.textContent='No se pudo verificar la disponibilidad de obligaciones y tarifas. Comprueba tus permisos.';return;}
    if(!rates.count||!debt.count){node.innerHTML='<p><b>Registro de pagos no habilitado:</b> todavía no hay obligaciones oficiales exigibles con tabulador aprobado. No se emitirán cobros sin respaldo normativo.</p>';return;}
    node.innerHTML='<p>Existen obligaciones oficiales. Utiliza el formulario «Registrar pago bancario oficial» para seleccionar meses, calcular la UCD a la tasa del día y adjuntar el comprobante. La operación quedará pendiente hasta la validación de Tesorería.</p>';
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
    if(!allocations?.length||allocations.some(a=>!a.assessment||a.assessment.is_demo)||(!preview&&Math.abs(allocations.reduce((sum,a)=>sum+Number(a.amount||0),0)-Number(p.amount||0))>0.01)){
      host.innerHTML='<div class="contributors-empty"><b>No se puede emitir este recibo.</b><span>El pago no tiene aplicaciones a obligaciones oficiales verificables.</span></div>';
      return;
    }
    const isVES=p.currency_code==='VES';
    const doc=window.sitmaudOfficialReceipt.render({payment:p,allocations,preview});
    host.style.cssText='';host.innerHTML=doc;
    if(preview){print.disabled=true;return;}
    if(!isVES){
      host.insertAdjacentHTML('beforeend','<div class="notice" style="margin-top:12px">No se puede imprimir un recibo con monto en bolívares: el registro está en '+safe(p.currency_code)+'. Debe existir una conversión institucional documentada.</div>');
      return;
    }
    // A reversed transaction or an unverified confirmation is never printable as proof of a settled payment.
    if(p.status==='reversed'||(p.status==='confirmed'&&!p.liquidated_at)){
      print.disabled=true;
      host.insertAdjacentHTML('beforeend','<div class="notice">Documento no imprimible como pago: operación reversada o sin liquidación verificable.</div>');
      return;
    }
    print.disabled=false;
  }
  // Un comprobante privado se consulta por enlace temporal; no se publica una URL permanente.
  async function openTreasuryEvidence(id,button){
    const p=payments.find(x=>x.id===id);
    if(!p?.evidence_path)return;
    button.disabled=true;
    try{
      const {data,error}=await imaudClient.storage.from('imaud-payment-proofs').createSignedUrl(p.evidence_path,60);
      if(error||!data?.signedUrl)throw error||new Error('Comprobante no disponible');
      window.open(data.signedUrl,'_blank','noopener,noreferrer');
      imaudClient.rpc('record_staff_activity',{p_action:'payment_proof_viewed',p_module:'tesoreria',p_reference:id})
        .then(({error})=>{if(error)console.warn('Bitácora:',error.message)});
    }catch(e){window.alert('No se pudo abrir el comprobante privado: '+(e.message||'Permiso insuficiente'))}
    finally{button.disabled=false}
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
    let rows=assessment.data||[];
    if(rows.length){
      const grants=await imaudClient.from('debt_relief_grants').select('assessment_id').in('assessment_id',rows.map(x=>x.id));
      if(grants.error){node.textContent='No fue posible verificar exoneraciones anteriores: '+grants.error.message;return;}
      const handled=new Set((grants.data||[]).map(x=>x.assessment_id));
      rows=rows.filter(x=>!handled.has(x.id));
    }
    if(!rows.length){node.textContent='Este contribuyente no tiene meses disponibles para exonerar; los períodos ya tratados conservan su registro de auditoría.';return;}
    reliefCandidates=rows;
    const addresses=new Map(properties.data.map(p=>[p.id,p.address]));
    node.innerHTML='<div class="panel-head"><div><h3>Meses pendientes · '+safe(contributor(c))+'</h3><p>Contrato '+safe(c.contract_number||'—')+' · selecciona uno, varios o todos los períodos.</p></div></div>'+
       '<div class="payment-debt-scroll"><table><thead><tr><th><input id="reliefSelectAll" type="checkbox" aria-label="Seleccionar todos los meses"></th><th>Mes</th><th>Inmueble</th><th>Saldo original</th><th>Estado</th></tr></thead><tbody>'+
       rows.map(x=>'<tr><td><input class="relief-month-check" type="checkbox" value="'+safe(x.id)+'" aria-label="Exonerar '+safe(x.period_start)+'"></td><td><b>'+safe(x.period_start)+'</b></td><td>'+safe(addresses.get(x.property_id)||'Cuenta matriz')+'</td><td>'+safe(money(x.total_amount,'VES'))+'</td><td>'+safe(x.status)+'</td></tr>').join('')+
       '</tbody></table></div><p class="panel-hint">Solo funcionarios con el permiso «Exonerar deudas» pueden exonerar los meses seleccionados. El motivo y cada operación quedarán exclusivamente en la bitácora; nunca se contabilizarán como recaudación.</p>'+
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
    const reason=window.prompt('Fundamento de exoneración de los '+ids.length+' mes(es) seleccionados (12 caracteres mínimo). El movimiento quedará únicamente en la bitácora:','');
    if(reason===null)return;
    if(reason.trim().length<12||reason.trim().length>500){window.alert('Indica el fundamento (12 a 500 caracteres).');return;}
    if(!window.confirm('¿Confirmas la exoneración DIRECTA de '+ids.length+' período(s)? Solo se exonerará el saldo pendiente; se conservarán pagos previos y se registrará la operación en la bitácora.'))return;
    button.disabled=true;
    const {data,error}=await imaudClient.rpc('exonerate_official_assessments',{p_assessment_ids:ids,p_reason:reason.trim()});
    if(error){
      window.alert('No se aplicó ninguna exoneración: '+error.message);
      button.disabled=false;return;
    }
    const host=document.getElementById('officialReliefObligations');
    if(host)host.innerHTML='<div class="notice">Se exoneraron '+safe(data.applied)+' períodos. Los movimientos están en la bitácora del funcionario y no se sumaron a recaudación.</div>';
    reliefCandidates=[];await loadOverview();
  }
  async function exportCSV(){
    const form=document.getElementById('officialFinancialFilter');if(!form)return;
    if(form.elements.group.value!=='operations'){exportTerritorialReport();return;}
    if(!reportData){window.alert('Consulta primero el reporte oficial.');return;}
    const frozen={from:reportData.from,to:reportData.to,status:reportData.status||null,
       total:Number(reportData.total_count||0)};
    if(frozen.total>10000){window.alert('El reporte contiene más de 10.000 operaciones. Divide el rango de fechas antes de exportar para evitar archivos incompletos.');return;}
    const fields=['N.º comprobante','Contribuyente','Identificación','Contrato','Fecha registro','Fecha liquidación','Banco','Referencia','Método','Estado','Moneda','Monto Bs.','Monto UCD','Fecha BCV','Fuente BCV'];
    const rows=[];const button=document.querySelector('[data-official-action="export"]');if(button)button.disabled=true;
    try{
      for(let offset=0;offset<frozen.total;offset+=250){
        const {data,error}=await imaudClient.rpc('get_official_operations_report',{
          p_from:frozen.from,p_to:frozen.to,p_status:frozen.status,p_limit:250,p_offset:offset
        });
        if(error)throw error;
        const items=data?.rows||[];
        if(!items.length||Number(data.total_count)!==frozen.total)throw Error('El conjunto de registros cambió durante la exportación. Vuelve a consultar.');
        for(const p of items)rows.push([p.receipt_number,p.contributor_name,p.identification,p.contract_number,
          fmtDate(p.created_at),fmtDate(p.liquidated_at),p.bank_code,p.external_reference,p.payment_method,
          label(p.status),p.currency_code,p.amount,p.udc_total,p.rate_effective_date,p.rate_source]);
      }
      if(rows.length!==frozen.total)throw Error('La exportación quedó incompleta. Se ha cancelado.');
      const csv=[fields,...rows].map(r=>r.map(v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
      const a=document.createElement('a'),url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
      a.href=url;a.download='SITMAUD-operaciones-'+frozen.from+'-'+frozen.to+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
      imaudClient.rpc('record_staff_activity',{p_action:'report_exported',p_module:'reportes',p_reference:frozen.from+'_'+frozen.to})
        .then(({error})=>{if(error)console.warn('Bitácora:',error.message)});
    }catch(error){window.alert('No se exportó el reporte: '+(error.message||'Error de consulta'));}
    finally{if(button?.isConnected)button.disabled=false;}
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
    const reportPageBtn=e.target.closest('[data-report-page]');
    if(reportPageBtn){const form=document.getElementById('officialFinancialFilter');if(form)renderReportRows(form,reportPage+(reportPageBtn.dataset.reportPage==='next'?1:-1));return;}
    const evidence=e.target.closest('[data-treasury-evidence]');if(evidence){openTreasuryEvidence(evidence.dataset.treasuryEvidence,evidence);return;}
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
      if(v==='reportes'){const form=document.getElementById('officialFinancialFilter');if(form){changeReportPeriod(form);changeReportGrouping(form);renderReportRows(form);}}
      if(v==='pagos'||v==='reportes')loadOverview();
      if(v==='pagos'){verifyReadiness();loadFinancialPrivileges();}
      await loadPayments();
    }
  };
})();
