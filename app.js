const state={view:'inicio',people:[],parishes:[],sectors:[],payments:[{ref:'DEMO-00031',person:'María Fernanda Rojas',period:'Noviembre 2026',amount:'3,00',date:'11/11/2026',status:'Registrado'},{ref:'DEMO-00030',person:'José Antonio Acosta',period:'Noviembre 2026',amount:'1,50',date:'10/11/2026',status:'Registrado'}],staff:[]};
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
 '<div class="contributors-toolbar card"><input class="search" id="personSearch" placeholder="⌕  Buscar por nombre, cédula o RIF"><select id="typeFilter" class="filter-select"><option value="">Tipo de contribuyente · Todos</option><option value="natural_venezolano">Persona natural</option><option value="natural_extranjero">Persona extranjera</option><option value="juridico">Persona jurídica</option></select><select id="statusFilter" class="filter-select"><option value="">Estado · Todos</option><option value="active">Activo</option><option value="pending">Pendiente</option><option value="inactive">Inactivo</option></select><select id="parishFilter" class="filter-select"><option value="">Parroquia · Todas</option></select></div>'+
 '<div class="contributors-layout"><section class="card contributors-table-card"><div class="table-toolbar"><div><h3>Directorio de contribuyentes</h3><p>Registros guardados en SITMAUD</p></div><span id="contributorsCount" class="table-count">Cargando…</span></div><div id="peopleTable" class="contributors-table-wrap"><div class="contributors-loading">Consultando contribuyentes…</div></div></section><aside class="contributors-stats"><article class="card contributor-stat"><span class="stat-icon">♙</span><small>Total contribuyentes</small><strong id="statTotal">—</strong></article><article class="card contributor-stat"><span class="stat-icon blue">♟</span><small>Personas naturales</small><strong id="statNatural">—</strong></article><article class="card contributor-stat"><span class="stat-icon violet">▦</span><small>Personas jurídicas</small><strong id="statLegal">—</strong></article><article class="card contributor-stat"><span class="stat-icon green">✓</span><small>Con correo registrado</small><strong id="statEmail">—</strong></article></aside></div>';
}
function contributorPaymentSummary(p){
 const confirmed=(p.payments||[]).filter(x=>x.status==='confirmed'&&x.paid_at).sort((a,b)=>new Date(b.paid_at)-new Date(a.paid_at));
 const last=confirmed[0]?.paid_at||null;
 const assessments=(p.properties||[]).flatMap(x=>x.assessments||[]);
 const hasDebt=assessments.some(x=>['pending','partially_paid'].includes(x.status));
 const status=hasDebt?'pending':last?'active':'inactive';
 return {status,lastPayment:last?new Intl.DateTimeFormat('es-VE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Caracas'}).format(new Date(last)):'—'};
}
function peopleTable(rows=state.people){
 if(!rows.length)return '<div class="contributors-empty"><b>No hay contribuyentes registrados</b><span>Utiliza «Nuevo contribuyente» para crear el primer expediente.</span></div>';
 return '<table><thead><tr><th>Contribuyente</th><th>Cédula / RIF</th><th>Tipo</th><th>Inmuebles</th><th>Correo</th><th>Estado</th><th>Último pago</th></tr></thead><tbody>'+rows.map(p=>{const count=(p.properties||[]).length;const summary=contributorPaymentSummary(p);const labels={active:'Activo',pending:'Pendiente',inactive:'Inactivo'};return '<tr><td><strong>'+escapeHTML(contributorName(p))+'</strong></td><td>'+escapeHTML((p.identification_type||'')+'-'+(p.identification_number||''))+'</td><td><span class="type-pill">'+escapeHTML(contributorType(p.kind))+'</span></td><td>'+count+'</td><td>'+escapeHTML(p.email||'—')+'</td><td><span class="status '+summary.status+'">'+labels[summary.status]+'</span></td><td>'+escapeHTML(summary.lastPayment)+'</td></tr>'}).join('')+'</tbody></table>';
}
async function loadContributors(){
 const target=document.getElementById('peopleTable'); if(!target)return;
 target.innerHTML='<div class="contributors-loading">Consultando contribuyentes…</div>';
 const {data,error}=await imaudClient.from('contributors').select('id,kind,identification_type,identification_number,legal_name,first_name,last_name,email,phone,contact_address,contact_parish_name,contact_sector_name,is_property_owner,created_at,properties(id,contract_number,is_active,parish_name,sector_name,assessments(id,status)),payments(id,status,paid_at)').order('created_at',{ascending:false});
 if(state.view!=='contribuyentes')return;
 if(error){console.error('SITMAUD contributors:',error);target.innerHTML='<div class="contributors-empty"><b>No se pudieron cargar los contribuyentes</b><span>Verifica que tu usuario tenga permiso de consulta y vuelve a intentarlo.</span></div>';return;}
 state.people=data||[];
 document.getElementById('statTotal').textContent=state.people.length.toLocaleString('es-VE');
 document.getElementById('statNatural').textContent=state.people.filter(p=>p.kind!=='juridico').length.toLocaleString('es-VE');
 document.getElementById('statLegal').textContent=state.people.filter(p=>p.kind==='juridico').length.toLocaleString('es-VE');
 document.getElementById('statEmail').textContent=state.people.filter(p=>p.email).length.toLocaleString('es-VE');
 const parishSelect=document.getElementById('parishFilter');
 [...new Set(state.people.map(p=>p.contact_parish_name).filter(Boolean))].sort().forEach(name=>parishSelect.add(new Option(name,name)));
 filterContributors();
}
function filterContributors(){
 const q=(document.getElementById('personSearch')?.value||'').toLowerCase();
 const type=document.getElementById('typeFilter')?.value||'';
 const status=document.getElementById('statusFilter')?.value||'';
 const parish=document.getElementById('parishFilter')?.value||'';
 const rows=state.people.filter(p=>{
  const text=[contributorName(p),p.identification_type,p.identification_number,p.rif,p.email].join(' ').toLowerCase();
  const summary=contributorPaymentSummary(p);
  return (!q||text.includes(q))&&(!type||p.kind===type)&&(!status||summary.status===status)&&(!parish||p.contact_parish_name===parish);
 });
 const target=document.getElementById('peopleTable');if(target)target.innerHTML=peopleTable(rows);
 const count=document.getElementById('contributorsCount');if(count)count.textContent='Mostrando '+rows.length+' de '+state.people.length;
}
function contributorModal(){
 return '<div class="contributor-modal-backdrop" id="contributorModal"><section class="contributor-modal" role="dialog" aria-modal="true" aria-labelledby="contributorModalTitle"><header class="contributor-modal-head"><div class="modal-heading-icon">＋</div><div><h2 id="contributorModalTitle">Nuevo contribuyente</h2><p>Registra al contribuyente y luego agrega el inmueble asociado.</p></div><button type="button" class="modal-close" data-action="close-contributor-modal" aria-label="Cerrar">×</button></header><div class="registration-steps"><div class="registration-step active" id="stepContributor"><b>1</b><span><strong>Registrar contribuyente</strong><small>Completa sus datos</small></span></div><div class="registration-step" id="stepProperty"><b>2</b><span><strong>Registrar inmueble</strong><small>Asigna contrato y dirección</small></span></div></div><div class="registration-columns"><section class="registration-panel"><h3>♙ Registrar contribuyente</h3><p class="panel-hint">Información de la persona u organización responsable.</p><form id="personForm"><div class="form-grid"><div class="field"><label>Tipo de contribuyente *</label><select name="kind" required><option value="natural_venezolano">Persona natural</option><option value="natural_extranjero">Persona extranjera</option><option value="juridico">Persona jurídica</option></select></div><div class="field"><label>Tipo de identificación *</label><select name="identification_type" required><option value="V">V</option><option value="E">E</option><option value="J">J</option><option value="G">G</option><option value="P">P</option></select></div><div class="field"><label>Cédula / RIF *</label><input name="identification_number" required placeholder="Número de identificación"></div><div class="field"><label>Nombre y apellido / Razón social *</label><input name="name" required placeholder="Nombre completo o razón social"></div><div class="field"><label>Correo electrónico</label><input type="email" name="email" placeholder="correo@ejemplo.com"></div><div class="field"><label>Teléfono</label><input name="phone" placeholder="+58"></div><div class="field full"><label>Dirección de contacto</label><textarea name="contact_address" rows="2" placeholder="Dirección de residencia o domicilio fiscal"></textarea></div><div class="field"><label>Parroquia</label><select name="contact_parish_name" id="contactParishSelect"><option value="">Seleccione parroquia</option></select></div><div class="field"><label>Sector</label><select name="contact_sector_name" id="contactSectorSelect" disabled><option value="">Seleccione primero la parroquia</option></select></div><div class="field"><label>¿Es propietario?</label><select name="is_property_owner"><option value="true">Sí</option><option value="false">No</option></select></div></div><div class="form-actions"><button class="btn btn-primary" id="saveContributorButton">Guardar contribuyente</button></div></form><div class="saved-contributor-note" id="savedContributorNote" hidden></div></section><section class="registration-panel property-panel" id="propertyPanel"><div class="property-lock" id="propertyLock"><span>2</span><b>Primero guarda los datos del contribuyente para habilitar este formulario.</b></div><div id="propertyFormWrap" hidden><h3>⌂ Registrar inmueble</h3><p class="panel-hint">El inmueble quedará vinculado al contribuyente recién creado.</p><div class="contract-preview" id="contractPreview"><small>N.º de contrato</small><strong>Se asignará al registrar el inmueble</strong></div><div class="linked-contributor" id="linkedContributor"></div><form id="propertyForm"><div class="form-grid"><div class="field full"><label>Dirección del inmueble *</label><textarea name="address" rows="2" required placeholder="Avenida, calle, número, urbanización"></textarea></div><div class="field"><label>Parroquia</label><select name="parish_id" id="propertyParishSelect"><option value="">Seleccione parroquia</option></select></div><div class="field"><label>Sector</label><select name="sector_id" id="propertySectorSelect" disabled><option value="">Seleccione primero la parroquia</option></select></div><div class="field"><label>Tipo de inmueble *</label><select name="property_type" required><option value="casa">Casa</option><option value="apartamento">Apartamento</option><option value="edificio">Edificio</option><option value="terreno">Terreno</option><option value="unidad_residencial">Unidad residencial</option></select></div><div class="field"><label>Uso *</label><select name="property_use" required><option value="residencial" selected>Residencial</option></select></div><div class="field"><label>Organización residencial (opcional)</label><input name="organization_name" placeholder="Condominio, villa o urbanización"></div><div class="field"><label>Referencia</label><input name="reference" placeholder="Punto de referencia"></div><div class="field full"><label>Observaciones</label><textarea name="notes" rows="2" placeholder="Información adicional del inmueble"></textarea></div></div><div class="form-actions"><button type="button" class="btn btn-light" data-action="close-contributor-modal">Volver a contribuyentes</button><button class="btn btn-primary" id="savePropertyButton">Registrar inmueble</button></div></form><div class="property-success" id="propertySuccess" hidden></div></div></section></div></section></div>';
}
function openContributorModal(){
 if(!document.getElementById('contributorModal'))document.body.insertAdjacentHTML('beforeend',contributorModal());
 const modal=document.getElementById('contributorModal');modal.classList.add('open');document.body.classList.add('modal-open');loadGeographyCatalogs();
}
function closeContributorModal(){
 document.getElementById('contributorModal')?.remove();document.body.classList.remove('modal-open');loadContributors();
}
async function saveContributor(form){
 const f=new FormData(form);const kind=f.get('kind');const fullName=String(f.get('name')||'').trim();const parts=fullName.split(/\s+/);
 const {data:{user}}=await imaudClient.auth.getUser();
 const payload={kind,identification_type:f.get('identification_type'),identification_number:String(f.get('identification_number')).trim(),email:String(f.get('email')||'').trim()||null,phone:String(f.get('phone')||'').trim()||null,contact_address:String(f.get('contact_address')||'').trim()||null,contact_parish_name:String(f.get('contact_parish_name')||'').trim()||null,contact_sector_name:String(f.get('contact_sector_name')||'').trim()||null,is_property_owner:f.get('is_property_owner')==='true',created_by:user?.id||null};
 if(kind==='juridico'){payload.legal_name=fullName;payload.rif=payload.identification_number;}else{payload.first_name=parts.shift()||fullName;payload.last_name=parts.join(' ');}
 const button=document.getElementById('saveContributorButton');button.disabled=true;button.textContent='Guardando…';
 const {data,error}=await imaudClient.from('contributors').insert(payload).select('id,kind,identification_type,identification_number,legal_name,first_name,last_name,is_property_owner').single();
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
async function loadGeographyCatalogs(){
 const [p,s]=await Promise.all([
  imaudClient.from('parishes').select('id,name').eq('is_active',true).order('name'),
  imaudClient.from('sectors').select('id,name,parish_id').eq('is_active',true).order('name')
 ]);
 if(p.error||s.error){console.error('Catálogo territorial:',p.error||s.error);toast('No se pudo cargar el catálogo territorial.');return;}
 state.parishes=p.data||[];state.sectors=s.data||[];
 const opts='<option value="">Seleccione parroquia</option>'+state.parishes.map(x=>'<option value="'+escapeHTML(x.id)+'">'+escapeHTML(x.name)+'</option>').join('');
 const c=document.getElementById('contactParishSelect'),pSel=document.getElementById('propertyParishSelect');
 if(c)c.innerHTML=opts;if(pSel)pSel.innerHTML=opts;
 if(!state.parishes.length)toast('El catálogo territorial está vacío. Hay que cargar parroquias y sectores.');
}
function updateSectorOptions(parishId,sectorId,storeName){
 const p=document.getElementById(parishId),s=document.getElementById(sectorId);if(!p||!s)return;
 const rows=state.sectors.filter(x=>x.parish_id===p.value);
 s.disabled=!p.value||!rows.length;
 s.innerHTML='<option value="">'+(p.value?(rows.length?'Seleccione sector':'No hay sectores cargados'):'Seleccione primero la parroquia')+'</option>'+rows.map(x=>'<option value="'+escapeHTML(storeName?x.name:x.id)+'">'+escapeHTML(x.name)+'</option>').join('');
}
async function saveProperty(form){
 const f=new FormData(form);const contributor=state.currentContributor;if(!contributor){toast('Primero debes guardar el contribuyente.');return;}
 const button=document.getElementById('savePropertyButton');button.disabled=true;button.textContent='Registrando…';
 const payload={contributor_id:contributor.id,address:String(f.get('address')).trim(),property_type:f.get('property_type'),property_use:'residencial',parish_id:String(f.get('parish_id')||'')||null,sector_id:String(f.get('sector_id')||'')||null,parish_name:state.parishes.find(p=>p.id===f.get('parish_id'))?.name||null,sector_name:state.sectors.find(x=>x.id===f.get('sector_id'))?.name||null,organization_name:String(f.get('organization_name')||'').trim()||null,reference:String(f.get('reference')||'').trim()||null,notes:String(f.get('notes')||'').trim()||null,is_active:true};
 const {data,error}=await imaudClient.from('properties').insert(payload).select('id,contract_number').single();
 button.disabled=false;button.textContent='Registrar inmueble';
 if(error){console.error(error);toast('No se pudo registrar el inmueble: '+error.message);return;}
 const relation=await imaudClient.from('property_relationships').insert({property_id:data.id,contributor_id:contributor.id,relationship_role:contributor.is_property_owner===false?'responsable_pago':'propietario',is_current:true,is_payment_responsible:true});
 if(relation.error){console.error('Relación de inmueble:',relation.error);toast('Inmueble creado; no se pudo completar la relación administrativa.');}
 document.getElementById('contractPreview').innerHTML='<small>N.º de contrato asignado</small><strong>'+escapeHTML(data.contract_number)+'</strong>';
 document.getElementById('propertyForm').hidden=true;
 document.getElementById('propertySuccess').hidden=false;
 document.getElementById('propertySuccess').innerHTML='<b>✓ Inmueble registrado correctamente</b><span>Contrato asignado: <strong>'+escapeHTML(data.contract_number)+'</strong></span><button type="button" class="btn btn-primary" data-action="close-contributor-modal">Finalizar y volver al directorio</button>';
 document.getElementById('stepProperty').classList.add('complete');
 toast('Inmueble registrado con contrato '+data.contract_number);
}
function properties(){
 return head('Gestión de inmuebles','Registro, administración y consulta de inmuebles vinculados a contribuyentes.','<button class="btn btn-primary" data-action="new-property">＋ Registrar inmueble</button>')+
 '<div class="grid kpis property-kpis"><article class="card kpi"><div class="kpi-top"><span>Total de inmuebles</span><span class="kpi-icon">⌂</span></div><div class="kpi-value" id="propertyTotal">—</div><div class="kpi-note">Registros existentes en SITMAUD</div></article><article class="card kpi"><div class="kpi-top"><span>Inmuebles activos</span><span class="kpi-icon property-green">✓</span></div><div class="kpi-value" id="propertyActive">—</div><div class="kpi-note">Propiedades habilitadas</div></article><article class="card kpi"><div class="kpi-top"><span>Pendientes</span><span class="kpi-icon property-amber">◷</span></div><div class="kpi-value" id="propertyPending">—</div><div class="kpi-note">Con obligaciones por pagar</div></article><article class="card kpi"><div class="kpi-top"><span>Inactivos</span><span class="kpi-icon property-red">×</span></div><div class="kpi-value" id="propertyInactive">—</div><div class="kpi-note">Propiedades desactivadas</div></article></div>'+
 '<div class="card property-toolbar"><input class="search" id="propertySearch" placeholder="⌕  Buscar por contrato, cédula, contribuyente o dirección"><select id="propertyParishFilter" class="filter-select"><option value="">Parroquia · Todas</option></select><select id="propertySectorFilter" class="filter-select"><option value="">Sector · Todos</option></select><select id="propertyStatusFilter" class="filter-select"><option value="">Estado · Todos</option><option value="active">Activo</option><option value="pending">Pendiente</option><option value="inactive">Inactivo</option></select></div>'+
 '<section class="card property-directory"><div class="table-toolbar"><div><h3>Directorio de inmuebles</h3><p>Listado de todos los inmuebles registrados en el sistema.</p></div><span id="propertiesCount" class="table-count">Consultando…</span></div><div id="propertiesTable" class="property-table-wrap"><div class="contributors-loading">Consultando inmuebles…</div></div><div class="property-pagination" id="propertyPagination"></div></section>';
}

const PROPERTY_PAGE_SIZE=8;
state.properties=[];
state.propertyPage=1;
state.propertySelectedContributor=null;
function propertyStatus(p){
 if(p.is_active===false)return 'inactive';
 if((p.assessments||[]).some(a=>['pending','partially_paid'].includes(a.status)))return 'pending';
 return 'active';
}
function propertyContributorName(c){
 if(!c)return 'Sin contribuyente';
 return c.kind==='juridico'?(c.legal_name||'Sin razón social'):[c.first_name,c.last_name].filter(Boolean).join(' ')||c.legal_name||'Sin nombre';
}
async function loadProperties(){
 const target=document.getElementById('propertiesTable');if(!target)return;
 target.innerHTML='<div class="contributors-loading">Consultando inmuebles…</div>';
 const results=await Promise.all([
  imaudClient.from('properties').select('id,contract_number,address,property_type,property_use,parish_id,sector_id,parish_name,sector_name,is_active,created_at,contributor:contributors!properties_contributor_id_fkey(id,kind,identification_type,identification_number,legal_name,first_name,last_name),parish:parishes!properties_parish_id_fkey(name),sector:sectors!properties_sector_id_fkey(name)').order('created_at',{ascending:false}),
  imaudClient.from('assessments').select('id,property_id,status'),
  imaudClient.from('parishes').select('id,name').eq('is_active',true).order('name'),
  imaudClient.from('sectors').select('id,name,parish_id').eq('is_active',true).order('name')
 ]);
 if(state.view!=='inmuebles')return;
 const pr=results[0],ar=results[1],par=results[2],sr=results[3];
 if(pr.error){console.error('SITMAUD properties:',pr.error);target.innerHTML='<div class="contributors-empty"><b>No se pudieron cargar los inmuebles</b><span>'+escapeHTML(pr.error.message||'Verifica los permisos de consulta del módulo.')+'</span></div>';return;}
 const rows=pr.data||[],assessments=ar.error?[]:(ar.data||[]);
 const allocations=await imaudClient.from('payment_allocations').select('assessment_id,payment:payments!payment_allocations_payment_id_fkey(paid_at,status)');
 const assessmentById=new Map(assessments.map(x=>[x.id,x]));
 const paymentDates=new Map();
 (allocations.data||[]).forEach(x=>{const payment=x.payment,a=assessmentById.get(x.assessment_id);if(payment&&payment.status==='confirmed'&&payment.paid_at&&a){if(!paymentDates.has(a.property_id))paymentDates.set(a.property_id,[]);paymentDates.get(a.property_id).push(payment.paid_at)}});
 state.properties=rows.map(p=>({...p,assessments:assessments.filter(a=>a.property_id===p.id),lastPayment:(paymentDates.get(p.id)||[]).sort((a,b)=>new Date(b)-new Date(a))[0]||null}));
 state.parishes=par.error?[]:(par.data||[]);
 state.sectors=sr.error?[]:(sr.data||[]);
 const sectors=state.sectors;
 const pf=document.getElementById('propertyParishFilter'),sf=document.getElementById('propertySectorFilter');
 if(pf)pf.innerHTML='<option value="">Parroquia · Todas</option>'+state.parishes.map(x=>'<option value="'+escapeHTML(x.id)+'">'+escapeHTML(x.name)+'</option>').join('');
 if(sf)sf.innerHTML='<option value="">Sector · Todos</option>'+sectors.map(x=>'<option value="'+escapeHTML(x.id)+'">'+escapeHTML(x.name)+'</option>').join('');
 const total=state.properties.length,active=state.properties.filter(p=>p.is_active!==false).length;
 document.getElementById('propertyTotal').textContent=total.toLocaleString('es-VE');
 document.getElementById('propertyActive').textContent=active.toLocaleString('es-VE');
 document.getElementById('propertyPending').textContent=state.properties.filter(p=>propertyStatus(p)==='pending').length.toLocaleString('es-VE');
 document.getElementById('propertyInactive').textContent=(total-active).toLocaleString('es-VE');
 renderPropertiesTable();
}
function propertyLastPayment(p){
 if(!p.lastPayment)return '—';
 return new Intl.DateTimeFormat('es-VE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Caracas'}).format(new Date(p.lastPayment));
}
function filteredProperties(){
 const q=(document.getElementById('propertySearch')?.value||'').trim().toLowerCase();
 const parish=document.getElementById('propertyParishFilter')?.value||'';
 const sector=document.getElementById('propertySectorFilter')?.value||'';
 const status=document.getElementById('propertyStatusFilter')?.value||'';
 return state.properties.filter(p=>{
  const c=p.contributor||{};
  const hay=[p.contract_number,p.address,p.parish?.name,p.parish_name,p.sector?.name,p.sector_name,propertyContributorName(c),c.identification_type,c.identification_number].join(' ').toLowerCase();
  return (!q||hay.includes(q))&&(!parish||p.parish_id===parish)&&(!sector||p.sector_id===sector)&&(!status||propertyStatus(p)===status);
 });
}
function renderPropertiesTable(){
 const rows=filteredProperties(),pages=Math.max(1,Math.ceil(rows.length/PROPERTY_PAGE_SIZE));
 state.propertyPage=Math.min(state.propertyPage,pages);
 const from=(state.propertyPage-1)*PROPERTY_PAGE_SIZE,visible=rows.slice(from,from+PROPERTY_PAGE_SIZE);
 const labels={active:'Activo',pending:'Pendiente',inactive:'Inactivo'},target=document.getElementById('propertiesTable');
 if(!rows.length)target.innerHTML='<div class="contributors-empty"><b>No hay inmuebles que mostrar</b><span>Registra un inmueble o ajusta los filtros de búsqueda.</span></div>';
 else target.innerHTML='<table><thead><tr><th>Contrato</th><th>Contribuyente</th><th>Cédula / RIF</th><th>Dirección</th><th>Parroquia</th><th>Sector</th><th>Estado</th><th>Último pago</th><th>Acciones</th></tr></thead><tbody>'+visible.map(p=>{
  const c=p.contributor||{},status=propertyStatus(p);
  return '<tr><td><strong>'+escapeHTML(p.contract_number||'Por asignar')+'</strong></td><td><strong>'+escapeHTML(propertyContributorName(c))+'</strong></td><td>'+escapeHTML((c.identification_type||'')+(c.identification_number?'-'+c.identification_number:'')||'—')+'</td><td class="property-address-cell">'+escapeHTML(p.address||'—')+'</td><td>'+escapeHTML(p.parish?.name||p.parish_name||'—')+'</td><td>'+escapeHTML(p.sector?.name||p.sector_name||'—')+'</td><td><span class="status '+status+'">'+labels[status]+'</span></td><td>'+escapeHTML(propertyLastPayment(p))+'</td><td><div class="property-row-actions"><button type="button" title="Ver inmueble" data-property-action="view" data-property-id="'+p.id+'">◉</button><button type="button" title="Editar inmueble" data-property-action="edit" data-property-id="'+p.id+'">✎</button><button type="button" title="Más opciones" data-property-action="more" data-property-id="'+p.id+'">⋮</button></div></td></tr>';
 }).join('')+'</tbody></table>';
 document.getElementById('propertiesCount').textContent='Mostrando '+(rows.length?from+1:0)+'–'+Math.min(from+PROPERTY_PAGE_SIZE,rows.length)+' de '+rows.length;
 document.getElementById('propertyPagination').innerHTML=rows.length?'<span>'+rows.length.toLocaleString('es-VE')+' inmuebles filtrados</span><div><button type="button" data-property-page="'+Math.max(1,state.propertyPage-1)+'" '+(state.propertyPage===1?'disabled':'')+'>‹</button><b>'+state.propertyPage+' / '+pages+'</b><button type="button" data-property-page="'+Math.min(pages,state.propertyPage+1)+'" '+(state.propertyPage===pages?'disabled':'')+'>›</button></div>':'';
}

