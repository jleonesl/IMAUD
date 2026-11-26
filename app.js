const state={view:'inicio',people:[],parishes:[],sectors:[],territorialAreas:[],pendingPropertyOwner:null,pendingOccupantRole:'arrendatario',paymentDebtors:[],paymentBankCatalog:[],paymentPage:1,currentPaymentContributor:null,currentPaymentAssessments:[],udcRate:null,payments:[],staff:[]};
const $=s=>document.querySelector(s);const money=n=>new Intl.NumberFormat('es-VE',{minimumFractionDigits:2}).format(n);
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
const titleMap={inicio:'Inicio',contribuyentes:'Contribuyentes',inmuebles:'Inmuebles',organizaciones:'Condominios',condominio_registro:'Registrar condominio',pagos:'Recaudación y pagos',facturacion:'Facturación',solvencias:'Solvencias',tesoreria:'Tesorería',reportes:'Reportes',puntos_venta:'Puntos de venta',mapa:'Mapa territorial',ordenanza:'Ordenanza y tarifas',funcionarios:'Funcionarios y permisos',bitacora:'Bitácora'};
function head(title,sub,action=''){return `<div class="page-head"><div><div class="eyebrow">SITMAUD · GESTIÓN MUNICIPAL</div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`}
function table(headers,rows){return `<div class="card table-card"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`}
function dashboard(){
 const metrics=[
  {key:'contributors_total',label:'Total de contribuyentes',icon:'♙',note:'Registros del sistema'},
  {key:'properties_total',label:'Inmuebles individuales',icon:'⌂',note:'Activos, sin cuentas matrices'},
  {key:'condominiums_total',label:'Condominios registrados',icon:'▥',note:'Cuentas matrices'},
  {key:'payments_total',label:'Pagos registrados',icon:'▧',note:'Operaciones oficiales'},
  {key:'payments_today',label:'Pagos de hoy',icon:'◷',note:'Fecha local de Coro'},
  {key:'debts_pending',label:'Obligaciones pendientes',icon:'!',note:'Liquidaciones oficiales pendientes'},
  {key:'certificates_total',label:'Solvencias emitidas',icon:'▣',note:'Certificados oficiales emitidos'}
 ];
 return head('Inicio','Resumen operativo y financiero del sistema institucional.')+
 '<section class="dashboard-section"><div class="dashboard-section-head"><h2>Indicadores generales</h2><p>Actividad y registros del sistema · sin importes monetarios</p></div><div class="grid kpis home-indicators dashboard-kpi-grid">'+metrics.map(m=>'<article class="card kpi home-kpi"><div class="kpi-top"><span>'+m.label+'</span><span class="kpi-icon">'+m.icon+'</span></div><div class="kpi-value" data-metric-value="'+m.key+'">—</div><div class="kpi-note" data-metric-note="'+m.key+'">'+m.note+'</div></article>').join('')+'</div></section>'+window.sitmaudOfficialFinance.overviewPlaceholder();
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
 if(state.view!=='inicio'||!document.body.classList.contains('sitmaud-authenticated'))return;
 document.querySelectorAll('[data-metric-value]').forEach(el=>el.textContent='…');
 const [base,finance,condos,issuedCertificates]=await Promise.all([
  imaudClient.rpc('get_dashboard_metrics'),
  imaudClient.rpc('get_official_financial_overview'),
  imaudClient.from('residential_organizations').select('id',{count:'exact',head:true}).eq('consolidated_billing',true),
  imaudClient.from('solvency_certificates').select('id',{count:'exact',head:true}).eq('status','issued')
 ]);
 if(state.view!=='inicio')return;
 if(base.error)console.error('SITMAUD dashboard:',base.error);
 if(finance.error)console.error('SITMAUD financial KPIs:',finance.error);
 const values=base.error?null:base.data,financial=finance.error?null:finance.data;
 for(const key of ['contributors_total','properties_total','payments_total','payments_today']){
  const el=document.querySelector('[data-metric-value="'+key+'"]');
  if(el)el.textContent=values?formatDashboardCount(values[key]):'No disponible';
 }

 const set=(key,value)=>{const el=document.querySelector('[data-metric-value="'+key+'"]');if(el)el.textContent=value;};
 set('debts_pending',financial?formatDashboardCount(financial.pending_debts_count):'No disponible');
 set('condominiums_total',condos.error?'No disponible':formatDashboardCount(condos.count||0));
 set('certificates_total',issuedCertificates.error?'No disponible':formatDashboardCount(issuedCertificates.count||0));
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
 const assessments=(p.properties||[]).flatMap(x=>(x.assessments||[]).filter(a=>a.is_demo===false));
 const debt=assessments.some(x=>['pending','partially_paid'].includes(x.status));
 return {administrative:p.status==='inactive'?'inactive':'active',debtStatus:debt?'pending':assessments.length?'paid':'none',lastPayment:last?new Intl.DateTimeFormat('es-VE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Caracas'}).format(new Date(last)):'—'};
}
function peopleTable(rows=state.people){
 if(!rows.length)return '<div class="contributors-empty"><b>No hay contribuyentes registrados</b><span>Utiliza «Nuevo contribuyente» para crear el primer expediente.</span></div>';
 return '<table class="contributors-compact-table"><colgroup><col class="contributor-col-name"><col class="contributor-col-id"><col class="contributor-col-contract"><col class="contributor-col-properties"><col class="contributor-col-admin"><col class="contributor-col-debt"><col class="contributor-col-payment"><col class="contributor-col-actions"></colgroup><thead><tr><th>Contribuyente</th><th>Cédula / RIF</th><th>N.º de contrato</th><th>Inmuebles</th><th>Estado</th><th>Cuenta</th><th>Último pago</th><th>Acciones</th></tr></thead><tbody>'+rows.map(p=>{
  const summary=contributorPaymentSummary(p);
  const count=(p.properties||[]).length;const condo=p.service_account_type==='condominio';const units=(p.properties||[]).find(x=>x.is_consolidated_master)?.consolidated_units;
  const debtLabel=summary.debtStatus==='pending'?'Con deuda':summary.debtStatus==='paid'?'Al día':'Sin liquidaciones';
  return '<tr><td class="contributor-name-cell"><strong>'+escapeHTML(contributorName(p))+'</strong></td><td>'+escapeHTML(p.identification_number||'—')+'</td><td><strong>'+escapeHTML(p.contract_number||'—')+'</strong></td><td class="contributor-properties-cell">'+(condo?(units?units+' viviendas':'Ficha matriz pendiente'):count+' '+(count===1?'inmueble':'inmuebles'))+'</td><td><span class="status '+summary.administrative+'">'+(summary.administrative==='inactive'?'Inactivo':'Activo')+'</span></td><td><span class="status '+(summary.debtStatus==='pending'?'pending':'active')+'">'+debtLabel+'</span></td><td>'+escapeHTML(summary.lastPayment)+'</td><td><div class="property-row-actions"><button type="button" title="Ver contribuyente" aria-label="Ver contribuyente" data-contributor-action="view" data-contributor-id="'+p.id+'">◉</button>'+(sitmaudCan('contributors.update')?'<button type="button" title="Editar contribuyente" aria-label="Editar contribuyente" data-contributor-action="edit" data-contributor-id="'+p.id+'">✎</button><button type="button" title="Más opciones" aria-label="Más opciones de contribuyente" data-contributor-action="more" data-contributor-id="'+p.id+'">⋮</button>':'')+'</div></td></tr>';
 }).join('')+'</tbody></table>';
}
function contributorActionModal(person,mode='view'){
 const view=mode==='view',name=contributorName(person),summary=contributorPaymentSummary(person);
 const disabled=view?'disabled':'';
 const condoUnits=person.service_account_type==='condominio'?(person.properties||[]).find(p=>p.is_consolidated_master)?.consolidated_units||0:0;
 const field=(label,key,value,type='text')=>'<div class="field"><label>'+label+'</label><input type="'+type+'" name="'+key+'" value="'+escapeHTML(value||'')+'" '+disabled+'></div>';
 return '<div id="contributorActionModal" class="contributor-modal-backdrop open"><section class="contributor-action-dialog" role="dialog" aria-modal="true"><header class="contributor-modal-head"><div><h2>'+(view?'Expediente del contribuyente':'Editar contribuyente')+'</h2><p>Contrato '+escapeHTML(person.contract_number||'—')+' · '+(summary.debtStatus==='pending'?'Con obligaciones pendientes':'Consulta administrativa')+'</p></div><button type="button" class="modal-close" data-contributor-action="close">×</button></header><form id="contributorActionForm"><div class="form-grid">'+
 field('Nombre(s)','first_name',person.first_name)+field('Apellido(s)','last_name',person.last_name)+field('Razón social','legal_name',person.legal_name)+field('Tipo de identificación','identification_type',person.identification_type)+field('Cédula / RIF','identification_number',person.identification_number)+field('Correo','email',person.email,'email')+field('Teléfono','phone',person.phone)+field('Dirección de contacto','contact_address',person.contact_address)+
 '</div><div class="contributor-action-summary"><span>Tipo de contribuyente: <b>'+escapeHTML(contributorType(person.kind))+'</b></span><span>Modalidad: <b>'+(person.service_account_type==='condominio'?'Condominio · Pago único consolidado':'Individual')+'</b></span><span>'+(person.service_account_type==='condominio'?'Viviendas registradas':'Inmuebles')+': <b>'+(person.service_account_type==='condominio'?(condoUnits?condoUnits+' viviendas':'Ficha matriz pendiente'):(person.properties||[]).length)+'</b></span><span>Estado administrativo: <b>'+(person.status==='inactive'?'Inactivo':'Activo')+'</b></span><span>Cuenta: <b>'+(summary.debtStatus==='pending'?'Con deuda':summary.debtStatus==='paid'?'Al día':'Sin liquidaciones')+'</b></span></div><div class="form-actions"><button type="button" class="btn btn-light" data-contributor-action="close">Cerrar</button>'+(view?'<button type="button" class="btn btn-primary" data-contributor-action="edit" data-contributor-id="'+person.id+'">Editar</button>':'<button type="submit" class="btn btn-primary">Guardar cambios</button>')+'</div></form></section></div>';
}
function openContributorAction(id,mode){
 if((mode==='edit'||mode==='more')&&!sitmaudCan('contributors.update')){
  toast('No tienes permiso para editar contribuyentes.');return;
 }
 const person=state.people.find(p=>p.id===id);if(!person)return;
 document.getElementById('contributorActionModal')?.remove();
 if(mode==='more'){
  const action=window.prompt('Opciones del contribuyente:\n1 = Ver expediente\n2 = Editar\n3 = Desactivar / reactivar (sin borrar historial)','1');
  if(action==='3'){toggleContributorActive(person);return}
  if(action==='2')mode='edit';else if(action==='1')mode='view';else return;
 }
 document.body.insertAdjacentHTML('beforeend',contributorActionModal(person,mode));
 document.getElementById('contributorActionForm').dataset.personId=id;
 document.body.classList.add('modal-open');
}
function closeContributorAction(){document.getElementById('contributorActionModal')?.remove();document.body.classList.remove('modal-open')}
async function saveContributorAction(form){
 if(!sitmaudCan('contributors.update')){toast('Sin permiso para editar.');return;}
 const id=form.dataset.personId,person=state.people.find(x=>x.id===id);if(!person)return;
 const f=new FormData(form);const payload={first_name:String(f.get('first_name')||'').trim()||null,last_name:String(f.get('last_name')||'').trim()||null,legal_name:String(f.get('legal_name')||'').trim()||null,identification_type:String(f.get('identification_type')||'').trim(),identification_number:String(f.get('identification_number')||'').trim(),email:String(f.get('email')||'').trim()||null,phone:String(f.get('phone')||'').trim()||null,contact_address:String(f.get('contact_address')||'').trim()||null};
 if(!payload.identification_number||!(person.kind==='juridico'?payload.legal_name:payload.first_name)){toast('Completa la identificación y el nombre del contribuyente.');return;}
 const {data,error}=await imaudClient.from('contributors').update(payload).eq('id',id).select('id').single();
 if(error){console.error(error);toast('No se pudo actualizar: '+error.message);return}
 closeContributorAction();await loadContributors();toast('Contribuyente actualizado correctamente.');
}
async function toggleContributorActive(person){
 const inactive=person.status!=='inactive';
 if(!window.confirm((inactive?'¿Desactivar':'¿Reactivar')+' este contribuyente? No se eliminarán contratos, inmuebles, pagos ni deudas.'))return;
 const {error}=await imaudClient.from('contributors').update({status:inactive?'inactive':'active'}).eq('id',person.id);
 if(error){console.error(error);toast('No se pudo cambiar el estado: '+error.message);return;}
 closeContributorAction();await loadContributors();toast('Estado administrativo actualizado sin borrar el historial.');
}
async function loadContributors(){
 const target=document.getElementById('peopleTable'); if(!target)return;
 target.innerHTML='<div class="contributors-loading">Consultando contribuyentes…</div>';
 const {data,error}=await imaudClient.from('contributors').select('id,contract_number,kind,service_account_type,identification_type,identification_number,legal_name,first_name,last_name,email,phone,contact_address,contact_parish_name,contact_sector_name,is_property_owner,status,created_at,properties(id,is_active,is_consolidated_master,consolidated_units,parish_name,sector_name,assessments(id,status,is_demo)),payments(id,status,paid_at)').order('created_at',{ascending:false});
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
  return (!q||text.includes(q))&&(!type||p.kind===type)&&(!status|| (status==='pending'?summary.debtStatus==='pending':summary.administrative===status))&&(!parish||p.contact_parish_name===parish);
 });
 const target=document.getElementById('peopleTable');if(target)target.innerHTML=peopleTable(rows);
 const count=document.getElementById('contributorsCount');if(count)count.textContent='Mostrando '+rows.length+' de '+state.people.length;
}
function contributorModal(){
 return '<div class="contributor-modal-backdrop" id="contributorModal"><section class="contributor-modal" role="dialog" aria-modal="true" aria-labelledby="contributorModalTitle"><header class="contributor-modal-head"><div class="modal-heading-icon">＋</div><div><h2 id="contributorModalTitle">Nuevo contribuyente</h2><p>Registra al contribuyente y luego agrega el inmueble asociado.</p></div><button type="button" class="modal-close" data-action="close-contributor-modal" aria-label="Cerrar">×</button></header><div class="registration-steps"><div class="registration-step active" id="stepContributor"><b>1</b><span><strong>Registrar contribuyente</strong><small>Completa sus datos</small></span></div><div class="registration-step" id="stepProperty"><b>2</b><span><strong>Registrar inmueble</strong><small>Contrato del contribuyente y dirección</small></span></div></div><div class="registration-columns"><section class="registration-panel"><h3>♙ Registrar contribuyente</h3><p class="panel-hint">Información de la persona u organización responsable.</p><form id="personForm"><div class="form-grid"><div class="field"><label>Tipo de contribuyente *</label><select name="kind" required><option value="natural_venezolano">Persona natural</option><option value="natural_extranjero">Persona extranjera</option><option value="juridico">Persona jurídica</option></select></div><div class="field" id="contributorServiceKindField" hidden><label>Modalidad de registro jurídico *</label><select name="service_account_type" id="contributorServiceAccountType"><option value="individual">Empresa / Organización independiente</option><option value="condominio">Condominio · Pago único consolidado</option></select><small>El condominio tendrá una ficha matriz con la cantidad de viviendas, no una casa individual.</small></div><div class="field"><label>Tipo de identificación *</label><select name="identification_type" required><option value="V">V</option><option value="E">E</option><option value="J">J</option><option value="G">G</option><option value="P">P</option></select></div><div class="field"><label>Cédula / RIF *</label><input name="identification_number" required placeholder="Número de identificación"></div><div class="field"><label>Nombre y apellido / Razón social *</label><input name="name" required placeholder="Nombre completo o razón social"></div><div class="field"><label>Correo electrónico *</label><input type="email" name="email" required placeholder="correo@ejemplo.com" autocomplete="email"></div><div class="field"><label>Teléfono</label><input name="phone" placeholder="+58"></div><div class="field full"><label>Dirección de contacto</label><textarea name="contact_address" rows="2" placeholder="Dirección de residencia o domicilio fiscal"></textarea></div><div class="field"><label>Parroquia</label><select name="contact_parish_name" id="contactParishSelect"><option value="">Seleccione parroquia</option></select></div><div class="field full" id="geographyLoadNotice" role="status" aria-live="polite" hidden></div><div class="field"><label>Sector</label><select name="contact_sector_name" id="contactSectorSelect" disabled><option value="">Seleccione primero la parroquia</option></select></div><div class="field"><label>¿Es propietario?</label><select name="is_property_owner" id="propertyOwnerFlag"><option value="true">Sí</option><option value="false">No</option></select></div><div class="field full" id="propertyOwnerDetails" hidden><h4 class="subform-title">Datos del propietario del inmueble</h4><p class="panel-hint">El propietario quedará registrado por separado. El contribuyente será el responsable del servicio y del pago.</p><div class="form-grid"><div class="field"><label>Nombre completo del propietario *</label><input name="owner_name" id="ownerName" placeholder="Nombre y apellido"></div><div class="field"><label>Tipo de identificación *</label><select name="owner_identification_type" id="ownerIdentificationType"><option value="V">V</option><option value="E">E</option><option value="J">J</option><option value="G">G</option><option value="P">P</option></select></div><div class="field"><label>Cédula / RIF del propietario *</label><input name="owner_identification_number" id="ownerIdentificationNumber" placeholder="Identificación del propietario"></div><div class="field"><label>Teléfono del propietario</label><input name="owner_phone" placeholder="+58"></div><div class="field full"><label>Correo del propietario (opcional)</label><input type="email" name="owner_email" placeholder="correo@ejemplo.com"></div><div class="field"><label>Relación del contribuyente con el inmueble</label><select name="occupant_relationship" id="occupantRelationship"><option value="arrendatario">Arrendatario</option><option value="ocupante">Ocupante</option></select></div></div></div></div><div class="form-actions"><button class="btn btn-primary" id="saveContributorButton">Guardar contribuyente</button></div></form><div class="saved-contributor-note" id="savedContributorNote" hidden></div></section><section class="registration-panel property-panel" id="propertyPanel"><div class="property-lock" id="propertyLock"><span>2</span><b>Primero guarda los datos del contribuyente para habilitar este formulario.</b></div><div id="propertyFormWrap" hidden><h3>⌂ Registrar inmueble</h3><p class="panel-hint">El inmueble quedará vinculado al contrato único del contribuyente.</p><div class="contract-preview" id="contractPreview"><small>N.º de contrato del contribuyente</small><strong>Se asignará al guardar el contribuyente</strong></div><div class="linked-contributor" id="linkedContributor"></div><form id="propertyForm"><div class="form-grid"><div class="field full"><label>Dirección del inmueble *</label><textarea name="address" rows="2" required placeholder="Avenida, calle, número, urbanización"></textarea></div><div class="field"><label>Parroquia</label><select name="parish_id" id="propertyParishSelect"><option value="">Seleccione parroquia</option></select></div><div class="field"><label>Tipo de ubicación *</label><select name="area_type" id="propertyAreaType" required><option value="sector">Sector</option><option value="comunidad">Comunidad</option><option value="urbanizacion_privada">Urbanización privada</option><option value="villa_privada">Villa privada</option></select></div><div class="field" id="propertySectorField"><label>Sector *</label><select name="sector_id" id="propertySectorSelect" disabled><option value="">Seleccione primero la parroquia</option></select></div><div class="field" id="propertyTerritorialAreaField" hidden><label id="propertyTerritorialAreaLabel">Comunidad / urbanización</label><select name="territorial_area_id" id="propertyTerritorialAreaSelect" disabled><option value="">Seleccione primero la parroquia</option></select></div><div class="field full"><button type="button" class="btn btn-light" id="createTerritorialAreaButton">＋ Crear nuevo sector, comunidad o urbanización</button></div><div class="field full territorial-area-creator" id="newTerritorialAreaPanel" hidden><h4 class="subform-title">Nuevo registro territorial</h4><p class="panel-hint">El nuevo registro quedará disponible para futuros inmuebles de esta parroquia.</p><form id="newTerritorialAreaForm"><div class="form-grid"><div class="field"><label>Nombre *</label><input name="name" required minlength="3" maxlength="120" placeholder="Nombre del sector o urbanización"></div><div class="field"><label>Tipología residencial *</label><select name="typology_code" required><option value="">Seleccione tipología</option><option value="TIPO I">Tipo I</option><option value="TIPO II">Tipo II</option><option value="TIPO III">Tipo III</option></select></div><div class="field full"><label>Observación de clasificación (opcional)</label><input name="typology_reason" maxlength="300" placeholder="Referencia de ordenanza o criterio aplicado"></div></div><div class="form-actions"><button type="button" class="btn btn-light" id="cancelTerritorialAreaButton">Cancelar</button><button type="submit" class="btn btn-primary" id="saveTerritorialAreaButton">Guardar registro territorial</button></div></form></div><div class="field"><label>Tipo de inmueble *</label><select name="property_type" required><option value="casa">Casa</option><option value="apartamento">Apartamento</option><option value="edificio">Edificio</option><option value="terreno">Terreno</option><option value="unidad_residencial">Unidad residencial</option></select></div><div class="field"><label>Uso *</label><select name="property_use" required><option value="residencial" selected>Residencial</option></select></div><div class="field"><label>Organización residencial (opcional)</label><input name="organization_name" placeholder="Condominio, villa o urbanización"></div><div class="field"><label>Referencia</label><input name="reference" placeholder="Punto de referencia"></div><div class="field full"><label>Observaciones</label><textarea name="notes" rows="2" placeholder="Información adicional del inmueble"></textarea></div></div><div class="form-actions"><button type="button" class="btn btn-light" data-action="close-contributor-modal">Volver a contribuyentes</button><button class="btn btn-primary" id="savePropertyButton">Registrar inmueble</button></div></form><div class="property-success" id="propertySuccess" hidden></div></div></section></div></section></div>';
}
function openContributorModal(){
 if(!sitmaudCan('contributors.create')){toast('No tienes permiso para registrar contribuyentes.');return;}
 if(!document.getElementById('contributorModal'))document.body.insertAdjacentHTML('beforeend',contributorModal());
 const modal=document.getElementById('contributorModal');modal.classList.add('open');document.body.classList.add('modal-open');const condoOption=modal.querySelector('#contributorServiceAccountType option[value="condominio"]');if(condoOption)condoOption.hidden=true;loadGeographyCatalogs();
}
document.addEventListener('click',e=>{if(e.target.closest('[data-action="retry-geography"]'))loadGeographyCatalogs();});
function closeContributorModal(){
 document.getElementById('contributorModal')?.remove();document.body.classList.remove('modal-open');loadContributors();
}
async function saveContributor(form){
 const f=new FormData(form);const kind=f.get('kind');const fullName=String(f.get('name')||'').trim();const parts=fullName.split(/\s+/);
 const isPropertyOwner=!(kind==='juridico'&&f.get('service_account_type')==='condominio')&&f.get('is_property_owner')==='true';
 if(!isPropertyOwner){
  const ownerName=String(f.get('owner_name')||'').trim(),ownerType=String(f.get('owner_identification_type')||'').trim(),ownerNumber=String(f.get('owner_identification_number')||'').trim();
  if(ownerName.length<3||!['V','E','J','G','P'].includes(ownerType)||ownerNumber.length<5){toast('Completa nombre, tipo y número de identificación del propietario del inmueble.');return;}
  state.pendingPropertyOwner={owner_name:ownerName,identification_type:ownerType,identification_number:ownerNumber,phone:String(f.get('owner_phone')||'').trim()||null,email:String(f.get('owner_email')||'').trim()||null};
  state.pendingOccupantRole=String(f.get('occupant_relationship')||'arrendatario');
 }else{state.pendingPropertyOwner=null;state.pendingOccupantRole='propietario';}
 const {data:{user}}=await imaudClient.auth.getUser();
 const payload={kind,service_account_type:kind==='juridico'&&f.get('service_account_type')==='condominio'?'condominio':'individual',identification_type:f.get('identification_type'),identification_number:String(f.get('identification_number')).trim(),email:String(f.get('email')||'').trim()||null,phone:String(f.get('phone')||'').trim()||null,contact_address:String(f.get('contact_address')||'').trim()||null,contact_parish_name:state.parishes.find(p=>p.id===f.get('contact_parish_name'))?.name||null,contact_sector_name:String(f.get('contact_sector_name')||'').trim()||null,is_property_owner:isPropertyOwner,created_by:user?.id||null};
 if(kind==='juridico'){payload.legal_name=fullName;payload.rif=payload.identification_number;}else{payload.first_name=parts.shift()||fullName;payload.last_name=parts.join(' ');}
 if(!payload.email||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))){
   toast('Es obligatorio registrar un correo válido para enviar automáticamente el acceso ciudadano.');return;
 }
 const button=document.getElementById('saveContributorButton');button.disabled=true;button.textContent='Guardando…';
 const {data:registration,error}=await imaudClient.functions.invoke('register-sitmaud-contributor',{body:payload});
 const data=registration?.contributor;
 button.disabled=false;button.textContent='Guardar contribuyente';
 if(error||!data){
   let reason=registration?.error||error?.message||'No se pudo confirmar el registro.';
   try{if(error?.context){const body=await error.context.json();reason=body.error||reason}}catch(_){}
   console.error('Registro de contribuyente:',reason);
   toast('No se pudo completar: '+reason);return;
 }
 state.currentContributor=data;
 document.getElementById('stepContributor').classList.add('complete');document.getElementById('stepProperty').classList.add('active');
 document.getElementById('personForm').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);
 document.getElementById('savedContributorNote').hidden=false;document.getElementById('savedContributorNote').textContent=data.service_account_type==='condominio'?'Contribuyente jurídico guardado. Completa ahora la ficha matriz y cantidad de viviendas del condominio.':'Contribuyente guardado correctamente. Ahora registra su inmueble.';
 document.getElementById('propertyLock').hidden=true;document.getElementById('propertyFormWrap').hidden=false;
 document.getElementById('linkedContributor').textContent='Contribuyente vinculado: '+contributorName(data)+' · '+data.identification_type+'-'+data.identification_number;
 document.getElementById('contractPreview').innerHTML='<small>N.º de contrato del contribuyente</small><strong>'+escapeHTML(data.contract_number)+'</strong>';
 if(registration.email_requested===true){
   document.getElementById('savedContributorNote').textContent+=' Supabase aceptó el envío automático de acceso al correo registrado. La entrega aún no está verificada.';
   toast('Contribuyente registrado; solicitud automática de correo aceptada.');
 }else{
   document.getElementById('savedContributorNote').textContent+=' CORREO DE ACCESO PENDIENTE: '+(registration.email_error||'El servidor no confirmó el envío.')+' Puedes solicitar un reenvío desde el expediente, sin duplicar el contribuyente.';
   toast('Contribuyente registrado; activación por correo pendiente.');
 }
}
// The contributor form is shared by desktop and mobile. Never leave an empty,
 // apparently usable selector when the network or the territorial catalog fails.
