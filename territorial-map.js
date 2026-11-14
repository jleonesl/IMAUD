/* SITMAUD · Panel territorial. Geolocalización independiente de los formularios de registro. */
(function(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>new Intl.NumberFormat('es-VE',{maximumFractionDigits:0}).format(Number(n||0));
 let map=null, layer=null, records=[], selected=null, placing=false, satellite=false, filtersOpen=false;
 const notify=m=>typeof window.toast==='function'?window.toast(m):alert(m);
 const name=p=>p.contributor?.kind==='juridico'?(p.contributor?.legal_name||p.organization_name||'Condominio'):[p.contributor?.first_name,p.contributor?.last_name].filter(Boolean).join(' ')||p.contributor?.legal_name||p.organization_name||'Contribuyente';
 const idText=p=>[p.contributor?.identification_type,p.contributor?.identification_number].filter(Boolean).join('-')||'Sin identificación';
 const contract=p=>p.contributor?.contract_number||'Sin contrato';
 function status(p){
  if((p.assessments||[]).some(a=>['pending','partially_paid'].includes(a.status)))return {key:'debt',label:'Con deuda'};
  if((p.pendingPayments||[]).length)return {key:'validation',label:'Por validar'};
  return {key:'paid',label:'Al día'};
 }
 function markerIcon(p){
  const s=status(p);
  const symbol=s.key==='paid'?'✓':s.key==='debt'?'!':'◷';
  return L.divIcon({className:'sitmaud-pin-host',html:'<span class="sitmaud-pin '+s.key+'"><b>'+symbol+'</b></span>',iconSize:[34,42],iconAnchor:[17,39],popupAnchor:[0,-36]});
 }
 function currentFilter(){
  const q=(document.getElementById('territorialSearch')?.value||'').trim().toLocaleLowerCase('es-VE');
  const kind=document.getElementById('territorialKind')?.value||'all';
  return records.filter(p=>{
   const text=[name(p),idText(p),contract(p),p.address,p.parish_name,p.sector_name,p.organization_name].join(' ').toLocaleLowerCase('es-VE');
   const condo=Boolean(p.is_consolidated_master||p.contributor?.service_account_type==='condominio'||p.organization_name);
   return (!q||text.includes(q))&&(kind==='all'||(kind==='condominio'?condo:kind==='contribuyente'?true:!p.is_consolidated_master));
  });
 }
 function updateStats(){
  const located=records.filter(p=>p.latitude!=null&&p.longitude!=null);
  const values=[
   ['territorialStatLocated',located.length],['territorialStatPaid',located.filter(p=>status(p).key==='paid').length],
   ['territorialStatDebt',located.filter(p=>status(p).key==='debt').length],['territorialStatValidation',located.filter(p=>status(p).key==='validation').length]
  ];
  values.forEach(([id,n])=>{const el=document.getElementById(id);if(el)el.textContent=money(n)});
 }
 function recentList(){
  const host=document.getElementById('territorialRecent');if(!host)return;
  const rows=records.filter(p=>p.latitude!=null&&p.longitude!=null).sort((a,b)=>new Date(b.location_updated_at||b.updated_at||b.created_at||0)-new Date(a.location_updated_at||a.updated_at||a.created_at||0)).slice(0,5);
  host.innerHTML=rows.length?rows.map(p=>'<button class="territorial-recent-row" type="button" data-territorial-id="'+esc(p.id)+'"><span class="territorial-recent-pin '+status(p).key+'">⌖</span><span><b>'+esc(idText(p))+'</b><strong>'+esc(name(p))+'</strong><small>'+esc(contract(p))+'</small></span><time>'+(p.location_updated_at?new Date(p.location_updated_at).toLocaleDateString('es-VE'):'')+'</time></button>').join(''):'<div class="territorial-no-recent">Todavía no hay ubicaciones registradas.</div>';
 }
 function selectedPanel(){
  const host=document.getElementById('territorialSelected');if(!host)return;
  if(!selected){host.innerHTML='<div class="territorial-select-empty">Busca un registro y selecciónalo para asignar su ubicación.</div>';return;}
  const s=status(selected);
  host.innerHTML='<div class="territorial-record-card"><div class="territorial-record-title"><span class="territorial-record-symbol">⌂</span><div><b>'+esc(name(selected))+'</b><small>'+esc(idText(selected))+'</small></div><button type="button" id="territorialClear" aria-label="Cerrar">×</button></div><p><b>Contrato:</b> '+esc(contract(selected))+'</p><p><b>Sector:</b> '+esc(selected.sector_name||'No especificado')+'</p><span class="territorial-state '+s.key+'">'+(s.key==='paid'?'✓':s.key==='debt'?'!':'◷')+' '+esc(s.label)+'</span><div class="territorial-coords">'+(selected.latitude!=null?'Lat. '+Number(selected.latitude).toFixed(6)+' · Long. '+Number(selected.longitude).toFixed(6):'Este registro aún no tiene ubicación asignada.')+'</div><button type="button" class="btn btn-primary territorial-expedient" id="territorialOpenRecord">↗ Ver expediente</button></div>';
 }
 function renderSearchResults(){
  const host=document.getElementById('territorialSearchResults');if(!host)return;
  const rows=currentFilter().slice(0,30);
  host.innerHTML=rows.length?rows.map(p=>'<button type="button" class="territorial-search-result" data-territorial-id="'+esc(p.id)+'"><span class="territorial-result-dot '+status(p).key+'"></span><span><b>'+esc(name(p))+'</b><small>'+esc(idText(p))+' · '+esc(contract(p))+'</small></span><em>'+(p.latitude!=null?'Ubicado':'Sin ubicación')+'</em></button>').join(''):'<div class="territorial-no-recent">No se encontraron registros con esos datos.</div>';
 }
 function popup(p){
  const s=status(p);
  return '<div class="territorial-popup"><b>'+esc(name(p))+'</b><span>'+esc(idText(p))+'</span><strong>Contrato: '+esc(contract(p))+'</strong><span>Sector: '+esc(p.sector_name||'No especificado')+'</span><i class="'+s.key+'">'+esc(s.label)+'</i><button type="button" data-territorial-popup="'+esc(p.id)+'">Ver expediente</button></div>';
 }
 function drawMarkers(){
  if(!map||!layer)return;layer.clearLayers();
  records.filter(p=>p.latitude!=null&&p.longitude!=null).forEach(p=>{
   const m=L.marker([Number(p.latitude),Number(p.longitude)],{icon:markerIcon(p)}).addTo(layer);
   m.bindPopup(popup(p),{maxWidth:260});
   m.on('click',()=>{selected=p;selectedPanel()});
  });
  updateStats();recentList();
 }
 function tileLayer(){
  if(!map)return;
  if(window.__sitmaudBaseTiles)map.removeLayer(window.__sitmaudBaseTiles);
  const url=satellite?'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}':'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  window.__sitmaudBaseTiles=L.tileLayer(url,{maxZoom:19,attribution:satellite?'Tiles &copy; Esri':'&copy; OpenStreetMap contributors'}).addTo(map);
  const label=document.getElementById('territorialLayerToggle');if(label)label.textContent=satellite?'Satélite':'Mapa';
 }
 async function saveLocation(lat,lng){
  if(!selected)return;
  const {error}=await window.imaudClient.from('properties').update({latitude:Number(lat),longitude:Number(lng)}).eq('id',selected.id);
  if(error){console.error('SITMAUD geolocation:',error);notify('No se pudo guardar la ubicación: '+error.message);return;}
  selected.latitude=Number(lat);selected.longitude=Number(lng);selected.location_updated_at=new Date().toISOString();placing=false;
  drawMarkers();selectedPanel();renderSearchResults();map.setView([lat,lng],17);notify('Ubicación guardada correctamente.');
 }
 async function loadData(){
  const result=document.getElementById('territorialSearchResults');if(result)result.innerHTML='<div class="territorial-no-recent">Cargando registros de SITMAUD…</div>';
  const [pr,ar,dr]=await Promise.all([
   window.imaudClient.from('properties').select('id,contributor_id,address,latitude,longitude,is_active,is_consolidated_master,consolidated_units,parish_name,sector_name,organization_name,created_at,updated_at,contributor:contributors!properties_contributor_id_fkey(id,contract_number,kind,service_account_type,identification_type,identification_number,legal_name,first_name,last_name),assessments(id,status,period_start)').eq('is_active',true).order('created_at',{ascending:false}),
   window.imaudClient.from('assessments').select('id,property_id,status'),
   window.imaudClient.from('demo_payments').select('contributor_id,treasury_status,paid_at')
  ]);
  if(!document.getElementById('territorialSearchResults'))return;
  if(pr.error){console.error('SITMAUD map query:',pr.error);result.innerHTML='<div class="territorial-no-recent error">No se pudieron cargar los registros: '+esc(pr.error.message)+'</div>';return;}
  const assessments=ar.error?[]:(ar.data||[]),payments=dr.error?[]:(dr.data||[]);
  records=(pr.data||[]).map(p=>({...p,assessments:assessments.filter(a=>a.property_id===p.id),pendingPayments:payments.filter(x=>x.contributor_id===p.contributor_id&&(x.treasury_status||'pending')==='pending')}));
  updateStats();recentList();renderSearchResults();drawMarkers();
  const located=records.filter(p=>p.latitude!=null&&p.longitude!=null);
  if(located.length)map.fitBounds(located.map(p=>[Number(p.latitude),Number(p.longitude)]),{padding:[30,30],maxZoom:16});
  else map.setView([11.4045,-69.6734],14);
 }
 function initMap(){
  const el=document.getElementById('territorialMapCanvas');if(!el)return;
  const ready=()=>{if(!document.getElementById('territorialMapCanvas'))return;if(map){map.remove();map=null;}
   map=L.map(el,{zoomControl:false,scrollWheelZoom:true}).setView([11.4045,-69.6734],14);
   L.control.zoom({position:'topleft'}).addTo(map);layer=L.layerGroup().addTo(map);tileLayer();
   map.on('click',e=>{if(placing&&selected)saveLocation(e.latlng.lat,e.latlng.lng)});
   loadData().then(()=>setTimeout(()=>map.invalidateSize(),160));
  };
  if(window.L){ready();return;}
  if(!document.querySelector('link[data-sitmaud-leaflet]')){const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.dataset.sitmaudLeaflet='1';document.head.appendChild(css);}
  const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.onload=ready;script.onerror=()=>{el.innerHTML='<div class="territorial-no-recent error">No se pudo cargar el mapa. Verifica tu conexión.</div>'};document.head.appendChild(script);
 }
 window.mapView=function(){
  return '<div class="territorial-page-head"><div class="territorial-page-title"><span class="territorial-page-icon">⌖</span><div><h1>Mapa territorial</h1><p>Georreferenciación y control de contribuyentes, inmuebles y condominios.</p></div></div><div class="territorial-head-actions"><button class="btn btn-primary" id="territorialLoadLocation">＋ Cargar ubicación</button><button class="btn btn-light" id="territorialExport">⇧ Exportar</button><button class="btn btn-light" id="territorialFilters">⚑ Filtros</button></div></div>'+
  '<div class="territorial-stats-grid"><article><span class="territorial-stat-icon green">⌖</span><div><b id="territorialStatLocated">—</b><small>Ubicaciones registradas</small></div></article><article><span class="territorial-stat-icon green">✓</span><div><b id="territorialStatPaid">—</b><small>Al día</small></div></article><article><span class="territorial-stat-icon red">!</span><div><b id="territorialStatDebt">—</b><small>Con deuda</small></div></article><article><span class="territorial-stat-icon amber">◷</span><div><b id="territorialStatValidation">—</b><small>Por validar</small></div></article></div>'+
  '<div class="territorial-main-grid"><aside class="territorial-control-column"><section class="card territorial-load-card"><h3>⌖ Cargar ubicación</h3><p>Busca un registro existente para asignar su ubicación en el mapa.</p><label for="territorialKind">Tipo de registro</label><select id="territorialKind"><option value="contribuyente">Contribuyente</option><option value="inmueble">Inmueble</option><option value="condominio">Condominio</option><option value="all">Todos</option></select><div class="territorial-searchbox"><span>⌕</span><input id="territorialSearch" placeholder="Cédula, RIF o N.º de contrato"></div><button class="btn btn-primary territorial-search-button" id="territorialSearchButton">Buscar</button><div id="territorialSearchResults" class="territorial-search-results"></div></section><section class="card territorial-recent-card"><h3>Últimas ubicaciones</h3><div id="territorialRecent"></div><button type="button" class="territorial-history-link" id="territorialHistory">Ver historial de ubicaciones →</button></section></aside>'+
  '<section class="card territorial-map-panel"><div class="territorial-map-tools"><button type="button" id="territorialGps" title="Centrar en mi ubicación">◎</button><div class="territorial-map-spacer"></div><button type="button" id="territorialLayerToggle">Mapa</button><button type="button" id="territorialSatelliteToggle">Satélite</button></div><div id="territorialMapCanvas" class="territorial-map-canvas"></div><div class="territorial-map-footer"><span><i class="paid"></i>Al día</span><span><i class="debt"></i>Con deuda</span><span><i class="validation"></i>Por validar</span><small>OpenStreetMap / Esri World Imagery</small></div></section></div>'+
  '<div class="territorial-location-hint" id="territorialHint" hidden>Registro seleccionado. Pulsa «Marcar ubicación» y luego el punto exacto en el mapa.</div>';
 };
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-view="mapa"]'))setTimeout(initMap,90);
  if(e.target.closest('#territorialLoadLocation')){document.getElementById('territorialSearch')?.focus();notify('Busca el contribuyente, inmueble o condominio y selecciónalo para cargar su ubicación.');}
  if(e.target.closest('#territorialSearchButton'))renderSearchResults();
  const item=e.target.closest('[data-territorial-id]');if(item){selected=records.find(p=>p.id===item.dataset.territorialId)||null;selectedPanel();if(selected?.latitude!=null)map?.setView([Number(selected.latitude),Number(selected.longitude)],17);else{placing=true;notify('Ahora puedes usar GPS o marcar el punto exacto en el mapa.')}return;}
  if(e.target.closest('#territorialClear')){selected=null;placing=false;selectedPanel();return;}\n  if(e.target.closest('#territorialStartPlace')){if(!selected)return;placing=true;const hint=document.getElementById('territorialHint');if(hint){hint.hidden=false;hint.textContent='Modo de ubicación activo: pulsa el punto exacto sobre el mapa para guardar las coordenadas.';}notify('Haz clic en el punto exacto del mapa para guardar la ubicación.');return;}\n  if(e.target.closest('#territorialSelectedGps')){if(!selected)return;if(!navigator.geolocation){notify('GPS no disponible en este navegador.');return;}navigator.geolocation.getCurrentPosition(pos=>saveLocation(pos.coords.latitude,pos.coords.longitude),()=>notify('No se pudo obtener tu ubicación. Revisa los permisos del navegador.'),{enableHighAccuracy:true,timeout:15000});return;}
  if(e.target.closest('#territorialSatelliteToggle')){satellite=true;tileLayer();document.getElementById('territorialSatelliteToggle').classList.add('active');document.getElementById('territorialLayerToggle').classList.remove('active');return;}
  if(e.target.closest('#territorialLayerToggle')){satellite=false;tileLayer();document.getElementById('territorialLayerToggle').classList.add('active');document.getElementById('territorialSatelliteToggle').classList.remove('active');return;}
  if(e.target.closest('#territorialGps')){if(!navigator.geolocation){notify('GPS no disponible en este navegador.');return;}navigator.geolocation.getCurrentPosition(pos=>{if(selected)saveLocation(pos.coords.latitude,pos.coords.longitude);else map?.setView([pos.coords.latitude,pos.coords.longitude],17)},()=>notify('No se pudo obtener tu ubicación. Revisa los permisos del navegador.'),{enableHighAccuracy:true,timeout:15000});return;}
  if(e.target.closest('#territorialExport')){const rows=records.filter(p=>p.latitude!=null&&p.longitude!=null);const csv=[['Contribuyente','Identificación','Contrato','Dirección','Parroquia','Sector','Latitud','Longitud','Estado'],...rows.map(p=>[name(p),idText(p),contract(p),p.address,p.parish_name,p.sector_name,p.latitude,p.longitude,status(p).label])].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='sitmaud-ubicaciones.csv';a.click();URL.revokeObjectURL(a.href);return;}
  if(e.target.closest('#territorialFilters')){const kind=document.getElementById('territorialKind');kind.focus();kind.click();return;}
  if(e.target.closest('#territorialOpenRecord')||e.target.closest('[data-territorial-popup]')){const id=e.target.closest('[data-territorial-popup]')?.dataset.territorialPopup||selected?.id;const p=records.find(x=>x.id===id);if(p&&window.showPropertyDetails)window.showPropertyDetails(p.id);else notify('Expediente seleccionado: '+name(p||selected));return;}
  if(e.target.closest('#territorialHistory')){const located=records.filter(p=>p.latitude!=null&&p.longitude!=null);notify('Historial disponible: '+located.length+' ubicaciones registradas.');}
 });
 document.addEventListener('input',e=>{if(e.target.id==='territorialSearch')renderSearchResults()});
 document.addEventListener('change',e=>{if(e.target.id==='territorialKind')renderSearchResults()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&map&&document.getElementById('territorialMapCanvas'))setTimeout(()=>map.invalidateSize(),100)});
})();
