import {createClient} from "npm:@supabase/supabase-js@2";
const ORIGIN="https://jleonesl.github.io";
const headers={"Content-Type":"application/json","Cache-Control":"no-store",
 "Access-Control-Allow-Origin":ORIGIN,
 "Access-Control-Allow-Headers":"content-type,apikey,authorization,x-client-info",
 "Access-Control-Allow-Methods":"POST, OPTIONS"};
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const denial=()=>respond({error:"Cédula/RIF o contraseña incorrectos, o acceso ciudadano no activado."},401);
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return respond({});
 if(req.method!=="POST"||(req.headers.get("origin")&&req.headers.get("origin")!==ORIGIN))return respond({error:"Operación no permitida"},403);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!service)return respond({error:"Acceso ciudadano no configurado"},503);
 let input:Record<string,unknown>;try{input=await req.json()}catch{return denial()}
 const type=String(input.type||""),identity=String(input.identification||"").replace(/[^a-z0-9]/gi,"").toUpperCase();
 const password=String(input.password||"");
 if(!["V","E","J","C"].includes(type)||identity.length<5||identity.length>20||!password||password.length>1024)return denial();
 const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
 const ip=(req.headers.get("x-forwarded-for")||"").split(",")[0].trim().slice(0,90);
 const bytes=new TextEncoder().encode(type+"|"+identity+"|"+ip);
 const digest=await crypto.subtle.digest("SHA-256",bytes);
 const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
 const {data:permitted,error:limitError}=await admin.rpc("check_citizen_login_limit",{p_hash:hash});
 if(limitError)return respond({error:"Servicio temporalmente no disponible"},503);
 if(permitted!==true)return respond({error:"Demasiados intentos. Intenta nuevamente más tarde."},429);
 const idType=type==="C"?"J":type;
 // Solo se consulta un expediente activo y vinculado; ninguna respuesta revela datos de identidad.
 const digits=identity.replace(/^[VEJ]/,"");
 const {data:matches,error:findError}=await admin.from("contributors")
  .select("id,email,identification_type,identification_number,service_account_type,status")
  .eq("status","active").eq("identification_type",idType)
  .limit(10);
 if(findError)return respond({error:"No se pudo consultar el acceso"},503);
 const normalized=(v:unknown)=>String(v||"").replace(/[^A-Za-z0-9]/g,"").toUpperCase().replace(/^[VEJ]/,"");
 const candidates=(matches||[]).filter(c=>
  normalized(c.identification_number)===digits &&
  (type==="C"?c.service_account_type==="condominio":c.service_account_type!=="condominio"));
 if(candidates.length!==1)return denial();
 const c=candidates[0];
 const {data:link,error:linkError}=await admin.from("citizen_accounts")
 .select("auth_user_id,identity_type,is_active").eq("contributor_id",c.id).maybeSingle();
 if(linkError||!link||!link.is_active||link.identity_type!==type)return denial();
 const {data:authUser,error:authError}=await admin.auth.admin.getUserById(link.auth_user_id);
 if(authError||!authUser.user||!authUser.user.email_confirmed_at||
  String(authUser.user.email||"").toLowerCase()!==String(c.email||"").toLowerCase())return denial();
 const {data:staff}=await admin.from("staff_profiles").select("user_id")
 .eq("user_id",link.auth_user_id).eq("is_active",true).maybeSingle();
 if(staff)return denial();
 const client=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:session,error:passwordError}=await client.auth.signInWithPassword({
  email:String(c.email),password
 });
 if(passwordError||!session.session||session.user?.id!==link.auth_user_id)return denial();
 return respond({access_token:session.session.access_token,refresh_token:session.session.refresh_token,
 token_type:"bearer",expires_in:session.session.expires_in});
});