let geographyLoadSequence=0;
async function loadGeographyCatalogs(){
 const seq=++geographyLoadSequence;
 const fields=['contactParishSelect','propertyParishSelect'];
 const retryButton='<button type="button" class="btn btn-light btn-sm" data-action="retry-geography">Reintentar cargar parroquias</button>';
 const notice=document.getElementById('geographyLoadNotice');
 const setNotice=(message,retry=false)=>{
  if(!notice)return;
  notice.innerHTML=escapeHTML(message)+(retry?' '+retryButton:'');
  notice.hidden=false;
 };
 fields.forEach(id=>{const el=document.getElementById(id);if(el){el.disabled=true;el.innerHTML='<option value="">Cargando parroquias…</option>';}});
 setNotice('Consultando las parroquias del municipio…');
 try{
  const p=await imaudClient.from('parishes').select('id,name').eq('is_active',true).order('name');
  if(seq!==geographyLoadSequence||!document.getElementById('contributorModal'))return;
  if(p.error)throw p.error;
  if(!Array.isArray(p.data)||!p.data.length)throw new Error('El catálogo de parroquias no tiene registros activos.');
  state.parishes=p.data;
  const opts='<option value="">Seleccione parroquia</option>'+state.parishes.map(x=>'<option value="'+escapeHTML(x.id)+'">'+escapeHTML(x.name)+'</option>').join('');
  fields.forEach(id=>{const el=document.getElementById(id);if(el){el.innerHTML=opts;el.disabled=false;}});
  // Sectors must not prevent parish selection when their request fails.
  const s=await imaudClient.from('sectors').select('id,name,parish_id,default_typology').eq('is_active',true).order('name');
  if(seq!==geographyLoadSequence||!document.getElementById('contributorModal'))return;
  state.sectors=s.error?[]:(s.data||[]);
  if(s.error)console.error('SITMAUD sectores:',s.error);
  const a=await imaudClient.from('territorial_areas').select('id,name,parish_id,area_type,typology_code').eq('is_active',true).order('name');
  if(seq!==geographyLoadSequence||!document.getElementById('contributorModal'))return;
  state.territorialAreas=a.error?[]:(a.data||[]);
  if(s.error||a.error){console.error('Catálogo territorial:',s.error||a.error);setNotice('Las parroquias están disponibles, pero una parte del catálogo territorial no pudo cargarse. Reintenta antes de registrar el inmueble.',true);}
  else if(notice){notice.hidden=true;notice.textContent='';}
  const chosen=document.getElementById('contactParishSelect');
  if(chosen?.value)updateSectorOptions('contactParishSelect','contactSectorSelect',true);
  updatePropertyLocationFields();
 }catch(error){
  if(seq!==geographyLoadSequence||!document.getElementById('contributorModal'))return;
  console.error('SITMAUD parroquias:',error);
  fields.forEach(id=>{const el=document.getElementById(id);if(el){el.disabled=true;el.innerHTML='<option value="">No se pudieron cargar las parroquias</option>';}});
  setNotice('No se pudieron cargar las parroquias. Revisa tu conexión y pulsa Reintentar. Si persiste, verifica los permisos de lectura del catálogo territorial.',true);
 }
}
function updateSectorOptions(parishId,sectorId,storeName){
 const p=document.getElementById(parishId),s=document.getElementById(sectorId);if(!p||!s)return;
 const rows=state.sectors.filter(x=>x.parish_id===p.value);
 s.disabled=!p.value||!rows.length;
 s.innerHTML='<option value="">'+(p.value?(rows.length?'Seleccione sector':'No hay sectores cargados'):'Seleccione primero la parroquia')+'</option>'+rows.map(x=>'<option value="'+escapeHTML(storeName?x.name:x.id)+'">'+escapeHTML(x.name)+'</option>').join('');
 const preview=document.getElementById(sectorId+'Preview');if(preview){preview.hidden=true;preview.textContent='';}
}
function updatePropertyLocationFields(){
 const type=document.getElementById('propertyAreaType')?.value||'sector';
 const sectorField=document.getElementById('propertySectorField'),areaField=document.getElementById('propertyTerritorialAreaField');
 const sector=document.getElementById('propertySectorSelect'),area=document.getElementById('propertyTerritorialAreaSelect');
 const parish=document.getElementById('propertyParishSelect')?.value||'';
 if(sectorField)sectorField.hidden=type!=='sector';
 if(areaField)areaField.hidden=type==='sector';
 if(sector){const rows=state.sectors.filter(x=>x.parish_id===parish);sector.innerHTML='<option value="">'+(parish?'Seleccione sector':'Seleccione primero la parroquia')+'</option>'+rows.map(x=>'<option value="'+escapeHTML(x.id)+'">'+escapeHTML(x.name)+(x.default_typology?' · '+escapeHTML(x.default_typology):' · Sin tipología')+'</option>').join('');sector.disabled=type!=='sector'||!parish||!rows.length;}
 if(area){const rows=state.territorialAreas.filter(x=>x.parish_id===parish&&x.area_type===type);area.innerHTML='<option value="">'+(parish?'Seleccione '+(type==='comunidad'?'comunidad':type==='urbanizacion_privada'?'urbanización privada':'villa privada'):'Seleccione primero la parroquia')+'</option>'+rows.map(x=>'<option value="'+escapeHTML(x.id)+'">'+escapeHTML(x.name)+' · '+escapeHTML(x.typology_code)+'</option>').join('');area.disabled=type==='sector'||!parish||!rows.length;}
 const label=document.getElementById('propertyTerritorialAreaLabel');if(label)label.textContent=type==='comunidad'?'Comunidad *':type==='urbanizacion_privada'?'Urbanización privada *':'Villa privada *';
 const create=document.getElementById('createTerritorialAreaButton');if(create)create.textContent='＋ Crear nuevo '+(type==='sector'?'sector':type==='comunidad'?'comunidad':type==='urbanizacion_privada'?'urbanización privada':'villa privada');
}
async function saveNewTerritorialArea(form){
 const parishId=document.getElementById('propertyParishSelect')?.value;
 const areaType=document.getElementById('propertyAreaType')?.value||'sector';
 const f=new FormData(form),name=String(f.get('name')||'').trim(),typology=String(f.get('typology_code')||'').trim();
 if(!parishId){toast('Selecciona primero la parroquia del inmueble.');return;}
 if(name.length<3||!['TIPO I','TIPO II','TIPO III'].includes(typology)){toast('Completa el nombre y la tipología residencial.');return;}
 const button=document.getElementById('saveTerritorialAreaButton');button.disabled=true;button.textContent='Guardando…';
 const {data,error}=await imaudClient.rpc('create_sitmaud_territorial_area',{p_parish_id:parishId,p_name:name,p_area_type:areaType,p_typology_code:typology,p_typology_reason:String(f.get('typology_reason')||'').trim()||null});
 button.disabled=false;button.textContent='Guardar registro territorial';
 if(error){console.error('Nuevo registro territorial:',error);toast('No se pudo crear: '+error.message);return;}
 if(areaType==='sector'){
  const {data:rows,error:sectorError}=await imaudClient.from('sectors').select('id,name,parish_id,default_typology').eq('is_active',true).eq('parish_id',parishId).order('name');
  if(sectorError){toast('El sector se creó, pero no se pudo actualizar el selector. Pulsa reintentar.');return;}
  state.sectors=state.sectors.filter(x=>x.parish_id!==parishId).concat(rows||[]);
  updatePropertyLocationFields();
  const select=document.getElementById('propertySectorSelect');if(select)select.value=data.sector_id||data.id;
 }else{
  state.territorialAreas.push({id:data.territorial_area_id||data.id,name:data.name,parish_id:parishId,area_type:areaType,typology_code:data.typology_code||typology});
  updatePropertyLocationFields();
  const select=document.getElementById('propertyTerritorialAreaSelect');if(select)select.value=data.territorial_area_id||data.id;
 }
 const panel=document.getElementById('newTerritorialAreaPanel');if(panel)panel.hidden=true;
 form.reset();
 toast('Registro territorial creado y disponible para este inmueble.');
}
async function saveProperty(form){
 const f=new FormData(form),contributor=state.currentContributor;
 if(!contributor){toast('Primero debes guardar el contribuyente.');return;}
 const parishId=String(f.get('parish_id')||'');
 const areaType=String(f.get('area_type')||'sector');
 const isOwner=contributor.is_property_owner!==false;
 const owner=state.pendingPropertyOwner;
 if(!parishId){toast('Selecciona la parroquia del inmueble.');return;}
 if(!isOwner&&(!owner||!owner.owner_name||!owner.identification_number)){toast('Faltan los datos del propietario. Vuelve al paso anterior y complétalos.');return;}
 const sectorId=areaType==='sector'?String(f.get('sector_id')||'')||null:null;
 const areaId=areaType==='sector'?null:String(f.get('territorial_area_id')||'')||null;
 if(areaType==='sector'&&!sectorId){toast('Selecciona un sector o crea uno nuevo.');return;}
 if(areaType!=='sector'&&!areaId){toast('Selecciona la comunidad, urbanización o villa, o crea un nuevo registro.');return;}
 const button=document.getElementById('savePropertyButton');button.disabled=true;button.textContent='Registrando…';
 const {data,error}=await imaudClient.rpc('register_sitmaud_individual_property',{
  p_contributor_id:contributor.id,p_address:String(f.get('address')||'').trim(),
  p_property_type:String(f.get('property_type')||'casa'),p_parish_id:parishId,p_area_type:areaType,
  p_sector_id:sectorId,p_territorial_area_id:areaId,p_is_property_owner:isOwner,
  p_owner_name:owner?.owner_name||null,p_owner_identification_type:owner?.identification_type||null,
  p_owner_identification_number:owner?.identification_number||null,p_owner_phone:owner?.phone||null,
  p_owner_email:owner?.email||null,p_occupant_role:state.pendingOccupantRole||'arrendatario',
  p_reference:String(f.get('reference')||'').trim()||null,p_notes:String(f.get('notes')||'').trim()||null
 });
 button.disabled=false;button.textContent='Registrar inmueble';
 if(error){console.error('Registro de inmueble:',error);toast('No se pudo registrar: '+error.message);return;}
 document.getElementById('contractPreview').innerHTML='<small>N.º de contrato del contribuyente</small><strong>'+escapeHTML(contributor.contract_number)+'</strong>';
 document.getElementById('propertyForm').hidden=true;
 document.getElementById('propertySuccess').hidden=false;
 document.getElementById('propertySuccess').innerHTML='<b>✓ Inmueble registrado correctamente</b><span>Contrato: <strong>'+escapeHTML(contributor.contract_number)+'</strong></span><span>Propietario y responsable de pago quedaron registrados por separado.</span><button type="button" class="btn btn-primary" data-action="close-contributor-modal">Finalizar y volver al directorio</button>';
 document.getElementById('stepProperty').classList.add('complete');
 toast('Inmueble, propietario y responsable registrados correctamente.');
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
 const official=(p.assessments||[]).filter(a=>a.is_demo===false&&a.status!=='void');
 // Un inmueble sin liquidaciones oficiales no demuestra que el titular esté al día.
 if(!official.length)return 'unassessed';
 if(official.some(a=>['pending','partially_paid'].includes(a.status)))return 'pending';
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
  imaudClient.from('properties').select('id,address,property_type,property_use,is_consolidated_master,consolidated_units,parish_id,sector_id,parish_name,sector_name,typology_override,typology_override_reason,organization_name,reference,notes,is_active,created_at,contributor:contributors!properties_contributor_id_fkey(id,contract_number,kind,identification_type,identification_number,legal_name,first_name,last_name),parish:parishes!properties_parish_id_fkey(name),sector:sectors!properties_sector_id_fkey(name,default_typology)').eq('is_consolidated_master',false).order('created_at',{ascending:false}),
  imaudClient.from('assessments').select('id,property_id,status,period_start,total_amount,coefficient_snapshot,udc_value_snapshot,udc_currency_code,is_demo').eq('is_demo',false),
  imaudClient.from('parishes').select('id,name').eq('is_active',true).order('name'),
  imaudClient.from('sectors').select('id,name,parish_id,default_typology').eq('is_active',true).order('name')
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
  const hay=[c.contract_number,p.address,p.parish?.name,p.parish_name,p.sector?.name,p.sector_name,propertyContributorName(c),c.identification_type,c.identification_number].join(' ').toLowerCase();
  return (!q||hay.includes(q))&&(!parish||p.parish_id===parish)&&(!sector||p.sector_id===sector)&&(!status||propertyStatus(p)===status);
 });
}
function renderPropertiesTable(){
 const rows=filteredProperties(),pages=Math.max(1,Math.ceil(rows.length/PROPERTY_PAGE_SIZE));
 state.propertyPage=Math.min(state.propertyPage,pages);
 const from=(state.propertyPage-1)*PROPERTY_PAGE_SIZE,visible=rows.slice(from,from+PROPERTY_PAGE_SIZE);
 const labels={active:'Al día',pending:'Con deuda',inactive:'Inactivo',unassessed:'Sin liquidaciones'},target=document.getElementById('propertiesTable');
 if(!rows.length)target.innerHTML='<div class="contributors-empty"><b>No hay inmuebles que mostrar</b><span>Registra un inmueble o ajusta los filtros de búsqueda.</span></div>';
 else target.innerHTML='<table><thead><tr><th>Contrato del contribuyente</th><th>Contribuyente</th><th>Cédula / RIF</th><th>Parroquia</th><th>Sector</th><th>Estado</th><th>Último pago</th><th>Acciones</th></tr></thead><tbody>'+visible.map(p=>{
  const c=p.contributor||{},status=propertyStatus(p);
  return '<tr><td><strong>'+escapeHTML(c.contract_number||'Sin asignar')+'</strong></td><td><strong>'+escapeHTML(propertyContributorName(c))+'</strong></td><td>'+escapeHTML((c.identification_type||'')+(c.identification_number?'-'+c.identification_number:'')||'—')+'</td><td>'+escapeHTML(p.parish?.name||p.parish_name||'—')+'</td><td>'+escapeHTML(p.sector?.name||p.sector_name||'—')+'</td><td><span class="status '+status+'">'+labels[status]+'</span></td><td>'+escapeHTML(propertyLastPayment(p))+'</td><td><div class="property-row-actions"><button type="button" title="Ver inmueble" data-property-action="view" data-property-id="'+p.id+'">◉</button>'+(sitmaudCan('properties.update')?'<button type="button" title="Editar inmueble" data-property-action="edit" data-property-id="'+p.id+'">✎</button><button type="button" title="Más opciones" data-property-action="more" data-property-id="'+p.id+'">⋮</button>':'')+'</div></td></tr>';
 }).join('')+'</tbody></table>';
 document.getElementById('propertiesCount').textContent='Mostrando '+(rows.length?from+1:0)+'–'+Math.min(from+PROPERTY_PAGE_SIZE,rows.length)+' de '+rows.length;
 document.getElementById('propertyPagination').innerHTML=rows.length?'<span>'+rows.length.toLocaleString('es-VE')+' inmuebles filtrados</span><div><button type="button" data-property-page="'+Math.max(1,state.propertyPage-1)+'" '+(state.propertyPage===1?'disabled':'')+'>‹</button><b>'+state.propertyPage+' / '+pages+'</b><button type="button" data-property-page="'+Math.min(pages,state.propertyPage+1)+'" '+(state.propertyPage===pages?'disabled':'')+'>›</button></div>':'';
}

function propertyRegistrationModal(){
 return '<div class="contributor-modal-backdrop open" id="propertyRegistrationModal"><section class="property-registration-modal" role="dialog" aria-modal="true" aria-labelledby="propertyRegistrationTitle"><header class="contributor-modal-head"><div class="modal-heading-icon">⌂</div><div><h2 id="propertyRegistrationTitle">Registrar inmueble</h2><p>Busca primero al contribuyente y agrega uno o varios inmuebles a su expediente.</p></div><button type="button" class="modal-close" data-action="close-property-modal">×</button></header><section class="property-lookup"><h3>1. Buscar contribuyente</h3><p class="panel-hint">Introduce su cédula o RIF para identificar el expediente.</p><div class="property-lookup-row"><input id="propertyContributorId" placeholder="Ej. V-XXXXXXXX o J-XXXXXXXX"><button type="button" class="btn btn-primary" data-action="find-property-contributor">Buscar contribuyente</button></div><div id="propertyContributorResult"></div></section><section class="property-new-panel" id="propertyNewPanel" hidden><div class="property-linked-card" id="propertyLinkedCard"></div><div class="property-add-heading"><div><h3>2. Agregar inmueble</h3><p class="panel-hint">El número de contrato pertenece al contribuyente y se comparte con todos sus inmuebles.</p></div><span class="property-count-chip" id="propertyLinkedCount">0 inmuebles registrados</span></div><form id="standalonePropertyForm"><div class="form-grid"><div class="field full"><label>Dirección del inmueble *</label><textarea name="address" rows="2" required placeholder="Avenida, calle, número, urbanización"></textarea></div><div class="field"><label>Parroquia *</label><select name="parish_id" id="standaloneParish" required><option value="">Seleccione parroquia</option></select></div><div class="field"><label>Sector *</label><select name="sector_id" id="standaloneSector" required disabled><option value="">Seleccione primero la parroquia</option></select></div><div class="field"><label>Tipo de inmueble *</label><select name="property_type" required><option value="casa">Casa</option><option value="apartamento">Apartamento</option><option value="unidad_residencial">Unidad residencial</option><option value="edificio">Edificio residencial</option></select></div><div class="field"><label>Uso</label><input value="Residencial" disabled></div><div class="field"><label>Organización residencial (opcional)</label><input name="organization_name" placeholder="Condominio, villa o urbanización"></div><div class="field"><label>Referencia</label><input name="reference" placeholder="Punto de referencia"></div><div class="field full"><label>Observaciones</label><textarea name="notes" rows="2" placeholder="Información adicional del inmueble"></textarea></div></div><div class="form-actions"><button class="btn btn-primary" id="standaloneSaveProperty">Guardar inmueble</button></div></form><div id="standalonePropertySuccess" class="property-success" hidden></div><div id="propertyExistingList" class="property-existing-list"></div></section></section></div>';
}
async function openPropertyRegistrationModal(){
 if(!document.getElementById('propertyRegistrationModal'))document.body.insertAdjacentHTML('beforeend',propertyRegistrationModal());
 document.body.classList.add('modal-open');
 const [p,s]=await Promise.all([imaudClient.from('parishes').select('id,name').eq('is_active',true).order('name'),imaudClient.from('sectors').select('id,name,parish_id,default_typology').eq('is_active',true).order('name')]);
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
 let query=imaudClient.from('contributors').select('id,contract_number,kind,service_account_type,identification_type,identification_number,legal_name,first_name,last_name,is_property_owner').ilike('identification_number','%'+digits).limit(3);
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
 document.getElementById('propertyLinkedCard').innerHTML='<span class="property-linked-icon">♙</span><div><b>'+escapeHTML(propertyContributorName(contributor))+'</b><small>'+escapeHTML(contributor.identification_type+'-'+contributor.identification_number)+'</small><small>Contrato del contribuyente: <strong>'+escapeHTML(contributor.contract_number||'Sin asignar')+'</strong></small></div>';
 document.getElementById('propertyLinkedCount').textContent=(existing.data||[]).length+' inmuebles registrados';
 renderExistingPropertyList(existing.data||[]);
}
function renderExistingPropertyList(rows){
 const target=document.getElementById('propertyExistingList');if(!target)return;
 target.innerHTML='<h4>Inmuebles asociados al contrato del contribuyente</h4>'+(rows.length?'<div class="property-existing-items">'+rows.map(p=>'<div><b>'+escapeHTML(p.address)+'</b><small>'+escapeHTML([p.parish_name,p.sector_name].filter(Boolean).join(' · ')||'Ubicación no especificada')+'</small></div>').join('')+'</div>':'<p class="panel-hint">Este contribuyente todavía no tiene inmuebles registrados.</p>');
}
async function saveStandaloneProperty(form){
 const contributor=state.propertySelectedContributor;if(!contributor){toast('Primero busca al contribuyente por cédula o RIF.');return;}
 const f=new FormData(form),button=document.getElementById('standaloneSaveProperty');button.disabled=true;button.textContent='Guardando…';
 const parish=state.parishes.find(x=>x.id===f.get('parish_id')),sector=state.sectors.find(x=>x.id===f.get('sector_id'));
 const payload={contributor_id:contributor.id,address:String(f.get('address')||'').trim(),property_type:f.get('property_type'),property_use:'residencial',parish_id:parish?.id||null,sector_id:sector?.id||null,parish_name:parish?.name||null,sector_name:sector?.name||null,organization_name:String(f.get('organization_name')||'').trim()||null,reference:String(f.get('reference')||'').trim()||null,notes:String(f.get('notes')||'').trim()||null,is_active:true};
 const {data,error}=await imaudClient.from('properties').insert(payload).select('id,address,parish_name,sector_name,is_active').single();
 button.disabled=false;button.textContent='Guardar inmueble';
 if(error){console.error(error);toast('No se pudo registrar el inmueble: '+error.message);return;}
 const relation=await imaudClient.from('property_relationships').insert({property_id:data.id,contributor_id:contributor.id,relationship_role:contributor.is_property_owner===false?'responsable_pago':'propietario',is_current:true,is_payment_responsible:true});
 if(relation.error)console.error('Relación del inmueble:',relation.error);
 const success=document.getElementById('standalonePropertySuccess');success.hidden=false;success.innerHTML='<b>✓ Inmueble registrado correctamente</b><span>Contrato del contribuyente: <strong>'+escapeHTML(contributor.contract_number||'No asignado')+'</strong></span><span>Puedes agregar otro inmueble al mismo contribuyente.</span>';
 form.reset();document.getElementById('standaloneSector').disabled=true;document.getElementById('standaloneSector').innerHTML='<option value="">Seleccione primero la parroquia</option>';
 const existing=await imaudClient.from('properties').select('id,contract_number,address,parish_name,sector_name,is_active').eq('contributor_id',contributor.id).order('created_at',{ascending:false});
 renderExistingPropertyList(existing.data||[]);document.getElementById('propertyLinkedCount').textContent=(existing.data||[]).length+' inmuebles registrados';
 await loadProperties();toast('Inmueble agregado al contrato '+contributor.contract_number);
}
function closePropertyRegistrationModal(){document.getElementById('propertyRegistrationModal')?.remove();document.body.classList.remove('modal-open');state.propertySelectedContributor=null;}

