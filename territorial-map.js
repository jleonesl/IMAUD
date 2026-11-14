/* SITMAUD · Módulo territorial independiente. No modifica formularios de contribuyentes, inmuebles ni condominios. */
(function(){
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => new Intl.NumberFormat('es-VE',{maximumFractionDigits:6}).format(Number(n));
  let map = null, markers = [], records = [], selected = null, manualMode = false, initialized = false;
  const toast = message => { if(typeof window.toast==='function') window.toast(message); else alert(message); };
  function loadLeaflet(){
    if(window.L) return Promise.resolve();
    if(window.__sitmaudLeafletPromise) return window.__sitmaudLeafletPromise;
    window.__sitmaudLeafletPromise = new Promise((resolve,reject)=>{
      if(!document.querySelector('link[data-sitmaud-leaflet]')){
        const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.dataset.sitmaudLeaflet='1';document.head.appendChild(css);
      }
      const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.onload=resolve;script.onerror=()=>reject(new Error('No se pudo cargar el visor cartográfico.'));document.head.appendChild(script);
    });
    return window.__sitmaudLeafletPromise;
  }
  function statusOf(p, demoPayments){
    const assessments=p.assessments||[];
    if(assessments.some(a=>['pending','partially_paid'].includes(a.status))) return {key:'debt',label:'Con deuda',color:'#d84b4b'};
    const demo=(demoPayments||[]).filter(x=>x.contributor_id===p.contributor_id);
    if(demo.some(x=>(x.treasury_status||'pending')==='pending')) return {key:'validation',label:'Pago por validar',color:'#e4ad32'};
    if(assessments.length && assessments.every(a=>a.status==='paid')) return {key:'paid',label:'Al día',color:'#239b69'};
    return {key:'validation',label:'Sin liquidación / por verificar',color:'#e4ad32'};
  }
  function iconFor(p){
    const status=p.mapStatus||{color:'#e4ad32'};
    return L.divIcon({className:'sitmaud-map-pin-wrap',html:'<span class="sitmaud-map-pin" style="--pin-color:'+status.color+'"></span>',iconSize:[22,22],iconAnchor:[11,11]});
  }
  function renderList(rows){
    const host=document.getElementById('territorialResults');if(!host)return;
    if(!rows.length){host.innerHTML='<div class="territorial-empty">No hay coincidencias. Prueba con cédula, RIF, contrato, nombre o dirección.</div>';return;}
    host.innerHTML=rows.map(p=>'<button type="button" class="territorial-result '+(selected?.id===p.id?'selected':'')+'" data-territorial-select="'+escape(p.id)+'"><span class="territorial-result-dot '+p.mapStatus.key+'"></span><span class="territorial-result-copy"><b>'+escape(p.contributor?.legal_name||[p.contributor?.first_name,p.contributor?.last_name].filter(Boolean).join(' ')||p.organization_name||p.address||'Inmueble')+'</b><small>'+escape(p.address)+' · '+escape([p.parish_name,p.sector_name].filter(Boolean).join(' / '))+'</small><small>'+escape(p.contract_number||'Sin contrato')+' · '+escape(p.mapStatus.label)+'</small></span><span class="territorial-result-action">'+(p.latitude!=null&&p.longitude!=null?'Ver':'Ubicar')+' →</span></button>').join('');
  }
  function refreshMarkers(){
    if(!map)return;
    markers.forEach(m=>m.remove());markers=[];
    records.filter(p=>p.latitude!=null&&p.longitude!=null).forEach(p=>{
      const marker=L.marker([Number(p.latitude),Number(p.longitude)],{icon:iconFor(p)}).addTo(map);
      marker.bindPopup('<b>'+escape(p.contributor?.legal_name||[p.contributor?.first_name,p.contributor?.last_name].filter(Boolean).join(' ')||p.address)+'</b><br>'+escape(p.address)+'<br>'+escape(p.mapStatus.label));
      marker.on('click',()=>{selected=p;renderList(filteredRecords());showSelected();});
      markers.push(marker);
    });
  }
  function filteredRecords(){
    const q=(document.getElementById('territorialSearch')?.value||'').trim().toLocaleLowerCase('es-VE');
    const kind=document.getElementById('territorialKind')?.value||'all';
    return records.filter(p=>{
      const c=p.contributor||{};
      const text=[c.legal_name,c.first_name,c.last_name,c.identification_type,c.identification_number,c.contract_number,p.contract_number,p.address,p.organization_name,p.parish_name,p.sector_name].join(' ').toLocaleLowerCase('es-VE');
      const condo=Boolean(p.is_consolidated_master||p.organization_id||c.service_account_type==='condominio'||p.organization_name);
      return (!q||text.includes(q))&&(kind==='all'||(kind==='condominio'?condo:kind==='inmueble'?!p.is_consolidated_master:true));
    });
  }
  function showSelected(){
    const host=document.getElementById('territorialSelected');if(!host)return;
    if(!selected){host.innerHTML='<p>Selecciona un registro de la lista para cargar o consultar su ubicación.</p>';return;}
    host.innerHTML='<div class="territorial-selected-head"><div><b>'+escape(selected.contributor?.legal_name||[selected.contributor?.first_name,selected.contributor?.last_name].filter(Boolean).join(' ')||selected.organization_name||'Registro seleccionado')+'</b><small>'+escape(selected.address)+'</small></div><span class="territorial-status '+selected.mapStatus.key+'">'+escape(selected.mapStatus.label)+'</span></div><div class="territorial-coordinates">'+(selected.latitude!=null&&selected.longitude!=null?'Lat. '+fmt(selected.latitude)+' · Long. '+fmt(selected.longitude):'Este registro todavía no tiene coordenadas guardadas.')+'</div><div class="territorial-actions"><button type="button" class="btn btn-primary" id="territorialGps">◎ Usar mi GPS</button><button type="button" class="btn btn-light" id="territorialManual">'+(manualMode?'Cancelar selección en mapa':'⌖ Marcar en el mapa')+'</button></div><small class="territorial-help">'+(manualMode?'Haz clic sobre el mapa para guardar la ubicación de este registro.':'Puedes usar el GPS del dispositivo o seleccionar un punto manualmente.')+'</small>';
  }
  async function saveCoordinates(lat,lng){
    if(!selected)return;
    const {error}=await window.imaudClient.from('properties').update({latitude:Number(lat),longitude:Number(lng)}).eq('id',selected.id);
    if(error){console.error('SITMAUD map location:',error);toast('No se pudo guardar la ubicación: '+error.message);return;}
    selected.latitude=Number(lat);selected.longitude=Number(lng);manualMode=false;
    refreshMarkers();renderList(filteredRecords());showSelected();
    map.setView([Number(lat),Number(lng)],17);
    toast('Ubicación guardada correctamente.');
  }
  async function loadRecords(){
    const host=document.getElementById('territorialResults');if(host)host.innerHTML='<div class="territorial-empty">Consultando inmuebles y cuentas territoriales…</div>';
    const query=window.imaudClient.from('properties').select('id,contributor_id,organization_id,address,latitude,longitude,is_active,is_consolidated_master,consolidated_units,parish_name,sector_name,organization_name,contract_number,contributor:contributors!properties_contributor_id_fkey(id,kind,service_account_type,identification_type,identification_number,legal_name,first_name,last_name,contract_number),assessments(id,status)').eq('is_active',true).order('address');
    const [propertyResult,paymentResult]=await Promise.all([query,window.imaudClient.from('demo_payments').select('contributor_id,treasury_status')]);
    if(propertyResult.error){console.error('SITMAUD territorial records:',propertyResult.error);if(host)host.innerHTML='<div class="territorial-empty error">No se pudieron consultar los registros. Verifica los permisos de lectura de inmuebles y contribuyentes.</div>';return;}
    const payments=paymentResult.error?[]:(paymentResult.data||[]);
    records=(propertyResult.data||[]).map(p=>({...p,mapStatus:statusOf(p,payments)}));
    const count=document.getElementById('territorialCount');if(count)count.textContent=records.length+' registros';
    const located=records.filter(p=>p.latitude!=null&&p.longitude!=null).length;
    const locatedCount=document.getElementById('territorialLocatedCount');if(locatedCount)locatedCount.textContent=located+' ubicados';
    renderList(filteredRecords());refreshMarkers();showSelected();
    const bounds=records.filter(p=>p.latitude!=null&&p.longitude!=null).map(p=>[Number(p.latitude),Number(p.longitude)]);
    if(bounds.length)map.fitBounds(bounds,{padding:[28,28],maxZoom:15});
  }
  function init(){
    const container=document.getElementById('territorialMap');if(!container)return;
    loadLeaflet().then(()=>{
      if(!document.getElementById('territorialMap'))return;
      if(map){map.remove();map=null;}
      map=L.map(container,{scrollWheelZoom:true}).setView([11.4045,-69.6734],12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
      map.on('click',event=>{if(manualMode&&selected)saveCoordinates(event.latlng.lat,event.latlng.lng);});
      loadRecords().then(()=>setTimeout(()=>map.invalidateSize(),120));
    }).catch(error=>{container.innerHTML='<div class="territorial-empty error">'+escape(error.message)+'</div>';});
  }
  window.mapView=function(){
    return '<div class="page-head"><div><div class="eyebrow">SITMAUD · CONTROL Y ANÁLISIS</div><h1>Mapa territorial</h1><p>Ubica contribuyentes, inmuebles y condominios desde un único visor geográfico.</p></div><button class="btn btn-light" id="territorialRefresh">↻ Actualizar</button></div>'+
    '<section class="territorial-toolbar card"><div class="territorial-search-wrap"><label for="territorialSearch">Buscar registro</label><input id="territorialSearch" type="search" placeholder="Nombre, cédula, RIF, contrato o dirección…"></div><div><label for="territorialKind">Tipo de registro</label><select id="territorialKind"><option value="all">Todos los registros</option><option value="inmueble">Inmuebles</option><option value="condominio">Condominios / organizaciones</option></select></div><div class="territorial-counts"><b id="territorialCount">— registros</b><small id="territorialLocatedCount">— ubicados</small></div></section>'+
    '<div class="territorial-layout"><section class="card territorial-map-card"><div class="territorial-map-heading"><b>Visor geográfico · Coro y municipio Miranda</b><span>OpenStreetMap</span></div><div id="territorialMap" class="territorial-map-canvas"></div><div class="territorial-legend"><span><i class="paid"></i>Al día</span><span><i class="debt"></i>Con deuda</span><span><i class="validation"></i>Pago por validar / sin liquidación</span></div></section><aside class="territorial-side"><section class="card territorial-results-card"><div class="territorial-side-heading"><b>Registros encontrados</b><small>Selecciona uno para asignarle ubicación</small></div><div id="territorialResults" class="territorial-results"></div></section><section class="card territorial-selected-card"><div class="territorial-side-heading"><b>Ubicación del registro</b><small>La geolocalización se guarda en el inmueble asociado</small></div><div id="territorialSelected" class="territorial-selected"><p>Selecciona un registro de la lista.</p></div></section></aside></div>';
  };
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-view="mapa"]'))setTimeout(init,80);
    if(event.target.closest('#territorialRefresh'))loadRecords();
    const result=event.target.closest('[data-territorial-select]');
    if(result){selected=records.find(p=>p.id===result.dataset.territorialSelect)||null;manualMode=false;renderList(filteredRecords());showSelected();if(selected?.latitude!=null&&selected?.longitude!=null)map?.setView([Number(selected.latitude),Number(selected.longitude)],17);return;}
    if(event.target.closest('#territorialGps')){
      if(!selected)return;
      if(!navigator.geolocation){toast('Este navegador no permite obtener la ubicación GPS.');return;}
      const button=document.getElementById('territorialGps');button.disabled=true;button.textContent='Obteniendo ubicación…';
      navigator.geolocation.getCurrentPosition(pos=>saveCoordinates(pos.coords.latitude,pos.coords.longitude).finally(()=>{if(button.isConnected){button.disabled=false;button.textContent='◎ Usar mi GPS';}}),error=>{toast(error.code===1?'Debes permitir el acceso a la ubicación.':'No se pudo obtener la ubicación GPS.');if(button.isConnected){button.disabled=false;button.textContent='◎ Usar mi GPS';}},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
    }
    if(event.target.closest('#territorialManual')){manualMode=!manualMode;showSelected();if(manualMode)toast('Haz clic en el mapa para guardar el punto.');}
  });
  document.addEventListener('input',event=>{if(event.target.id==='territorialSearch')renderList(filteredRecords());});
  document.addEventListener('change',event=>{if(event.target.id==='territorialKind')renderList(filteredRecords());});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&map&&document.getElementById('territorialMap'))setTimeout(()=>map.invalidateSize(),100);});
})();
