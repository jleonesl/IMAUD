const state={view:'inicio',people:[],payments:[{ref:'DEMO-00031',person:'María Fernanda Rojas',period:'Noviembre 2026',amount:'3,00',date:'11/11/2026',status:'Registrado'},{ref:'DEMO-00030',person:'José Antonio Acosta',period:'Noviembre 2026',amount:'1,50',date:'10/11/2026',status:'Registrado'}],staff:[]};
const $=s=>document.querySelector(s);const money=n=>new Intl.NumberFormat('es-VE',{minimumFractionDigits:2}).format(n);
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
const titleMap={inicio:'Inicio',contribuyentes:'Contribuyentes',inmuebles:'Inmuebles',organizaciones:'Organizaciones residenciales',pagos:'Recaudación y pagos',facturacion:'Facturación',reportes:'Reportes',mapa:'Mapa territorial',ordenanza:'Ordenanza y tarifas',funcionarios:'Funcionarios y permisos',bitacora:'Bitácora'};
function head(title,sub,action=''){return `<div class="page-head"><div><div class="eyebrow">SITMAUD · GESTIÓN MUNICIPAL</div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`}
function table(headers,rows){return `<div class="card table-card"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`}
function dashboard(){
  const metrics=[
    {key:'contributors_total',label:'Total de contribuyentes',icon:'♙',note:'Personas y organizaciones registradas'},
    {key:'properties_total',label:'Total de inmuebles',icon:'⌂',note:'Inmuebles activos registrados'},
    {key:'payments_total',label:'Pagos registrados',icon:'▧',note:'Total histórico de operaciones'},
    {key:'payments_today',label:'Pagos registrados hoy',icon:'◷',note:'Operaciones creadas durante el día'},
    {key:'revenue_today',label:'Recaudación del día',icon:'↗',note:'Pagos confirmados hoy · hora local de Coro'},
    {key:'revenue_total',label:'Recaudación total',icon:'▤',note:'Acumulado de pagos confirmados'},
    {key:'debts_pending',label:'Deudas pendientes',icon:'!',note:'Obligaciones pendientes o parcialmente pagadas'},
    {key:'certificates_total',label:'Certificados de solvencia emitidos',icon:'▣',note:'Indicador pendiente de habilitar el módulo'}
  ];
  return head('Indicadores generales','Resumen de los principales datos de SITMAUD.')+
    '<div class="grid kpis home-indicators">'+metrics.map(m=>`
      <article class="card kpi home-kpi">
        <div class="kpi-top"><span>${m.label}</span><span class="kpi-icon">${m.icon}</span></div>
        <div class="kpi-value" data-metric-value="${m.key}">—</div>
        <div class="kpi-note" data-metric-note="${m.key}">${m.note}</div>
      </article>`).join('')+'</div>';
}
function formatDashboardCount(value){
  return new Intl.NumberFormat('es-VE',{maximumFractionDigits:0}).format(Number(value||0));
}
function formatDashboardMoney(value){
  return new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0));
}
function formatDashboardCurrencyMap(map){
  const entries=Object.entries(map||{}).filter(([,amount])=>Number(amount)!==0);
  if(!entries.length) return '0,00';
  return entries.map(([currency,amount])=>{
    const code=String(currency||'').toUpperCase();
    const prefix=code==='VES'?'Bs. ':code==='USD'?'$ ':code+' ';
    return prefix+formatDashboardMoney(amount);
  }).join(' · ');
}
async function loadDashboardMetrics(){
  if(state.view!=='inicio'||!document.body.classList.contains('sitmaud-authenticated')) return;
  const values=document.querySelectorAll('[data-metric-value]');
  values.forEach(el=>{el.textContent='…';});
  const {data,error}=await imaudClient.rpc('get_dashboard_metrics');
  if(state.view!=='inicio') return;
  if(error||!data){
    values.forEach(el=>{el.textContent='No disponible';});
    document.querySelectorAll('[data-metric-note]').forEach(el=>{el.textContent='No se pudo consultar la base de datos. Verifica los permisos del Dashboard.';});
    console.error('SITMAUD dashboard metrics:',error);
    return;
  }
  const countKeys=['contributors_total','properties_total','payments_total','payments_today','debts_pending'];
  countKeys.forEach(key=>{
    const el=document.querySelector('[data-metric-value="'+key+'"]');
    if(el) el.textContent=formatDashboardCount(data[key]);
  });
  ['revenue_today','revenue_total'].forEach(key=>{
    const el=document.querySelector('[data-metric-value="'+key+'"]');
    if(el) el.textContent=formatDashboardCurrencyMap(data[key]);
  });
  const certificateValue=document.querySelector('[data-metric-value="certificates_total"]');
  const certificateNote=document.querySelector('[data-metric-note="certificates_total"]');
  if(certificateValue) certificateValue.textContent=data.certificates_configured?formatDashboardCount(data.certificates_total):'Pendiente';
  if(certificateNote) certificateNote.textContent=data.certificates_configured?'Total histórico de certificados emitidos':'El módulo de certificados aún no está creado';
}