function openPropertyEdit(id){
 const p=state.properties.find(x=>x.id===id);if(!p)return;
 const parishOptions='<option value="">Seleccione parroquia</option>'+state.parishes.map(x=>'<option value="'+escapeHTML(x.id)+'" '+(x.id===p.parish_id?'selected':'')+'>'+escapeHTML(x.name)+'</option>').join('');
 const sectorOptions='<option value="">Seleccione sector</option>'+state.sectors.filter(x=>x.parish_id===p.parish_id).map(x=>'<option value="'+escapeHTML(x.id)+'" '+(x.id===p.sector_id?'selected':'')+'>'+escapeHTML(x.name)+'</option>').join('');
 const sectorData=state.sectors.find(x=>x.id===p.sector_id);
 const sectorDefault=sectorData?.default_typology||p.sector?.default_typology||'Sin clasificación';
 const overrideOptions=['TIPO I','TIPO II','TIPO III'].map(t=>'<option value="'+t+'" '+(p.typology_override===t?'selected':'')+'>'+t+'</option>').join('');
 const markup='<div class="contributor-modal-backdrop open" id="propertyEditModal"><section class="property-registration-modal"><header class="contributor-modal-head"><div class="modal-heading-icon">✎</div><div><h2>Editar inmueble</h2><p>Contrato del contribuyente: '+escapeHTML(p.contributor?.contract_number||'Sin asignar')+'</p></div><button type="button" class="modal-close" data-action="close-property-edit">×</button></header><form id="editPropertyForm" data-property-id="'+p.id+'"><div class="form-grid" style="margin-top:18px"><div class="field full"><label>Dirección del inmueble *</label><textarea name="address" rows="2" required>'+escapeHTML(p.address||'')+'</textarea></div><div class="field"><label>Parroquia</label><select name="parish_id" id="editPropertyParish">'+parishOptions+'</select></div><div class="field"><label>Sector</label><select name="sector_id" id="editPropertySector">'+sectorOptions+'</select></div><div class="field"><label>Tipo de inmueble *</label><select name="property_type" required><option value="casa" '+(p.property_type==='casa'?'selected':'')+'>Casa</option><option value="apartamento" '+(p.property_type==='apartamento'?'selected':'')+'>Apartamento</option><option value="unidad_residencial" '+(p.property_type==='unidad_residencial'?'selected':'')+'>Unidad residencial</option><option value="edificio" '+(p.property_type==='edificio'?'selected':'')+'>Edificio residencial</option></select></div><div class="field"><label>Tipología según sector</label><input id="propertySectorTypology" value="'+escapeHTML(sectorDefault)+'" disabled></div><div class="field"><label>Tipología particular del inmueble</label><select name="typology_override" id="editPropertyTypology"><option value="">Automática según sector</option>'+overrideOptions+'</select></div><div class="field full"><label>Motivo de clasificación particular (obligatorio cuando se modifica)</label><textarea name="typology_override_reason" rows="2" placeholder="Justificación de la clasificación particular, mínimo 10 caracteres">'+escapeHTML(p.typology_override_reason||'')+'</textarea><small>Solo un intendente puede autorizar esta excepción. No cambia las liquidaciones ya emitidas.</small></div><div class="field"><label>Estado administrativo</label><select name="is_active"><option value="true" '+(p.is_active?'selected':'')+'>Activo</option><option value="false" '+(!p.is_active?'selected':'')+'>Inactivo</option></select></div><div class="field"><label>Organización residencial</label><input name="organization_name" value="'+escapeHTML(p.organization_name||'')+'"></div><div class="field"><label>Referencia</label><input name="reference" value="'+escapeHTML(p.reference||'')+'"></div><div class="field full"><label>Observaciones</label><textarea name="notes" rows="2">'+escapeHTML(p.notes||'')+'</textarea></div></div><div class="form-actions"><button type="button" class="btn btn-light" data-action="close-property-edit">Cancelar</button><button class="btn btn-primary" id="savePropertyEditButton">Guardar cambios</button></div></form></section></div>';
 document.body.insertAdjacentHTML('beforeend',markup);document.body.classList.add('modal-open');
}
async function savePropertyEdit(form){
 const id=form.dataset.propertyId,f=new FormData(form),button=document.getElementById('savePropertyEditButton');
 const parish=state.parishes.find(x=>x.id===f.get('parish_id')),sector=state.sectors.find(x=>x.id===f.get('sector_id'));
 button.disabled=true;button.textContent='Guardando…';
 const requestedTypology=String(f.get('typology_override')||'');
 const reason=String(f.get('typology_override_reason')||'').trim();
 if(requestedTypology && reason.length<10){button.disabled=false;button.textContent='Guardar cambios';toast('Explica la clasificación particular en al menos 10 caracteres.');return;}
 const payload={address:String(f.get('address')||'').trim(),parish_id:parish?.id||null,sector_id:sector?.id||null,parish_name:parish?.name||null,sector_name:sector?.name||null,property_type:f.get('property_type'),property_use:'residencial',organization_name:String(f.get('organization_name')||'').trim()||null,reference:String(f.get('reference')||'').trim()||null,notes:String(f.get('notes')||'').trim()||null,is_active:f.get('is_active')==='true',typology_override:requestedTypology||null,typology_override_reason:requestedTypology?reason:null};
 const {error}=await imaudClient.from('properties').update(payload).eq('id',id);
 button.disabled=false;button.textContent='Guardar cambios';
 if(error){console.error(error);toast('No se pudieron guardar los cambios: '+error.message);return;}
 document.getElementById('propertyEditModal')?.remove();document.body.classList.remove('modal-open');await loadProperties();toast('Inmueble actualizado correctamente');
}
function showPropertyDetails(id){
 const p=state.properties.find(x=>x.id===id);if(!p)return;
 const c=p.contributor||{},status=propertyStatus(p),labels={active:'Al día',pending:'Con deuda',inactive:'Inactivo',unassessed:'Sin liquidaciones'};
 const sectorTypology=p.sector?.default_typology||state.sectors.find(x=>x.id===p.sector_id)?.default_typology||'Sin clasificación';
 const effectiveTypology=p.typology_override||sectorTypology;
 const coefficient={'TIPO I':3,'TIPO II':1.5,'TIPO III':0.5}[effectiveTypology];
 const currentDue=(p.assessments||[]).filter(a=>a.status!=='void').sort((a,b)=>String(b.period_start||'').localeCompare(String(a.period_start||'')))[0];
 const udcSnapshot=currentDue?.udc_value_snapshot;
 const monthlyAmount=coefficient&&udcSnapshot?new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.round(coefficient*Number(udcSnapshot)*100)/100):null;
 const tariffSummary=coefficient?(coefficient.toLocaleString('es-VE')+' UCD'+(monthlyAmount?' · Bs. '+monthlyAmount:' · pendiente de tasa UCD')):'Tarifa pendiente de clasificación';
 const markup='<div class="property-detail-backdrop" id="propertyDetailModal"><section class="property-detail-modal"><header><div><h2>Expediente del inmueble</h2><p>Contrato del contribuyente: '+escapeHTML(c.contract_number||'Sin asignar')+'</p></div><button type="button" data-action="close-property-detail">×</button></header><div class="property-detail-grid"><div><small>Contribuyente</small><b>'+escapeHTML(propertyContributorName(c))+'</b></div><div><small>Cédula / RIF</small><b>'+escapeHTML(c.identification_type+'-'+c.identification_number)+'</b></div><div><small>Dirección completa</small><b>'+escapeHTML(p.address)+'</b></div><div><small>Parroquia</small><b>'+escapeHTML(p.parish?.name||p.parish_name||'—')+'</b></div><div><small>Sector</small><b>'+escapeHTML(p.sector?.name||p.sector_name||'—')+'</b></div><div><small>Tipo</small><b>'+escapeHTML(p.property_type||'—')+'</b></div><div><small>Uso</small><b>Residencial</b></div><div><small>Tipología automática del sector</small><b>'+escapeHTML(sectorTypology)+'</b></div><div><small>Tipología aplicable al inmueble</small><b>'+escapeHTML(effectiveTypology)+(p.typology_override?' (particular)':' (automática)')+'</b></div><div><small>Tarifa residencial según ordenanza</small><b>'+escapeHTML(tariffSummary)+'</b></div><div><small>Motivo de excepción</small><b>'+escapeHTML(p.typology_override_reason||'No aplica')+'</b></div><div><small>Organización residencial</small><b>'+escapeHTML(p.organization_name||'—')+'</b></div><div><small>Referencia</small><b>'+escapeHTML(p.reference||'—')+'</b></div><div><small>Observaciones</small><b>'+escapeHTML(p.notes||'—')+'</b></div><div><small>Estado</small><b>'+labels[status]+'</b></div><div><small>Último pago</small><b>'+escapeHTML(propertyLastPayment(p))+'</b></div></div></section></div>';
 document.body.insertAdjacentHTML('beforeend',markup);
}
function organizations(){
 return head('Condominios','Registro y administración de cuentas jurídicas con cobro consolidado.','<button class="btn btn-primary" data-go="condominio_registro">＋ Registrar condominio</button>')+
 '<section class="card condo-directory-panel"><div class="table-toolbar"><div><h3>Directorio de condominios</h3><p>Ficha matriz, responsable, tipología y situación de cuenta oficial</p></div></div><div id="condoDirectory" class="condo-directory"><div class="contributors-loading">Cargando condominios registrados…</div></div></section>';
}
async function loadOrganizations(){
 const target=document.getElementById('condoDirectory');if(!target)return;
 const [orgRes,contribRes]=await Promise.all([
  imaudClient.from('residential_organizations').select('id,contributor_id,display_name,unit_count,consolidated_billing,representative_name,billing_typology').eq('consolidated_billing',true).order('created_at',{ascending:false}),
  imaudClient.from('contributors').select('id,contract_number,identification_type,identification_number,legal_name,service_account_type,responsible_name').eq('service_account_type','condominio').order('created_at',{ascending:false})
 ]);
 if(!document.getElementById('condoDirectory'))return;
 if(orgRes.error||contribRes.error){target.innerHTML='<div class="contributors-empty"><b>No se pudo consultar el directorio de condominios.</b><span>'+escapeHTML(orgRes.error?.message||contribRes.error?.message)+'</span></div>';return;}
 const orgs=orgRes.data||[],contributors=contribRes.data||[];
 const count=document.getElementById('condoDirectoryCount');if(count)count.textContent=orgs.length.toLocaleString('es-VE');
 const homes=document.getElementById('condoHomesCount');if(homes)homes.textContent=orgs.reduce((sum,x)=>sum+Number(x.unit_count||0),0).toLocaleString('es-VE');
 const orgByContributor=new Map(orgs.map(o=>[o.contributor_id,o]));
 if(!contributors.length){target.innerHTML='<div class="contributors-empty"><b>Aún no hay condominios registrados.</b><span>Selecciona «Registrar condominio» para crear una persona jurídica y su ficha matriz con viviendas y tipología.</span></div>';return;}
 const orgIds=orgs.map(o=>o.id);
 let properties=[],assessments=[];
 if(orgIds.length){
  const {data,error}=await imaudClient.from('properties').select('id,organization_id,parish_name,sector_name').in('organization_id',orgIds).eq('is_consolidated_master',true);
  if(!error)properties=data||[];
 }
 const ids=properties.map(x=>x.id);
 if(ids.length){
  const {data,error}=await imaudClient.from('assessments').select('property_id,status,total_amount,is_demo').in('property_id',ids).eq('is_demo',false);
  if(!error)assessments=data||[];
 }
 if(!document.getElementById('condoDirectory'))return;
 const propertyMap=new Map(properties.map(x=>[x.organization_id,x]));
 target.innerHTML='<div class="condo-directory-scroll"><table><thead><tr><th>Condominio / Razón social</th><th>RIF y contrato</th><th>Administrador responsable</th><th>Viviendas</th><th>Ubicación</th><th>Tipología</th><th>Obligación pendiente</th><th>Acciones</th></tr></thead><tbody>'+
 contributors.map(c=>{
  const o=orgByContributor.get(c.id),p=o?propertyMap.get(o.id):null;
  const pending=assessments.filter(a=>a.property_id===p?.id&&['pending','partially_paid'].includes(a.status));
  const debt=pending.reduce((n,a)=>n+Number(a.total_amount||0),0);
  const fmt=new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(debt);
  const rif=[c.identification_type,c.identification_number].filter(Boolean).join('-');
  return '<tr><td><b>'+escapeHTML(o?.display_name||c.legal_name||'Condominio sin nombre')+'</b><small>'+escapeHTML(c.legal_name||'')+'</small></td><td>'+escapeHTML(rif)+'<small>'+escapeHTML(c.contract_number||'—')+'</small></td><td>'+escapeHTML(c.responsible_name||o?.representative_name||'Pendiente')+'</td><td><strong>'+(o?Number(o.unit_count||0).toLocaleString('es-VE'):'Pendiente')+'</strong></td><td>'+escapeHTML([p?.parish_name,p?.sector_name].filter(Boolean).join(' · ')||'Ficha pendiente')+'</td><td><strong>'+escapeHTML(o?.billing_typology||'Pendiente')+'</strong></td><td>'+escapeHTML(o?'Bs. '+fmt:'Sin liquidar')+'</td><td>'+(o&&p?'<button type="button" class="btn btn-light btn-sm" data-condo-assess="'+escapeHTML(o.id)+'">Generar obligaciones</button>':'<span class="status">Ficha pendiente</span>')+'</td></tr>';
 }).join('')+'</tbody></table></div>';
}
function payments(){
 return head('Recaudación y pagos','Listado de contribuyentes con obligaciones pendientes del servicio de aseo urbano y domiciliario.','<button class="btn btn-primary" data-action="new-payment">＋ Registrar pago</button>')+
 '<section class="card payment-debt-card"><div class="payment-list-head"><div><h3>Contribuyentes con deudas</h3><p>Personas y organizaciones con obligaciones pendientes o parcialmente pagadas.</p></div><span class="table-count" id="paymentDebtorCount">Consultando…</span></div><div class="payment-debt-toolbar"><input id="paymentDebtorSearch" class="search" placeholder="Buscar por cédula, contrato o contribuyente…"><select id="paymentDebtStatus" class="filter-select"><option value="all">Todas las deudas</option><option value="pending">Pendientes</option><option value="partial">Parcialmente pagadas</option></select></div><div id="paymentDebtorsTable" class="payment-debt-table"><div class="contributors-loading">Consultando obligaciones pendientes…</div></div></section>'+
 '<section class="card demo-payment-history"><div class="payment-list-head"><div><h3>Pagos registrados de prueba</h3><p>Comprobantes DEMO emitidos al registrar cada pago. Tesorería verifica la acreditación bancaria por separado.</p></div><span class="table-count" id="demoPaymentsCount">Consultando…</span></div><div id="demoPaymentsHistory" class="payment-debt-table"><div class="contributors-loading">Consultando historial de pruebas…</div></div></section>';
}
function assessmentBalance(assessment){
 const applied=(assessment.payment_allocations||[]).reduce((sum,allocation)=>{
  const status=allocation.payments?.status;
  return sum+(status==='confirmed'?Number(allocation.amount||0):0);
 },0);
 return Math.max(0,Number(assessment.total_amount||0)-applied);
}
function debtRowsFromContributor(person){
 const rows=[];
 (person.properties||[]).filter(property=>property.is_active!==false).forEach(property=>{
  (property.assessments||[]).filter(assessment=>assessment.is_demo===false&&['pending','partially_paid'].includes(assessment.status)).forEach(assessment=>{
   const balance=assessmentBalance(assessment);
   if(balance>0) rows.push({id:assessment.id,propertyId:property.id,propertyAddress:property.is_consolidated_master?('Cuenta matriz · '+(property.consolidated_units||0)+' viviendas'):property.address,periodStart:assessment.period_start,periodEnd:assessment.period_end,total:Number(assessment.total_amount||0),balance,status:assessment.status});
  });
 });
 return rows;
}
function paymentDebtorRecords(){
 return (state.paymentDebtors||[]).map(person=>({person,debts:debtRowsFromContributor(person)})).filter(item=>item.debts.length);
}
function paymentDebtorTable(){
 const query=(document.getElementById('paymentDebtorSearch')?.value||'').trim().toLowerCase();
 const status=document.getElementById('paymentDebtStatus')?.value||'all';
 const records=paymentDebtorRecords().filter(({person,debts})=>{
  const haystack=[contributorName(person),person.identification_type+'-'+person.identification_number,person.contract_number].join(' ').toLowerCase();
  return (!query||haystack.includes(query))&&(status==='all'||(status==='partial'?debts.some(d=>d.status==='partially_paid'):debts.some(d=>d.status==='pending')));
 });
 const count=document.getElementById('paymentDebtorCount');if(count)count.textContent=records.length+' contribuyentes con deuda';
 const perPage=10,totalPages=Math.max(1,Math.ceil(records.length/perPage));state.paymentPage=Math.min(state.paymentPage,totalPages);
 const pageRows=records.slice((state.paymentPage-1)*perPage,state.paymentPage*perPage);
 if(!records.length)return '<div class="payment-debt-empty"><b>No se encontraron contribuyentes con deudas.</b><span>Cuando existan obligaciones pendientes, aparecerán en este listado.</span></div>';
 const rows=pageRows.map(({person,debts})=>{
  const amount=debts.reduce((sum,debt)=>sum+debt.balance,0);
  const identification=(person.identification_type||'')+'-'+(person.identification_number||'');
  const propertyCount=new Set(debts.map(d=>d.propertyId)).size;const units=(person.properties||[]).find(p=>p.is_consolidated_master)?.consolidated_units||0;
  return '<tr><td><strong>'+escapeHTML(person.contract_number||'—')+'</strong></td><td>'+escapeHTML(contributorName(person))+'</td><td>'+escapeHTML(identification)+'</td><td>'+(person.service_account_type==='condominio'?units+' viviendas':propertyCount+' inmueble(s)')+'</td><td>'+debts.length+'</td><td><strong>Bs. '+money(amount)+'</strong></td><td><span class="status pending">Pendiente</span></td><td><button class="btn btn-light btn-sm" data-payment-person="'+escapeHTML(person.id)+'">Ver / pagar</button></td></tr>';
 }).join('');
 return '<div class="payment-debt-scroll"><table><thead><tr><th>N.º de contrato</th><th>Contribuyente</th><th>Cédula / RIF</th><th>Inmuebles / Viviendas</th><th>Períodos</th><th>Monto adeudado</th><th>Estado</th><th>Acción</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="property-pagination"><span>Mostrando '+((state.paymentPage-1)*perPage+1)+' a '+Math.min(state.paymentPage*perPage,records.length)+' de '+records.length+' contribuyentes</span><div><button data-payment-page="'+Math.max(1,state.paymentPage-1)+'" '+(state.paymentPage===1?'disabled':'')+'>‹</button><span>Página '+state.paymentPage+' de '+totalPages+'</span><button data-payment-page="'+Math.min(totalPages,state.paymentPage+1)+'" '+(state.paymentPage===totalPages?'disabled':'')+'>›</button></div></div>';
}
async function loadPaymentDebtors(){
 const target=document.getElementById('paymentDebtorsTable');if(!target)return;
 target.innerHTML='<div class="contributors-loading">Consultando obligaciones pendientes…</div>';
 const select='id,contract_number,kind,service_account_type,identification_type,identification_number,legal_name,first_name,last_name,properties(id,address,property_type,property_use,is_active,is_consolidated_master,consolidated_units,assessments(id,period_start,period_end,total_amount,status,is_demo,payment_allocations(amount,payments(status))))';
 const {data,error}=await imaudClient.from('contributors').select(select).order('created_at',{ascending:false});
 if(state.view!=='pagos')return;
 if(error){console.error('SITMAUD payment debtors:',error);target.innerHTML='<div class="payment-debt-empty"><b>No se pudieron consultar las obligaciones.</b><span>Verifica los permisos de lectura de contribuyentes, inmuebles, liquidaciones y aplicaciones de pago.</span></div>';const count=document.getElementById('paymentDebtorCount');if(count)count.textContent='Consulta no disponible';return;}
 state.paymentDebtors=data||[];target.innerHTML=paymentDebtorTable();
}
async function loadDemoPayments(){
 const host=document.getElementById('demoPaymentsHistory');if(!host)return;
 const {data,error}=await imaudClient.from('demo_payments').select('id,receipt_number,amount,paid_at,payment_method,external_reference,bank_code,proof_storage_path,treasury_status,treasury_checked_at,contributor:contributors!demo_payments_contributor_id_fkey(kind,first_name,last_name,legal_name,contract_number)').order('paid_at',{ascending:false}).limit(100);
 if(!document.getElementById('demoPaymentsHistory'))return;
 const count=document.getElementById('demoPaymentsCount');
 if(error){console.error('Demo payments history:',error);host.innerHTML='<div class="payment-debt-empty">No se pudo cargar el historial. Comprueba los permisos del usuario.</div>';if(count)count.textContent='No disponible';return;}
 const rows=data||[];
 if(count)count.textContent=rows.length+' registro(s) de prueba';
 if(!rows.length){host.innerHTML='<div class="payment-debt-empty"><b>Aún no hay pagos de prueba registrados.</b><span>Una vez guardes una simulación aparecerá aquí su comprobante.</span></div>';return;}
 host.innerHTML='<div class="payment-debt-scroll"><table><thead><tr><th>Comprobante DEMO</th><th>Contribuyente</th><th>Contrato</th><th>Fecha</th><th>Medio</th><th>Referencia</th><th>Monto</th><th>Soporte</th><th>Tesorería</th></tr></thead><tbody>'+rows.map(p=>{
  const c=p.contributor||{};
  const method=({tarjeta:'Punto de venta',efectivo:'Efectivo',transferencia:'Transferencia',pago_movil:'Pago móvil'})[p.payment_method]||p.payment_method;
  const date=new Date(p.paid_at).toLocaleDateString('es-VE',{timeZone:'America/Caracas'});
  const bank=p.bank_code?' · '+p.bank_code:'';
  const status=p.treasury_status||'pending';
  const statusText={pending:'Por validar',validated:'Validado',incident:'En incidencia',reversed:'Revertido'}[status]||'Por validar';
  return '<tr><td><strong>'+escapeHTML(p.receipt_number)+'</strong></td><td>'+escapeHTML(contributorName(c))+'</td><td>'+escapeHTML(c.contract_number||'—')+'</td><td>'+escapeHTML(date)+'</td><td>'+escapeHTML(method+bank)+'</td><td>'+escapeHTML(p.external_reference||'—')+'</td><td><b>Bs. '+money(Number(p.amount))+'</b></td><td>'+(p.proof_storage_path?'<button type="button" class="btn btn-light btn-sm" data-proof-payment-id="'+escapeHTML(p.id)+'">Ver adjunto</button>':'<span class="payment-proof-empty">—</span>')+'</td><td><div class="treasury-cell"><span class="treasury-badge treasury-'+escapeHTML(status)+'">'+statusText+'</span><button type="button" class="btn btn-light btn-sm" data-treasury-review="'+escapeHTML(p.id)+'">Ver / Validar</button></div></td></tr>';
 }).join('')+'</tbody></table></div>';
}
function paymentModal(){
 return '<div class="payment-modal-backdrop" id="paymentModal"><section class="payment-modal" role="dialog" aria-modal="true" aria-labelledby="paymentModalTitle"><header class="payment-modal-head"><div><h2 id="paymentModalTitle">Registrar pago</h2><p>Busca al contribuyente para consultar sus obligaciones y registrar el pago.</p></div><button type="button" class="modal-close" data-action="close-payment-modal" aria-label="Cerrar">×</button></header><form id="paymentLookupForm"><div class="payment-lookup-controls"><fieldset><legend>Tipo de búsqueda</legend><label><input type="radio" name="lookupType" value="cedula" checked> Cédula de identidad</label><label><input type="radio" name="lookupType" value="contrato"> Número de contrato</label></fieldset><div class="payment-lookup-input"><label id="paymentLookupLabel" for="paymentLookupValue">Cédula de identidad</label><div><input id="paymentLookupValue" name="lookupValue" placeholder="Ej. V-18.765.432" required><button class="btn btn-primary" type="submit" id="paymentLookupButton">⌕ Buscar</button></div></div></div></form><div id="paymentLookupMessage" class="payment-lookup-message">Introduce la cédula o el número de contrato para localizar al contribuyente.</div><div id="paymentContributorResult" class="payment-contributor-result" hidden></div></section></div>';
}
function openPaymentModal(person=null){
 document.getElementById('paymentModal')?.remove();document.body.insertAdjacentHTML('beforeend',paymentModal());document.body.classList.add('modal-open');
 if(person) renderPaymentContributor(person);
 document.getElementById('paymentLookupValue')?.focus();
}
function closePaymentModal(){document.getElementById('paymentModal')?.remove();document.body.classList.remove('modal-open');state.currentPaymentContributor=null;state.currentPaymentAssessments=[];}
function renderPaymentContributor(person){
 state.currentPaymentContributor=person;
 const debts=debtRowsFromContributor(person);state.currentPaymentAssessments=debts;
 const result=document.getElementById('paymentContributorResult');if(!result)return;
 const identification=(person.identification_type||'')+'-'+(person.identification_number||'');
 const properties=[...new Map((person.properties||[]).map(p=>[p.id,p])).values()];
 const propertyInfo=properties.map(p=>'<div class="payment-property-item"><b>'+escapeHTML(p.is_consolidated_master?'Cuenta matriz de condominio · '+(p.consolidated_units||0)+' viviendas':p.address||'Dirección no registrada')+'</b><small>'+escapeHTML(p.is_consolidated_master?'Cobranza consolidada por cuenta jurídica':(p.property_type||'Inmueble')+' · '+(p.property_use||'Uso no especificado'))+'</small></div>').join('');
 result.hidden=false;
 result.innerHTML='<section class="payment-person-card"><div class="payment-person-avatar">♙</div><div class="payment-person-main"><h3>'+escapeHTML(contributorName(person))+'</h3><p>Cédula / RIF: <b>'+escapeHTML(identification)+'</b> <span>·</span> Contrato: <b>'+escapeHTML(person.contract_number||'—')+'</b></p></div><span class="status">Contribuyente localizado</span></section><section class="payment-property-section"><h3>'+(person.service_account_type==='condominio'?'Cuenta matriz y viviendas cubiertas':'Inmueble(s) asociado(s)')+'</h3>'+propertyInfo+'</section><section class="payment-obligations"><div class="payment-obligations-heading"><h3>Obligaciones pendientes / períodos a pagar</h3><span>'+debts.length+' período(s)</span></div>'+(debts.length?'<div class="payment-assessment-scroll"><table><thead><tr><th></th><th>Cuenta / Inmueble</th><th>Período</th><th>Concepto</th><th>Saldo pendiente</th></tr></thead><tbody>'+debts.map((debt,index)=>'<tr><td><input type="checkbox" class="payment-assessment-check" data-assessment-index="'+index+'" checked></td><td>'+escapeHTML(debt.propertyAddress||'—')+'</td><td>'+escapeHTML(debt.periodStart||'—')+' – '+escapeHTML(debt.periodEnd||'—')+'</td><td>Servicio de aseo urbano y domiciliario</td><td><b>Bs. '+money(debt.balance)+'</b></td></tr>').join('')+'</tbody></table></div>':'<div class="payment-debt-empty"><b>Este contribuyente no tiene obligaciones pendientes.</b></div>')+'</section><section class="payment-total-row"><div><span>Obligaciones seleccionadas</span><b id="paymentSelectedCount">'+debts.length+'</b></div><div><span>Total a cancelar</span><strong id="paymentSelectedTotal">Bs. '+money(debts.reduce((sum,d)=>sum+d.balance,0))+'</strong></div></section>'+(debts.length?'<form id="paymentRegisterForm" class="payment-register-form"><div class="payment-register-fields"><div class="field"><label for="paymentMethod">Método de pago *</label><select id="paymentMethod" name="method" required><option value="">Seleccionar método</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="pago_movil">Pago móvil</option><option value="tarjeta">Tarjeta / Punto de venta</option></select></div><div class="field"><label for="paymentReference">Referencia / N.º de operación *</label><input id="paymentReference" name="reference" placeholder="Número que aparece en el comprobante" required autocomplete="off"></div><div id="paymentBankField" class="field full payment-bank-field" hidden><label for="paymentBankSearch">Banco emisor de la tarjeta *</label><div class="payment-bank-combobox"><div class="payment-bank-input-row"><input type="search" id="paymentBankSearch" placeholder="Escribe o despliega la lista de bancos" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="paymentBankResults"><button type="button" class="payment-bank-toggle" id="paymentBankToggle" title="Mostrar todos los bancos" aria-label="Mostrar todos los bancos" aria-controls="paymentBankResults" aria-expanded="false">⌄</button></div><input type="hidden" id="paymentBankCode" name="bank_code"><div id="paymentBankResults" class="payment-bank-results" role="listbox" hidden></div></div><small>Selecciona un resultado de la lista. Catálogo importado del Excel de prueba.</small></div><div class="field full payment-proof-field" id="paymentProofField" hidden><label for="paymentProofFile">Comprobante bancario *</label><input id="paymentProofFile" name="payment_proof" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"><small>Obligatorio para transferencia o pago móvil. Imagen o PDF, máximo 10 MB. Se almacenará de forma privada junto al pago.</small><div id="paymentProofSelected" class="payment-proof-selected"></div></div></div><div class="payment-modal-actions"><button type="button" class="btn btn-light" data-action="close-payment-modal">Cancelar</button><button type="submit" class="btn btn-primary" id="paymentRegisterButton">Registrar pago de prueba</button></div><p class="payment-demo-note">Entorno de pruebas: guarda el pago simulado, actualiza el estado de cuenta y emite comprobante DEMO; no mueve dinero real.</p></form>':'');
 loadPaymentBankCatalog();
}
async function loadPaymentBankCatalog(){
 const input=document.getElementById('paymentBankSearch');if(!input)return;
 const {data,error}=await imaudClient.from('payment_banks').select('code,name,short_name').eq('is_active',true).order('short_name');
 if(!document.getElementById('paymentBankSearch'))return;
 if(error){console.error('SITMAUD bank catalog:',error);input.placeholder='No se pudo cargar el catálogo de bancos';input.disabled=true;return;}
 state.paymentBankCatalog=data||[];
 input.disabled=!state.paymentBankCatalog.length;
 if(!state.paymentBankCatalog.length)input.placeholder='Catálogo bancario vacío';
}
function filterPaymentBanks(){
 const input=document.getElementById('paymentBankSearch'),list=document.getElementById('paymentBankResults'),bankCode=document.getElementById('paymentBankCode');
 if(!input||!list)return;
 bankCode.value='';
 const query=input.value.trim().toLocaleLowerCase('es-VE');
 const matches=(state.paymentBankCatalog||[]).filter(bank=>
  [bank.code,bank.name,bank.short_name].some(v=>String(v||'').toLocaleLowerCase('es-VE').includes(query))
 );
 list.innerHTML=matches.length?matches.map(bank=>'<button type="button" role="option" class="payment-bank-option" data-bank-code="'+escapeHTML(bank.code)+'"><b>'+escapeHTML(bank.short_name)+'</b><span>'+escapeHTML(bank.code)+' · '+escapeHTML(bank.name)+'</span></button>').join(''):'<div class="payment-bank-no-results">No se encontraron bancos con ese nombre o código.</div>';
 list.hidden=false;input.setAttribute('aria-expanded','true');document.getElementById('paymentBankToggle')?.setAttribute('aria-expanded','true');
}
function choosePaymentBank(code){
 const bank=(state.paymentBankCatalog||[]).find(x=>x.code===code);
 if(!bank)return;
 const input=document.getElementById('paymentBankSearch'),hidden=document.getElementById('paymentBankCode'),list=document.getElementById('paymentBankResults');
 if(!input||!hidden||!list)return;
 input.value=bank.short_name+' · '+bank.code;hidden.value=bank.code;list.hidden=true;input.setAttribute('aria-expanded','false');document.getElementById('paymentBankToggle')?.setAttribute('aria-expanded','false');
}
function updatePaymentMethodFields(){
 const method=document.getElementById('paymentMethod')?.value||'';
 const field=document.getElementById('paymentBankField'),bank=document.getElementById('paymentBankSearch'),code=document.getElementById('paymentBankCode'),reference=document.getElementById('paymentReference');
 if(!field||!bank||!code||!reference)return;
 const needsBank=method==='tarjeta';
 field.hidden=!needsBank;bank.required=needsBank;
 if(!needsBank){bank.value='';code.value='';const list=document.getElementById('paymentBankResults');if(list)list.hidden=true;bank.setAttribute('aria-expanded','false')}
 reference.required=method!=='efectivo';reference.placeholder=needsBank?'Referencia que imprime el punto de venta':'Referencia / N.º de operación';const proofField=document.getElementById('paymentProofField'),proof=document.getElementById('paymentProofFile');const needsProof=method==='transferencia'||method==='pago_movil';if(proofField)proofField.hidden=!needsProof;if(proof)proof.required=needsProof;
}
async function findPaymentContributor(form){
 const button=document.getElementById('paymentLookupButton'),message=document.getElementById('paymentLookupMessage'),result=document.getElementById('paymentContributorResult');
 const type=new FormData(form).get('lookupType');const raw=String(new FormData(form).get('lookupValue')||'').trim();
 if(!raw){message.textContent='Introduce un dato para realizar la búsqueda.';return;}
 button.disabled=true;button.textContent='Buscando…';message.textContent='Consultando el expediente del contribuyente…';result.hidden=true;
 const select='id,contract_number,kind,service_account_type,identification_type,identification_number,legal_name,first_name,last_name,properties(id,address,property_type,property_use,is_active,is_consolidated_master,consolidated_units,assessments(id,period_start,period_end,total_amount,status,payment_allocations(amount,payments(status))))';
 let query=imaudClient.from('contributors').select(select);
 if(type==='contrato') {
  query=query.ilike('contract_number',raw);
 } else {
  const normalized=raw.replace(/[^0-9]/g,'');
  if(!normalized){button.disabled=false;button.textContent='⌕ Buscar';message.textContent='Introduce los números de la cédula o RIF.';return;}
  // En el registro se conserva el prefijo (por ejemplo, V-26310820).
  // Buscar por los dígitos finales permite encontrar tanto "26310820" como "V-26310820".
  query=query.ilike('identification_number','%'+normalized);
 }
 const {data,error}=await query.maybeSingle();
 button.disabled=false;button.textContent='⌕ Buscar';
 if(error){console.error('SITMAUD contributor payment lookup:',error);message.textContent='No se pudo completar la búsqueda. Verifica los permisos e intenta nuevamente.';return;}
 if(!data){message.textContent='No encontramos un contribuyente con ese dato. Verifica la cédula o el número de contrato.';return;}
 message.textContent='Contribuyente localizado. Revisa sus datos y selecciona las obligaciones que deseas cancelar.';
 renderPaymentContributor(data);
}
async function saveDemoPayment(form){
 const selected=[...document.querySelectorAll('.payment-assessment-check:checked')];
 if(!selected.length){toast('Selecciona al menos una obligación.');return;}
 const person=state.currentPaymentContributor;
 if(!person?.id){toast('Debes localizar al contribuyente.');return;}
 const method=document.getElementById('paymentMethod')?.value;
 const reference=document.getElementById('paymentReference')?.value.trim()||null;
 const bankCode=document.getElementById('paymentBankCode')?.value||null;
 if(!method){toast('Selecciona un método de pago.');return;}
 if(method!=='efectivo'&&!reference){toast('Debes introducir la referencia del comprobante.');return;}
 if(method==='tarjeta'&&!bankCode){toast('Selecciona el banco de la tarjeta.');return;}
 const attachment=document.getElementById('paymentProofFile')?.files?.[0]||null;
 const needsProof=method==='transferencia'||method==='pago_movil';
 if(needsProof&&!attachment){toast('Para transferencia o pago móvil debes cargar el comprobante bancario.');document.getElementById('paymentProofFile')?.focus();return;}
 const mimeToExt={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 if(attachment&&(!mimeToExt[attachment.type]||attachment.size<1||attachment.size>10485760)){toast('Comprobante inválido: PDF, JPG, PNG o WEBP, hasta 10 MB.');return;}
 const assessmentIds=selected.map(c=>state.currentPaymentAssessments[Number(c.dataset.assessmentIndex)]?.id).filter(Boolean);
 const button=document.getElementById('paymentRegisterButton');
 if(!button)return;
 button.disabled=true;button.textContent='Registrando pago de prueba…';
 let uploadedPath=null;
 try{
  if(attachment){
   button.textContent='Cargando comprobante bancario…';
   uploadedPath=person.id+'/'+crypto.randomUUID()+'.'+mimeToExt[attachment.type];
   const {error:upError}=await imaudClient.storage.from('imaud-payment-proofs').upload(uploadedPath,attachment,{upsert:false,contentType:attachment.type,cacheControl:'3600'});
   if(upError)throw upError;
  }
  button.textContent='Guardando pago de prueba…';
  const {data,error}=await imaudClient.rpc('register_demo_payment_with_proof',{
   p_contributor_id:person.id,p_assessment_ids:assessmentIds,p_method:method,
   p_reference:reference,p_bank_code:bankCode,p_proof_storage_path:uploadedPath,
   p_proof_original_name:attachment?attachment.name.slice(0,255):null
  });
  if(error)throw error;
  const saved=data?.[0];
  if(!saved?.receipt_number)throw Error('No se recibió la confirmación del pago. Consulta el historial antes de repetir.');
  closePaymentModal();
  await Promise.all([loadPaymentDebtors(),loadDemoPayments()]);
  showDemoReceipt(saved,person,method,reference,bankCode);
 }catch(error){
  console.error('SITMAUD DEMO payment:',error);
  toast('No se pudo registrar el pago: '+(error.message||'Error de operación'));
  // El archivo subido que no quedó asociado al pago se puede borrar.
  // Nunca borrar archivos ya vinculados a comprobantes registrados.
  if(uploadedPath){
   try{await imaudClient.storage.from('imaud-payment-proofs').remove([uploadedPath]);}catch(e){console.warn('Limpieza de comprobante:',e);}
  }
 }finally{
  if(button.isConnected){button.disabled=false;button.textContent='Registrar pago de prueba';}
 }
}
function showDemoReceipt(payment,person,method,reference,bankCode){
 const bank=(state.paymentBankCatalog||[]).find(x=>x.code===bankCode);
 const localDate=new Date(payment.paid_at).toLocaleString('es-VE',{timeZone:'America/Caracas',dateStyle:'medium',timeStyle:'short'});
 const markup='<div id="demoReceiptModal" class="payment-modal-backdrop"><section class="demo-receipt-modal" role="dialog" aria-modal="true"><header><h2>Pago de prueba registrado</h2><button type="button" class="modal-close" data-action="close-demo-receipt">×</button></header><span class="demo-receipt-mark">✓</span><p>La operación quedó guardada en el historial de pruebas de SITMAUD.</p><div class="demo-receipt-data"><div><span>Comprobante</span><strong>'+escapeHTML(payment.receipt_number)+'</strong></div><div><span>Contribuyente</span><strong>'+escapeHTML(contributorName(person))+'</strong></div><div><span>Períodos pagados</span><strong>'+Number(payment.periods_paid)+'</strong></div><div><span>Importe abonado</span><strong>Bs. '+money(Number(payment.amount))+'</strong></div><div><span>Método</span><strong>'+escapeHTML(({tarjeta:'Tarjeta / Punto de venta',efectivo:'Efectivo',transferencia:'Transferencia',pago_movil:'Pago móvil'})[method]||method)+'</strong></div><div><span>Banco</span><strong>'+escapeHTML(bank?.short_name||'No aplica')+'</strong></div><div><span>Referencia</span><strong>'+escapeHTML(reference||'No aplica')+'</strong></div><div><span>Fecha</span><strong>'+escapeHTML(localDate)+'</strong></div></div><div class="demo-receipt-actions"><button class="btn btn-primary" data-action="close-demo-receipt">Finalizar</button></div><small>SIMULACIÓN · Comprobante no fiscal, no acredita transferencia de dinero real.</small></section></div>';
 document.body.insertAdjacentHTML('beforeend',markup);
 document.body.classList.add('modal-open');
 toast('Pago DEMO guardado · '+payment.receipt_number);
}
function updatePaymentTotal(){
 const checks=[...document.querySelectorAll('.payment-assessment-check')];
 const selected=checks.filter(c=>c.checked).map(c=>Number(c.dataset.assessmentIndex));
 const total=selected.reduce((sum,index)=>sum+(state.currentPaymentAssessments[index]?.balance||0),0);
 const count=document.getElementById('paymentSelectedCount'),amount=document.getElementById('paymentSelectedTotal');
 if(count)count.textContent=String(selected.length);if(amount)amount.textContent='Bs. '+money(total);
 const button=document.getElementById('paymentRegisterButton');if(button)button.disabled=!selected.length;
}

function paymentForm(){return head('Registrar pago de prueba','Simulación de liquidación y comprobante. No procesa dinero real.','<button class="btn btn-light" data-go="pagos">← Volver</button>')+`<div class="card form-card"><div class="notice">No introducir datos reales ni referencias bancarias reales. Esta pantalla es exclusivamente demostrativa.</div><form id="paymentForm"><div class="form-grid"><div class="field full"><label>Contribuyente</label><select name="person">${state.people.map(p=>`<option>${p.name}</option>`).join('')}</select></div><div class="field"><label>Inmueble</label><select><option>Casa · Las Velitas</option><option>Unidad residencial</option></select></div><div class="field"><label>Período</label><select name="period"><option>Noviembre 2026</option><option>Octubre 2026</option><option>Septiembre 2026</option></select></div><div class="field"><label>Importe demostrativo (Bs.)</label><input name="amount" type="number" min="0.01" step=".01" value="3.00" required></div><div class="field"><label>Medio de pago</label><select><option>Transferencia (simulación)</option><option>Pago móvil (simulación)</option><option>Efectivo (simulación)</option><option>Punto de venta (simulación)</option></select></div></div><div class="form-actions"><button class="btn btn-primary">Registrar operación de prueba</button></div></form></div>`}
function invoices(){return head('Facturación','Consulta e impresión de comprobantes DEMO generados por los pagos de prueba.')+
 '<div class="notice">Entorno de pruebas: estos comprobantes no son facturas fiscales ni acreditan pagos reales.</div>'+
 '<section class="card panel"><div class="panel-head"><div><h3>Comprobantes registrados</h3><p>Se cargan desde el historial de pagos de prueba.</p></div><button class="btn btn-light" data-action="refresh-invoices">↻ Actualizar</button></div><div id="invoiceRecords"><div class="contributors-loading">Consultando comprobantes…</div></div></section>'+
 '<section class="card panel" id="invoicePreviewPanel" hidden><div class="panel-head"><h3>Vista previa del comprobante</h3><button class="btn btn-primary" data-action="print-invoice">Imprimir comprobante</button></div><div class="invoice" id="invoicePreview"></div></section>'}
async function loadInvoiceRecords(){
 const host=document.getElementById('invoiceRecords');if(!host)return;
 const {data,error}=await imaudClient.from('demo_payments').select('id,receipt_number,amount,paid_at,payment_method,external_reference,treasury_status,contributor:contributors!demo_payments_contributor_id_fkey(kind,identification_type,identification_number,first_name,last_name,legal_name,contract_number)').order('paid_at',{ascending:false}).limit(100);
 if(!host.isConnected)return;
 if(error){host.innerHTML='<div class="contributors-empty">No se pudieron consultar los comprobantes: '+escapeHTML(error.message)+'</div>';return;}
 if(!data?.length){host.innerHTML='<div class="contributors-empty"><b>No hay comprobantes de prueba todavía.</b><span>Registra un pago DEMO en Recaudación y pagos para generar el primero.</span></div>';return;}
 host.innerHTML='<div class="payment-debt-scroll"><table><thead><tr><th>Comprobante</th><th>Contribuyente</th><th>Contrato</th><th>Fecha</th><th>Medio</th><th>Importe</th><th>Estado</th><th></th></tr></thead><tbody>'+data.map(p=>'<tr><td><b>'+escapeHTML(p.receipt_number)+'</b></td><td>'+escapeHTML(contributorName(p.contributor||{}))+'</td><td>'+escapeHTML(p.contributor?.contract_number||'—')+'</td><td>'+escapeHTML(new Date(p.paid_at).toLocaleDateString('es-VE',{timeZone:'America/Caracas'}))+'</td><td>'+escapeHTML(p.payment_method)+'</td><td>Bs. '+money(p.amount)+'</td><td><span class="status">'+escapeHTML(p.treasury_status||'pending')+'</span></td><td><button class="btn btn-light btn-sm" data-invoice-id="'+p.id+'">Ver comprobante</button></td></tr>').join('')+'</tbody></table></div>';
}
async function showInvoice(id){
 const {data,error}=await imaudClient.from('demo_payments').select('id,receipt_number,amount,paid_at,payment_method,external_reference,bank_code,treasury_status,contributor:contributors!demo_payments_contributor_id_fkey(kind,identification_type,identification_number,first_name,last_name,legal_name,contract_number)').eq('id',id).single();
 if(error){toast('No se pudo abrir el comprobante: '+error.message);return;}
 const c=data.contributor||{},name=contributorName(c),date=new Date(data.paid_at).toLocaleString('es-VE',{timeZone:'America/Caracas',dateStyle:'long',timeStyle:'short'});
 const panel=document.getElementById('invoicePreviewPanel'),host=document.getElementById('invoicePreview');if(!panel||!host)return;
 host.innerHTML='<div style="text-align:center;border-bottom:2px solid #173f5d;padding-bottom:14px"><h2 style="color:#173f5d;margin:0">SITMAUD</h2><b>INSTITUTO MUNICIPAL DE ASEO URBANO Y DOMICILIARIO</b><p>Alcaldía del Municipio Miranda · Coro, estado Falcón</p><strong>RECIBO DE PAGO — DEMOSTRACIÓN</strong></div><p><b>N.º de comprobante:</b> '+escapeHTML(data.receipt_number)+'</p><p><b>Contribuyente:</b> '+escapeHTML(name)+'</p><p><b>Identificación:</b> '+escapeHTML((c.identification_type||'')+'-'+(c.identification_number||''))+'</p><p><b>N.º de contrato:</b> '+escapeHTML(c.contract_number||'—')+'</p><p><b>Fecha:</b> '+escapeHTML(date)+'</p><p><b>Medio:</b> '+escapeHTML(data.payment_method)+'</p><p><b>Referencia:</b> '+escapeHTML(data.external_reference||'No aplica')+'</p><h2 style="text-align:right;color:#173f5d">MONTO PAGADO: Bs. '+money(data.amount)+'</h2><p style="text-align:center;font-size:10px">DOCUMENTO SIN VALIDEZ FISCAL · OPERACIÓN DE PRUEBA</p>';
 panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'});
}

function reports(){return head('Reportes','Consulta filtrada de operaciones DEMO, distribución territorial y estado de cuenta.')+
 '<div class="notice">Los reportes de esta sección consultan operaciones de prueba. No representan recaudación oficial.</div>'+
 '<section class="card panel"><form id="demoReportForm"><div class="form-grid"><div class="field"><label>Tipo de reporte</label><select name="kind"><option value="collection">Recaudación y pagos</option><option value="territory">Parroquia y sector</option><option value="accounts">Estado de cuenta</option></select></div><div class="field"><label>Desde</label><input type="date" name="from" required></div><div class="field"><label>Hasta</label><input type="date" name="to" required></div></div><div class="form-actions"><button class="btn btn-primary" type="submit" id="runDemoReport">Consultar reporte</button></div></form></section>'+
 '<section class="card panel" id="demoReportResult"><div class="contributors-empty">Selecciona un tipo y rango de fechas para consultar.</div></section>'}
async function runDemoReport(form){
 const f=new FormData(form),button=document.getElementById('runDemoReport'),host=document.getElementById('demoReportResult');
 button.disabled=true;button.textContent='Consultando…';
 try{
  const {data,error}=await imaudClient.rpc('get_filtered_demo_report',{p_kind:f.get('kind'),p_from:f.get('from'),p_to:f.get('to'),p_export:false});
  if(error)throw error;
  const result=data||{},rows=Array.isArray(result.rows)?result.rows:[];
  if(!rows.length){host.innerHTML='<div class="contributors-empty"><b>Sin resultados para ese período.</b><span>Prueba con otro rango de fechas.</span></div>';return;}
  const columns=Object.keys(rows[0]);
  host.innerHTML='<div class="panel-head"><div><h3>Resultado del reporte · DEMO</h3><p>'+escapeHTML(result.date_from)+' al '+escapeHTML(result.date_to)+' · '+rows.length+' registro(s)</p></div><strong>Bs. '+money(result.total_bs||0)+'</strong></div><div class="payment-debt-scroll"><table><thead><tr>'+columns.map(k=>'<th>'+escapeHTML(k.replaceAll('_',' '))+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+columns.map(k=>'<td>'+escapeHTML(typeof row[k]==='object'?JSON.stringify(row[k]):row[k]??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><button class="btn btn-light" type="button" data-action="export-report">Exportar resultado CSV</button>';
  window.sitmaudLastDemoReport=rows;
 }catch(error){host.innerHTML='<div class="contributors-empty"><b>No se pudo generar el reporte.</b><span>'+escapeHTML(error.message||'Error de consulta')+'</span></div>';}
 finally{button.disabled=false;button.textContent='Consultar reporte';}
}
function exportDemoReport(){
 const rows=window.sitmaudLastDemoReport||[];if(!rows.length){toast('Primero consulta un reporte.');return;}
 const cols=Object.keys(rows[0]),csv=[cols,...rows.map(r=>cols.map(k=>typeof r[k]==='object'?JSON.stringify(r[k]):r[k]??''))].map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='SITMAUD-reporte-DEMO.csv';a.click();URL.revokeObjectURL(a.href);
}

function mapView(){return typeof window.renderTerritorialMap==='function'?window.renderTerritorialMap():head('Mapa territorial','Cargando el módulo territorial…')+'<div class="card panel">Preparando cartografía y herramientas de ubicación.</div>';}
function ordinance(){
 return head('Ordenanza y tarifas','Unidad de Cambio Dinámico, vigencias y criterios tarifarios.')+
 '<section class="card udc-panel"><div class="udc-panel-head"><div><div class="eyebrow">UNIDAD DE CUENTA DINÁMICA · UCD</div><h2 id="udcCurrencyName">Consultando tasa BCV…</h2><p>Moneda de mayor valor entre las tasas oficiales publicadas por el Banco Central de Venezuela.</p></div><button class="btn btn-primary" data-action="sync-udc" id="syncUdcButton">↻ Actualizar tasa</button></div><div id="udcRateContent" class="udc-rate-content"><div class="udc-rate-loading">Consultando el valor vigente…</div></div><div class="udc-source-note">Fuente de datos: BCV · Sincronización automática diaria a las 6:30 p. m. (hora de Venezuela). La aplicación comprueba nuevas tasas cada hora. Si el BCV no está disponible, mostrará la fuente de respaldo como provisional; ninguna cifra se considerará oficial sin verificación.</div></section>'+
 '<section class="card panel" id="officialBillingEnginePanel"><div class="panel-head"><div><h3>Motor de obligaciones · pruebas 2026 y ciclo 2027</h3><p>Ordenanza 2024 · prueba desde septiembre 2026; operación oficial desde enero 2027</p></div><span id="officialEngineStatus" class="status pending">Verificando…</span></div><div id="officialEngineReadiness">Comprobando coeficientes, sectorización, vigencia y tasa BCV…</div><div class="form-actions"><button class="btn btn-primary" type="button" id="officialEngineApprove" data-action="approve-residential-tariff" hidden>Habilitar tabulador de pruebas 2026</button><button class="btn btn-light" type="button" data-action="refresh-residential-engine">Actualizar diagnóstico</button></div><p class="panel-hint">La habilitación de pruebas requiere el permiso Administrar tarifas y queda registrada en bitácora. Solo aplica a septiembre-diciembre de 2026; no crea ni valida pagos.</p><div id="trialBillingBulk" class="form-actions"><button type="button" class="btn btn-primary" id="officialEngineGenerate" data-action="generate-official-obligations" disabled>Generar mensualidades de TODOS los inmuebles (pruebas 2026)</button></div><p class="panel-hint" id="trialBillingProgress" aria-live="polite">La generación general procesa hasta 200 inmuebles por lote, sin duplicar períodos. Los casos que requieren revisión quedarán identificados.</p><p class="panel-hint">En 2026 puede ejecutarse la generación general de pruebas; desde enero de 2027 las mensualidades se procesarán automáticamente en el servidor, incluyendo los inmuebles incorporados después.</p></section>'+
 '<section class="card panel" id="udcContingencyPanel" hidden aria-live="polite"></section>'+
 '<section class="card udc-tariffs"><div class="panel-head"><h3>Coeficientes de la ordenanza</h3><span class="status">Cálculo en UCD</span></div><p class="udc-formula">Monto mensual = coeficiente × valor vigente de la UCD</p><div class="udc-tariff-grid"><article><span>Tipo I</span><strong>3 UCD</strong><small id="udcType1">—</small></article><article><span>Tipo II</span><strong>1,5 UCD</strong><small id="udcType2">—</small></article><article><span>Tipo III</span><strong>0,5 UCD</strong><small id="udcType3">—</small></article></div><p class="udc-source-note">Las obligaciones se expresan en UCD y se convierten a bolívares con la tasa vigente al registrar cada pago; las facturas conservan la tasa efectivamente aplicada.</p></section>'+
 '<section class="card udc-sector-card"><div class="panel-head"><h3>Consultar tarifa residencial por sector</h3><span class="status pending">Vista previa · sin generar deuda</span></div><p class="udc-sector-intro">Selecciona una parroquia y un sector para consultar su categoría residencial y el valor calculado con la UCD registrada.</p><div class="udc-sector-selectors"><div class="field"><label for="udcParishSelect">Parroquia</label><select id="udcParishSelect"><option value="">Cargando parroquias…</option></select></div><div class="field"><label for="udcSectorSelect">Sector</label><select id="udcSectorSelect" disabled><option value="">Seleccione primero la parroquia</option></select></div></div></section>'+
  '<section class="card udc-sector-correction"><div class="panel-head"><h3>Corrección excepcional de la categoría de un sector</h3><span class="status pending">Solo intendente</span></div><p>Cuando todo un sector esté mal clasificado, el intendente podrá cambiar su categoría para las próximas obligaciones. No modifica deudas anteriores ni excepciones particulares de inmuebles.</p><form id="sectorCorrectionForm"><div class="udc-correction-grid"><div class="field"><label>Parroquia</label><select id="correctionParish" required><option value="">Seleccione parroquia</option></select></div><div class="field"><label>Sector</label><select id="correctionSector" required disabled><option value="">Seleccione parroquia primero</option></select></div><div class="field"><label>Clasificación nueva</label><select id="correctionTypology" required><option value="">Seleccione clasificación</option><option value="TIPO I">Tipo I</option><option value="TIPO II">Tipo II</option><option value="TIPO III">Tipo III</option></select></div><div class="field"><label>Motivo y respaldo de la corrección</label><input id="correctionReason" minlength="10" placeholder="Explique la clasificación correcta" required></div></div><div id="correctionCurrent" class="udc-correction-note">Elige el sector para ver su clasificación actual.</div><div class="form-actions"><button class="btn btn-primary" type="submit" id="correctionSubmit">Guardar corrección del sector</button></div></form></section>'+
  '<div class="grid two-col"><div class="card panel"><div class="panel-head"><h3>Normativa municipal</h3><span class="status active">Documento cargado</span></div>'+
 '<div class="ordinance-official-doc"><div class="ordinance-official-icon">§</div><div class="ordinance-official-info"><h4>Reforma Parcial de la Ordenanza de Aseo Urbano y Domiciliario</h4><p>Municipio Miranda · Coro, estado Falcón</p><span>Gaceta Municipal N.º 021-24 · 2 de mayo de 2024</span><small>Documento PDF original compartido para SITMAUD · 1,53 MB</small></div></div>'+
 '<p class="ordinance-official-description">Texto completo de la ordenanza, incluidos sus artículos, disposiciones y anexos de clasificación y tarifas. Esta copia se utiliza como referencia normativa del sistema.</p>'+
 '<div class="ordinance-official-actions"><a class="btn btn-primary" href="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/ccfc6da1-e01a-4c37-b925-eda861f69f1d.pdf" target="_blank" rel="noopener noreferrer">◉ Ver ordenanza completa</a><a class="btn btn-light" href="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/ccfc6da1-e01a-4c37-b925-eda861f69f1d.pdf" target="_blank" rel="noopener noreferrer" download="Ordenanza-IMAUD-Miranda-2024.pdf">↓ Descargar PDF</a></div>'+
 '</div><div class="card panel"><div class="panel-head"><h3>Historial de UCD</h3><span class="status">Registro diario</span></div><div id="udcHistory">Cargando histórico…</div></div></div>';
}

let residentialEngineReady=false,residentialEngineCanCreate=false;
async function loadResidentialEngineProperties(){
 const auth=await imaudClient.rpc('has_permission',{permission_code:'assessments.create'});
 residentialEngineCanCreate=!auth.error&&auth.data===true;
 await loadResidentialEngineReadiness();
}
async function generateOfficialObligations(btn){
 if(!residentialEngineReady||!residentialEngineCanCreate)return;
 if(!window.confirm('¿Generar ahora las mensualidades de prueba de TODOS los inmuebles residenciales y condominios habilitados desde septiembre de 2026? Solo se crearán las obligaciones faltantes; los conflictos quedarán pendientes de revisión.'))return;
 btn.disabled=true;let created=0,scanned=0,failures=0,batches=0;
 const progress=document.getElementById('trialBillingProgress');
 try{
  while(batches<1000){
   const {data,error}=await imaudClient.rpc('run_trial_billing_batch',{p_batch_size:200});
   if(error)throw error;
   batches++;created+=Number(data?.created||0);scanned+=Number(data?.processed||0);failures+=Number(data?.failed||0);
   if(progress)progress.textContent='Procesados: '+scanned+' inmuebles · Obligaciones nuevas: '+created+' · Casos para revisión: '+failures+'.';
   if(data?.status==='cycle_complete')break;
   if(data?.status!=='more')throw Error('El procesador no respondió con un estado esperado: '+(data?.status||'desconocido'));
  }
  if(progress)progress.textContent='Generación finalizada. '+scanned+' inmuebles revisados, '+created+' mensualidades nuevas, '+failures+' errores. Los meses con cargos DEMO existentes se conservaron sin duplicarse y requieren conciliación.';
  await loadResidentialEngineReadiness();
 }catch(error){
  if(progress)progress.textContent='Generación interrumpida: '+(error.message||String(error))+'. Operaciones de lotes anteriores permanecen registradas; la continuación es segura porque no duplica meses.';
 }finally{if(btn.isConnected)btn.disabled=!residentialEngineReady||!residentialEngineCanCreate;}
}

async function loadResidentialEngineReadiness(){
 const root=document.getElementById('officialBillingEnginePanel');
 if(!root)return;
 const output=document.getElementById('officialEngineReadiness');
 const [readiness,authorization,trialTariff]=await Promise.all([
  imaudClient.rpc('get_residential_billing_readiness'),
  imaudClient.rpc('has_permission',{permission_code:'tariffs.manage'}),
  imaudClient.from('tariff_schedules').select('id,is_approved,valid_from').lte('valid_from','2026-09-30').order('valid_from',{ascending:false}).limit(1)
 ]);
 if(!root.isConnected)return;
 if(readiness.error){output.textContent='No se pudo consultar el motor: '+readiness.error.message;return;}
 const data=readiness.data||{},canApprove=!authorization.error&&authorization.data===true;
 const approvedForTrial=!trialTariff.error&&(trialTariff.data||[]).some(x=>x.is_approved===true);
 const inTrial=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())<'2027-01-01';
 residentialEngineReady=inTrial&&approvedForTrial&&!!data.rate_current&&Number(data.unclassified_sectors||0)===0;
 const trialPanel=document.getElementById('trialBillingBulk');if(trialPanel)trialPanel.hidden=!inTrial;
 const generator=document.getElementById('officialEngineGenerate');if(generator)generator.disabled=!residentialEngineReady||!residentialEngineCanCreate;
 const status=document.getElementById('officialEngineStatus'),button=document.getElementById('officialEngineApprove');
 if(status){status.textContent=!inTrial?(data.approved?'Generación automática desde enero 2027':'Falta aprobar tarifa de producción'):(approvedForTrial?'Tarifa de pruebas aprobada':'Tarifa de septiembre sin aprobación');status.className='status '+((!inTrial?data.approved:approvedForTrial)?'active':'pending');}
 if(button){button.hidden=!inTrial||approvedForTrial||!canApprove;button.disabled=false;}
 const safeText=v=>escapeHTML(String(v??'—'));
 output.innerHTML='<div class="grid two-col">'+
  '<div><b>Normativa</b><p>Ordenanza '+safeText(data.ordinance)+' · Tipos I, II y III</p></div>'+
  '<div><b>Inicio de obligaciones</b><p>Pruebas: 01/09/2026 · Producción: 01/01/2027</p></div>'+
  '<div><b>Sectorización</b><p>'+safeText(data.sector_count)+' sectores activos · '+safeText(data.unclassified_sectors)+' sin tipología válida</p></div>'+
  '<div><b>Última UCD registrada</b><p>'+safeText(data.last_udc_currency)+' · '+safeText(data.last_udc_rate_date)+'</p></div>'+
  '<div><b>Estado tarifario</b><p>'+safeText(inTrial?(approvedForTrial?'Aprobado para septiembre de 2026':'Falta aprobación del tabulador de pruebas'):(data.approved?'Aprobado para producción 2027':'Falta aprobar tabulador de producción'))+'</p></div>'+
  '<div><b>Obligaciones oficiales</b><p>'+safeText(data.official_obligations)+'</p></div>'+
  '</div>'+
  '<p class="panel-hint">'+(data.rate_current?'Tasa almacenada dentro del margen de actualización.':'La tasa registrada requiere actualización y validación antes de generar cargos.')+
  ' Los importes en bolívares deben verificarse contra el tipo de cambio vigente en la fecha efectiva del pago.</p>'+
  (!data.approved&&!canApprove?'<p class="notice">Tu usuario puede consultar, pero no tiene el permiso «Administrar tarifas» para activar el tabulador.</p>':'')+
  (inTrial&&!approvedForTrial?'<p class="notice">Para generar mensualidades desde septiembre 2026, primero debe aprobarse por funcionario autorizado el tabulador correspondiente. No se utilizarán tarifas sin aprobación.</p>':(!inTrial?'<p class="panel-hint">La generación de mensualidades funciona automáticamente en el servidor desde enero 2027. No es necesario seleccionar ni procesar contribuyentes manualmente.</p>':''));
}
async function approveResidentialTariff(button){
 if(!window.confirm('¿Habilitar EXCLUSIVAMENTE PARA PRUEBAS el tabulador de septiembre a diciembre de 2026 (Tipo I: 3 UCD, Tipo II: 1,5 UCD, Tipo III: 0,5 UCD)? Se registrará tu autorización en bitácora. No se generan pagos ni ingresos bancarios.'))return;
 button.disabled=true;
 try{
  const {data,error}=await imaudClient.rpc('activate_trial_residential_tariff_2026');
  if(error)throw error;
  toast(data?.enabled?'Tabulador de pruebas habilitado. Ya puedes generar las mensualidades.':'No se habilitó el tabulador.');
  await loadResidentialEngineReadiness();
 }catch(error){toast('No se pudo habilitar el tabulador: '+error.message);button.disabled=false;}
}

async function loadUdcCatalog(){
 const parishSelect=document.getElementById('udcParishSelect');if(!parishSelect)return;
 const [parishes,sectors]=await Promise.all([
  imaudClient.from('parishes').select('id,name').eq('is_active',true).order('name'),
  imaudClient.from('sectors').select('id,name,parish_id,default_typology').eq('is_active',true).order('name')
 ]);
 if(parishes.error||sectors.error){console.error('Catálogo UCD:',parishes.error||sectors.error);parishSelect.innerHTML='<option value="">Catálogo no disponible</option>';return;}
 state.parishes=parishes.data||[];
 state.sectors=sectors.data||[];
 parishSelect.innerHTML='<option value="">Seleccione parroquia</option>'+state.parishes.map(p=>'<option value="'+escapeHTML(p.id)+'">'+escapeHTML(p.name)+'</option>').join('');
 const correctionParish=document.getElementById('correctionParish');if(correctionParish)correctionParish.innerHTML=parishSelect.innerHTML;
}
function updateUdcSectorOptions(){
 const parish=document.getElementById('udcParishSelect'),sector=document.getElementById('udcSectorSelect');if(!parish||!sector)return;
 const rows=state.sectors.filter(s=>s.parish_id===parish.value);
 sector.disabled=!rows.length;
 sector.innerHTML='<option value="">Seleccione sector</option>'+rows.map(s=>'<option value="'+escapeHTML(s.id)+'">'+escapeHTML(s.name)+'</option>').join('');
 document.getElementById('udcSectorResult')?.remove();
}
async function showUdcSectorPreview(selectId){
 const select=document.getElementById(selectId);if(!select)return;
 let preview=document.getElementById(selectId+'Preview');
 if(!preview){preview=document.createElement('div');preview.id=selectId+'Preview';preview.className='udc-sector-preview';select.closest('.field')?.appendChild(preview);}
 if(!select.value){preview.textContent='';preview.hidden=true;return;}
 const selectedSector=select.value;
 preview.hidden=false;preview.textContent='Calculando tarifa del sector…';
 const {data,error}=await imaudClient.rpc('preview_sector_udc',{p_sector_id:selectedSector});
 if(!document.getElementById(selectId)||select.value!==selectedSector)return;
 if(error||!Array.isArray(data)||!data.length){console.error('Vista previa UCD:',error);preview.textContent='No se pudo consultar la tarifa del sector. Verifica que exista una UCD registrada.';return;}
 const item=data[0];const value=new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(item.amount_bs));
 const coef=new Intl.NumberFormat('es-VE',{maximumFractionDigits:2}).format(Number(item.coefficient));
 preview.innerHTML='<strong>'+escapeHTML(item.typology_code)+' · '+coef+' UCD</strong><span>Tarifa mensual referencial: <b>Bs. '+value+'</b></span><small>UCD '+escapeHTML(item.udc_currency_code)+' · vigencia '+escapeHTML(item.udc_effective_date)+' · '+(item.tariff_approved?'Tarifa aprobada':'Pendiente de validar la ordenanza')+'</small>';
}
function updateCorrectionSectors(){
 const p=document.getElementById('correctionParish'),se=document.getElementById('correctionSector');
 if(!p||!se)return;
 const rows=state.sectors.filter(s=>s.parish_id===p.value);
 se.disabled=!rows.length;
 se.innerHTML='<option value="">Seleccione sector</option>'+rows.map(x=>'<option value="'+escapeHTML(x.id)+'">'+escapeHTML(x.name)+'</option>').join('');
 document.getElementById('correctionCurrent').textContent='Elige el sector para ver su clasificación actual.';
}
function showCorrectionCurrent(){
 const id=document.getElementById('correctionSector')?.value,sector=state.sectors.find(s=>s.id===id);
 const current=document.getElementById('correctionCurrent');
 if(current)current.textContent=sector?'Clasificación vigente del sector: '+(sector.default_typology||'No asignada'):'Elige el sector para ver su clasificación actual.';
 if(sector)document.getElementById('correctionTypology').value=sector.default_typology||'';
}
async function saveSectorCorrection(form){
 const sectorId=document.getElementById('correctionSector')?.value,
 typology=document.getElementById('correctionTypology')?.value,
 reason=document.getElementById('correctionReason')?.value.trim();
 if(!sectorId||!typology||!reason||reason.length<10){toast('Selecciona sector, categoría y justificación.');return;}
 const sector=state.sectors.find(s=>s.id===sectorId);
 if(!window.confirm('¿Cambiar la clasificación de '+(sector?.name||'este sector')+' de '+(sector?.default_typology||'—')+' a '+typology+'? Solo afectará las futuras liquidaciones.'))return;
 const btn=document.getElementById('correctionSubmit');btn.disabled=true;btn.textContent='Guardando…';
 const {data,error}=await imaudClient.rpc('correct_sector_typology',{p_sector_id:sectorId,p_new_typology:typology,p_reason:reason});
 btn.disabled=false;btn.textContent='Guardar corrección del sector';
 if(error){console.error('Sector correction:',error);toast('No se pudo corregir: '+error.message);return;}
 if(sector)sector.default_typology=typology;
 document.getElementById('correctionReason').value='';
 showCorrectionCurrent();
 await showUdcSectorPreview('udcSectorSelect');
 toast('Sector corregido y cambio registrado en auditoría.');
}
async function loadUdcRate(){
 const host=document.getElementById('udcRateContent');if(!host)return;
 const {data,error}=await imaudClient.from('udc_rates').select('*').order('effective_date',{ascending:false}).limit(8);
 if(error){console.error('UCD:',error);host.innerHTML='<div class="udc-rate-loading">No se pudo consultar el historial UCD. Verifica el acceso a la tabla.</div>';return;}
 const rows=data||[];state.udcRate=rows[0]||null;
 if(!rows.length){host.innerHTML='<div class="udc-rate-loading">Todavía no hay una tasa registrada. Pulsa «Actualizar tasa» para consultar el BCV.</div>';return;}
 const current=rows[0],fmt=n=>new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:8}).format(Number(n));
 const {data:verification,error:verificationError}=await imaudClient.rpc('get_udc_rate_readiness');
 if(verificationError)console.warn('No se pudo verificar la habilitación institucional de UCD:',verificationError.message);
 const manuallyVerified=!verificationError&&verification?.rate_id===current.id&&verification?.verified_manually===true;
 document.getElementById('udcCurrencyName').textContent=current.udc_currency_name+' ('+current.udc_currency_code+')';
 const currentDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const isToday=current.effective_date===currentDay;
 const official=current.source_url==='https://www.bcv.org.ve/';
 const sourceLabel=official?'Banco Central de Venezuela (consulta directa)':manuallyVerified?'Fuente alternativa · contrastada manualmente con BCV por la administración':'Fuente alternativa sin verificación directa del BCV';
 host.innerHTML='<div class="udc-main-value"><span>Valor UCD</span><strong>Bs. '+fmt(current.udc_value)+'</strong><small>Por 1 '+escapeHTML(current.udc_currency_code)+'</small></div><div class="udc-rate-meta"><div><span>Fecha valor</span><b>'+escapeHTML(current.effective_date)+'</b></div><div><span>Última consulta</span><b>'+new Date(current.fetched_at).toLocaleString('es-VE',{timeZone:'America/Caracas'})+' (Coro)</b></div><div><span>Fuente</span><b>'+escapeHTML(sourceLabel)+'</b></div></div>'+
 (!isToday?'<p class="notice">Atención: no hay tasa registrada con fecha valor de hoy ('+escapeHTML(currentDay)+'). Debe actualizarse y comprobar su vigencia antes de registrar cobros.</p>':'')+
 (!official&&!manuallyVerified?'<p class="notice">Valor de referencia provisional. Procede de una fuente alternativa: aún no está confirmada su coincidencia exacta con la publicación directa del BCV. La recaudación oficial requiere tasa verificada.</p>':'')+
 (manuallyVerified?'<p class="notice">Verificación institucional registrada. El origen del dato continúa identificado como fuente alternativa; la comprobación del valor y su responsable están archivados por separado.</p>':'')+
 '<div class="udc-all-rates">'+Object.entries(current.rates_by_currency||{}).map(([code,value])=>'<span>'+escapeHTML(code)+': <b>Bs. '+fmt(value)+'</b></span>').join('')+'</div>';
 document.getElementById('udcType1').textContent='Bs. '+fmt(Number(current.udc_value)*3);
 document.getElementById('udcType2').textContent='Bs. '+fmt(Number(current.udc_value)*1.5);
 document.getElementById('udcType3').textContent='Bs. '+fmt(Number(current.udc_value)*0.5);
 document.getElementById('udcHistory').innerHTML=rows.map(row=>'<div class="udc-history-row"><span>'+escapeHTML(row.effective_date)+' · '+escapeHTML(row.udc_currency_code)+'</span><b>Bs. '+fmt(row.udc_value)+'</b></div>').join('');
}
async function syncUdcRate(){
 const button=document.getElementById('syncUdcButton');if(button){button.disabled=true;button.textContent='Consultando BCV…'}
 const {data,error}=await imaudClient.functions.invoke('sync-udc-bcv',{body:{}});
 if(button){button.disabled=false;button.textContent='↻ Actualizar tasa'}
 if(error){console.error('UCD sync:',error);toast('No se pudo actualizar la UCD. Se conserva la última tasa registrada.');return;}
 if(!data?.ok&&!data?.skipped){toast(data?.error||'No se pudo validar la tasa BCV.');return;}
 await loadUdcRate();toast(data?.skipped?'Se conserva la tasa vigente registrada.':(data?.source_url==='https://www.bcv.org.ve/'?'Tasa actualizada desde el BCV.':'Tasa actualizada desde fuente alternativa: falta verificación directa del BCV.'));
}
const staffPermissionGroups=[
 {name:'Contribuyentes',items:[['contributors.read','Consultar'],['contributors.create','Registrar'],['contributors.update','Editar']]},
 {name:'Inmuebles',items:[['properties.read','Consultar'],['properties.create','Registrar'],['properties.update','Editar']]},
 {name:'Condominios',items:[['condominiums.read','Consultar'],['condominiums.create','Registrar'],['condominiums.update','Editar']]},
 {name:'Pagos y Tesorería',items:[['payments.read','Consultar'],['payments.register','Registrar pagos'],['payments.validate','Revisar y validar pagos'],['payments.reverse','Revertir pagos']]},
 {name:'Exoneraciones',items:[['debt_relief.apply','Exonerar deudas']]},
 {name:'Facturación',items:[['invoices.read','Consultar comprobantes'],['invoices.issue','Emitir comprobantes']]},
 {name:'Solvencias',items:[['solvencies.read','Consultar solvencias'],['solvencies.issue','Emitir solvencias']]},
 {name:'Reportes',items:[['reports.read','Consultar'],['reports.export','Exportar']]},
 {name:'Ordenanza y tarifas',items:[['tariffs.read','Consultar'],['tariffs.manage','Administrar tarifas']]},
 {name:'Bitácora',items:[['audit.read','Consultar']]}
];
let staffPermissionRole=null,staffPermissionUsers=[],staffPermissionGrants=[],staffPermissionSelected='',staffPermissionBusy=false;

