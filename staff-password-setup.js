/* SITMAUD | Alta de contraseña personal tras invitación o recuperación */
(()=>{
  'use strict';
  const login=document.getElementById('staffLogin');
  const setup=document.getElementById('staffSetPassword');
  const heading=document.getElementById('staffHeading');
  const description=document.getElementById('staffDescription');
  const forgot=document.getElementById('staffForgot');
  const message=document.getElementById('staffMessage');
  const submit=document.getElementById('staffPasswordSubmit');
  const hashParams=new URLSearchParams(location.hash.replace(/^#/,''));
  const query=new URLSearchParams(location.search);
  let mode=query.get('setup')||hashParams.get('type')||'';
  const hasAuthLink=mode==='invite'||mode==='recovery'||mode==='signup'||mode==='change';
  let configured=false;
  const error=hashParams.get('error_description')||query.get('error_description');
  function showLogin(){
    login.hidden=false;setup.hidden=true;forgot.hidden=false;
    heading.textContent='Iniciar sesión';
    description.textContent='Ingresa con tu correo y la contraseña que creaste.';
  }
  function showSetup(){
    login.hidden=true;setup.hidden=false;forgot.hidden=true;
    heading.textContent=mode==='recovery'?'Restablecer contraseña':mode==='change'?'Cambiar mi contraseña':'Crear contraseña de acceso';
    description.textContent=mode==='recovery'
      ?'Confirma una nueva contraseña para recuperar tu acceso a SITMAUD.'
      :mode==='change'?'Establece una contraseña nueva para tu cuenta. Este cambio es voluntario.'
      :'Invitación aceptada. Para ingresar, crea una contraseña personal y segura.';
  }
  async function verifyAndShow(){
    if(configured||!hasAuthLink)return;
    const {data,error:authError}=await client.auth.getSession();
    if(authError||!data.session){
      message.textContent=mode==='change'?'Primero inicia sesión para cambiar tu contraseña.':'El enlace no tiene una sesión válida o expiró. Solicita una nueva invitación al intendente.';
      showLogin();
      return;
    }
    const {data:profile,error:profileError}=await client.from('staff_profiles')
      .select('is_active').eq('user_id',data.session.user.id).maybeSingle();
    if(profileError||!profile||!profile.is_active){
      message.textContent='Esta invitación no corresponde a un funcionario habilitado. Contacta al superusuario.';
      await client.auth.signOut();
      showLogin();return;
    }
    configured=true;
    showSetup();
    message.textContent='';
    // Remove authentication tokens from the visible URL only after Supabase has handled them.
    if(location.hash)history.replaceState(null,'',location.pathname+location.search);
  }
  if(error){
    showLogin();
    message.textContent='El enlace de invitación no se pudo validar. Solicita uno nuevo.';
  }else if(hasAuthLink){
    login.hidden=true;forgot.hidden=true;
    heading.textContent='Verificando invitación…';
    description.textContent='Comprobando el enlace de acceso de forma segura.';
    client.auth.onAuthStateChange((event)=>{
      if(event==='SIGNED_IN'||event==='PASSWORD_RECOVERY'||event==='INITIAL_SESSION')
        setTimeout(()=>{verifyAndShow().catch(()=>{message.textContent='No se pudo validar la invitación.';showLogin();});},0);
    });
    setTimeout(()=>{verifyAndShow().catch(()=>{message.textContent='No se pudo validar la invitación.';showLogin();});},350);
  }
  setup.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!configured)return;
    const password=document.getElementById('staffNewPassword').value;
    const confirmation=document.getElementById('staffConfirmPassword').value;
    if(password.length<8||password.length>128){
      message.textContent='La contraseña debe tener entre 8 y 128 caracteres.';return;
    }
    if(password!==confirmation){
      message.textContent='Las contraseñas no coinciden.';return;
    }
    submit.disabled=true;submit.textContent='Guardando contraseña…';message.textContent='';
    try{
      const {data,error:authError}=await client.auth.updateUser({password});
      if(authError||!data.user)throw new Error(authError?.message||'No se pudo guardar la contraseña.');
      await client.auth.signOut();
      configured=false;
      history.replaceState(null,'',location.pathname);
      showLogin();
      document.getElementById('staffEmail').value=data.user.email||'';
      setup.reset();
      message.textContent='Contraseña guardada. Ahora inicia sesión con tu correo y tu nueva contraseña.';
      message.style.color='#147a58';
    }catch(err){
      message.style.color='#ad4444';
      message.textContent='No se pudo guardar la contraseña: '+(err.message||'error de conexión');
    }finally{submit.disabled=false;submit.textContent='Guardar contraseña y activar acceso';}
  });
})();