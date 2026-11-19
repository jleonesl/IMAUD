/* SITMAUD · Gestión de puntos de venta y conciliación por terminal */
(function(){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
 const fmt=n=>new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0));
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const before=n=>{const d=new Date();d.setDate(d.getDate()-n);return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);};
 let latest=null,manage=false,canReport=false;
 function view(){
  return '<div class="page-head"><div><div class="eyebrow">SITMAUD · CONTROL FINANCIERO</div><h1>Puntos de venta</h1><p>Registro de terminales municipales, operaciones por dispositivo y conciliación de Tesorería.</p></div></div>'+
  '<section class="card panel"><div class="panel-head"><h3>Resumen de terminales</h3><span class="status">Operaciones oficiales</span></div><div class="grid kpis" id="posKpis"><div>Consultando permisos y operaciones…</div></div></section>'+
  '<section class="card panel" id="posAdmin" hidden><div class="panel-head"><h3>Registrar punto de venta</h3><span class="status">Solo usuarios autorizados</span></div>'+
  '<form id="posRegisterForm"><div class="form-grid"><div class="field"><label>Código del terminal *</label><input name="terminal_code" maxlength="60" required placeholder="Código físico del equipo"></div>'+
  '<div class="field"><label>Nombre identificador *</label><input name="name" maxlength="120" required placeholder="Ej. Taquilla principal 1"></div>'+
  '<div class="field"><label>Banco adquirente *</label><select name="bank_code" id="posBank" required><option value="">Consultando bancos…</option></select></div>'+
  '<div class="field"><label>Ubicación *</label><input name="location" required placeholder="Oficina o taquilla"></div>'+
  '<div class="field"><label>Observaciones</label><input name="notes" maxlength="255" placeholder="Identificación interna del equipo"></div></div>'+
  '<button type="submit" class="btn btn-primary">Guardar punto de venta</button></form></section>'+
  '<section class="card panel"><div class="panel-head"><h3>Reporte por punto de venta</h3><span class="status">Fecha de Venezuela</span></div>'+
  '<form id="posReportForm"><div class="form-grid"><div class="field"><label>Desde</label><input type="date" name="from" id="posFrom" required></div><div class="field"><label>Hasta</label><input type="date" name="to" id="posTo" required></div></div><div class="form-actions"><button type="submit" class="btn btn-primary">Consultar reporte</button><button type="button" class="btn btn-light" id="posExport" disabled>Descargar CSV</button></div></form>'+
  '<p class="panel-hint" id="posMessage">Las cifras corresponden a pagos oficiales asociados al terminal. Registrados, pendientes, validados y rechazados se muestran por separado.</p>'+
  '<div id="posTerminalRows" class="payment-debt-scroll"></div><h3>Movimientos</h3><div id="posMovementRows" class="payment-debt-scroll"></div></section>';
 }
 function statusLabel(s){return ({pending:'Por validar',confirmed:'Validado',reversed:'Rechazado'})[s]||s||'—';}
 function draw(data){
  latest=data;
  const terminals=data.terminals||[],transactions=data.transactions||[];
  const total=(key)=>terminals.reduce((sum,t)=>sum+Number(t[key]||0),0);
  const kpis=[['Terminales registrados',terminals.length],['Cobros registrados',total('registered_count')],['Por validar','Bs. '+fmt(total('pending_bs'))],['Validado','Bs. '+fmt(total('validated_bs'))]];
  document.getElementById('posKpis').innerHTML=kpis.map(([k,v])=>'<article class="card kpi"><div class="kpi-top"><span>'+esc(k)+'</span></div><div class="kpi-value">'+esc(v)+'</div></article>').join('');
  document.getElementById('posTerminalRows').innerHTML='<table><thead><tr><th>Código</th><th>Terminal</th><th>Banco</th><th>Ubicación</th><th>Estado</th><th>Operaciones</th><th>Registrado (Bs.)</th><th>Pendiente (Bs.)</th><th>Validado (Bs.)</th><th>Rechazado (Bs.)</th><th>Acciones</th></tr></thead><tbody>'+
  (terminals.length?terminals.map(t=>'<tr><td>'+esc(t.code)+'</td><td>'+esc(t.name)+'</td><td>'+esc(t.bank_code)+'</td><td>'+esc(t.location)+'</td><td>'+(t.active?'Activo':'Inactivo')+'</td><td>'+esc(t.registered_count)+'</td><td>'+fmt(t.registered_bs)+'</td><td>'+fmt(t.pending_bs)+'</td><td>'+fmt(t.validated_bs)+'</td><td>'+fmt(t.rejected_bs)+'</td><td>'+(manage?'<button type="button" class="btn btn-light btn-sm" data-pos-toggle="'+esc(t.id)+'" data-pos-active="'+String(t.active)+'">'+(t.active?'Desactivar':'Activar')+'</button>':'—')+'</td></tr>').join(''):'<tr><td colspan="11">Aún no hay terminales registrados.</td></tr>')+'</tbody></table>';
  document.getElementById('posMovementRows').innerHTML='<table><thead><tr><th>Fecha</th><th>Punto</th><th>Factura</th><th>Recaudador</th><th>Referencia</th><th>Monto (Bs.)</th><th>Tesorería</th></tr></thead><tbody>'+
  (transactions.length?transactions.map(t=>'<tr><td>'+esc(new Date(t.paid_at).toLocaleString('es-VE',{timeZone:'America/Caracas'}))+'</td><td>'+esc(t.terminal_code)+'</td><td>'+esc(t.receipt_number)+'</td><td>'+esc(t.cashier)+'</td><td>'+esc(t.reference)+'</td><td>'+fmt(t.amount_bs)+'</td><td>'+esc(statusLabel(t.status))+'</td></tr>').join(''):'<tr><td colspan="7">No hay movimientos para las fechas seleccionadas.</td></tr>')+'</tbody></table>';
  document.getElementById('posExport').disabled=!canReport;
  document.getElementById('posMessage').textContent='Período: '+data.from+' a '+data.to+' · '+transactions.length+' operaciones de puntos de venta.';
 }
 async function report(){
  const form=document.getElementById('posReportForm');if(!form)return;
  const from=form.elements.from.value,to=form.elements.to.value;
  if(!from||!to||from>to){document.getElementById('posMessage').textContent='Selecciona un rango válido.';return;}
  const res=await imaudClient.rpc('get_pos_terminal_report',{p_from:from,p_to:to});
  if(res.error){document.getElementById('posMessage').textContent='No se pudo consultar: '+res.error.message;return;}
  draw(res.data);
 }
 async function mount(){
  const can=await Promise.all([
    imaudClient.rpc('has_permission',{permission_code:'settings.manage'}),
    imaudClient.rpc('has_permission',{permission_code:'reports.read'})
  ]);
  manage=can[0].data===true&&!can[0].error;
  canReport=(can[1].data===true&&!can[1].error)||manage;
  if(!canReport){document.getElementById('posKpis').textContent='Sin permiso de consultar reportes.';document.getElementById('posReportForm').hidden=true;return;}
  const from=document.getElementById('posFrom'),to=document.getElementById('posTo');
  from.value=before(30);to.value=today();
  const admin=document.getElementById('posAdmin');admin.hidden=!manage;
  if(manage){
   const r=await imaudClient.from('payment_banks').select('code,name').eq('is_active',true).order('name');
   document.getElementById('posBank').innerHTML='<option value="">Seleccione banco</option>'+((r.data||[]).map(b=>'<option value="'+esc(b.code)+'">'+esc(b.name)+'</option>').join(''));
  }
  await report();
 }
 function csvCell(value){return '"'+String(value??'').replace(/"/g,'""')+'"';}
 function exportCsv(){
  if(!latest||!canReport)return;
  const t=latest.terminals||[],tx=latest.transactions||[];
  const records=[
   ['Reporte SITMAUD por punto de venta',latest.from,latest.to],
   ['Codigo','Nombre','Banco','Ubicacion','Activo','Operaciones','Registrado Bs','Pendiente Bs','Validado Bs','Rechazado Bs'],
   ...t.map(x=>[x.code,x.name,x.bank_code,x.location,x.active?'Si':'No',x.registered_count,x.registered_bs,x.pending_bs,x.validated_bs,x.rejected_bs]),
   [],['Movimientos'],['Fecha','Terminal','Factura','Recaudador','Referencia','Monto Bs','Estado Tesoreria'],
   ...tx.map(x=>[x.paid_at,x.terminal_code,x.receipt_number,x.cashier,x.reference,x.amount_bs,statusLabel(x.status)])
  ];
  const content='\ufeff'+records.map(x=>x.map(csvCell).join(';')).join('\r\n');
  const blob=new Blob([content],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='SITMAUD-puntos-de-venta-'+latest.from+'-'+latest.to+'.csv';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 document.addEventListener('submit',async e=>{
  if(e.target.id==='posReportForm'){e.preventDefault();await report();}
  if(e.target.id==='posRegisterForm'){
   e.preventDefault();if(!manage)return;
   const f=e.target,button=f.querySelector('[type=submit]');button.disabled=true;
   const payload={terminal_code:f.elements.terminal_code.value.trim(),name:f.elements.name.value.trim(),bank_code:f.elements.bank_code.value,location:f.elements.location.value.trim(),notes:f.elements.notes.value.trim()||null};
   const {error}=await imaudClient.from('pos_terminals').insert(payload);
   button.disabled=false;
   if(error){window.alert('No se pudo registrar el punto: '+error.message);return;}
   f.reset();await report();window.alert('Punto de venta registrado correctamente.');
  }
 });
 document.addEventListener('click',async e=>{
  if(e.target.id==='posExport')exportCsv();
  const button=e.target.closest('[data-pos-toggle]');if(!button||!manage)return;
  const active=button.dataset.posActive!=='true';
  if(!window.confirm((active?'¿Activar':'¿Desactivar')+' este punto de venta? Los cobros históricos permanecerán asociados.'))return;
  button.disabled=true;
  const result=await imaudClient.from('pos_terminals').update({is_active:active,updated_at:new Date().toISOString()}).eq('id',button.dataset.posToggle);
  if(result.error){window.alert('No se pudo cambiar el estado: '+result.error.message);button.disabled=false;return;}
  await report();
 });
 window.sitmaudPosTerminals={view,mount};
})();