function openStaffRegistrationPreview(){
 if(staffPermissionRole!=='intendente'){toast('Solo el superusuario maestro puede registrar funcionarios.');return;}
 document.getElementById('staffRegistrationPreview')?.remove();
 const overlay=document.createElement('div');
 overlay.id='staffRegistrationPreview';
 overlay.className='staff-reg-overlay';
 overlay.innerHTML='<section class="staff-reg-dialog" role="dialog" aria-modal="true" aria-labelledby="staffRegistrationTitle">'+
 '<div class="staff-reg-header"><div><div class="eyebrow">SITMAUD · GESTIÓN DE USUARIOS</div><h2 id="staffRegistrationTitle">Registrar funcionario</h2><p>El correo del funcionario será su usuario de acceso. Con el servicio de correo institucional configurado recibirá una clave provisional, que podrá cambiar cuando desee. Sin esa configuración recibirá un enlace seguro de activación. El perfil Intendente no concede el control de superusuario maestro; los permisos operativos de los demás perfiles se asignan desde la matriz.</p></div><button type="button" class="staff-reg-close" data-close-staff-preview aria-label="Cerrar">×</button></div>'+
 '<form id="sitmaudStaffInviteForm">'+
 '<div class="staff-reg-fields">'+
 '<label class="field"><span>Nombres *</span><input name="first_name" required maxlength="90" type="text" placeholder="Ej. María Elena" autocomplete="given-name"></label>'+
 '<label class="field"><span>Apellidos *</span><input name="last_name" required maxlength="90" type="text" placeholder="Ej. Rodríguez" autocomplete="family-name"></label>'+
 '<label class="field"><span>Cédula de identidad *</span><input name="identification_number" required type="text" pattern="[VEve]-?[0-9]{6,10}" placeholder="Ej. V-12345678"></label>'+
 '<label class="field"><span>Correo del funcionario *</span><input name="email" required type="email" maxlength="180" placeholder="funcionario@institucion.gob.ve" autocomplete="email"></label>'+
 '<label class="field"><span>Teléfono de contacto</span><input name="phone" maxlength="30" type="tel" placeholder="Ej. 04XX-XXXXXXX"></label>'+
 '<label class="field"><span>Cargo o área *</span><input name="job_title" required minlength="3" maxlength="120" placeholder="Ej. Recaudador, Analista o Tesorero"></label>'+
 '<label class="field"><span>Perfil de cuenta *</span><select name="role" required><option value="">Selecciona el perfil…</option><option value="intendente">Intendente</option><option value="recaudador">Recaudador</option><option value="administrador_analista">Administrador / Analista</option></select></label>'+
 '</div><p class="staff-reg-footnote">El funcionario recibirá las instrucciones de acceso por correo. Sus permisos operativos serán asignados exclusivamente por el superusuario.</p>'+
 '<div class="staff-reg-info" id="sitStaffInviteNotice" aria-live="polite">Registro disponible solo para el superusuario maestro.</div>'+
 '<div class="staff-reg-actions"><button type="button" class="btn btn-light" data-close-staff-preview>Cerrar</button><button class="btn btn-primary" type="submit" id="sitStaffInviteSubmit">Enviar invitación</button></div></form></section>';
 document.body.appendChild(overlay);
 document.body.classList.add('modal-open');
 overlay.addEventListener('click',ev=>{if(ev.target===overlay||ev.target.closest('[data-close-staff-preview]')){overlay.remove();document.body.classList.remove('modal-open');}});
 overlay.querySelector('#sitmaudStaffInviteForm')?.addEventListener('submit',async ev=>{
   ev.preventDefault();
   const form=ev.currentTarget;
   if(!form.reportValidity())return;
   const submit=form.querySelector('#sitStaffInviteSubmit'),notice=form.querySelector('#sitStaffInviteNotice');
   const payload=Object.fromEntries(new FormData(form).entries());
   submit.disabled=true;submit.textContent='Creando invitación…';notice.textContent='Verificando autorizaciones y enviando invitación de acceso…';
   try{
     const {data,error}=await imaudClient.functions.invoke('invite-sitmaud-staff',{body:payload});
     if(error){
       let detail=error.message||'No se pudo enviar la invitación.';
       try{if(error.context){const body=await error.context.json();detail=body.error||detail;}}catch(_){}
       throw new Error(detail);
     }
     if(!data?.ok)throw new Error(data?.error||'El servidor no confirmó la creación.');
     const credentialsDelivered=data.delivery_mode==='temporary_password_email';
     notice.textContent=credentialsDelivered
       ?'Funcionario registrado. Se envió a su correo el usuario y la clave provisional. Ya puede iniciar sesión; cambiar la contraseña es opcional. Asígnale los permisos en la matriz.'
       :'Funcionario invitado. Se envió un enlace seguro para crear su clave. Para enviar credenciales provisionales por correo debe configurarse el proveedor institucional de correo.';
     toast(credentialsDelivered?'Credenciales enviadas al correo del funcionario.':'Invitación de activación enviada.');
     await loadStaffPermissionMatrix();
     form.reset();
   }catch(error){
     notice.textContent='No se completó el registro: '+(error.message||'Comprueba la configuración de invitaciones.');
   }finally{
     if(submit.isConnected){submit.disabled=false;submit.textContent='Enviar invitación';}
   }
 });
 const credentialInfo=overlay.querySelector('#sitStaffInviteNotice');
 const invitationButton=overlay.querySelector('#sitStaffInviteSubmit');
 if(credentialInfo)credentialInfo.textContent='Verificando modalidad de entrega de credenciales…';
 imaudClient.functions.invoke('invite-sitmaud-staff',{body:{action:'delivery_status'}}).then(({data,error})=>{
   if(!overlay.isConnected)return;
   if(error||!data?.ok){
     if(credentialInfo)credentialInfo.textContent='No se pudo verificar el servicio de correo. Antes de registrar, comprueba que la función de invitaciones esté disponible.';
     if(invitationButton)invitationButton.disabled=true;
     return;
   }
   const institutional=data.institutional_credentials_enabled===true;
   if(credentialInfo)credentialInfo.textContent=institutional
    ?'Correo institucional configurado. Se enviarán el usuario (correo electrónico) y una clave provisional al funcionario.'
    :'El servicio de correo para claves provisionales aún no está configurado. Se enviará un enlace de invitación para que el funcionario cree su contraseña.';
   if(invitationButton)invitationButton.textContent=institutional?'Registrar y enviar credenciales':'Enviar enlace de invitación';
 }).catch(()=>{
   if(credentialInfo)credentialInfo.textContent='No se pudo verificar el servicio de correo.';
   if(invitationButton)invitationButton.disabled=true;
 });
 overlay.querySelector('[name="first_name"]')?.focus();
}
function staff(){
 return head('Funcionarios y permisos','Gestión de cuentas y autorizaciones exclusivamente por el intendente.','<button type="button" class="btn btn-primary" data-action="new-staff">＋ Registrar funcionario</button>')+
 '<div class="notice">Solo el superusuario maestro puede crear funcionarios y asignar o revocar permisos. Registrar pagos, validar su acreditación en Tesorería y revertirlos son tres autorizaciones diferentes.</div>'+
 '<div class="grid module-grid"><div class="card panel"><h3 style="margin-top:0">Usuarios intendentes</h3><div class="kpi-value">Acceso integral</div><p style="font-size:10px;color:#82919c">Superusuarios responsables de la creación de funcionarios y sus permisos.</p></div><div class="card panel"><h3 style="margin-top:0">Administradores analistas</h3><div class="kpi-value">Permisos a medida</div><p style="font-size:10px;color:#82919c">Acceso asignado por módulo y operación.</p></div><div class="card panel"><h3 style="margin-top:0">Recaudadores / Tesorería</h3><div class="kpi-value">Funciones separadas</div><p style="font-size:10px;color:#82919c">Registrar un pago no concede permiso para validarlo ni revertirlo.</p></div></div>'+
 '<section class="card panel staff-permission-panel" style="margin-top:16px"><div class="panel-head"><div><h3>Permisos por funcionario</h3><p>Selecciona un funcionario existente para administrar las autorizaciones que realmente se guardan en SITMAUD.</p></div><span id="staffPermissionStatus">Verificando acceso…</span></div>'+
 '<div class="staff-permission-selector"><label for="staffPermissionUser">Funcionario</label><select id="staffPermissionUser" disabled><option value="">Cargando funcionarios…</option></select></div>'+
 '<div id="staffPermissionNotice" class="panel-hint" aria-live="polite">Preparando permisos…</div>'+
 staffPermissionGroups.map(group=>'<div class="permission-group"><h4>'+group.name+'</h4><div class="checks">'+group.items.map(item=>'<label class="staff-permission-choice"><input type="checkbox" data-staff-permission="'+item[0]+'" disabled> '+item[1]+'</label>').join('')+'</div></div>').join('')+
 '</section>'+window.sitmaudBankAdmin.panel();
}
async function loadStaffPermissionMatrix(){
 const select=document.getElementById('staffPermissionUser'),note=document.getElementById('staffPermissionNotice'),status=document.getElementById('staffPermissionStatus');if(!select)return;
 const {data:isMaster,error:masterError}=await imaudClient.rpc('is_sitmaud_master');
 if(!document.getElementById('staffPermissionUser'))return;
 if(masterError||isMaster!==true){
  staffPermissionRole=null;status.textContent='Acceso restringido';note.textContent='La asignación de permisos está disponible exclusivamente para el intendente.';
  select.innerHTML='<option>Sin autorización</option>';return;
 }
 staffPermissionRole='intendente';
 const [users,grants]=await Promise.all([
  imaudClient.from('staff_profiles').select('user_id,display_name,role,is_active').eq('is_active',true).order('display_name'),
  imaudClient.from('staff_permissions').select('user_id,permission_code')
 ]);
 if(!document.getElementById('staffPermissionUser'))return;
 if(users.error||grants.error){status.textContent='No disponible';note.textContent='No se pudieron consultar los funcionarios o permisos. Comprueba la conexión y vuelve a entrar.';return;}
 staffPermissionUsers=(users.data||[]).filter(u=>u.role!=='intendente');
 staffPermissionGrants=grants.data||[];
 status.textContent='Administración del intendente';
 select.innerHTML='<option value="">Seleccionar funcionario…</option>'+staffPermissionUsers.map(u=>'<option value="'+escapeHTML(u.user_id)+'">'+escapeHTML(u.display_name||'Funcionario')+' · '+escapeHTML(String(u.role||'').replaceAll('_',' '))+'</option>').join('');
 select.disabled=!staffPermissionUsers.length;
 note.textContent=staffPermissionUsers.length?'Selecciona un funcionario para consultar y editar sus permisos. Los cambios se guardan individualmente y quedan registrados.':'Aún no hay funcionarios no intendentes activos. Primero debes habilitar sus cuentas.';
 staffPermissionSelected='';document.querySelectorAll('[data-staff-permission]').forEach(c=>{c.checked=false;c.disabled=true});
}
function showStaffPermissionGrants(){
 const select=document.getElementById('staffPermissionUser'),note=document.getElementById('staffPermissionNotice');
 if(!select||staffPermissionRole!=='intendente')return;
 staffPermissionSelected=select.value;
 const granted=new Set(staffPermissionGrants.filter(x=>x.user_id===staffPermissionSelected).map(x=>x.permission_code));
 document.querySelectorAll('[data-staff-permission]').forEach(c=>{c.checked=granted.has(c.dataset.staffPermission);c.disabled=!staffPermissionSelected||staffPermissionBusy;});
 if(note)note.textContent=staffPermissionSelected?'Modifica únicamente los permisos necesarios. Los cambios se guardan al marcar o desmarcar cada casilla.':'Selecciona un funcionario para administrar sus permisos.';
}
async function saveStaffPermissionCheckbox(box){
 if(staffPermissionRole!=='intendente'||!staffPermissionSelected||staffPermissionBusy)return;
 const person=staffPermissionSelected,code=box.dataset.staffPermission,enabled=box.checked;
 if(!staffPermissionGroups.some(g=>g.items.some(item=>item[0]===code)))return;
 staffPermissionBusy=true;document.querySelectorAll('[data-staff-permission]').forEach(c=>c.disabled=true);
 const note=document.getElementById('staffPermissionNotice');if(note)note.textContent='Guardando permiso…';
 const {error}=await imaudClient.rpc('set_staff_permission',{p_user_id:person,p_code:code,p_enabled:enabled});
 staffPermissionBusy=false;
 if(error){box.checked=!enabled;if(note)note.textContent='No se pudo guardar: '+error.message;toast('El permiso no se guardó.');}
 else{
  staffPermissionGrants=staffPermissionGrants.filter(g=>!(g.user_id===person&&g.permission_code===code));
  if(enabled)staffPermissionGrants.push({user_id:person,permission_code:code});
  if(note)note.textContent='Permiso actualizado y auditado. Solo el intendente puede modificarlo.';
  toast('Permiso '+(enabled?'concedido':'revocado')+' correctamente.');
 }
 showStaffPermissionGrants();
}
document.addEventListener('change',event=>{
 if(event.target.id==='staffPermissionUser'){showStaffPermissionGrants();return;}
 if(event.target.matches('[data-staff-permission]'))saveStaffPermissionCheckbox(event.target);
});
function log(){return head('Bitácora de auditoría','Registro demostrativo de eventos y trazabilidad administrativa.')+`<div class="notice">En producción, la bitácora deberá ser de solo anexado, con fecha/hora del servidor, actor, IP, acción, entidad afectada y valores anteriores/nuevos cuando corresponda.</div>${table(['Fecha y hora','Usuario','Módulo','Acción','Resultado'],[['11/11/2026 09:42','Usuario intendente','Contribuyentes','Consulta de expediente','<span class="status">Correcto</span>'],['11/11/2026 09:18','Recaudador demo','Pagos','Registro de pago ficticio','<span class="status">Correcto</span>'],['10/11/2026 16:03','Administrador demo','Reportes','Exportación CSV de prueba','<span class="status">Correcto</span>']].map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''))}`}
function productionModule(title,detail){
 return head(title,'Gestión institucional de SITMAUD.')+
 '<section class="card" style="padding:28px;max-width:850px"><h3>Operación pendiente de habilitación</h3><p>'+detail+'</p><p style="color:#667788;font-size:12px">Este módulo no permite efectuar operaciones financieras hasta completar los controles tributarios, la validación de Tesorería y la autorización institucional.</p></section>';
}
function officialBilling(){return productionModule('Facturación','La emisión de comprobantes oficiales se habilitará únicamente cuando existan pagos reales confirmados y documentos aprobados.');}

