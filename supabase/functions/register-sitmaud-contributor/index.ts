import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN="https://jleonesl.github.io";
const cors={
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store",
  "Access-Control-Allow-Origin":ORIGIN,
  "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Vary":"Origin"
};
const respond=(data:unknown,status=200)=>
  new Response(JSON.stringify(data),{status,headers:cors});

Deno.serve(async request=>{
 if(request.method==="OPTIONS")return respond({});
 if(request.method!=="POST"||
   (request.headers.get("origin")&&request.headers.get("origin")!==ORIGIN))
   return respond({error:"Operación no autorizada"},403);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),
       service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!service)return respond({error:"Servicio de registro no configurado"},503);
 const jwt=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!jwt)return respond({error:"Se requiere sesión institucional"},401);
 const staff=createClient(url,anon,{
  global:{headers:{Authorization:"Bearer "+jwt}},
  auth:{persistSession:false,autoRefreshToken:false}
 });
 const {data:userResult,error:authError}=await staff.auth.getUser(jwt);
 if(authError||!userResult.user)return respond({error:"Sesión no válida"},401);
 const {data:allowed,error:permissionError}=await staff.rpc("has_permission",{permission_code:"contributors.create"});
 if(permissionError||allowed!==true)
   return respond({error:"No tienes autorización para registrar contribuyentes"},403);
 let payload:Record<string,unknown>;
 try{payload=await request.json();}catch{return respond({error:"Datos inválidos"},400);}
 const string=(key:string,max=300)=>String(payload[key]||"").trim().slice(0,max);
 const kind=string("kind",30),identityType=string("identification_type",3);
 const number=string("identification_number",30);
 const email=string("email",180).toLowerCase();
 const legal=string("legal_name",180),first=string("first_name",100),last=string("last_name",120);
 const condo=kind==="juridico"&&string("service_account_type",20)==="condominio";
 if(!["natural_venezolano","natural_extranjero","juridico"].includes(kind)||
   !["V","E","J"].includes(identityType)||
   !number||number.length<5||number.length>30||
   !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||
   (kind==="juridico"?!legal:!first))
   return respond({error:"Indica identificación, nombre y correo válidos para el acceso ciudadano"},400);
 if(kind==="juridico"&&identityType!=="J"||
   kind==="natural_venezolano"&&identityType!=="V"||
   kind==="natural_extranjero"&&identityType!=="E")
   return respond({error:"El tipo de contribuyente no coincide con la identificación"},400);
 const canonicalId=identityType==="V"||identityType==="E"
   ?number.replace(/[^0-9]/g,"")
   :number.replace(/[^0-9A-Za-z]/g,"").toUpperCase();
 if(identityType==="J"?!/^J[0-9]{9}$/.test(canonicalId):!/^[0-9]{5,12}$/.test(canonicalId))
   return respond({error:"La cédula/RIF no tiene un formato válido. Revisa el número antes de registrar."},400);
 const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
 // El acceso ciudadano se vincula 1:1 con el correo del titular.
 // Evita crear expedientes incompletos cuyo email ya pertenece a otro acceso.
 const {data:mailMatches,error:mailCheckError}=await admin.from("contributors")
  .select("id,contract_number").ilike("email",email).limit(1);
 if(mailCheckError)return respond({error:"No se pudo verificar la unicidad del correo. Intenta de nuevo."},503);
 if(mailMatches?.length)
   return respond({error:"Este correo ya está registrado en otro expediente. Comprueba el contribuyente existente antes de crear una cuenta nueva."},409);
 const row={
  kind,service_account_type:condo?"condominio":"individual",
  identification_type:identityType,identification_number:canonicalId,email,
  phone:string("phone",30)||null,
  contact_address:string("contact_address",500)||null,
  contact_parish_name:string("contact_parish_name",140)||null,
  contact_sector_name:string("contact_sector_name",140)||null,
  is_property_owner:!condo&&payload.is_property_owner===true,
  first_name:kind!=="juridico"?first:null,
  last_name:kind!=="juridico"?last:null,
  legal_name:kind==="juridico"?legal:null,
  rif:kind==="juridico"?canonicalId:null,
  created_by:userResult.user.id
 };
 const {data:contributor,error:insertError}=await admin.from("contributors").insert(row)
 .select("id,contract_number,kind,service_account_type,identification_type,identification_number,legal_name,first_name,last_name,is_property_owner")
 .single();
 if(insertError||!contributor)
   return respond({error:"No fue posible registrar al contribuyente: "+(insertError?.message||"Error institucional")},409);
 // El correo se solicita en el servidor, sin una segunda acción del navegador.
 let emailAccepted=false,emailIssue:string|null=null;
 try{
  const result=await fetch(url+"/functions/v1/invite-sitmaud-citizen",{
   method:"POST",
   headers:{"Content-Type":"application/json","apikey":anon,"Authorization":"Bearer "+jwt},
   body:JSON.stringify({contributor_id:contributor.id,action:"automatic"})
  });
  const body=await result.json().catch(()=>({}));
  emailAccepted=result.ok&&body.email_requested===true;
  if(!emailAccepted)emailIssue=String(body.error||"El servidor no confirmó el correo de activación.").slice(0,250);
 }catch(err){
  emailIssue="Falló la comunicación con el servicio de activación por correo.";
  console.error("Citizen automatic mail invocation failed:",err);
 }
 return respond({
  ok:true,contributor,
  email_requested:emailAccepted,email_status:emailAccepted?"accepted":"not_confirmed",
  email_error:emailIssue,
  note:emailAccepted?
    "Supabase aceptó la solicitud de activación por correo; aún debe comprobarse la entrega.":
    "Contribuyente registrado, pero el correo requiere revisión. Reenvía desde el expediente sin registrar otra vez."
 },201);
});