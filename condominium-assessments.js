/* SITMAUD: generación consolidada desde el directorio de condominios.
   La autorización definitiva se comprueba de nuevo en PostgreSQL. */
(function(){
  'use strict';
  let busy=false;
  function caracasToday(){
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }
  document.addEventListener('click',async function(event){
    const btn=event.target.closest('[data-condo-assess]');
    if(!btn)return;
    event.preventDefault();
    if(busy)return;
    const orgId=btn.getAttribute('data-condo-assess');
    if(!/^[a-f0-9-]{36}$/i.test(orgId)){toast('Identificador del condominio inválido.');return;}
    const date=caracasToday();
    if(date<'2027-01-01'){
      toast('La generación oficial de obligaciones inicia en enero de 2027.');
      return;
    }
    const permission=await imaudClient.rpc('has_permission',{permission_code:'assessments.create'});
    if(permission.error||permission.data!==true){
      toast('Tu cuenta no tiene permiso para generar obligaciones.');
      return;
    }
    if(!window.confirm('Se generarán exclusivamente los meses vencidos o vigentes desde enero de 2027, en la cuenta matriz del condominio. ¿Continuar?'))return;
    busy=true;btn.disabled=true;btn.textContent='Calculando…';
    try{
      const {data,error}=await imaudClient.rpc('generate_official_condominium_assessments',{
        p_organization_id:orgId,p_through_date:date
      });
      if(error)throw error;
      const created=(data||[]).filter(r=>r.result==='created');
      toast(created.length?'Obligaciones consolidadas generadas: '+created.length:'Sin nuevos meses por generar.');
      if(typeof loadOrganizations==='function')await loadOrganizations();
    }catch(error){
      console.error('SITMAUD: generación consolidada:',error);
      toast('No se pudo generar la obligación: '+(error.message||'Error'));
    }finally{
      busy=false;if(btn.isConnected){btn.disabled=false;btn.textContent='Generar obligaciones';}
    }
  });
})();