function solvencyModule(){
 return head('Consulta de solvencias','Verifica el estado de las obligaciones oficiales de cada contribuyente antes de iniciar una solicitud.')+
 '<section class="card solvency-intro"><div><span class="solvency-kicker">CONSULTA ADMINISTRATIVA</span><h3>Verificación de cuenta</h3><p>Busca por nombre, cédula, RIF o número de contrato. Consulta las liquidaciones oficiales registradas en el sistema.</p></div><div class="solvency-intro-mark">▣</div></section>'+
 '<section class="card solvency-search"><label for="solvencySearch">Buscar contribuyente</label><input id="solvencySearch" class="search" type="search" placeholder="Nombre, cédula, RIF o número de contrato"><span id="solvencyCount" class="table-count">Consultando registros…</span></section>'+
 '<section id="solvencyResults" class="solvency-results"><div class="contributors-loading">Consultando obligaciones oficiales…</div></section>'+
 '<section class="card solvency-notice"><b>Emisión de certificado</b><p>La emisión requiere autorización individual, meses completos y pagos liquidados o exoneraciones documentadas. Un pago pendiente no es suficiente.</p></section>'+window.sitmaudSolvencyDocuments.panel();
}
let solvencyRows=[],solvencyCanIssue=false,solvencyGrantedAssessments=new Set();
async function loadSolvencyRecords(){
 const host=document.getElementById('solvencyResults');if(!host)return;
 const perm=await imaudClient.rpc('has_permission',{permission_code:'solvencies.issue'});
 solvencyCanIssue=!perm.error&&perm.data===true;
 host.innerHTML='<div class="contributors-loading">Consultando obligaciones oficiales…</div>';
 const {data,error}=await imaudClient.from('contributors').select('id,contract_number,kind,service_account_type,identification_type,identification_number,legal_name,first_name,last_name,properties(id,address,is_consolidated_master,assessments(id,status,is_demo,period_start,total_amount))').order('created_at',{ascending:false});
 if(state.view!=='solvencias')return;
 if(error){console.error('SITMAUD solvencias:',error);host.innerHTML='<div class="contributors-empty"><b>No se pudo consultar la cuenta</b><span>'+escapeHTML(error.message||'Verifica los permisos de consulta.')+'</span></div>';return;}
 solvencyRows=data||[];
 solvencyGrantedAssessments=new Set();
 const assessmentIds=solvencyRows.flatMap(c=>(c.properties||[]).flatMap(p=>(p.assessments||[]).filter(a=>a.is_demo===false).map(a=>a.id)));
 if(assessmentIds.length){
  const {data:grants,error:grantsError}=await imaudClient.from('debt_relief_grants').select('assessment_id').in('assessment_id',assessmentIds).is('revoked_at',null);
  if(grantsError){
    console.warn('No se pudo comprobar exoneraciones autorizadas:',grantsError.message);
    const notice=document.querySelector('.solvency-notice');
    if(notice)notice.insertAdjacentHTML('beforeend','<p class="notice">No se pudieron verificar las exoneraciones. La emisión permanecerá restringida a las cuentas pagadas.</p>');
  }else solvencyGrantedAssessments=new Set((grants||[]).map(g=>g.assessment_id));
 }
 renderSolvencyRows();
}
function solvencyName(p){return p.kind==='juridico'?(p.legal_name||'Sin razón social'):[p.first_name,p.last_name].filter(Boolean).join(' ')||p.legal_name||'Sin nombre';}
function solvencyStatus(p){
 const assessments=(p.properties||[]).flatMap(x=>(x.assessments||[]).filter(a=>a.is_demo===false));
 if(!assessments.length)return {key:'unverified',label:'Sin liquidación oficial',detail:'No hay períodos oficiales para verificar.'};
 if(assessments.some(a=>['pending','partially_paid'].includes(a.status)&&!solvencyGrantedAssessments.has(a.id)))return {key:'pending',label:'Obligaciones pendientes',detail:'La cuenta mantiene períodos por cancelar o pagos parciales.'};
 if(assessments.every(a=>a.status==='paid'||solvencyGrantedAssessments.has(a.id)))return {key:'paid',label:'Cuenta al día',detail:'Obligaciones oficialmente pagadas o cubiertas por exoneraciones institucionales vigentes.'};
 return {key:'unverified',label:'Requiere revisión',detail:'Hay estados que necesitan validación administrativa.'};
}
function renderSolvencyRows(){
 const q=(document.getElementById('solvencySearch')?.value||'').trim().toLocaleLowerCase('es-VE');
 const rows=solvencyRows.filter(p=>[solvencyName(p),p.identification_type,p.identification_number,p.contract_number].join(' ').toLocaleLowerCase('es-VE').includes(q));
 const host=document.getElementById('solvencyResults');if(!host)return;
 const count=document.getElementById('solvencyCount');if(count)count.textContent=rows.length+' de '+solvencyRows.length+' contribuyentes';
 if(!rows.length){host.innerHTML='<div class="card contributors-empty"><b>No se encontraron coincidencias</b><span>Prueba con otro nombre, identificación o contrato.</span></div>';return;}
 host.innerHTML=rows.map(p=>{
  const st=solvencyStatus(p),props=p.properties||[],official=props.flatMap(x=>(x.assessments||[]).filter(a=>a.is_demo===false));
  const periods=official.length?official.length+' liquidación(es) oficial(es)':'Sin liquidaciones oficiales';
  return '<article class="card solvency-row"><div class="solvency-person"><span class="solvency-avatar">▣</span><div><b>'+escapeHTML(solvencyName(p))+'</b><small>'+escapeHTML((p.identification_type||'')+(p.identification_number?'-'+p.identification_number:'')+' · Contrato '+(p.contract_number||'Sin asignar'))+'</small></div></div><div class="solvency-meta"><span class="solvency-state '+st.key+'">'+escapeHTML(st.label)+'</span><small>'+escapeHTML(periods)+'</small></div><p>'+escapeHTML(st.detail)+'</p><button type="button" class="btn btn-light" data-solvency-detail="'+escapeHTML(p.id)+'">Ver períodos y obligaciones</button>'+(solvencyCanIssue&&st.key==='paid'?'<button type="button" class="btn btn-primary" data-issue-solvency="'+escapeHTML(p.id)+'">Emitir solvencia</button>':'')+'</article>';
 }).join('');
}
async function issueOfficialSolvency(id,button){
 if(!solvencyCanIssue)return;
 const p=solvencyRows.find(x=>x.id===id);if(!p)return;
 const status=solvencyStatus(p);
 if(status.key!=='paid'){toast('Existen períodos pendientes de verificación.');return;}
 const months=(p.properties||[]).flatMap(prop=>(prop.assessments||[]).filter(a=>a.is_demo===false&&(a.status==='paid'||solvencyGrantedAssessments.has(a.id))).map(a=>a.period_start)).filter(Boolean).sort();
 if(!months.length){toast('No existen períodos oficialmente liquidados.');return;}
 const first=months[0].slice(0,7)+'-01',last=months[months.length-1];
 const [y,m]=last.split('-').map(Number),to=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
 if(!window.confirm('¿Emitir solvencia institucional para '+solvencyName(p)+' desde '+first+' hasta '+to+'? La emisión se registrará en la bitácora.'))return;
 button.disabled=true;
 const {data,error}=await imaudClient.rpc('issue_solvency_certificate',{p_contributor_id:id,p_period_start:first,p_period_end:to});
 if(error){toast('No se pudo emitir la solvencia: '+error.message);button.disabled=false;return;}
 button.textContent='Solvencia emitida';
 toast('Certificado emitido: '+data.certificate_number); window.sitmaudSolvencyDocuments?.load(); window.sitmaudSolvencyDocuments?.show(data);
}