function propertyRegistrationModal(){
 return '<div class="contributor-modal-backdrop open" id="propertyRegistrationModal"><section class="property-registration-modal" role="dialog" aria-modal="true" aria-labelledby="propertyRegistrationTitle"><header class="contributor-modal-head"><div class="modal-heading-icon">⌂</div><div><h2 id="propertyRegistrationTitle">Registrar inmueble</h2><p>Busca primero al contribuyente y agrega uno o varios inmuebles a su expediente.</p></div><button type="button" class="modal-close" data-action="close-property-modal">×</button></header><section class="property-lookup"><h3>1. Buscar contribuyente</h3><p class="panel-hint">Introduce su cédula o RIF para identificar el expediente.</p><div class="property-lookup-row"><input id="propertyContributorId" placeholder="Ej. V-XXXXXXXX o J-XXXXXXXX"><button type="button" class="btn btn-primary" data-action="find-property-contributor">Buscar contribuyente</button></div><div id="propertyContributorResult"></div></section><section class="property-new-panel" id="propertyNewPanel" hidden><div class="property-linked-card" id="propertyLinkedCard"></div><div class="property-add-heading"><div><h3>2. Agregar inmueble</h3><p class="panel-hint">Cada propiedad tendrá su propio número de contrato.</p></div><span class="property-count-chip" id="propertyLinkedCount">0 inmuebles registrados</span></div><form id="standalonePropertyForm"><div class="form-grid"><div class="field full"><label>Dirección del inmueble *</label><textarea name="address" rows="2" required placeholder="Avenida, calle, número, urbanización"></textarea></div><div class="field"><label>Parroquia *</label><select name="parish_id" id="standaloneParish" required><option value="">Seleccione parroquia</option></select></div><div class="field"><label>Sector *</label><select name="sector_id" id="standaloneSector" required disabled><option value="">Seleccione primero la parroquia</option></select></div><div class="field"><label>Tipo de inmueble *</label><select name="property_type" required><option value="casa">Casa</option><option value="apartamento">Apartamento</option><option value="unidad_residencial">Unidad residencial</option><option value="edificio">Edificio residencial</option></select></div><div class="field"><label>Uso</label><input value="Residencial" disabled></div><div class="field"><label>Organización residencial (opcional)</label><input name="organization_name" placeholder="Condominio, villa o urbanización"></div><div class="field"><label>Referencia</label><input name="reference" placeholder="Punto de referencia"></div><div class="field full"><label>Observaciones</label><textarea name="notes" rows="2" placeholder="Información adicional del inmueble"></textarea></div></div><div class="form-actions"><button class="btn btn-primary" id="standaloneSaveProperty">Guardar inmueble</button></div></form><div id="standalonePropertySuccess" class="property-success" hidden></div><div id="propertyExistingList" class="property-existing-list"></div></section></section></div>';
}
async function openPropertyRegistrationModal(){
 if(!document.getElementById('propertyRegistrationModal'))document.body.insertAdjacentHTML('beforeend',propertyRegistrationModal());
 document.body.classList.add('modal-open');
 const [p,s]=await Promise.all([imaudClient.from('parishes').select('id,name').eq('is_active',true).order('name'),imaudClient.from('sectors').select('id,name,parish_id').eq('is_active',true).order('name')]);
 if(p.error||s.error){toast('No se pudo cargar el catálogo territorial.');return;}
 state.parishes=p.data||[];state.sectors=s.data||[];
 document.getElementById('standaloneParish').innerHTML='<option value="">Seleccione parroquia</option>'+state.parishes.map(x=>'<option value="'+escapeHTML(x.id)+'">'+escapeHTML(x.name)+'</option>').join('');
 document.getElementById('propertyContributorId')?.focus();
}
async function findPropertyContributor(){
 const input=document.getElementById('propertyContributorId'),target=document.getElementById('propertyContributorResult');
 const raw=input.value.trim().toUpperCase();
 const match=raw.match(/^([VEJPG])?[-\s.]*(\d+)$/);
 if(!match){toast('Introduce una cédula o RIF válido.');return;}
 const prefix=match[1]||null,digits=match[2];
 target.innerHTML='<div class="contributors-loading">Buscando contribuyente…</div>';
 let query=imaudClient.from('contributors').select('id,kind,identification_type,identification_number,legal_name,first_name,last_name,is_property_owner').ilike('identification_number','%'+digits).limit(3);
 if(prefix)query=query.eq('identification_type',prefix);
 const {data,error}=await query;
 if(error){console.error(error);target.innerHTML='<div class="property-lookup-message error">No se pudo consultar: '+escapeHTML(error.message)+'</div>';return;}
 const matches=data||[];
 if(matches.length>1){state.propertySelectedContributor=null;document.getElementById('propertyNewPanel').hidden=true;target.innerHTML='<div class="property-lookup-message">Encontramos más de un registro con esos dígitos. Introduce también el tipo de identificación (V, E, J, G o P) para identificar al titular.</div>';return;}
 const contributor=matches[0];
 if(!contributor){state.propertySelectedContributor=null;document.getElementById('propertyNewPanel').hidden=true;target.innerHTML='<div class="property-lookup-message">No encontramos un contribuyente con esa identificación. Verifica el número o regístralo primero en el módulo Contribuyentes.</div>';return;}
 state.propertySelectedContributor=contributor;
 const existing=await imaudClient.from('properties').select('id,contract_number,address,parish_name,sector_name,is_active').eq('contributor_id',contributor.id).order('created_at',{ascending:false});
 if(existing.error){console.error(existing.error);target.innerHTML='<div class="property-lookup-message error">El contribuyente existe, pero no se pudieron consultar sus inmuebles: '+escapeHTML(existing.error.message)+'</div>';return;}
 target.innerHTML='<div class="property-lookup-message success">✓ Contribuyente encontrado. Puedes agregarle un inmueble.</div>';
 document.getElementById('propertyNewPanel').hidden=false;
 document.getElementById('propertyLinkedCard').innerHTML='<span class="property-linked-icon">♙</span><div><b>'+escapeHTML(propertyContributorName(contributor))+'</b><small>'+escapeHTML(contributor.identification_type+'-'+contributor.identification_number)+'</small></div>';
 document.getElementById('propertyLinkedCount').textContent=(existing.data||[]).length+' inmuebles registrados';
 renderExistingPropertyList(existing.data||[]);
}
function renderExistingPropertyList(rows){
 const target=document.getElementById('propertyExistingList');if(!target)return;
 target.innerHTML='<h4>Inmuebles asociados a este contribuyente</h4>'+(rows.length?'<div class="property-existing-items">'+rows.map(p=>'<div><b>'+escapeHTML(p.contract_number||'Contrato pendiente')+'</b><span>'+escapeHTML(p.address)+'</span><small>'+escapeHTML([p.parish_name,p.sector_name].filter(Boolean).join(' · ')||'Ubicación no especificada')+'</small></div>').join('')+'</div>':'<p class="panel-hint">Este contribuyente todavía no tiene inmuebles registrados.</p>');
}
async function saveStandaloneProperty(form){
 const contributor=state.propertySelectedContributor;if(!contributor){toast('Primero busca al contribuyente por cédula o RIF.');return;}
 const f=new FormData(form),button=document.getElementById('standaloneSaveProperty');button.disabled=true;button.textContent='Guardando…';
 const parish=state.parishes.find(x=>x.id===f.get('parish_id')),sector=state.sectors.find(x=>x.id===f.get('sector_id'));
 const payload={contributor_id:contributor.id,address:String(f.get('address')||'').trim(),property_type:f.get('property_type'),property_use:'residencial',parish_id:parish?.id||null,sector_id:sector?.id||null,parish_name:parish?.name||null,sector_name:sector?.name||null,organization_name:String(f.get('organization_name')||'').trim()||null,reference:String(f.get('reference')||'').trim()||null,notes:String(f.get('notes')||'').trim()||null,is_active:true};
 const {data,error}=await imaudClient.from('properties').insert(payload).select('id,contract_number,address,parish_name,sector_name,is_active').single();
 button.disabled=false;button.textContent='Guardar inmueble';
 if(error){console.error(error);toast('No se pudo registrar el inmueble: '+error.message);return;}
 const relation=await imaudClient.from('property_relationships').insert({property_id:data.id,contributor_id:contributor.id,relationship_role:contributor.is_property_owner===false?'responsable_pago':'propietario',is_current:true,is_payment_responsible:true});
 if(relation.error)console.error('Relación del inmueble:',relation.error);
 const success=document.getElementById('standalonePropertySuccess');success.hidden=false;success.innerHTML='<b>✓ Inmueble registrado correctamente</b><span>Número de contrato asignado: <strong>'+escapeHTML(data.contract_number||'Pendiente de asignación')+'</strong></span><span>Puedes agregar otro inmueble al mismo contribuyente.</span>';
 form.reset();document.getElementById('standaloneSector').disabled=true;document.getElementById('standaloneSector').innerHTML='<option value="">Seleccione primero la parroquia</option>';
 const existing=await imaudClient.from('properties').select('id,contract_number,address,parish_name,sector_name,is_active').eq('contributor_id',contributor.id).order('created_at',{ascending:false});
 renderExistingPropertyList(existing.data||[]);document.getElementById('propertyLinkedCount').textContent=(existing.data||[]).length+' inmuebles registrados';
 await loadProperties();toast('Inmueble registrado: '+(data.contract_number||'contrato asignado'));
}
function closePropertyRegistrationModal(){document.getElementById('propertyRegistrationModal')?.remove();document.body.classList.remove('modal-open');state.propertySelectedContributor=null;}

