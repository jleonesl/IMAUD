/* SITMAUD · expediente documental privado y administrador de condominio */
(function(){
'use strict';
const bucket='imaud-contributor-files';
const esc=value=>escapeHTML(value==null?'':String(value));
const documentTypes={
 cedula:'Cédula de identidad',
 rif:'RIF',
 catastro:'Planilla / Carta catastral',
 constitutiva:'Documento constitutivo del condominio',
 acta_asamblea:'Acta de asamblea',
 designacion_administrador:'Designación / Nombramiento del administrador',
 registro_condominio:'Registro y documentación administrativa',
 poder:'Poder o autorización',
 otro:'Otro documento'
};
const canUpdate=()=>true; // El servidor aplica los permisos del funcionario a cada operación.
function profileSections(person){
 const condo=person.service_account_type==='condominio';
 const id=esc(person.id);
 return '<section class="contributor-doc-section" id="contributorDocumentSection" data-doc-person="'+id+'">'+
 (condo?'<div class="contributor-extra-head"><div><h3>Responsable / Administrador del condominio</h3><p>Contacto administrativo que representa al conjunto residencial ante SITMAUD. No modifica la razón social ni el RIF del contribuyente.</p></div></div>'+
 '<form id="condoResponsibleForm" data-person-id="'+id+'" class="contributor-responsible-form"><div class="form-grid">'+
 '<div class="field"><label>Nombre del administrador / Responsable</label><input name="responsible_name" autocomplete="name" placeholder="Nombre y apellido"></div>'+
 '<div class="field"><label>Cédula del responsable</label><input name="responsible_identification" placeholder="V-00000000"></div>'+
 '<div class="field"><label>Teléfono del responsable</label><input name="responsible_phone" placeholder="04XX-XXXXXXX"></div>'+
 '<div class="field"><label>Correo del responsable</label><input name="responsible_email" type="email" placeholder="administracion@ejemplo.com"></div>'+
 '</div><div class="form-actions"><button type="submit" class="btn btn-primary">Guardar responsable</button></div></form>':'')+
 '<div class="contributor-extra-head"><div><h3>Documentos del expediente</h3><p>Adjuntos opcionales: puedes registrar al contribuyente sin documentos y cargarlos en cualquier momento.</p></div><span class="contributor-doc-count" id="contributorDocCount">Consultando…</span></div>'+
 '<div id="contributorDocList" class="contributor-doc-list"><div class="contributors-loading">Consultando los documentos guardados…</div></div>'+
 '<form class="contributor-doc-upload" id="contributorDocumentUpload" data-person-id="'+id+'"><div class="form-grid">'+
 '<div class="field"><label>Tipo de documento</label><select name="document_type" required>'+
 Object.keys(documentTypes).map(k=>'<option value="'+k+'">'+esc(documentTypes[k])+'</option>').join('')+'</select></div>'+
 '<div class="field"><label>Archivo (PDF, JPG, PNG o WEBP)</label><input name="document_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required></div>'+
 '<div class="field full"><label>Descripción (opcional)</label><input name="description" maxlength="300" placeholder="Ej. RIF actualizado, acta de junta directiva 2026…"></div></div>'+
 '<div class="contributor-doc-bottom"><small>Máximo 10 MB por archivo · Acceso privado según permisos de funcionarios · La carga no es obligatoria.</small><button class="btn btn-primary" type="submit">Adjuntar documento</button></div></form></section>';
}
const originalOpenContributorAction=openContributorAction;
openContributorAction=function(id,mode){
 originalOpenContributorAction(id,mode);
 const root=document.getElementById('contributorActionModal'),person=state.people?.find(x=>x.id===id);
 if(!root||!person)return;
 const base=root.querySelector('#contributorActionForm');
 if(!base)return;
 base.insertAdjacentHTML('afterend',profileSections(person));
 loadDocProfile(person);
};
async function loadDocProfile(person){
 const root=document.getElementById('contributorDocumentSection');
 if(!root||root.dataset.docPerson!==person.id)return;
 if(person.service_account_type==='condominio'){
  const {data,error}=await imaudClient.from('contributors').select('id,responsible_name,responsible_identification,responsible_phone,responsible_email').eq('id',person.id).single();
  const {data:orgs}=await imaudClient.from('residential_organizations').select('representative_name,representative_id').eq('contributor_id',person.id).limit(1);
  const form=document.getElementById('condoResponsibleForm');
  if(form&&!error){
   const org=orgs?.[0]||{};
   for(const field of ['responsible_name','responsible_identification','responsible_phone','responsible_email']){
    if(form.elements[field])form.elements[field].value=data[field]|| (field==='responsible_name'?org.representative_name:field==='responsible_identification'?org.representative_id:'')||'';
   }
  }
 }
 await listDocs(person.id);
}
async function listDocs(id){
 const target=document.getElementById('contributorDocList'),count=document.getElementById('contributorDocCount');
 if(!target)return;
 const {data,error}=await imaudClient.from('contributor_documents').select('id,document_type,description,original_name,mime_type,size_bytes,created_at,storage_path').eq('contributor_id',id).order('created_at',{ascending:false});
 if(!document.getElementById('contributorDocumentSection')||document.getElementById('contributorDocumentSection').dataset.docPerson!==id)return;
 if(error){target.innerHTML='<div class="contributor-doc-empty">No se pudo consultar el expediente documental. '+esc(error.message)+'</div>';return;}
 const rows=data||[];if(count)count.textContent=rows.length+' archivo(s)';
 if(!rows.length){target.innerHTML='<div class="contributor-doc-empty">Sin documentos adjuntos. Puedes incorporar la cédula, el RIF, catastro u otros documentos cuando estén disponibles.</div>';return;}
 target.innerHTML=rows.map(d=>{
  const date=new Date(d.created_at).toLocaleDateString('es-VE',{timeZone:'America/Caracas',day:'2-digit',month:'2-digit',year:'numeric'});
  const kb=d.size_bytes>=1048576?(d.size_bytes/1048576).toFixed(1)+' MB':Math.round(d.size_bytes/1024)+' KB';
  return '<div class="contributor-doc-item"><div class="contributor-doc-icon">▤</div><div class="contributor-doc-meta"><b>'+esc(documentTypes[d.document_type]||d.document_type)+'</b><span>'+esc(d.original_name)+' · '+kb+' · '+date+'</span>'+(d.description?'<small>'+esc(d.description)+'</small>':'')+'</div><button type="button" class="btn btn-light btn-sm" data-open-contributor-doc="'+esc(d.id)+'">Ver archivo</button></div>';
 }).join('');
 window.imaudProfileDocs=rows;
}
document.addEventListener('submit',async event=>{
 const form=event.target;
 if(form.id==='condoResponsibleForm'){
  event.preventDefault();
  const button=form.querySelector('button[type="submit"]'),id=form.dataset.personId;
  const fd=new FormData(form);const payload={};
  for(const field of ['responsible_name','responsible_identification','responsible_phone','responsible_email'])payload[field]=String(fd.get(field)||'').trim()||null;
  if(payload.responsible_email&&!form.elements.responsible_email.checkValidity()){toast('Correo del responsable inválido.');return;}
  button.disabled=true;button.textContent='Guardando…';
  const {error}=await imaudClient.from('contributors').update(payload).eq('id',id);
  button.disabled=false;button.textContent='Guardar responsable';
  if(error){console.error('SITMAUD admin:',error);toast('No se pudo guardar el responsable: '+error.message);return;}
  toast('Responsable del condominio actualizado.');
 }
 if(form.id==='contributorDocumentUpload'){
  event.preventDefault();
  const id=form.dataset.personId,fd=new FormData(form),file=fd.get('document_file'),type=String(fd.get('document_type')||'');
  const validMime=['application/pdf','image/jpeg','image/png','image/webp'];
  if(!(file instanceof File)||!file.size){toast('Selecciona un documento.');return;}
  if(file.size>10485760){toast('El archivo no puede superar 10 MB.');return;}
  if(!validMime.includes(file.type)){toast('Solo se admiten archivos PDF, JPG, PNG y WEBP.');return;}
  if(!documentTypes[type]){toast('Selecciona un tipo de documento válido.');return;}
  const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Cargando…';
  const suffix=({ 'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type];
  const path=id+'/'+crypto.randomUUID()+'.'+suffix;
  try{
   const {error:uploadError}=await imaudClient.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
   if(uploadError)throw uploadError;
   const {data:userData}=await imaudClient.auth.getUser();
   const {error:insertError}=await imaudClient.from('contributor_documents').insert({
    contributor_id:id,document_type:type,description:String(fd.get('description')||'').trim()||null,
    original_name:file.name.slice(0,255),mime_type:file.type,size_bytes:file.size,storage_path:path,uploaded_by:userData?.user?.id
   });
   if(insertError){await imaudClient.storage.from(bucket).remove([path]);throw insertError;}
   form.reset();toast('Documento adjuntado de forma privada.');
   await listDocs(id);
  }catch(e){console.error('SITMAUD document upload:',e);toast('No se pudo adjuntar el documento: '+(e.message||'Error'))}
  finally{button.disabled=false;button.textContent='Adjuntar documento';}
 }
});
document.addEventListener('click',async event=>{
 const btn=event.target.closest('[data-open-contributor-doc]');
 if(!btn)return;
 const d=(window.imaudProfileDocs||[]).find(x=>x.id===btn.dataset.openContributorDoc);
 if(!d)return;
 btn.disabled=true;
 const {data,error}=await imaudClient.storage.from(bucket).createSignedUrl(d.storage_path,60);
 btn.disabled=false;
 if(error||!data?.signedUrl){toast('No se pudo abrir el documento. Verifica tus permisos.');return;}
 window.open(data.signedUrl,'_blank','noopener,noreferrer');
});
})();