function showSolvencyDetail(id){
 const p=solvencyRows.find(x=>x.id===id);if(!p)return;
 const assessments=(p.properties||[]).flatMap(prop=>(prop.assessments||[]).filter(a=>a.is_demo===false).map(a=>({...a,address:prop.address})));
 const rows=assessments.length?assessments.map(a=>'<tr><td>'+escapeHTML(a.period_start||'—')+'</td><td>'+escapeHTML(a.address||'Cuenta matriz')+'</td><td>'+escapeHTML(solvencyGrantedAssessments.has(a.id)?'Exoneración institucional autorizada':(a.status||'Sin estado'))+'</td></tr>').join(''):'<tr><td colspan="3">No existen liquidaciones oficiales asociadas.</td></tr>';
 const modal=document.createElement('div');modal.className='contributor-modal-backdrop open';modal.id='solvencyDetailModal';
 modal.innerHTML='<section class="card solvency-detail" role="dialog" aria-modal="true"><header><div><span class="solvency-kicker">DETALLE DE CUENTA</span><h2>'+escapeHTML(solvencyName(p))+'</h2><p>'+escapeHTML((p.identification_type||'')+(p.identification_number?'-'+p.identification_number:''))+'</p></div><button type="button" class="modal-close" data-action="close-solvency-detail">×</button></header><div class="table-card"><table><thead><tr><th>Período</th><th>Inmueble / cuenta</th><th>Estado oficial</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="solvency-detail-note">Este detalle es informativo. No constituye certificado de solvencia.</p></section>';
 document.body.appendChild(modal);
}

