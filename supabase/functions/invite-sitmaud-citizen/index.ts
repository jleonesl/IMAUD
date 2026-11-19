import {createClient} from "npm:@supabase/supabase-js@2";
const ORIGIN="https://jleonesl.github.io";
function respond(data:unknown,status=200,origin:string|null=null){
 return new Response(JSON.stringify(data),{status,headers:{
 "Content-Type":"application/json","Cache-Control":"no-store",
 "Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}});
}
Deno.serve(async request=>{
 const origin=request.headers.get("origin");
 if(request.method==="OPTIONS")return respond({},200,origin);
 if(request.method!=="POST"||(origin&&origin!==ORIGIN))return respond({error:"Operación no permitida"},403,origin);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!service)return respond({error:"Servicio institucional no configurado"},503,origin);
 const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return respond({error:"Sesión de funcionario requerida"},401,origin);
 const staff=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
 const {data:user,error:userError}=await staff.auth.getUser(token);
 if(userError||!user.user)return respond({error:"Sesión inválida"},401,origin);
 const {data:master,error:masterError}=await staff.rpc("is_sitmaud_master");
 const {data:canCreate,error:permissionError}=await staff.rpc("has_permission",{permission_code:"contributors.create"});
 if(masterError||permissionError||master!==true&&canCreate!==true)return respond({error:"Funcionario sin permiso para activar contribuyentes"},403,origin);
 let payload:Record<string,unknown>;
 try{payload=await request.json()}catch{return respond({error:"Solicitud inválida"},400,origin)}
 const id=String(payload.contributor_id||"");
 if(!/^[a-f0-9-]{36}$/i.test(id))return respond({error:"Expediente inválido"},400,origin);
 const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:c,error:cError}=await admin.from("contributors")
 .select("id,status,email,kind,service_account_type,identification_type,identification_number,first_name,last_name,legal_name,contract_number")
 .eq("id",id).single();
 if(cError||!c||c.status!=="active"||!c.email||!c.identification_number)return respond({error:"El expediente activo necesita cédula/RIF y correo registrado"},400,origin);
 const email=String(c.email).trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return respond({error:"Correo del expediente inválido"},400,origin);
 // Acción automática en nuevos registros; el funcionario solo reenvía el acceso.
 const action=payload.action==="resend"?"resend":"automatic";
 const {data:linked,error:linkedError}=await admin.from("citizen_accounts")
 .select("auth_user_id,is_active").eq("contributor_id",id).maybeSingle();
 if(linkedError)return respond({error:"No se pudo verificar la cuenta ciudadana"},503,origin);
 const redirectTo=ORIGIN+"/IMAUD/activar-contribuyente.html";
 if(linked){
   const {data:authRecord,error:authRecordError}=await admin.auth.admin.getUserById(linked.auth_user_id);
   if(authRecordError||!authRecord?.user
     ||String(authRecord.user.email||"").trim().toLowerCase()!==email) {
     return respond({error:"La cuenta y el correo no coinciden; requiere verificación institucional"},409,origin);
   }
   const {data:staffAccount,error:staffAccountError}=await admin.from("staff_profiles")
     .select("user_id").eq("user_id",linked.auth_user_id).limit(1);
   if(staffAccountError||staffAccount?.length)
     return respond({error:"No es posible usar un acceso de funcionario como contribuyente"},409,origin);
   if(action!=="resend")
     return respond({ok:true,status:"already_registered",email_requested:false,contract_number:c.contract_number},200,origin);
   const {data:permitted,error:limitError}=await admin.rpc("allow_citizen_access_email",{p_contributor_id:id});
   if(limitError)return respond({error:"No se pudo verificar el límite de reenvíos"},503,origin);
   if(!permitted)return respond({error:"Ya se solicitó un correo recientemente. Vuelve a intentarlo más tarde."},429,origin);
   const {error:recoveryError}=await admin.auth.resetPasswordForEmail(email,{redirectTo});
   if(recoveryError) {
     console.error("citizen resend failed:",recoveryError.message);
     return respond({error:"El servicio de correo rechazó el reenvío. Revisa la configuración de Auth y SMTP."},503,origin);
   }
   await admin.from("audit_log").insert({actor_user_id:user.user.id,action:"citizen_access_resent",
     entity_table:"citizen_accounts",entity_id:id,
     after_data:{auth_user_id:linked.auth_user_id,contract_number:c.contract_number,channel:"recovery_email"}});
   return respond({ok:true,status:"resend_accepted",email_requested:true,contract_number:c.contract_number},200,origin);
 }
 if(action==="resend")return respond({error:"Este contribuyente todavía no tiene acceso vinculado. Completa la activación institucional."},409,origin);
 const {data:permitted,error:limitError}=await admin.rpc("allow_citizen_access_email",{p_contributor_id:id});
 if(limitError)return respond({error:"No se pudo verificar la autorización de correo"},503,origin);
 if(!permitted)return respond({error:"Se intentó enviar este acceso recientemente. Evita registrar el expediente nuevamente."},429,origin);
 const {data:invitation,error:invitationError}=await admin.auth.admin.inviteUserByEmail(email,{
  data:{citizen_portal:true},redirectTo
 });
 if(invitationError||!invitation.user)return respond({error:"No se pudo emitir la invitación. Si el correo ya tiene una cuenta de acceso, verifica su titularidad y utiliza la activación institucional existente."},409,origin);
 const newId=invitation.user.id;
 const {data:staffAccount}=await admin.from("staff_profiles").select("user_id").eq("user_id",newId).maybeSingle();
 const {data:linkedElsewhere}=await admin.from("citizen_accounts").select("contributor_id").eq("auth_user_id",newId).maybeSingle();
 if(staffAccount||linkedElsewhere&&linkedElsewhere.contributor_id!==id)
  return respond({error:"Este correo pertenece a otra cuenta institucional. No se vinculó el expediente."},409,origin);
 const identityType=c.service_account_type==="condominio"?"C":c.identification_type;
 const {error:linkError}=await admin.from("citizen_accounts").upsert({
  auth_user_id:newId,contributor_id:id,identity_type:identityType,
  activated_by:user.user.id,is_active:true
 },{onConflict:"auth_user_id"});
 if(linkError)return respond({error:"Invitación enviada, pero no se vinculó el expediente. Se requiere revisión institucional."},503,origin);
 await admin.from("audit_log").insert({actor_user_id:user.user.id,action:"citizen_invited",
  entity_table:"citizen_accounts",entity_id:id,
  after_data:{auth_user_id:newId,contract_number:c.contract_number,channel:"email_activation"}});
 return respond({ok:true,invited:true,status:"invitation_accepted",email_requested:true,contract_number:c.contract_number},200,origin);
});