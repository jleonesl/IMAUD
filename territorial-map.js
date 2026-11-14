/* SITMAUD · Mapa territorial. Implementación del render aprobado. */
(function () {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => new Intl.NumberFormat('es-VE').format(Number(value || 0));
  const money = value => new Intl.NumberFormat('es-VE',{maximumFractionDigits:2}).format(Number(value || 0));
  const notify = message => typeof window.toast === 'function' ? window.toast(message) : alert(message);
  let map = null, markerLayer = null, baseLayer = null, rows = [], selected = null;
  let placing = false, satellite = false, statusFilter = 'all', typeFilter = 'all';

  function personName(p) {
    const c = p.contributor || {};
    return c.kind === 'juridico'
      ? (c.legal_name || p.organization_name || 'Condominio')
      : ([c.first_name,c.last_name].filter(Boolean).join(' ') || c.legal_name || p.organization_name || 'Contribuyente');
  }
  function identification(p) {
    const c = p.contributor || {};
    return [c.identification_type,c.identification_number].filter(Boolean).join('-') || 'Sin identificación';
  }
  function contract(p) { return p.contributor?.contract_number || p.contract_number || 'Sin contrato'; }
  function recordType(p) {
    return p.is_consolidated_master || p.contributor?.service_account_type === 'condominio' || p.organization_name ? 'condominio' : 'inmueble';
  }
  function recordStatus(p) {
    const assessments = p.assessments || [];
    if (assessments.some(a => ['pending','partially_paid'].includes(a.status))) return {key:'debt',label:'Con deuda',symbol:'!'};
    if ((p.pendingPayments || []).length) return {key:'validation',label:'Por validar',symbol:'◷'};
    if (assessments.length && assessments.every(a => a.status === 'paid')) return {key:'paid',label:'Al día',symbol:'✓'};
    return {key:'validation',label:'Por validar',symbol:'◷'};
  }
  function filteredRows() {
    const query = (document.getElementById('territorialSearch')?.value || '').trim().toLocaleLowerCase('es-VE');
    const kind = document.getElementById('territorialKind')?.value || 'all';
    return rows.filter(p => {
      const text = [personName(p),identification(p),contract(p),p.address,p.parish_name,p.sector_name,p.organization_name].join(' ').toLocaleLowerCase('es-VE');
      const matchesKind = kind === 'all' || (kind === 'contribuyente' ? true : recordType(p) === kind);
      const matchesStatus = statusFilter === 'all' || recordStatus(p).key === statusFilter;
      const matchesType = typeFilter === 'all' || recordType(p) === typeFilter;
      return (!query || text.includes(query)) && matchesKind && matchesStatus && matchesType;
    });
  }
  function stats() {
    const located = rows.filter(p => p.latitude != null && p.longitude != null);
    const counts = {
      territorialStatLocated: located.length,
      territorialStatPaid: located.filter(p => recordStatus(p).key === 'paid').length,
      territorialStatDebt: located.filter(p => recordStatus(p).key === 'debt').length,
      territorialStatValidation: located.filter(p => recordStatus(p).key === 'validation').length
    };
    Object.entries(counts).forEach(([id,value]) => { const el=document.getElementById(id); if(el) el.textContent=number(value); });
  }
  function pinIcon(p) {
    const s = recordStatus(p);
    return L.divIcon({
      className:'sitmaud-pin-host',
      html:'<span class="sitmaud-pin '+s.key+'"><b>'+s.symbol+'</b></span>',
      iconSize:[34,42], iconAnchor:[17,39], popupAnchor:[0,-36]
    });
  }
  function popupContent(p) {
    const s = recordStatus(p);
    return '<div class="territorial-popup"><b>'+esc(personName(p))+'</b><span>'+esc(identification(p))+'</span><strong>Contrato: '+esc(contract(p))+'</strong><span>Sector: '+esc(p.sector_name || 'No especificado')+'</span><i class="'+s.key+'">'+esc(s.label)+'</i><small>'+esc(p.address || '')+'</small></div>';
  }
  function drawMarkers() {
    if (!map || !markerLayer) return;
    markerLayer.clearLayers();
    rows.filter(p => p.latitude != null && p.longitude != null).forEach(p => {
      L.marker([Number(p.latitude),Number(p.longitude)],{icon:pinIcon(p)})
        .addTo(markerLayer).bindPopup(popupContent(p),{maxWidth:260})
        .on('click',() => { selected=p; renderSelected(); });
    });
    stats();
    renderRecent();
  }
  function renderRecent() {
    const host=document.getElementById('territorialRecent');
    if(!host)return;
    const recent=rows.filter(p=>p.latitude!=null&&p.longitude!=null)
      .sort((a,b)=>new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0)).slice(0,5);
    host.innerHTML=recent.length ? recent.map(p=>{
      const s=recordStatus(p);
      const date=p.updated_at?new Date(p.updated_at).toLocaleDateString('es-VE'):'';
      return '<button class="territorial-recent-row" type="button" data-territorial-id="'+esc(p.id)+'"><span class="territorial-recent-pin '+s.key+'">⌖</span><span><b>'+esc(identification(p))+'</b><strong>'+esc(personName(p))+'</strong><small>'+esc(contract(p))+'</small></span><time>'+esc(date)+'</time></button>';
    }).join('') : '<div class="territorial-no-recent">Todavía no hay ubicaciones registradas.</div>';
  }
  function renderResults() {
    const host=document.getElementById('territorialSearchResults');
    if(!host)return;
    const query=(document.getElementById('territorialSearch')?.value||'').trim();
    if(!query){host.innerHTML='';return;}
    const matches=filteredRows().slice(0,30);
    host.innerHTML=matches.length ? matches.map(p=>{
      const s=recordStatus(p);
      return '<button type="button" class="territorial-search-result" data-territorial-id="'+esc(p.id)+'"><span class="territorial-result-dot '+s.key+'"></span><span><b>'+esc(personName(p))+'</b><small>'+esc(identification(p))+' · '+esc(contract(p))+'</small></span><em>'+(p.latitude!=null?'Ubicado':'Sin ubicación')+'</em></button>';
    }).join('') : '<div class="territorial-no-recent">No se encontraron registros con esos datos.</div>';
  }
  function renderSelected() {
    const host=document.getElementById('territorialSelected');
    if(!host)return;
    if(!selected){host.innerHTML='<div class="territorial-select-empty">Busca un registro existente y selecciónalo para asignar su ubicación.</div>';return;}
    const s=recordStatus(selected);
    host.innerHTML='<div class="territorial-record-card"><div class="territorial-record-title"><span class="territorial-record-symbol">⌂</span><div><b>'+esc(personName(selected))+'</b><small>'+esc(identification(selected))+'</small></div><button type="button" id="territorialClear" aria-label="Cerrar">×</button></div><p><b>Contrato:</b> '+esc(contract(selected))+'</p><p><b>Sector:</b> '+esc(selected.sector_name||'No especificado')+'</p><span class="territorial-state '+s.key+'">'+s.symbol+' '+esc(s.label)+'</span><div class="territorial-coords">'+(selected.latitude!=null?'Lat. '+Number(selected.latitude).toFixed(6)+' · Long. '+Number(selected.longitude).toFixed(6):'Este registro todavía no tiene ubicación asignada.')+'</div><div class="territorial-selected-actions"><button type="button" class="btn btn-primary" id="territorialStartPlace">⌖ Marcar ubicación</button><button type="button" class="btn btn-light" id="territorialSelectedGps">◎ Usar GPS</button></div><button type="button" class="btn btn-light territorial-expedient" id="territorialOpenRecord">↗ Ver expediente</button></div>';
  }
  function setBaseLayer() {
    if(!map)return;
    if(baseLayer)map.removeLayer(baseLayer);
    const url=satellite
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    baseLayer=L.tileLayer(url,{maxZoom:19,attribution:satellite?'Tiles &copy; Esri':'&copy; OpenStreetMap contributors'}).addTo(map);
    document.getElementById('territorialLayerToggle')?.classList.toggle('active',!satellite);
    document.getElementById('territorialSatelliteToggle')?.classList.toggle('active',satellite);
  }
  async function saveLocation(lat,lng) {
    if(!selected)return;
    const button=document.getElementById('territorialStartPlace');
    if(button){button.disabled=true;button.textContent='Guardando…';}
    const {error}=await imaudClient.from('properties')
      .update({latitude:Number(lat),longitude:Number(lng)}).eq('id',selected.id);
    if(error){
      console.error('SITMAUD location update:',error);
      notify('No se pudo guardar la ubicación. '+error.message);
      if(button){button.disabled=false;button.textContent='⌖ Marcar ubicación';}
      return;
    }
    selected.latitude=Number(lat);selected.longitude=Number(lng);
    selected.updated_at=new Date().toISOString();placing=false;
    const hint=document.getElementById('territorialHint');if(hint)hint.hidden=true;
    drawMarkers();renderSelected();renderResults();
    map?.setView([Number(lat),Number(lng)],17);
    notify('Ubicación guardada correctamente.');
  }
  function locateWithGps() {
    if(!selected){notify('Primero busca y selecciona un registro.');return;}
    if(!navigator.geolocation){notify('Este navegador no permite obtener coordenadas GPS.');return;}
    const button=document.getElementById('territorialSelectedGps');
    if(button){button.disabled=true;button.textContent='Obteniendo GPS…';}
    navigator.geolocation.getCurrentPosition(pos=>{
      saveLocation(pos.coords.latitude,pos.coords.longitude).finally(()=>{
        if(button?.isConnected){button.disabled=false;button.textContent='◎ Usar GPS';}
      });
    },err=>{
      notify(err.code===1?'Debes permitir el acceso a la ubicación.':'No se pudo obtener la ubicación GPS.');
      if(button?.isConnected){button.disabled=false;button.textContent='◎ Usar GPS';}
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  }
  async function loadData() {
    const host=document.getElementById('territorialSearchResults');
    const [properties,payments]=await Promise.all([
      imaudClient.from('properties')
        .select('id,contributor_id,address,latitude,longitude,is_active,is_consolidated_master,consolidated_units,parish_name,sector_name,organization_name,created_at,updated_at,contributor:contributors!properties_contributor_id_fkey(id,contract_number,kind,service_account_type,identification_type,identification_number,legal_name,first_name,last_name),assessments(id,status,period_start)')
        .eq('is_active',true).order('created_at',{ascending:false}),
      imaudClient.from('demo_payments').select('contributor_id,treasury_status')
    ]);
    if(!document.getElementById('territorialMapCanvas'))return;
    if(properties.error){
      console.error('SITMAUD territorial records:',properties.error);
      if(host)host.innerHTML='<div class="territorial-no-recent error">No se pudieron consultar los registros. '+esc(properties.error.message)+'</div>';
      return;
    }
    const paymentRows=payments.error?[]:(payments.data||[]);
    rows=(properties.data||[]).map(p=>({...p,pendingPayments:paymentRows.filter(x=>x.contributor_id===p.contributor_id&&(x.treasury_status||'pending')==='pending')}));
    stats();renderRecent();renderResults();drawMarkers();
    const located=rows.filter(p=>p.latitude!=null&&p.longitude!=null);
    if(located.length)map.fitBounds(located.map(p=>[Number(p.latitude),Number(p.longitude)]),{padding:[28,28],maxZoom:16});
    else map.setView([11.4045,-69.6734],14);
  }
  function initMap() {
    const el=document.getElementById('territorialMapCanvas');
    if(!el)return;
    const start=()=>{
      if(!document.getElementById('territorialMapCanvas'))return;
      if(map){map.remove();map=null;}
      map=L.map(el,{zoomControl:false,scrollWheelZoom:true}).setView([11.4045,-69.6734],14);
      L.control.zoom({position:'topleft'}).addTo(map);
      markerLayer=L.layerGroup().addTo(map);
      setBaseLayer();
      map.on('click',event=>{
        if(placing&&selected)saveLocation(event.latlng.lat,event.latlng.lng);
      });
      loadData().then(()=>setTimeout(()=>map?.invalidateSize(),150));
    };
    if(window.L){start();return;}
    if(!document.querySelector('link[data-sitmaud-leaflet]')){
      const link=document.createElement('link');link.rel='stylesheet';
      link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.dataset.sitmaudLeaflet='1';document.head.appendChild(link);
    }
    const script=document.createElement('script');
    script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload=start;
    script.onerror=()=>{el.innerHTML='<div class="territorial-no-recent error">No se pudo cargar el mapa. Verifica tu conexión.</div>';};
    document.head.appendChild(script);
  }
  function exportLocations() {
    const located=rows.filter(p=>p.latitude!=null&&p.longitude!=null);
    const data=[['Contribuyente','Identificación','Contrato','Dirección','Parroquia','Sector','Latitud','Longitud','Estado'],
      ...located.map(p=>[personName(p),identification(p),contract(p),p.address,p.parish_name,p.sector_name,p.latitude,p.longitude,recordStatus(p).label])];
    const csv=data.map(row=>row.map(value=>'"'+String(value??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download='SITMAUD-ubicaciones-territoriales.csv';a.click();URL.revokeObjectURL(url);
  }
  function showFilters() {
    const panel=document.getElementById('territorialFilterPanel');
    if(!panel)return;
    panel.hidden=!panel.hidden;
  }
  function openLocationHistory() {
    document.getElementById('territorialHistoryModal')?.remove();
    const history=rows.filter(p=>p.latitude!=null&&p.longitude!=null)
      .sort((a,b)=>new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0));
    const modal=document.createElement('div');
    modal.id='territorialHistoryModal';
    modal.className='territorial-history-backdrop';
    modal.innerHTML='<section class="territorial-history-dialog" role="dialog" aria-modal="true" aria-labelledby="territorialHistoryTitle"><header><div><h2 id="territorialHistoryTitle">Historial de ubicaciones</h2><p>Registros que actualmente tienen coordenadas geográficas.</p></div><button type="button" data-close-territorial-history aria-label="Cerrar">×</button></header><div class="territorial-history-list">'+
      (history.length?history.map(p=>'<article><span class="territorial-recent-pin '+recordStatus(p).key+'">⌖</span><div><b>'+esc(personName(p))+'</b><small>'+esc(identification(p))+' · '+esc(contract(p))+'</small><small>'+esc(p.address||'Dirección no registrada')+'</small></div><time>'+esc(p.updated_at?new Date(p.updated_at).toLocaleDateString('es-VE'):'')+'</time><button type="button" data-history-record="'+esc(p.id)+'">Ver</button></article>').join(''):'<p class="territorial-no-recent">Todavía no hay ubicaciones registradas.</p>')+
      '</div><footer><span>'+history.length+' ubicación(es) registradas</span><button type="button" class="btn btn-primary" data-close-territorial-history>Cerrar</button></footer></section>';
    document.body.appendChild(modal);
  }
  window.mapView=function() {
    return '<div class="territorial-page-head"><div class="territorial-page-title"><span class="territorial-page-icon">⌖</span><div><h1>Mapa territorial</h1><p>Georreferenciación y control de contribuyentes, inmuebles y condominios.</p></div></div><div class="territorial-head-actions"><button class="btn btn-primary" id="territorialLoadLocation">＋ Cargar ubicación</button><button class="btn btn-light" id="territorialExport">⇧ Exportar</button><button class="btn btn-light" id="territorialFilters">⚑ Filtros</button></div></div>'+
    '<div class="territorial-stats-grid"><article><span class="territorial-stat-icon green">⌖</span><div><b id="territorialStatLocated">—</b><small>Ubicaciones registradas</small></div></article><article><span class="territorial-stat-icon green">✓</span><div><b id="territorialStatPaid">—</b><small>Al día</small></div></article><article><span class="territorial-stat-icon red">!</span><div><b id="territorialStatDebt">—</b><small>Con deuda</small></div></article><article><span class="territorial-stat-icon amber">◷</span><div><b id="territorialStatValidation">—</b><small>Por validar</small></div></article></div>'+
    '<div class="territorial-filter-panel card" id="territorialFilterPanel" hidden><label>Estado de cuenta<select id="territorialStatusFilter"><option value="all">Todos los estados</option><option value="paid">Al día</option><option value="debt">Con deuda</option><option value="validation">Por validar</option></select></label><label>Tipo de registro<select id="territorialTypeFilter"><option value="all">Todos</option><option value="inmueble">Inmuebles</option><option value="condominio">Condominios</option></select></label></div>'+
    '<div class="territorial-main-grid"><aside class="territorial-control-column"><section class="card territorial-load-card"><h3>⌖ Cargar ubicación</h3><p>Busca un registro existente para asignar su ubicación en el mapa.</p><label for="territorialKind">Tipo de registro</label><select id="territorialKind"><option value="contribuyente">Contribuyente</option><option value="inmueble">Inmueble</option><option value="condominio">Condominio</option><option value="all">Todos los registros</option></select><div class="territorial-searchbox"><span>⌕</span><input id="territorialSearch" autocomplete="off" placeholder="Cédula, RIF o N.º de contrato"></div><button class="btn btn-primary territorial-search-button" id="territorialSearchButton">Buscar</button><div id="territorialSearchResults" class="territorial-search-results"></div><div id="territorialSelected" class="territorial-selected"><div class="territorial-select-empty">Selecciona un registro para asignarle ubicación.</div></div></section><section class="card territorial-recent-card"><h3>Últimas ubicaciones</h3><div id="territorialRecent"></div><button type="button" class="territorial-history-link" id="territorialHistory">Ver historial de ubicaciones →</button></section></aside>'+
    '<section class="card territorial-map-panel"><div class="territorial-map-tools"><button type="button" id="territorialGps" title="Centrar en mi ubicación">◎</button></div><div class="territorial-layer-switch"><button type="button" id="territorialLayerToggle" class="active">Mapa</button><button type="button" id="territorialSatelliteToggle">Satélite</button></div><div id="territorialMapCanvas" class="territorial-map-canvas"></div><div class="territorial-map-footer"><span><i class="paid"></i>Al día</span><span><i class="debt"></i>Con deuda</span><span><i class="validation"></i>Por validar</span><small>Cartografía OpenStreetMap · Satélite Esri</small></div></section></div>'+
    '<div class="territorial-location-hint" id="territorialHint" hidden>Modo de ubicación activo: pulsa el punto exacto del mapa para guardar las coordenadas.</div>';
  };
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-view="mapa"]'))setTimeout(initMap,100);
    if(event.target.closest('#territorialLoadLocation')){document.getElementById('territorialSearch')?.focus();notify('Busca el registro por cédula, RIF o contrato y selecciónalo.');}
    if(event.target.closest('#territorialSearchButton'))renderResults();
    const result=event.target.closest('[data-territorial-id]');
    if(result){
      selected=rows.find(p=>p.id===result.dataset.territorialId)||null;
      placing=false;renderSelected();
      if(selected?.latitude!=null)map?.setView([Number(selected.latitude),Number(selected.longitude)],17);
      return;
    }
    if(event.target.closest('#territorialClear')){selected=null;placing=false;renderSelected();return;}
    if(event.target.closest('#territorialStartPlace')){
      if(!selected)return;
      placing=true;
      const hint=document.getElementById('territorialHint');if(hint)hint.hidden=false;
      notify('Haz clic en el punto exacto del mapa para guardar la ubicación.');
      return;
    }
    if(event.target.closest('#territorialSelectedGps')){locateWithGps();return;}
    if(event.target.closest('#territorialGps')){
      if(selected){locateWithGps();return;}
      if(!navigator.geolocation){notify('GPS no disponible en este navegador.');return;}
      navigator.geolocation.getCurrentPosition(pos=>map?.setView([pos.coords.latitude,pos.coords.longitude],17),()=>notify('No se pudo obtener tu ubicación.'),{enableHighAccuracy:true,timeout:15000});
      return;
    }
    if(event.target.closest('#territorialSatelliteToggle')){satellite=true;setBaseLayer();return;}
    if(event.target.closest('#territorialLayerToggle')){satellite=false;setBaseLayer();return;}
    if(event.target.closest('#territorialExport')){exportLocations();return;}
    if(event.target.closest('#territorialFilters')){showFilters();return;}
    if(event.target.closest('#territorialHistory')){openLocationHistory();return;}
    if(event.target.closest('[data-close-territorial-history]')){document.getElementById('territorialHistoryModal')?.remove();return;}
    const historyRecord=event.target.closest('[data-history-record]');
    if(historyRecord){const p=rows.find(x=>x.id===historyRecord.dataset.historyRecord);document.getElementById('territorialHistoryModal')?.remove();if(p){selected=p;renderSelected();map?.setView([Number(p.latitude),Number(p.longitude)],17);}return;}
    if(event.target.closest('#territorialOpenRecord')){
      if(selected&&typeof window.sitmaudShowPropertyDetails==='function')window.sitmaudShowPropertyDetails(selected.id);
      else notify('No se pudo abrir el expediente del inmueble.');
    }
  });
  document.addEventListener('input',event=>{if(event.target.id==='territorialSearch')renderResults();});
  document.addEventListener('change',event=>{
    if(event.target.id==='territorialKind')renderResults();
    if(event.target.id==='territorialStatusFilter'){statusFilter=event.target.value;renderResults();}
    if(event.target.id==='territorialTypeFilter'){typeFilter=event.target.value;renderResults();}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&map&&document.getElementById('territorialMapCanvas'))setTimeout(()=>map.invalidateSize(),100);});
})();