function officialReports(){return productionModule('Reportes','La consulta de recaudación requiere integrar registros financieros definitivos y auditoría.');}
function officialPayments(){return productionModule('Recaudación y pagos','Los cobros se mantienen bloqueados hasta disponer de tarifas aprobadas, liquidaciones oficiales y conciliación bancaria.');}
function officialCondoRegistration(){
  return head('Registrar condominio','Incorporar un condominio o urbanización a la gestión tributaria.')+
  '<div class="sit-condo-registration">'+
  '<div class="sit-condo-title"><div class="sit-condo-title-symbol" aria-hidden="true">▦</div><div><h2>Registrar condominio</h2><p>Datos institucionales y cuenta matriz de facturación consolidada.</p></div></div>'+
  '<form id="officialCondoForm" class="sit-condo-form">'+
    '<section class="sit-condo-card sit-condo-identity" aria-labelledby="sitCondoIdentity"><h3 id="sitCondoIdentity"><span aria-hidden="true">▦</span> Datos del condominio</h3>'+
      '<div class="sit-condo-fields sit-condo-fields-two">'+
      '<div class="field"><label for="sitCondoName">Nombre del condominio / urbanización *</label><input id="sitCondoName" name="display_name" required minlength="3" placeholder="Ej. Residencias Los Mangos"></div>'+
      '<div class="field"><label for="sitCondoRif">RIF jurídico *</label><input id="sitCondoRif" name="rif" required placeholder="J-12345678-9" autocomplete="off"></div>'+
      '<div class="field"><label for="sitCondoLegal">Razón social registrada en el RIF *</label><input id="sitCondoLegal" name="legal_name" required minlength="4" placeholder="Denominación legal de la administración"></div>'+
      '<div class="field"><label for="sitCondoEmail">Correo del condominio</label><input id="sitCondoEmail" name="email" type="email" placeholder="condominio@ejemplo.com"></div>'+
      '<div class="field"><label for="sitCondoPhone">Teléfono</label><input id="sitCondoPhone" name="phone" type="tel" placeholder="0414-0000000"></div>'+
      '</div></section>'+
    '<div class="sit-condo-grid">'+
    '<section class="sit-condo-card" aria-labelledby="sitCondoMatrix"><h3 id="sitCondoMatrix"><span aria-hidden="true">▤</span> Cuenta matriz y viviendas</h3>'+
      '<div class="sit-condo-fields sit-condo-fields-two">'+
      '<div class="field"><label for="sitCondoUnits">Cantidad de viviendas cubiertas *</label><input id="sitCondoUnits" name="unit_count" type="number" min="1" max="100000" required placeholder="Cantidad total"></div>'+
      '<div class="field"><label for="sitCondoAddress">Dirección de la cuenta matriz *</label><textarea id="sitCondoAddress" name="address" required minlength="5" rows="2" placeholder="Dirección completa del condominio o urbanización"></textarea></div>'+
      '</div><p class="sit-condo-help">Una sola cuenta matriz para la facturación consolidada; no se duplica el cobro por vivienda.</p></section>'+
    '<section class="sit-condo-card" aria-labelledby="sitCondoLocation"><h3 id="sitCondoLocation"><span aria-hidden="true">⌖</span> Ubicación territorial</h3>'+
      '<div class="sit-condo-fields sit-condo-fields-two">'+
      '<div class="field"><label for="officialCondoParish">Parroquia *</label><select name="parish_id" id="officialCondoParish" required><option value="">Cargando parroquias…</option></select></div>'+
      '<div class="field"><label for="officialCondoSector">Sector donde se ubica *</label><select name="sector_id" id="officialCondoSector" required disabled><option value="">Seleccione parroquia</option></select></div>'+
      '</div><p class="sit-condo-help">La ubicación geográfica se conserva aunque el condominio tenga una tipología propia.</p></section>'+
    '<section class="sit-condo-card" aria-labelledby="sitCondoType"><h3 id="sitCondoType"><span aria-hidden="true">≋</span> Tipología de cobro</h3>'+
      '<div class="sit-condo-type-row"><div class="field"><label for="officialCondoTypology">Tipología de cobro *</label><select name="billing_typology" id="officialCondoTypology" required><option value="">Seleccione sector primero</option><option value="TIPO I">TIPO I</option><option value="TIPO II">TIPO II</option><option value="TIPO III">TIPO III</option></select><small id="officialCondoSectorType">La clasificación territorial se muestra al seleccionar el sector.</small></div>'+
      '<div class="sit-condo-type-note"><strong>Clasificación residencial · Ordenanza 2024</strong><span>Tipo I · 3,00 UCD</span><span>Tipo II · 1,50 UCD</span><span>Tipo III · 0,50 UCD</span></div></div>'+
      '<div class="field"><label for="sitCondoReason">Justificación si la tipología es distinta</label><textarea id="sitCondoReason" name="typology_reason" minlength="15" maxlength="300" rows="2" placeholder="Justificación institucional, cuando corresponda"></textarea><div class="sit-condo-counter"><span>Solo requerida para una excepción autorizada</span><output id="sitCondoReasonCount" for="sitCondoReason">0/300</output></div></div></section>'+
    '<section class="sit-condo-card" aria-labelledby="sitCondoResponsible"><h3 id="sitCondoResponsible"><span aria-hidden="true">♙</span> Administrador / responsable</h3>'+
      '<div class="sit-condo-fields sit-condo-fields-two">'+
      '<div class="field"><label for="sitCondoManager">Nombre del administrador / responsable *</label><input id="sitCondoManager" name="responsible_name" required minlength="3" placeholder="Nombre y apellido"></div>'+
      '<div class="field"><label for="sitCondoManagerId">Cédula del responsable</label><input id="sitCondoManagerId" name="responsible_id" placeholder="V-00000000"></div>'+
      '<div class="field"><label for="sitCondoManagerPhone">Teléfono del responsable</label><input id="sitCondoManagerPhone" name="responsible_phone" type="tel" placeholder="0414-0000000"></div>'+
      '<div class="field"><label for="sitCondoManagerEmail">Correo del responsable</label><input id="sitCondoManagerEmail" name="responsible_email" type="email" placeholder="responsable@ejemplo.com"></div>'+
      '</div></section>'+
    '</div>'+
    '<div class="sit-condo-actions"><button type="button" class="btn btn-light" data-go="organizaciones">Cancelar</button><button type="submit" class="btn btn-primary" id="saveOfficialCondo">Registrar condominio</button></div>'+
  '</form></div>';
}
async function loadOfficialCondoCatalogs(){
 const [p,s]=await Promise.all([imaudClient.from('parishes').select('id,name').eq('is_active',true).order('name'),imaudClient.from('sectors').select('id,name,parish_id,default_typology').eq('is_active',true).order('name')]);
 const parish=document.getElementById('officialCondoParish'),sector=document.getElementById('officialCondoSector');
 if(!parish||!sector)return;
 if(p.error||s.error){parish.innerHTML='<option value="">No disponible</option>';toast('No se pudo cargar el catálogo territorial.');return;}
 state.officialCondoParishes=p.data||[];state.officialCondoSectors=s.data||[];
 parish.innerHTML='<option value="">Seleccione parroquia</option>'+state.officialCondoParishes.map(x=>'<option value="'+x.id+'">'+escapeHTML(x.name)+'</option>').join('');
 sector.innerHTML='<option value="">Seleccione primero la parroquia</option>';
}
function updateOfficialCondoSectors(){
 const parish=document.getElementById('officialCondoParish'),sector=document.getElementById('officialCondoSector'),typ=document.getElementById('officialCondoTypology'),hint=document.getElementById('officialCondoSectorType');if(!parish||!sector)return;
 const rows=(state.officialCondoSectors||[]).filter(x=>x.parish_id===parish.value);
 sector.disabled=!parish.value||!rows.length;sector.innerHTML='<option value="">Seleccione sector</option>'+rows.map(x=>'<option value="'+x.id+'">'+escapeHTML(x.name)+'</option>').join('');
 typ.value='';hint.textContent='La tipología del sector se mostrará al seleccionarlo.';
}
function applyOfficialCondoTypology(){
 const sector=document.getElementById('officialCondoSector'),typ=document.getElementById('officialCondoTypology'),hint=document.getElementById('officialCondoSectorType');
 const row=(state.officialCondoSectors||[]).find(x=>x.id===sector?.value);if(!row)return;
 const current=row.default_typology||'';typ.value=current;hint.textContent='Tipología predeterminada del sector: '+(current||'Sin clasificar')+'. Si corresponde una clasificación particular, el sistema exigirá permiso institucional y justificación.';
}
async function saveOfficialCondo(form){
 const f=new FormData(form),button=document.getElementById('saveOfficialCondo');button.disabled=true;button.textContent='Registrando…';
 try{
  const {data,error}=await imaudClient.rpc('register_official_condominium',{
   p_legal_name:String(f.get('legal_name')).trim(),p_rif:String(f.get('rif')).trim(),p_email:String(f.get('email')||'').trim()||null,p_phone:String(f.get('phone')||'').trim()||null,
   p_display_name:String(f.get('display_name')).trim(),p_address:String(f.get('address')).trim(),p_parish_id:f.get('parish_id'),p_sector_id:f.get('sector_id'),p_unit_count:Number(f.get('unit_count')),
   p_responsible_name:String(f.get('responsible_name')).trim(),p_responsible_id:String(f.get('responsible_id')||'').trim()||null,p_responsible_phone:String(f.get('responsible_phone')||'').trim()||null,p_responsible_email:String(f.get('responsible_email')||'').trim()||null,
   p_billing_typology:f.get('billing_typology'),p_typology_reason:String(f.get('typology_reason')||'').trim()||null
  });
  if(error)throw error;
  toast('Condominio registrado. Contrato: '+(data.contract_number||'asignado'));
  if(data.billing_notice)toast(data.billing_notice);
  go('organizaciones');
 }catch(error){toast('No se pudo registrar el condominio: '+(error.message||'Error'));button.disabled=false;button.textContent='Registrar condominio';}
}

function officialAudit(){
 return head('Bitácora de auditoría','Trazabilidad institucional de acceso, consultas, cambios, pagos y autorizaciones.')+
 '<section class="card panel"><div class="panel-head"><div><h3>Actividad de funcionarios</h3><p>Busca por funcionario y consulta los eventos registrados en los servidores del sistema.</p></div><button class="btn btn-light" data-action="refresh-audit">Actualizar</button></div>'+
 '<form id="auditFilterForm"><div class="form-grid">'+
 '<div class="field"><label for="auditActor">Funcionario</label><select id="auditActor" name="actor"><option value="">Todos los funcionarios</option></select></div>'+
 '<div class="field"><label for="auditPeriod">Período</label><select id="auditPeriod" name="period"><option value="day">Hoy</option><option value="week">Últimos 7 días</option><option value="month" selected>Este mes</option><option value="2months">Últimos 2 meses</option><option value="3months">Últimos 3 meses</option><option value="4months">Últimos 4 meses</option><option value="custom">Rango personalizado</option><option value="all">Todo el historial</option></select></div>'+
 '<div class="field"><label for="auditFrom">Desde</label><input type="date" id="auditFrom" name="from"></div>'+
 '<div class="field"><label for="auditTo">Hasta</label><input type="date" id="auditTo" name="to"></div></div>'+
 '<div class="form-actions"><button class="btn btn-primary" type="submit">Consultar bitácora</button></div></form>'+
 '<p class="panel-hint">Fechas y horas de Santa Ana de Coro. La bitácora es de solo consulta: no permite modificar ni borrar movimientos.</p>'+
 '<div id="auditStatus" style="font-size:12px;color:#6f8193;margin:9px 0"></div>'+
 '<div id="auditRecords"><div class="contributors-loading">Consultando bitácora…</div></div>'+
 '<div class="form-actions"><button type="button" class="btn btn-light" id="auditPrev" data-audit-page="previous" disabled>Anterior</button><span id="auditPageLabel">Página 1</span><button type="button" class="btn btn-light" id="auditNext" data-audit-page="next" disabled>Siguiente</button></div></section>';
}
let auditPageOffset=0,auditFilterReady=false;
const auditCaracasDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function auditSetPeriod(form){
 if(!form)return;
 const type=form.elements.period.value;
 if(type==='custom')return;
 if(type==='all'){form.elements.from.value='';form.elements.to.value='';return;}
 const today=auditCaracasDate(),date=new Date(today+'T12:00:00Z');
 let start=new Date(date);
 if(type==='week')start.setUTCDate(date.getUTCDate()-6);
 if(type==='month')start.setUTCDate(1);
 if(['2months','3months','4months'].includes(type)){start.setUTCMonth(date.getUTCMonth()-(Number(type[0])-1));start.setUTCDate(1);}
 form.elements.from.value=start.toISOString().slice(0,10);form.elements.to.value=today;
}
async function auditLoadActors(){
 const select=document.getElementById('auditActor');
 if(!select)return;
 const {data,error}=await imaudClient.rpc('get_staff_audit_users');
 if(!select.isConnected)return;
 if(error){document.getElementById('auditStatus').textContent='No se pudo obtener el listado de funcionarios: '+error.message;return;}
 const active=select.value;
 select.innerHTML='<option value="">Todos los funcionarios</option>'+
 (data||[]).map(x=>'<option value="'+escapeHTML(x.user_id)+'">'+escapeHTML(x.display_name||'Funcionario')+' · '+escapeHTML(x.email||'Sin correo')+(x.is_active?'':' · Inactivo')+'</option>').join('');
 if((data||[]).some(x=>x.user_id===active))select.value=active;
}
async function loadAuditRecords(reset=false){
 const host=document.getElementById('auditRecords'),form=document.getElementById('auditFilterForm');if(!host||!form)return;
 if(!auditFilterReady){auditSetPeriod(form);auditFilterReady=true;await auditLoadActors();}
 if(reset)auditPageOffset=0;
 const f=new FormData(form),from=String(f.get('from')||''),to=String(f.get('to')||''),actor=String(f.get('actor')||'');
 if(from&&to&&from>to){host.innerHTML='<div class="contributors-empty">El rango de fechas es inválido.</div>';return;}
 host.innerHTML='<div class="contributors-loading">Consultando eventos…</div>';
 const {data,error}=await imaudClient.rpc('get_staff_audit_events',{
  p_actor:actor||null,p_from:from||null,p_to:to||null,p_limit:100,p_offset:auditPageOffset
 });
 if(!host.isConnected)return;
 if(error){host.innerHTML='<div class="contributors-empty">No se pudo consultar la bitácora: '+escapeHTML(error.message)+'</div>';return;}
 const rows=data?.events||[],total=Number(data?.total||0);
 const status=document.getElementById('auditStatus'),prev=document.getElementById('auditPrev'),next=document.getElementById('auditNext'),page=document.getElementById('auditPageLabel');
 if(status)status.textContent=total.toLocaleString('es-VE')+' eventos registrados · Mostrando '+(rows.length?auditPageOffset+1:0)+'–'+(auditPageOffset+rows.length);
 if(prev)prev.disabled=auditPageOffset===0;if(next)next.disabled=auditPageOffset+rows.length>=total;
 if(page)page.textContent='Página '+(Math.floor(auditPageOffset/100)+1);
 if(!rows.length){host.innerHTML='<div class="contributors-empty">No se encontraron eventos para estos filtros.</div>';return;}
 const auditModuleLabels={
  authentication:'Acceso al sistema',inicio:'Inicio',pagos:'Recaudación y pagos',
  contribuyentes:'Contribuyentes',inmuebles:'Inmuebles',organizaciones:'Condominios',
  condominio_registro:'Condominios',facturacion:'Facturación',solvencias:'Solvencias',
  reportes:'Reportes',puntos_venta:'Puntos de venta',mapa:'Mapa territorial',
  ordenanza:'Ordenanza y tarifas',funcionarios:'Funcionarios y permisos',
  bitacora:'Bitácora',assessments:'Obligaciones tributarias',
  staff_profiles:'Funcionarios',staff_permissions:'Permisos de funcionarios',
  pos_terminals:'Puntos de venta',tariff_schedules:'Ordenanza y tarifas',
  citizen_accounts:'Portal del contribuyente',payments:'Pagos',
  demo_payments:'Pagos de prueba',udc_rates:'Tasas UCD'
 };
 const auditActionLabels={
  session_started:'Inició sesión en SITMAUD',
  session_finished:'Cerró sesión en SITMAUD',
  module_opened:'Accedió al módulo',
  search_executed:'Realizó una búsqueda',
  receipt_opened:'Consultó un recibo',
  report_exported:'Exportó un reporte',
  staff_permission_granted:'Asignó un permiso a un funcionario',
  staff_permission_revoked:'Revocó un permiso de un funcionario',
  staff_user_invited:'Invitó a un funcionario al sistema',
  citizen_invited:'Invitó a un contribuyente al portal',
  citizen_access_resent:'Reenvió las instrucciones de acceso a un contribuyente',
  pos_terminal_registered:'Registró un punto de venta',
  residential_tariff_approved:'Aprobó una tarifa residencial',
  trial_tariff_2026_enabled:'Habilitó las tarifas de prueba de 2026',
  udc_rate_contingency_verified:'Verificó institucionalmente una tasa UCD',
  official_payment_udc_registered:'Registró un pago',
  treasury_payment_liquidated:'Tesorería validó y liquidó un pago',
  treasury_bank_reconciled:'Tesorería concilió banco, referencia y monto recibido',
  treasury_payment_rejected:'Tesorería rechazó un pago',
  payment_actual_ves_recorded:'Registró el monto realmente recibido en bolívares',
  citizen_payment_udc_submitted:'Un contribuyente presentó un pago para validación',
  official_payment_liquidated:'Validó y liquidó un pago',
  official_payment_rejected:'Rechazó un pago',
  demo_payment_registered:'Registró un pago de prueba',
  demo_test_record_retired_by_user_request:'Retiró un registro de prueba',
  SUPERUSER_INITIALIZED:'Se configuró el superusuario',
  insert:'Registró información',
  update:'Actualizó información',
  delete:'Eliminó información'
 };
 const auditDescribe=(x)=>{
  const d=x.details&&typeof x.details==='object'?x.details:{};
  const moduleCode=x.module==='staff_activity'?d.module:x.module;
  const moduleLabel=auditModuleLabels[moduleCode]||'';
  const action=auditActionLabels[x.action]||'Operación registrada';
  const phrase=x.action==='module_opened'
    ?action+(moduleLabel?' '+moduleLabel:'')
    :action;
  let note='';
  if(x.action==='module_opened'&&moduleCode==='pagos')note='Acceso a la sección de Recaudación y pagos; no significa que haya registrado un cobro.';
  if(x.action==='session_started')note='Acceso autenticado al sistema.';
  if(x.action==='session_finished')note='Salida de la sesión institucional.';
  return {phrase,moduleLabel:moduleLabel||'Gestión institucional',note};
 };
 host.innerHTML='<div class="payment-debt-scroll"><table class="sit-audit-table"><thead><tr><th>Fecha y hora (Coro)</th><th>Funcionario</th><th>Actividad realizada</th><th>Módulo</th><th>Información</th></tr></thead><tbody>'+
 rows.map(x=>{
  const description=auditDescribe(x);
  const raw=JSON.stringify({accion:x.action,modulo:x.module,registro:x.entity_id,datos:x.details||{}},null,2);
  const email=x.email?'<div class="sit-audit-subtle">'+escapeHTML(x.email)+'</div>':'';
  const detail=description.note?'<span class="sit-audit-note">'+escapeHTML(description.note)+'</span>':'<span class="sit-audit-subtle">Actividad almacenada en la bitácora.</span>';
  return '<tr><td>'+escapeHTML(new Date(x.occurred_at).toLocaleString('es-VE',{timeZone:'America/Caracas',dateStyle:'short',timeStyle:'short'}))+
    '</td><td><strong>'+escapeHTML(x.display_name||'Sistema / usuario no registrado')+'</strong>'+
    (x.job_title?'<div class="sit-audit-subtle">'+escapeHTML(x.job_title)+'</div>':'')+email+
    '</td><td><strong>'+escapeHTML(description.phrase)+'</strong></td><td>'+escapeHTML(description.moduleLabel)+
    '</td><td>'+detail+'<details class="sit-audit-technical"><summary>Ver datos técnicos</summary><pre>'+escapeHTML(raw)+'</pre></details></td></tr>';
 }).join('')+'</tbody></table></div>';
}


