// IMAUD authentication gate — public publishable key only; never put service_role keys here.
const IMAUD_SUPABASE_URL = "https://vlgvojndrmvwhfjlpbid.supabase.co";
const IMAUD_SUPABASE_KEY = "sb_publishable_1_ze-KwpjoSM1j4d9pi_hw_bH6gd6Tm";
const imaudClient = window.supabase.createClient(IMAUD_SUPABASE_URL, IMAUD_SUPABASE_KEY);

(async function(){
 const root=document.getElementById('authGate');
 const app=document.querySelector('.app-shell');
 const msg=document.getElementById('authMessage');
 const form=document.getElementById('loginForm');
 const btn=document.getElementById('loginButton');
 root.hidden=true; root.style.display='none'; app.style.display='none'; const landing=document.getElementById('publicHome'); if(landing){landing.hidden=false; landing.style.display='';}
 const {data:{session}}=await imaudClient.auth.getSession();
 async function enter(user){
   const {data:profile,error}=await imaudClient.from('staff_profiles').select('display_name,role,is_active').eq('user_id',user.id).maybeSingle();
   if(error||!profile||!profile.is_active){
     await imaudClient.auth.signOut();
     msg.textContent='Tu cuenta aún no tiene un perfil administrativo habilitado. Solicita la activación al intendente principal.';
     return;
   }
   root.hidden=true; root.style.display='none'; if(landing){landing.hidden=true; landing.style.display='none';} app.style.display='block';
   const name=document.querySelector('.user-chip b'); const role=document.querySelector('.user-chip small');
   if(name) name.textContent=profile.display_name;
   if(role) role.textContent=profile.role.replaceAll('_',' ');
   document.querySelector('.demo-pill')?.remove();
   const banner=document.querySelector('.demo-banner');
   if(banner){banner.innerHTML='<b>ENTORNO DE PRUEBAS</b><span>La autenticación está activa. Las operaciones financieras aún no están habilitadas.</span>'}
   window.imaudCurrentProfile=profile;
 }
 if(session) await enter(session.user);
 form.addEventListener('submit',async e=>{
   e.preventDefault(); btn.disabled=true; btn.textContent='Verificando…'; msg.textContent='';
   const email=form.email.value.trim(),password=form.password.value;
   const {data,error}=await imaudClient.auth.signInWithPassword({email,password});
   if(error){msg.textContent='No se pudo iniciar sesión. Verifica el correo y la contraseña o solicita una invitación.';}
   else await enter(data.user);
   btn.disabled=false;btn.textContent='Iniciar sesión';
 });
 document.getElementById('forgotLink').addEventListener('click',async e=>{
   e.preventDefault(); const email=form.email.value.trim();
   if(!email){msg.textContent='Escribe primero tu correo institucional para enviar el enlace de recuperación.';return;}
   const {error}=await imaudClient.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
   msg.textContent=error?'No se pudo enviar el enlace.':'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.';
 });
})();