function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function contributorName(p){return p.kind==='juridico'?(p.legal_name||'Sin razón social'):[p.first_name,p.last_name].filter(Boolean).join(' ')||p.legal_name||'Sin nombre';}
function contributorType(kind){return ({natural_venezolano:'Persona natural',natural_extranjero:'Persona extranjera',juridico:'Persona jurídica'})[kind]||kind||'—';}
function listPeople(){
 return head('Gestión de contribuyentes','Administración, consulta y registro de personas y organizaciones inscritas en el sistema.','<button class="btn btn-primary" data-action="new-person">＋ Nuevo contribuyente</button>')+
 '<div class="contributors-toolbar card"><input class="search" id="personSearch" placeholder="⌕  Buscar por nombre, cédula o RIF"><select id="typeFilter" class="filter-select"><option value="">Tipo de contribuyente · Todos</option><option value="natural_venezolano">Persona natural</option><option value="natural_extranjero">Persona extranjera</option><option value="juridico">Persona jurídica</option></select><select id="statusFilter" class="filter-select"><option value="">Estado · Todos</option><option value="con inmueble">Con inmueble</option><option value="sin inmueble">Sin inmueble</option></select><select id="parishFilter" class="filter-select"><option value="">Parroquia · Todas</option></select></div>'+
 '<div class="contributors-layout"><section class="card contributors-table-card"><div class="table-toolbar"><div><h3>Directorio de contribuyentes</h3><p>Registros guardados en SITMAUD</p></div><span id="contributorsCount" class="table-count">Cargando…</span></div><div id="peopleTable" class="contributors-table-wrap"><div class="contributors-loading">Consultando contribuyentes…</div></div></section><aside class="contributors-stats"><article class="card contributor-stat"><span class="stat-icon">♙</span><small>Total contribuyentes</small><strong id="statTotal">—</strong></article><article class="card contributor-stat"><span class="stat-icon blue">♟</span><small>Personas naturales</small><strong id="statNatural">—</strong></article><article class="card contributor-stat"><span class="stat-icon violet">▦</span><small>Personas jurídicas</small><strong id="statLegal">—</strong></article><article class="card contributor-stat"><span class="stat-icon green">✓</span><small>Con correo registrado</small><strong id="statEmail">—</strong></article></aside></div>';
}
function peopleTable(rows=state.people){
 if(!rows.length)return '<div class="contributors-empty"><b>No hay contribuyentes registrados</b><span>Utiliza «Nuevo contribuyente» para crear el primer expediente.</span></div>';
 return '<table><thead><tr><th>Contribuyente</th><th>Cédula / RIF</th><th>Tipo</th><th>Inmuebles</th><th>Correo</th><th>Estado</th></tr></thead><tbody>'+rows.map(p=>{const count=(p.properties||[]).length;const status=count?'Con inmueble':'Sin inmueble';return '<tr><td><strong>'+escapeHTML(contributorName(p))+'</strong></td><td>'+escapeHTML((p.identification_type||'')+'-'+(p.identification_number||''))+'</td><td><span class="type-pill">'+escapeHTML(contributorType(p.kind))+'</span></td><td>'+count+'</td><td>'+escapeHTML(p.email||'—')+'</td><td><span class="status '+(count?'':'pending')+'">'+status+'</span></td></tr>'}).join('')+'</tbody></table>';
}
async function loadContributors(){
 const target=document.getElementById('peopleTable'); if(!target)return;
 target.innerHTML='<div class="contributors-loading">Consultando contribuyentes…</div>';
 const {data,error}=await imaudClient.from('contributors').select('id,kind,identification_type,identification_number,legal_name,first_name,last_name,email,phone,contact_address,is_property_owner,created_at,properties(id,contract_number,is_active,parish_name,sector_name)').order('created_at',{ascending:false});
 if(state.view!=='contribuyentes')return;
 if(error){console.error('SITMAUD contributors:',error);target.innerHTML='<div class="contributors-empty"><b>No se pudieron cargar los contribuyentes</b><span>Verifica que tu usuario tenga permiso de consulta y vuelve a intentarlo.</span></div>';return;}
 state.people=data||[];
 document.getElementById('statTotal').textContent=state.people.length.toLocaleString('es-VE');
 document.getElementById('statNatural').textContent=state.people.filter(p=>p.kind!=='juridico').length.toLocaleString('es-VE');
 document.getElementById('statLegal').textContent=state.people.filter(p=>p.kind==='juridico').length.toLocaleString('es-VE');
 document.getElementById('statEmail').textContent=state.people.filter(p=>p.email).length.toLocaleString('es-VE');
 const parishSelect=document.getElementById('parishFilter');
 [...new Set(state.people.flatMap(p=>(p.properties||[]).map(x=>x.parish_name).filter(Boolean)))].sort().forEach(name=>parishSelect.add(new Option(name,name)));
 filterContributors();
}
function filterContributors(){
 const q=(document.getElementById('personSearch')?.value||'').toLowerCase();
 const type=document.getElementById('typeFilter')?.value||'';
 const status=document.getElementById('statusFilter')?.value||'';
 const parish=document.getElementById('parishFilter')?.value||'';
 const rows=state.people.filter(p=>{
  const text=[contributorName(p),p.identification_type,p.identification_number,p.rif,p.email].join(' ').toLowerCase();
  const hasProperty=(p.properties||[]).length>0;
  return (!q||text.includes(q))&&(!type||p.kind===type)&&(!status||(status==='con inmueble'?hasProperty:!hasProperty))&&(!parish||(p.properties||[]).some(x=>x.parish_name===parish));
 });
 const target=document.getElementById('peopleTable');if(target)target.innerHTML=peopleTable(rows);
 const count=document.getElementById('contributorsCount');if(count)count.textContent='Mostrando '+rows.length+' de '+state.people.length;
}
function contributorModal(){
 return '<div class="contributor-modal-backdrop" id="contributorModal"><section class="contributor-modal" role="dialog" aria-modal="true" aria-labelledby="contributorModalTitle"><header class="contributor-modal-head"><div class="modal-heading-icon">＋</div><div><h2 id="contributorModalTitle">Nuevo contribuyente</h2><p>Registra al contribuyente y luego agrega el inmueble asociado.</p></div><button type="button" class="modal-close" data-action="close-contributor-modal" aria-label="Cerrar">×</button></header><div class="registration-steps"><div class="registration-step active" id="stepContributor"><b>1</b><span><strong>Registrar contribuyente</strong><small>Completa sus datos</small></span></div><div class="registration-step" id="stepProperty"><b>2</b><span><strong>Registrar inmueble</strong><small>Asigna contrato y dirección</small></span></div></div><div class="registration-columns"><section class="registration-panel"><h3>♙ Registrar contribuyente</h3><p class="panel-hint">Información de la persona u organización responsable.</p><form id="personForm"><div class="form-grid"><div class="field"><label>Tipo de contribuyente *</label><select name="kind" required><option value="natural_venezolano">Persona natural</option><option value="natural_extranjero">Persona extranjera</option><option value="juridico">Persona jurídica</option></select></div><div class="field"><label>Tipo de identificación *</label><select name="identification_type" required><option value="V">V</option><option value="E">E</option><option value="J">J</option><option value="G">G</option><option value="P">P</option></select></div><div class="field"><label>Cédula / RIF *</label><input name="identification_number" required placeholder="Número de identificación"></div><div class="field"><label>Nombre y apellido / Razón social *</label><input name="name" required placeholder="Nombre completo o razón social"></div><div class="field"><label>Correo electrónico</label><input type="email" name="email" placeholder="correo@ejemplo.com"></div><div class="field"><label>Teléfono</label><input name="phone" placeholder="+58"></div><div class="field full"><label>Dirección de contacto</label><textarea name="contact_address" rows="2" placeholder="Dirección de residencia o domicilio fiscal"></textarea></div><div class="field"><label>¿Es propietario?</label><select name="is_property_owner"><option value="true">Sí</option><option value="false">No</option></select></div></div><div class="form-actions"><button class="btn btn-primary" id="saveContributorButton">Guardar contribuyente</button></div></form><div class="saved-contributor-note" id="savedContributorNote" hidden></div></section><section class="registration-panel property-panel" id="propertyPanel"><div class="property-lock" id="propertyLock"><span>2</span><b>Primero guarda los datos del contribuyente para habilitar este formulario.</b></div><div id="propertyFormWrap" hidden><h3>⌂ Registrar inmueble</h3><p class="panel-hint">El inmueble quedará vinculado al contribuyente recién creado.</p><div class="contract-preview" id="contractPreview"><small>N.º de contrato asignado al guardar</small><strong>Se generará automáticamente</strong></div><div class="linked-contributor" id="linkedContributor"></div><form id="propertyForm"><div class="form-grid"><div class="field full"><label>Dirección del inmueble *</label><textarea name="address" rows="2" required placeholder="Avenida, calle, número, urbanización"></textarea></div><div class="field"><label>Parroquia</label><input name="parish_name" placeholder="Parroquia"></div><div class="field"><label>Sector</label><input name="sector_name" placeholder="Sector o comunidad"></div><div class="field"><label>Tipo de inmueble *</label><select name="property_type" required><option value="casa">Casa</option><option value="apartamento">Apartamento</option><option value="local">Local comercial</option><option value="edificio">Edificio</option><option value="terreno">Terreno</option><option value="unidad_residencial">Unidad residencial</option></select></div><div class="field"><label>Uso *</label><select name="property_use" required><option value="residencial">Residencial</option><option value="comercial">Comercial</option><option value="mixto">Mixto</option><option value="institucional">Institucional</option></select></div><div class="field"><label>Organización residencial (opcional)</label><input name="organization_name" placeholder="Condominio, villa o urbanización"></div><div class="field"><label>Referencia</label><input name="reference" placeholder="Punto de referencia"></div><div class="field"><label>Código catastral (opcional)</label><input name="cadastral_code" placeholder="Código catastral"></div><div class="field full"><label>Observaciones</label><textarea name="notes" rows="2" placeholder="Información adicional del inmueble"></textarea></div></div><div class="form-actions"><button type="button" class="btn btn-light" data-action="close-contributor-modal">Volver a contribuyentes</button><button class="btn btn-primary" id="savePropertyButton">Registrar inmueble</button></div></form><div class="property-success" id="propertySuccess" hidden></div></div></section></div></section></div>';
}
function openContributorModal(){
 if(!document.getElementById('contributorModal'))document.body.insertAdjacentHTML('beforeend',contributorModal());
 const modal=document.getElementById('contributorModal');modal.classList.add('open');document.body.classList.add('modal-open');
}
function closeContributorModal(){
 document.getElementById('contributorModal')?.remove();document.body.classList.remove('modal-open');loadContributors();
}
async function saveContributor(form){
 const f=new FormData(form);const kind=f.get('kind');const fullName=String(f.get('name')||'').trim();const parts=fullName.split(/\s+/);
 const {data:{user}}=await imaudClient.auth.getUser();
 const payload={kind,identification_type:f.get('identification_type'),identification_number:String(f.get('identification_number')).trim(),email:String(f.get('email')||'').trim()||null,phone:String(f.get('phone')||'').trim()||null,contact_address:String(f.get('contact_address')||'').trim()||null,is_property_owner:f.get('is_property_owner')==='true',created_by:user?.id||null};
 if(kind==='juridico'){payload.legal_name=fullName;payload.rif=payload.identification_number;}else{payload.first_name=parts.shift()||fullName;payload.last_name=parts.join(' ');}
 const button=document.getElementById('saveContributorButton');button.disabled=true;button.textContent='Guardando…';
 const {data,error}=await imaudClient.from('contributors').insert(payload).select('id,kind,identification_type,identification_number,legal_name,first_name,last_name').single();
 button.disabled=false;button.textContent='Guardar contribuyente';
 if(error){console.error(error);toast('No se pudo guardar el contribuyente: '+error.message);return;}
 state.currentContributor=data;
 document.getElementById('stepContributor').classList.add('complete');document.getElementById('stepProperty').classList.add('active');
 document.getElementById('personForm').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);
 document.getElementById('savedContributorNote').hidden=false;document.getElementById('savedContributorNote').textContent='Contribuyente guardado correctamente. Ahora registra su inmueble.';
 document.getElementById('propertyLock').hidden=true;document.getElementById('propertyFormWrap').hidden=false;
 document.getElementById('linkedContributor').textContent='Contribuyente vinculado: '+contributorName(data)+' · '+data.identification_type+'-'+data.identification_number;
 toast('Contribuyente guardado. Continúa con el inmueble.');
}
async function saveProperty(form){
 const f=new FormData(form);const contributor=state.currentContributor;if(!contributor){toast('Primero debes guardar el contribuyente.');return;}
 const button=document.getElementById('savePropertyButton');button.disabled=true;button.textContent='Registrando…';
 const payload={contributor_id:contributor.id,address:String(f.get('address')).trim(),property_type:f.get('property_type'),property_use:f.get('property_use'),parish_name:String(f.get('parish_name')||'').trim()||null,sector_name:String(f.get('sector_name')||'').trim()||null,organization_name:String(f.get('organization_name')||'').trim()||null,reference:String(f.get('reference')||'').trim()||null,cadastral_code:String(f.get('cadastral_code')||'').trim()||null,notes:String(f.get('notes')||'').trim()||null,is_active:true};
 const {data,error}=await imaudClient.from('properties').insert(payload).select('id,contract_number').single();
 button.disabled=false;button.textContent='Registrar inmueble';
 if(error){console.error(error);toast('No se pudo registrar el inmueble: '+error.message);return;}
 const relation=await imaudClient.from('property_relationships').insert({property_id:data.id,contributor_id:contributor.id,relationship_role:'propietario',is_current:true,is_payment_responsible:true});
 if(relation.error){console.error('Relación de inmueble:',relation.error);toast('Inmueble creado; no se pudo completar la relación administrativa.');}
 document.getElementById('contractPreview').innerHTML='<small>N.º de contrato asignado</small><strong>'+escapeHTML(data.contract_number)+'</strong>';
 document.getElementById('propertyForm').hidden=true;
 document.getElementById('propertySuccess').hidden=false;
 document.getElementById('propertySuccess').innerHTML='<b>✓ Inmueble registrado correctamente</b><span>Contrato asignado: <strong>'+escapeHTML(data.contract_number)+'</strong></span><button type="button" class="btn btn-primary" data-action="close-contributor-modal">Finalizar y volver al directorio</button>';
 document.getElementById('stepProperty').classList.add('complete');
 toast('Inmueble registrado con contrato '+data.contract_number);
}
function properties(){return head('Inmuebles','Registro territorial y vinculación con contribuyentes.','<button class="btn btn-primary" data-action="new-property">＋ Registrar inmueble</button>')+`<div class="grid kpis"><div class="card stat-mini"><span>Total de inmuebles</span><strong>9.183</strong></div><div class="card stat-mini"><span>Viviendas individuales</span><strong>8.640</strong></div><div class="card stat-mini"><span>Unidades agrupadas</span><strong>543</strong></div><div class="card stat-mini"><span>Con ubicación pendiente</span><strong>126</strong></div></div><div class="card panel"><div class="panel-head"><h3>Datos básicos del inmueble</h3><span>Modelo de registro</span></div><div class="form-grid"><div class="field"><label>Código catastral</label><input placeholder="Código, si existe"></div><div class="field"><label>Contribuyente titular</label><input placeholder="Buscar por cédula o RIF"></div><div class="field"><label>Parroquia</label><select><option>Seleccione parroquia</option></select></div><div class="field"><label>Sector</label><input placeholder="Sector"></div><div class="field"><label>Tipo de inmueble</label><select><option>Casa</option><option>Apartamento</option><option>Unidad residencial</option></select></div><div class="field"><label>Uso</label><select><option>Residencial</option><option>Residencial multifamiliar</option></select></div><div class="field full"><label>Dirección exacta</label><input placeholder="Calle, avenida, número, referencia"></div></div><div class="form-actions"><button class="btn btn-primary" data-action="demo-save">Guardar inmueble de prueba</button></div></div>`}
function organizations(){return head('Organizaciones residenciales','Agrupa conjuntos, villas y condominios dentro de una sola ficha jurídica cuando corresponda.','<button class="btn btn-primary" data-action="new-org">＋ Nueva organización</button>')+`<div class="notice">La organización agrupa inmuebles sin sustituir el registro individual de cada unidad. La responsabilidad tributaria y modalidad de liquidación deben validarse contra la ordenanza vigente.</div><div class="grid module-grid"><div class="card module-card"><div class="module-icon">▤</div><h3>Condominio Villa Jardines</h3><p>RIF jurídico · 45 unidades · Sector Las Velitas</p><p style="margin-top:12px"><span class="status pending">Saldo pendiente · DEMO</span></p></div><div class="card module-card"><div class="module-icon">⌂</div><h3>Residencias Los Médanos</h3><p>RIF jurídico · 32 unidades · Ubicación por validar</p><p style="margin-top:12px"><span class="status">Al día · DEMO</span></p></div><div class="card module-card"><div class="module-icon">♧</div><h3>Consejo Comunal Centro</h3><p>Organización comunitaria · Representación territorial</p><p style="margin-top:12px"><span class="status inactive">Representación · DEMO</span></p></div></div>`}
function payments(){return head('Recaudación y pagos','Registro de operaciones y consulta de obligaciones.','<button class="btn btn-primary" data-action="new-payment">＋ Registrar pago</button>')+`<div class="grid kpis"><div class="card stat-mini"><span>Operaciones de hoy</span><strong>38</strong></div><div class="card stat-mini"><span>Total del día</span><strong>Bs. 18.450</strong></div><div class="card stat-mini"><span>Medios de pago</span><strong>4</strong></div><div class="card stat-mini"><span>Reversiones</span><strong>0</strong></div></div><div class="card"><div class="table-toolbar"><h3>Operaciones recientes</h3><input class="search" placeholder="Buscar referencia…" id="paySearch"></div><div id="paymentsTable">${paymentTable()}</div></div>`}
function paymentTable(){return table(['Referencia','Contribuyente','Período','Importe demo','Fecha','Estado'],state.payments.map(p=>`<tr><td><strong>${p.ref}</strong></td><td>${p.person}</td><td>${p.period}</td><td>Bs. ${p.amount}</td><td>${p.date}</td><td><span class="status">${p.status}</span></td></tr>`).join(''))}
function paymentForm(){return head('Registrar pago de prueba','Simulación de liquidación y comprobante. No procesa dinero real.','<button class="btn btn-light" data-go="pagos">← Volver</button>')+`<div class="card form-card"><div class="notice">No introducir datos reales ni referencias bancarias reales. Esta pantalla es exclusivamente demostrativa.</div><form id="paymentForm"><div class="form-grid"><div class="field full"><label>Contribuyente</label><select name="person">${state.people.map(p=>`<option>${p.name}</option>`).join('')}</select></div><div class="field"><label>Inmueble</label><select><option>Casa · Las Velitas</option><option>Unidad residencial</option></select></div><div class="field"><label>Período</label><select name="period"><option>Noviembre 2026</option><option>Octubre 2026</option><option>Septiembre 2026</option></select></div><div class="field"><label>Importe demostrativo (Bs.)</label><input name="amount" type="number" min="0.01" step=".01" value="3.00" required></div><div class="field"><label>Medio de pago</label><select><option>Transferencia (simulación)</option><option>Pago móvil (simulación)</option><option>Efectivo (simulación)</option><option>Punto de venta (simulación)</option></select></div></div><div class="form-actions"><button class="btn btn-primary">Registrar operación de prueba</button></div></form></div>`}
function invoices(){return head('Facturación','Comprobantes de operaciones registradas en el entorno de prueba.')+`<div class="notice">Los comprobantes reales deberán cumplir los requisitos tributarios y de facturación aplicables. Esta vista genera únicamente muestras no fiscales.</div><div class="card panel"><div class="panel-head"><h3>Comprobante de demostración</h3><button class="btn btn-primary" data-action="print-sample">Imprimir muestra</button></div><div class="invoice" id="invoice"><div style="text-align:center;border-bottom:2px solid #173f5d;padding-bottom:14px"><h2 style="color:#173f5d;margin:0">SITMAUD</h2><b style="font-size:10px">INSTITUTO MUNICIPAL DE ASEO URBANO Y DOMICILIARIO</b><p style="font-size:9px">Alcaldía del Municipio Miranda · Coro, estado Falcón</p><strong>COMPROBANTE DE PAGO — DEMOSTRACIÓN</strong></div><p><b>Referencia:</b> DEMO-00031</p><p><b>Contribuyente:</b> María Fernanda Rojas</p><p><b>Identificación:</b> V-12.345.678</p><p><b>Período:</b> Noviembre 2026</p><p><b>Concepto:</b> Servicio de aseo domiciliario (dato ficticio)</p><h2 style="text-align:right;color:#173f5d">TOTAL: Bs. 3,00</h2><p style="text-align:center;font-size:9px">DOCUMENTO SIN VALIDEZ FISCAL · DATOS FICTICIOS</p></div></div>`}
function reports(){return head('Reportes','Consulta y exportación de información demostrativa.')+`<div class="grid module-grid"><div class="card module-card"><div class="module-icon">▥</div><h3>Recaudación diaria</h3><p>Operaciones, montos y medios de pago por fecha.</p><button class="btn btn-light" data-action="export">Exportar CSV demo</button></div><div class="card module-card"><div class="module-icon">⌖</div><h3>Por parroquia y sector</h3><p>Distribución territorial de contribuyentes e inmuebles.</p><button class="btn btn-light" data-action="export">Exportar CSV demo</button></div><div class="card module-card"><div class="module-icon">▤</div><h3>Estado de cuenta</h3><p>Obligaciones, pagos y saldos demostrativos.</p><button class="btn btn-light" data-action="export">Exportar CSV demo</button></div></div>`}
function mapView(){return head('Mapa territorial','Ubicación de inmuebles y organizaciones residenciales.')+`<div class="empty-map"><div><div style="font-size:38px;color:#278a9a">⌖</div><b>Visor geográfico SITMAUD</b><p>El mapa se conectará cuando dispongamos de cartografía y coordenadas verificadas de parroquias, sectores, inmuebles y conjuntos residenciales. No se muestran ubicaciones inventadas.</p><span class="status pending">Cartografía pendiente</span></div></div>`}
function ordinance(){return head('Ordenanza y tarifas','Administración de reglas tributarias con vigencias y respaldo normativo.')+`<div class="notice">No se han cargado tarifas legales. Los valores mencionados durante la planificación son referencias pendientes de comprobar con la ordenanza vigente del municipio Miranda.</div><div class="grid two-col"><div class="card panel"><div class="panel-head"><h3>Normativa municipal</h3><span class="status pending">Pendiente de carga</span></div><p style="font-size:11px;color:#748695;line-height:1.7">Adjuntar ordenanza vigente, reformas, anexos tarifarios y actos administrativos aplicables.</p><button class="btn btn-light" data-action="demo-save">Registrar documento (demo)</button></div><div class="card panel"><div class="panel-head"><h3>Motor de reglas</h3><span class="status inactive">Sin activar</span></div><p style="font-size:11px;color:#748695;line-height:1.7">Tipologías, unidad de cuenta, fórmula de conversión, fecha de vigencia, exenciones y modalidad de liquidación.</p><button class="btn btn-light" data-action="demo-save">Configurar reglas (demo)</button></div></div>`}
function staff(){return head('Funcionarios y permisos','Gestión exclusiva de cuentas y autorizaciones por usuarios intendentes.','<button class="btn btn-primary" data-action="new-staff">＋ Crear funcionario</button>')+`<div class="notice">Solo los usuarios intendentes pueden crear funcionarios y conceder o revocar permisos. La pantalla actual es un prototipo local; no crea cuentas autenticadas.</div><div class="grid module-grid"><div class="card panel"><h3 style="margin-top:0">Usuarios intendentes</h3><div class="kpi-value">Hasta 5</div><p style="font-size:10px;color:#82919c">Superusuarios con acceso integral y autenticación reforzada.</p></div><div class="card panel"><h3 style="margin-top:0">Administradores analistas</h3><div class="kpi-value">Permisos a medida</div><p style="font-size:10px;color:#82919c">Permisos por módulo y acción asignados por intendentes.</p></div><div class="card panel"><h3 style="margin-top:0">Recaudadores</h3><div class="kpi-value">Acceso operativo</div><p style="font-size:10px;color:#82919c">Consultar obligaciones, registrar cobros y comprobantes autorizados.</p></div></div><div class="card panel" style="margin-top:16px"><div class="panel-head"><h3>Matriz conceptual de permisos</h3><span>Solo demostración</span></div>${['Contribuyentes: consultar, registrar, editar','Inmuebles: consultar, registrar, editar','Pagos: consultar, registrar, reversar','Facturación: consultar, emitir muestra, reimprimir','Reportes: consultar, exportar','Ordenanza: consultar, administrar tarifas','Funcionarios: crear cuentas, asignar permisos'].map(x=>`<div class="permission-group"><h4>${x.split(':')[0]}</h4><div class="checks">${x.split(':')[1].split(',').map(v=>`<label><input type="checkbox" disabled> ${v.trim()}</label>`).join('')}</div></div>`).join('')}</div>`}
function log(){return head('Bitácora de auditoría','Registro demostrativo de eventos y trazabilidad administrativa.')+`<div class="notice">En producción, la bitácora deberá ser de solo anexado, con fecha/hora del servidor, actor, IP, acción, entidad afectada y valores anteriores/nuevos cuando corresponda.</div>${table(['Fecha y hora','Usuario','Módulo','Acción','Resultado'],[['11/11/2026 09:42','Usuario intendente','Contribuyentes','Consulta de expediente','<span class="status">Correcto</span>'],['11/11/2026 09:18','Recaudador demo','Pagos','Registro de pago ficticio','<span class="status">Correcto</span>'],['10/11/2026 16:03','Administrador demo','Reportes','Exportación CSV de prueba','<span class="status">Correcto</span>']].map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''))}`}
function render(){const v=state.view;$('#crumb').textContent=titleMap[v]||'Inicio';const views={inicio:dashboard,contribuyentes:listPeople,inmuebles:properties,organizaciones:organizations,pagos:payments,facturacion:invoices,reportes:reports,mapa:mapView,ordenanza:ordinance,funcionarios:staff,bitacora:log};$('#content').innerHTML=(views[v]||dashboard)();document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('#sidebar').classList.remove('open');if(v==='inicio')loadDashboardMetrics();if(v==='contribuyentes')loadContributors()}
function go(v){state.view=v;render();window.scrollTo(0,0)}
document.addEventListener('click',e=>{const nav=e.target.closest('[data-view]');if(nav){go(nav.dataset.view);return}const g=e.target.closest('[data-go]');if(g){go(g.dataset.go);return}const a=e.target.closest('[data-action]');if(a){const act=a.dataset.action;if(act==='new-person')go('contribuyentes-form');else if(act==='new-payment')go('pago-form');else if(act==='close-contributor-modal')closeContributorModal();else if(act==='new-property'||act==='new-org'||act==='new-staff')toast('Formulario ampliado en la siguiente iteración.');else if(act==='print-sample')window.print();else if(act==='export')exportCSV();else toast('Acción disponible en el prototipo.');return}});
document.addEventListener('click',e=>{if(e.target.closest('#menuToggle'))$('#sidebar').classList.toggle('open')});
function exportCSV(){const rows=[['Referencia','Contribuyente','Periodo','Importe demo','Fecha'],...state.payments.map(p=>[p.ref,p.person,p.period,p.amount,p.date])];const csv=rows.map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='imaud-reporte-demostracion.csv';a.click();URL.revokeObjectURL(a.href);toast('CSV demostrativo descargado')}
document.addEventListener('submit',e=>{if(e.target.id==='personForm'){e.preventDefault();saveContributor(e.target)}if(e.target.id==='propertyForm'){e.preventDefault();saveProperty(e.target)}if(e.target.id==='paymentForm'){e.preventDefault();const f=new FormData(e.target);state.payments.unshift({ref:'DEMO-'+String(32+state.payments.length).padStart(5,'0'),person:f.get('person'),period:f.get('period'),amount:money(Number(f.get('amount'))),date:new Date().toLocaleDateString('es-VE'),status:'Registrado'});go('pagos');toast('Pago de demostración registrado localmente')}});
document.addEventListener('input',e=>{if(e.target.id==='personSearch')filterContributors()});
document.addEventListener('change',e=>{if(['typeFilter','statusFilter','parishFilter'].includes(e.target.id))filterContributors()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('contributorModal'))closeContributorModal()});
const originalRender=render;render=function(){if(state.view==='contribuyentes-form'){ $('#crumb').textContent='Nuevo contribuyente';$('#content').innerHTML=personForm();$('#sidebar').classList.remove('open');return}if(state.view==='pago-form'){ $('#crumb').textContent='Registrar pago';$('#content').innerHTML=paymentForm();$('#sidebar').classList.remove('open');return}originalRender()};
// Register authentication handling before the first render to avoid a blank Inicio
// if the session resolves while the application bundle is initializing.
window.addEventListener('imaud:authenticated',()=>{
  state.view='inicio';
  render();
});
render();
if(document.body.classList.contains('sitmaud-authenticated')){
  state.view='inicio';
  render();
}