window.sitmaudShowPropertyDetails=showPropertyDetails;
// Permission-driven navigation: UI convenience backed by server-enforced RLS/RPC.
const sitmaudViewPermissions={
 inicio:['dashboard.read'],contribuyentes:['contributors.read','contributors.create','contributors.update'],
 inmuebles:['properties.read','properties.create','properties.update'],
 organizaciones:['organizations.manage'],condominio_registro:['organizations.manage'],
 pagos:['payments.read','payments.register'],tesoreria:['payments.validate'],facturacion:['invoices.read','invoices.issue'],
 solvencias:['solvencies.read','solvencies.issue'],
 reportes:['reports.read'],puntos_venta:['reports.read','settings.manage'],
 mapa:['properties.read'],ordenanza:['tariffs.read','tariffs.manage','assessments.read'],
 funcionarios:['staff.manage','permissions.manage'],
 bitacora:['audit.read']
};
function sitmaudCan(permission){
 const access=window.sitmaudAccess;
 return !!access&&(access.master||access.grants.has(permission));
}
function sitmaudAllowed(view){
 const access=window.sitmaudAccess;
 if(!access)return false;
 if(view==='tesoreria')return access.master||(access.grants.has('payments.read')&&access.grants.has('payments.validate'));
 return access.master||((sitmaudViewPermissions[view]||[]).some(p=>access.grants.has(p)));
}
function sitmaudFirstView(){
 return Object.keys(sitmaudViewPermissions).find(sitmaudAllowed)||null;
}
function sitmaudUpdateMenu(){
 const access=window.sitmaudAccess;
 if(!access)return;
 const menu=document.getElementById('mainNav');
 if(!menu)return;
 menu.querySelectorAll('[data-view]').forEach(el=>{
   const visible=sitmaudAllowed(el.dataset.view);
   el.hidden=!visible;
   el.disabled=!visible;
 });
 // Hide unused group headings while keeping their relative order and design.
 menu.querySelectorAll('.nav-label').forEach(group=>{
   let sibling=group.nextElementSibling,visible=false;
   while(sibling&&!sibling.classList.contains('nav-label')){
     if(sibling.matches('[data-view]')&&!sibling.hidden)visible=true;
     sibling=sibling.nextElementSibling;
   }
   group.hidden=!visible;
 });
 // Only show the dashboard as a landing page when its permission exists.
}
function sitmaudCloseMobileMenu(){
 const nav=document.getElementById('sidebar'),backdrop=document.getElementById('mobileNavBackdrop'),trigger=document.getElementById('menuToggle');
 nav?.classList.remove('open');
 if(backdrop)backdrop.hidden=true;
 if(trigger){trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','Abrir menú');}
 document.body.classList.remove('sitmaud-mobile-menu-open');
}
function sitmaudToggleMobileMenu(){
 const nav=document.getElementById('sidebar'),backdrop=document.getElementById('mobileNavBackdrop'),trigger=document.getElementById('menuToggle');
 const opened=nav?.classList.toggle('open')===true;
 if(backdrop)backdrop.hidden=!opened;
 if(trigger){trigger.setAttribute('aria-expanded',String(opened));trigger.setAttribute('aria-label',opened?'Cerrar menú':'Abrir menú');}
 document.body.classList.toggle('sitmaud-mobile-menu-open',opened);
}
document.addEventListener('click',e=>{if(e.target.id==='mobileNavBackdrop')sitmaudCloseMobileMenu();});
window.addEventListener('resize',()=>{if(window.innerWidth>760)sitmaudCloseMobileMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')sitmaudCloseMobileMenu();});
function sitmaudApplyActionPermissions(){
 const a=window.sitmaudAccess;
 if(!a)return;
 const can=code=>a.master||a.grants.has(code);
 const rules={
  'new-person':'contributors.create',
  'new-condo':'organizations.manage',
  'generate-official-obligations':'assessments.create',
  'new-payment':'payments.register',
  'refresh-audit':'audit.read'
 };
 document.querySelectorAll('[data-action]').forEach(button=>{
   const permission=rules[button.dataset.action];
   if(permission&&!can(permission))button.hidden=true;
 });
 document.querySelectorAll('[data-contributor-action="edit"],[data-contributor-action="more"]').forEach(el=>{
  if(!can('contributors.update'))el.hidden=true;
 });
 document.querySelectorAll('[data-property-action="edit"],[data-property-action="more"]').forEach(el=>{
  if(!can('properties.update'))el.hidden=true;
 });
 document.querySelectorAll('[data-go="condominio_registro"]').forEach(el=>{
  if(!can('organizations.manage'))el.hidden=true;
 });
 // A rendered view is still protected by the same permission gate as the sidebar.
}
function render(){
 sitmaudUpdateMenu();
 if(window.sitmaudAccess&&!sitmaudAllowed(state.view)){
   state.view=sitmaudFirstView()||'__no_access';
 }
 if(state.view==='__no_access'){
   $('#crumb').textContent='Acceso restringido';
   $('#content').innerHTML='<section class="card panel"><h2>Sin módulos asignados</h2><p>El superusuario debe asignar los permisos de trabajo a tu cuenta.</p></section>';
   sitmaudCloseMobileMenu();
   return;
 }
 const v=state.view;$('#crumb').textContent=titleMap[v]||'Inicio';const views={inicio:dashboard,contribuyentes:listPeople,inmuebles:properties,organizaciones:organizations,condominio_registro:officialCondoRegistration,pagos:()=>window.sitmaudOfficialFinance.view('pagos'),tesoreria:()=>window.sitmaudOfficialFinance.view('tesoreria'),facturacion:()=>window.sitmaudOfficialFinance.view('facturacion'),solvencias:solvencyModule,reportes:()=>window.sitmaudOfficialFinance.view('reportes'),puntos_venta:()=>window.sitmaudPosTerminals.view(),mapa:mapView,ordenanza:ordinance,funcionarios:staff,bitacora:officialAudit};$('#content').innerHTML=(views[v]||dashboard)();sitmaudApplyActionPermissions();document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===v));sitmaudCloseMobileMenu();if(v==='inicio'){loadDashboardMetrics();window.sitmaudOfficialFinance.loadOverview();}if(v==='solvencias'){loadSolvencyRecords();window.sitmaudSolvencyDocuments?.load();}if(v==='contribuyentes')loadContributors();if(v==='organizaciones')loadOrganizations();if(v==='inmuebles')loadProperties();if(['pagos','tesoreria','facturacion','reportes'].includes(v))window.sitmaudOfficialFinance.mount(v);if(v==='puntos_venta')window.sitmaudPosTerminals.mount();if(v==='condominio_registro')loadOfficialCondoCatalogs();if(v==='bitacora'){auditFilterReady=false;auditPageOffset=0;loadAuditRecords();}if(v==='ordenanza'){loadUdcRate();loadUdcCatalog();loadResidentialEngineReadiness();loadResidentialEngineProperties();window.sitmaudRateContingency?.mount()}if(v==='funcionarios'){loadStaffPermissionMatrix();window.sitmaudBankAdmin.load();}}
function go(v){if(!sitmaudAllowed(v)){toast('No tienes permiso para abrir ese módulo.');return;}state.view=v;render();window.scrollTo(0,0);recordStaffAudit('module_opened',v);}
function recordStaffAudit(action,module,reference=null){
 if(!window.imaudCurrentProfile)return;
 imaudClient.rpc('record_staff_activity',{p_action:action,p_module:module||null,p_reference:reference}).then(({error})=>{if(error)console.warn('Bitácora de navegación no disponible:',error.message);});
}
document.addEventListener('click',e=>{const issuing=e.target.closest('[data-issue-solvency]');if(issuing){issueOfficialSolvency(issuing.dataset.issueSolvency,issuing);return;}const nav=e.target.closest('[data-view]');if(nav){go(nav.dataset.view);return}const g=e.target.closest('[data-go]');if(g){go(g.dataset.go);return}const a=e.target.closest('[data-action]');if(a){const act=a.dataset.action;if(act==='new-person')openContributorModal();else if(act==='new-condo')go('condominio_registro');else if(act==='new-payment')openPaymentModal();else if(act==='refresh-invoices')loadInvoiceRecords();else if(act==='print-invoice')window.print();else if(act==='refresh-audit')loadAuditRecords(true);else if(act==='export-report')exportDemoReport();else if(act==='close-payment-modal')closePaymentModal();else if(act==='close-solvency-detail'){document.getElementById('solvencyDetailModal')?.remove();}else if(act==='close-demo-receipt'){document.getElementById('demoReceiptModal')?.remove();document.body.classList.remove('modal-open');}else if(act==='close-contributor-modal')closeContributorModal();else if(act==='new-property')openPropertyRegistrationModal();else if(act==='close-property-modal')closePropertyRegistrationModal();else if(act==='find-property-contributor')findPropertyContributor();else if(act==='close-property-detail')document.getElementById('propertyDetailModal')?.remove();else if(act==='close-property-edit'){document.getElementById('propertyEditModal')?.remove();document.body.classList.remove('modal-open')}else if(act==='new-staff')openStaffRegistrationPreview();else if(act==='new-org')toast('Formulario ampliado en la siguiente iteración.');else if(act==='approve-residential-tariff')approveResidentialTariff(a);else if(act==='generate-official-obligations')generateOfficialObligations(a);else if(act==='refresh-residential-engine')loadResidentialEngineReadiness();else if(act==='sync-udc')syncUdcRate();else if(act==='print-sample')window.print();else if(act==='export')exportCSV();else toast('Acción disponible en el prototipo.');return}});
document.addEventListener('input',e=>{if(e.target.id==='solvencySearch')renderSolvencyRows()});
document.addEventListener('submit',e=>{if(e.target.id==='auditFilterForm'){e.preventDefault();loadAuditRecords(true);}});
document.addEventListener('change',e=>{if(e.target.id==='auditPeriod'){auditSetPeriod(e.target.form);}});

document.addEventListener('click',e=>{const target=e.target.closest('[data-audit-page]');if(!target)return;auditPageOffset=Math.max(0,auditPageOffset+(target.dataset.auditPage==='next'?100:-100));loadAuditRecords();});

document.addEventListener('input',e=>{if(e.target.id==='sitCondoReason'){const counter=document.getElementById('sitCondoReasonCount');if(counter)counter.textContent=e.target.value.length+'/300';}});
document.addEventListener('change',e=>{if(e.target.id==='demoCondoParish')updateDemoCondoSectors();if(e.target.id==='demoCondoSector')applyDemoCondoTypology()});
document.addEventListener('click',e=>{const invoice=e.target.closest('[data-invoice-id]');if(invoice)showInvoice(invoice.dataset.invoiceId)});
document.addEventListener('click',async e=>{
 const review=e.target.closest('[data-treasury-review]');
 if(review){
  const id=review.dataset.treasuryReview;
  const action=String(window.prompt('Revisión DEMO de Tesorería. Escribe VALIDAR, INCIDENCIA o REVERSAR:','VALIDAR')||'').trim().toLowerCase();
  const map={validar:'validate',incidencia:'incident',reversar:'reverse'};
  const operation=map[action];if(!operation){toast('Acción cancelada o no reconocida.');return;}
  let notes=null;
  if(operation!=='validate'){notes=window.prompt('Describe el motivo y respaldo (mínimo 20 caracteres):','');if(!notes||notes.trim().length<20){toast('La descripción debe tener al menos 20 caracteres.');return;}}
  if(!window.confirm('¿Confirmas la acción '+action.toUpperCase()+' sobre este comprobante DEMO?'))return;
  review.disabled=true;review.textContent='Procesando…';
  const {data,error}=await imaudClient.rpc('review_demo_payment_treasury',{p_payment_id:id,p_action:operation,p_reference:null,p_notes:notes});
  if(error){toast('Tesorería no pudo completar la acción: '+error.message);review.disabled=false;review.textContent='Ver / Validar';return;}
  toast('Tesorería actualizó el comprobante DEMO: '+(data?.treasury_status||operation));
  await loadDemoPayments();await loadPaymentDebtors();
  return;
 }
 const proof=e.target.closest('[data-proof-payment-id]');
 if(proof){
  const {data,error}=await imaudClient.from('demo_payments').select('proof_storage_path').eq('id',proof.dataset.proofPaymentId).single();
  if(error||!data?.proof_storage_path){toast('No se encontró el comprobante adjunto.');return;}
  const signed=await imaudClient.storage.from('imaud-payment-proofs').createSignedUrl(data.proof_storage_path,120);
  if(signed.error){toast('No se pudo abrir el adjunto: '+signed.error.message);return;}
  window.open(signed.data.signedUrl,'_blank','noopener');
 }
});

document.addEventListener('submit',e=>{if(e.target.id==='officialCondoForm'){e.preventDefault();saveOfficialCondo(e.target)}if(e.target.id==='demoReportForm'){e.preventDefault();runDemoReport(e.target)}});
document.addEventListener('click',e=>{const detail=e.target.closest('[data-solvency-detail]');if(detail){showSolvencyDetail(detail.dataset.solvencyDetail);return}});
document.addEventListener('click',e=>{const toggle=e.target.closest('#paymentBankToggle');if(toggle){const input=document.getElementById('paymentBankSearch'),list=document.getElementById('paymentBankResults');if(!input||!list)return;if(!list.hidden){list.hidden=true;input.setAttribute('aria-expanded','false');toggle.setAttribute('aria-expanded','false')}else{input.value='';filterPaymentBanks();toggle.setAttribute('aria-expanded','true');input.focus()}return}const input=e.target.closest('#paymentBankSearch');if(input){filterPaymentBanks();return}const bank=e.target.closest('[data-bank-code]');if(bank){choosePaymentBank(bank.dataset.bankCode);return}const list=document.getElementById('paymentBankResults');if(list&&!e.target.closest('.payment-bank-combobox')){list.hidden=true;document.getElementById('paymentBankSearch')?.setAttribute('aria-expanded','false');document.getElementById('paymentBankToggle')?.setAttribute('aria-expanded','false')}});
document.addEventListener('click',e=>{const person=e.target.closest('[data-payment-person]');if(person){const found=state.paymentDebtors.find(p=>p.id===person.dataset.paymentPerson);if(found)openPaymentModal(found);return}const page=e.target.closest('[data-payment-page]');if(page){state.paymentPage=Number(page.dataset.paymentPage);const host=document.getElementById('paymentDebtorsTable');if(host)host.innerHTML=paymentDebtorTable();return}if(e.target.closest('#menuToggle'))sitmaudToggleMobileMenu()});
function exportCSV(){const rows=[['Referencia','Contribuyente','Periodo','Importe demo','Fecha'],...state.payments.map(p=>[p.ref,p.person,p.period,p.amount,p.date])];const csv=rows.map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='imaud-reporte-demostracion.csv';a.click();URL.revokeObjectURL(a.href);toast('CSV demostrativo descargado')}
document.addEventListener('click',e=>{const action=e.target.closest('[data-contributor-action]');if(!action)return;if(action.dataset.contributorAction==='close')closeContributorAction();else openContributorAction(action.dataset.contributorId,action.dataset.contributorAction)});
document.addEventListener('submit',e=>{if(e.target.id==='contributorActionForm'){e.preventDefault();saveContributorAction(e.target)}});
document.addEventListener('click',e=>{const rowAction=e.target.closest('[data-property-action]');if(rowAction){const id=rowAction.dataset.propertyId;if(rowAction.dataset.propertyAction==='view')showPropertyDetails(id);else if(rowAction.dataset.propertyAction==='edit')openPropertyEdit(id);else showPropertyDetails(id);return}const page=e.target.closest('[data-property-page]');if(page){state.propertyPage=Number(page.dataset.propertyPage);renderPropertiesTable()}});
document.addEventListener('submit',e=>{if(e.target.id==='sectorCorrectionForm'){e.preventDefault();saveSectorCorrection(e.target)}});
document.addEventListener('submit',e=>{if(e.target.id==='editPropertyForm'){e.preventDefault();savePropertyEdit(e.target)}});
document.addEventListener('submit',e=>{if(e.target.id==='standalonePropertyForm'){e.preventDefault();saveStandaloneProperty(e.target)}});
document.addEventListener('click',e=>{
 if(e.target.closest('#createTerritorialAreaButton')){const panel=document.getElementById('newTerritorialAreaPanel');if(panel){panel.hidden=!panel.hidden;panel.querySelector('input[name="name"]')?.focus();}}
 if(e.target.closest('#cancelTerritorialAreaButton')){const panel=document.getElementById('newTerritorialAreaPanel');if(panel)panel.hidden=true;document.getElementById('newTerritorialAreaForm')?.reset();}
});
document.addEventListener('submit',e=>{if(e.target.id==='personForm'){e.preventDefault();saveContributor(e.target)}if(e.target.id==='propertyForm'){e.preventDefault();saveProperty(e.target)}if(e.target.id==='newTerritorialAreaForm'){e.preventDefault();saveNewTerritorialArea(e.target)}if(e.target.id==='paymentLookupForm'){e.preventDefault();findPaymentContributor(e.target)}if(e.target.id==='paymentRegisterForm'){e.preventDefault();saveDemoPayment(e.target)}});
document.addEventListener('input',e=>{if(e.target.id==='paymentBankSearch')filterPaymentBanks();if(e.target.id==='personSearch')filterContributors();if(e.target.id==='paymentDebtorSearch'){state.paymentPage=1;const host=document.getElementById('paymentDebtorsTable');if(host)host.innerHTML=paymentDebtorTable()}if(e.target.id==='propertySearch'){state.propertyPage=1;renderPropertiesTable()}});
document.addEventListener('change',e=>{
 if(e.target.name==='kind'&&e.target.closest('#personForm')){const field=document.getElementById('contributorServiceKindField'),select=document.getElementById('contributorServiceAccountType');if(field)field.hidden=e.target.value!=='juridico';if(e.target.value!=='juridico'&&select)select.value='individual';if(e.target.value==='juridico'){const id=document.querySelector('#personForm [name="identification_type"]');if(id)id.value='J';}}if(e.target.id==='contributorServiceAccountType'){const owner=document.querySelector('#personForm [name="is_property_owner"]');if(owner){owner.value=e.target.value==='condominio'?'false':'true';owner.closest('.field').hidden=e.target.value==='condominio';}}
 if(['typeFilter','statusFilter','parishFilter'].includes(e.target.id))filterContributors();if(e.target.id==='paymentDebtStatus'){state.paymentPage=1;const host=document.getElementById('paymentDebtorsTable');if(host)host.innerHTML=paymentDebtorTable()}if(e.target.classList.contains('payment-assessment-check'))updatePaymentTotal();if(e.target.name==='lookupType'){const label=document.getElementById('paymentLookupLabel'),input=document.getElementById('paymentLookupValue');if(label&&input){const contract=e.target.value==='contrato';label.textContent=contract?'Número de contrato':'Cédula de identidad';input.placeholder=contract?'Ej. CONT-000587':'Ej. V-18.765.432';}}
 if(e.target.id==='paymentMethod')updatePaymentMethodFields();
 if(e.target.id==='contactParishSelect')updateSectorOptions('contactParishSelect','contactSectorSelect',true);
 if(e.target.id==='propertyParishSelect')updatePropertyLocationFields();
 if(e.target.id==='propertyAreaType')updatePropertyLocationFields();
 if(e.target.id==='propertyOwnerFlag'){const box=document.getElementById('propertyOwnerDetails'),isOwner=e.target.value==='true';if(box)box.hidden=isOwner;['ownerName','ownerIdentificationNumber'].forEach(id=>{const input=document.getElementById(id);if(input)input.required=!isOwner;});}
 if(e.target.id==='standaloneParish')updateSectorOptions('standaloneParish','standaloneSector',false);
 if(e.target.id==='editPropertyParish')updateSectorOptions('editPropertyParish','editPropertySector',false); if(e.target.id==='editPropertySector'){const sect=state.sectors.find(x=>x.id===e.target.value);const field=document.getElementById('propertySectorTypology');if(field)field.value=sect?.default_typology||'Sin clasificación';}
 if(e.target.id==='udcParishSelect')updateUdcSectorOptions();if(e.target.id==='correctionParish')updateCorrectionSectors();if(e.target.id==='correctionSector')showCorrectionCurrent();
 if(['udcSectorSelect','propertySectorSelect','standaloneSector','editPropertySector'].includes(e.target.id))showUdcSectorPreview(e.target.id);
 if(['propertyParishFilter','propertySectorFilter','propertyStatusFilter'].includes(e.target.id)){state.propertyPage=1;renderPropertiesTable()}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('contributorModal'))closeContributorModal();if(e.key==='Escape'&&document.getElementById('propertyRegistrationModal'))closePropertyRegistrationModal();if(e.key==='Escape'&&document.getElementById('propertyEditModal')){document.getElementById('propertyEditModal')?.remove();document.body.classList.remove('modal-open')}if(e.key==='Escape')document.getElementById('propertyDetailModal')?.remove();if(e.key==='Enter'&&e.target.id==='propertyContributorId'){e.preventDefault();findPropertyContributor()}});
const originalRender=render;render=function(){if(state.view==='pago-form'&&sitmaudAllowed('pagos')){ $('#crumb').textContent='Registrar pago';$('#content').innerHTML=paymentForm();sitmaudCloseMobileMenu();return}originalRender()};
// Register authentication handling before the first render to avoid a blank Inicio
// if the session resolves while the application bundle is initializing.
window.addEventListener('imaud:authenticated',()=>{
  state.view=sitmaudFirstView()||'__no_access';
  render();
});
render();
if(document.body.classList.contains('sitmaud-authenticated')&&window.sitmaudAccess){
  state.view=sitmaudFirstView()||'__no_access';
  render();
}