function openPropertyEdit(id){
 const p=state.properties.find(x=>x.id===id);if(!p)return;
 const parishOptions='<option value="">Seleccione parroquia</option>'+state.parishes.map(x=>'<option value="'+escapeHTML(x.id)+'" '+(x.id===p.parish_id?'selected':'')+'>'+escapeHTML(x.name)+'</option>').join('');
 const sectorOptions='<option value="">Seleccione sector</option>'+state.sectors.filter(x=>x.parish_id===p.parish_id).map(x=>'<option value="'+escapeHTML(x.id)+'" '+(x.id===p.sector_id?'selected':'')+'>'+escapeHTML(x.name)+'</option>').join('');
 const markup='<div class="contributor-modal-backdrop open" id="propertyEditModal"><section class="property-registration-modal"><header class="contributor-modal-head"><div class="modal-heading-icon">✎</div><div><h2>Editar inmueble</h2><p>'+escapeHTML(p.contract_number||'Contrato sin asignar')+'</p></div><button type="button" class="modal-close" data-action="close-property-edit">×</button></header><form id="editPropertyForm" data-property-id="'+p.id+'"><div class="form-grid" style="margin-top:18px"><div class="field full"><label>Dirección del inmueble *</label><textarea name="address" rows="2" required>'+escapeHTML(p.address||'')+'</textarea></div><div class="field"><label>Parroquia</label><select name="parish_id" id="editPropertyParish">'+parishOptions+'</select></div><div class="field"><label>Sector</label><select name="sector_id" id="editPropertySector">'+sectorOptions+'</select></div><div class="field"><label>Tipo de inmueble *</label><select name="property_type" required><option value="casa" '+(p.property_type==='casa'?'selected':'')+'>Casa</option><option value="apartamento" '+(p.property_type==='apartamento'?'selected':'')+'>Apartamento</option><option value="unidad_residencial" '+(p.property_type==='unidad_residencial'?'selected':'')+'>Unidad residencial</option><option value="edificio" '+(p.property_type==='edificio'?'selected':'')+'>Edificio residencial</option></select></div><div class="field"><label>Estado administrativo</label><select name="is_active"><option value="true" '+(p.is_active?'selected':'')+'>Activo</option><option value="false" '+(!p.is_active?'selected':'')+'>Inactivo</option></select></div><div class="field"><label>Organización residencial</label><input name="organization_name" value="'+escapeHTML(p.organization_name||'')+'"></div><div class="field"><label>Referencia</label><input name="reference" value="'+escapeHTML(p.reference||'')+'"></div><div class="field full"><label>Observaciones</label><textarea name="notes" rows="2">'+escapeHTML(p.notes||'')+'</textarea></div></div><div class="form-actions"><button type="button" class="btn btn-light" data-action="close-property-edit">Cancelar</button><button class="btn btn-primary" id="savePropertyEditButton">Guardar cambios</button></div></form></section></div>';
 document.body.insertAdjacentHTML('beforeend',markup);document.body.classList.add('modal-open');
}
async function savePropertyEdit(form){
 const id=form.dataset.propertyId,f=new FormData(form),button=document.getElementById('savePropertyEditButton');
 const parish=state.parishes.find(x=>x.id===f.get('parish_id')),sector=state.sectors.find(x=>x.id===f.get('sector_id'));
 button.disabled=true;button.textContent='Guardando…';
 const payload={address:String(f.get('address')||'').trim(),parish_id:parish?.id||null,sector_id:sector?.id||null,parish_name:parish?.name||null,sector_name:sector?.name||null,property_type:f.get('property_type'),property_use:'residencial',organization_name:String(f.get('organization_name')||'').trim()||null,reference:String(f.get('reference')||'').trim()||null,notes:String(f.get('notes')||'').trim()||null,is_active:f.get('is_active')==='true'};
 const {error}=await imaudClient.from('properties').update(payload).eq('id',id);
 button.disabled=false;button.textContent='Guardar cambios';
 if(error){console.error(error);toast('No se pudieron guardar los cambios: '+error.message);return;}
 document.getElementById('propertyEditModal')?.remove();document.body.classList.remove('modal-open');await loadProperties();toast('Inmueble actualizado correctamente');
}
function showPropertyDetails(id){
 const p=state.properties.find(x=>x.id===id);if(!p)return;
 const c=p.contributor||{},status=propertyStatus(p),labels={active:'Activo',pending:'Pendiente',inactive:'Inactivo'};
 const markup='<div class="property-detail-backdrop" id="propertyDetailModal"><section class="property-detail-modal"><header><div><h2>Expediente del inmueble</h2><p>'+escapeHTML(p.contract_number||'Contrato sin asignar')+'</p></div><button type="button" data-action="close-property-detail">×</button></header><div class="property-detail-grid"><div><small>Contribuyente</small><b>'+escapeHTML(propertyContributorName(c))+'</b></div><div><small>Cédula / RIF</small><b>'+escapeHTML(c.identification_type+'-'+c.identification_number)+'</b></div><div><small>Dirección</small><b>'+escapeHTML(p.address)+'</b></div><div><small>Parroquia</small><b>'+escapeHTML(p.parish?.name||p.parish_name||'—')+'</b></div><div><small>Sector</small><b>'+escapeHTML(p.sector?.name||p.sector_name||'—')+'</b></div><div><small>Tipo</small><b>'+escapeHTML(p.property_type||'—')+'</b></div><div><small>Uso</small><b>Residencial</b></div><div><small>Estado</small><b>'+labels[status]+'</b></div><div><small>Último pago</small><b>'+escapeHTML(propertyLastPayment(p))+'</b></div></div></section></div>';
 document.body.insertAdjacentHTML('beforeend',markup);
}
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
function render(){const v=state.view;$('#crumb').textContent=titleMap[v]||'Inicio';const views={inicio:dashboard,contribuyentes:listPeople,inmuebles:properties,organizaciones:organizations,pagos:payments,facturacion:invoices,reportes:reports,mapa:mapView,ordenanza:ordinance,funcionarios:staff,bitacora:log};$('#content').innerHTML=(views[v]||dashboard)();document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('#sidebar').classList.remove('open');if(v==='inicio')loadDashboardMetrics();if(v==='contribuyentes')loadContributors();if(v==='inmuebles')loadProperties()}
function go(v){state.view=v;render();window.scrollTo(0,0)}
document.addEventListener('click',e=>{const nav=e.target.closest('[data-view]');if(nav){go(nav.dataset.view);return}const g=e.target.closest('[data-go]');if(g){go(g.dataset.go);return}const a=e.target.closest('[data-action]');if(a){const act=a.dataset.action;if(act==='new-person')openContributorModal();else if(act==='new-payment')go('pago-form');else if(act==='close-contributor-modal')closeContributorModal();else if(act==='new-property')openPropertyRegistrationModal();else if(act==='close-property-modal')closePropertyRegistrationModal();else if(act==='find-property-contributor')findPropertyContributor();else if(act==='close-property-detail')document.getElementById('propertyDetailModal')?.remove();else if(act==='close-property-edit'){document.getElementById('propertyEditModal')?.remove();document.body.classList.remove('modal-open')}else if(act==='new-org'||act==='new-staff')toast('Formulario ampliado en la siguiente iteración.');else if(act==='print-sample')window.print();else if(act==='export')exportCSV();else toast('Acción disponible en el prototipo.');return}});
document.addEventListener('click',e=>{if(e.target.closest('#menuToggle'))$('#sidebar').classList.toggle('open')});
function exportCSV(){const rows=[['Referencia','Contribuyente','Periodo','Importe demo','Fecha'],...state.payments.map(p=>[p.ref,p.person,p.period,p.amount,p.date])];const csv=rows.map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='imaud-reporte-demostracion.csv';a.click();URL.revokeObjectURL(a.href);toast('CSV demostrativo descargado')}
document.addEventListener('click',e=>{const rowAction=e.target.closest('[data-property-action]');if(rowAction){const id=rowAction.dataset.propertyId;if(rowAction.dataset.propertyAction==='view')showPropertyDetails(id);else if(rowAction.dataset.propertyAction==='edit')openPropertyEdit(id);else showPropertyDetails(id);return}const page=e.target.closest('[data-property-page]');if(page){state.propertyPage=Number(page.dataset.propertyPage);renderPropertiesTable()}});
document.addEventListener('submit',e=>{if(e.target.id==='editPropertyForm'){e.preventDefault();savePropertyEdit(e.target)}});
document.addEventListener('submit',e=>{if(e.target.id==='standalonePropertyForm'){e.preventDefault();saveStandaloneProperty(e.target)}});
document.addEventListener('submit',e=>{if(e.target.id==='personForm'){e.preventDefault();saveContributor(e.target)}if(e.target.id==='propertyForm'){e.preventDefault();saveProperty(e.target)}if(e.target.id==='paymentForm'){e.preventDefault();const f=new FormData(e.target);state.payments.unshift({ref:'DEMO-'+String(32+state.payments.length).padStart(5,'0'),person:f.get('person'),period:f.get('period'),amount:money(Number(f.get('amount'))),date:new Date().toLocaleDateString('es-VE'),status:'Registrado'});go('pagos');toast('Pago de demostración registrado localmente')}});
document.addEventListener('input',e=>{if(e.target.id==='personSearch')filterContributors();if(e.target.id==='propertySearch'){state.propertyPage=1;renderPropertiesTable()}});
document.addEventListener('change',e=>{
 if(['typeFilter','statusFilter','parishFilter'].includes(e.target.id))filterContributors();
 if(e.target.id==='contactParishSelect')updateSectorOptions('contactParishSelect','contactSectorSelect',true);
 if(e.target.id==='propertyParishSelect')updateSectorOptions('propertyParishSelect','propertySectorSelect',false);
 if(e.target.id==='standaloneParish')updateSectorOptions('standaloneParish','standaloneSector',false);
 if(e.target.id==='editPropertyParish')updateSectorOptions('editPropertyParish','editPropertySector',false);
 if(['propertyParishFilter','propertySectorFilter','propertyStatusFilter'].includes(e.target.id)){state.propertyPage=1;renderPropertiesTable()}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('contributorModal'))closeContributorModal();if(e.key==='Escape'&&document.getElementById('propertyRegistrationModal'))closePropertyRegistrationModal();if(e.key==='Escape'&&document.getElementById('propertyEditModal')){document.getElementById('propertyEditModal')?.remove();document.body.classList.remove('modal-open')}if(e.key==='Escape')document.getElementById('propertyDetailModal')?.remove();if(e.key==='Enter'&&e.target.id==='propertyContributorId'){e.preventDefault();findPropertyContributor()}});
const originalRender=render;render=function(){if(state.view==='pago-form'){ $('#crumb').textContent='Registrar pago';$('#content').innerHTML=paymentForm();$('#sidebar').classList.remove('open');return}originalRender()};
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
