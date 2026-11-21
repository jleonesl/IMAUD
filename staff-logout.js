/* SITMAUD: cierre de sesión institucional accesible desde todos los dispositivos. */
(function(){
 'use strict';
 let closing=false;
 async function logout(){
   if(closing)return;
   closing=true;
   const buttons=[...document.querySelectorAll('[data-staff-signout]')];
   buttons.forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true');});
   // No permitir que el usuario siga operando mientras se cierra su sesión.
   const app=document.querySelector('.app-shell');
   if(app)app.style.visibility='hidden';
   let signoutError=null;
   try{
     // La bitácora no debe impedir que el funcionario cierre su sesión.
     try{await imaudClient.rpc('record_staff_activity',{
       p_action:'session_finished',p_module:'authentication',p_reference:null
     });}catch(err){console.warn('Bitácora de salida no disponible',err);}
     const {error}=await imaudClient.auth.signOut({scope:'local'});
     if(error)signoutError=error;
   }catch(err){signoutError=err;}
   if(signoutError){
     if(app)app.style.visibility='';
     buttons.forEach(b=>{b.disabled=false;b.removeAttribute('aria-busy');});
     closing=false;
     const message=document.getElementById('toast');
     if(message){message.textContent='No se pudo cerrar sesión. Comprueba tu conexión e inténtalo nuevamente.';message.classList.add('show');}
     console.error('SITMAUD: no se completó el cierre de sesión',signoutError);
     return;
   }
   window.sitmaudAccess=null;
   window.imaudCurrentProfile=null;
   // replace evita volver a la página privada mediante el botón Atrás.
   location.replace('./funcionario.html?sesion=cerrada');
 }
 window.addEventListener('pageshow',async event=>{
   if(!event.persisted||closing||!document.body.classList.contains('sitmaud-authenticated'))return;
   try{
     const {data,error}=await imaudClient.auth.getUser();
     if(error||!data.user)location.replace('./funcionario.html?sesion=cerrada');
   }catch(_){location.replace('./funcionario.html?sesion=cerrada');}
 });
 document.addEventListener('click',event=>{
   if(event.target.closest('[data-staff-signout]'))logout();
 });
 // Una pestaña abierta no debe mostrar datos privados tras cerrar sesión en otra.
 imaudClient.auth.onAuthStateChange((event)=>{
   if(event==='SIGNED_OUT'){
     const app=document.querySelector('.app-shell');
     if(app)app.style.visibility='hidden';
     if(!closing&&document.body.classList.contains('sitmaud-authenticated'))
       location.replace('./funcionario.html?sesion=cerrada');
   }
 });
})();
