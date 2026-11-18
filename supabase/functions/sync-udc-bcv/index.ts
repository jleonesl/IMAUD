import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const BCV_URL = "https://www.bcv.org.ve/";
const NAMES: Record<string,string> = {
  EUR:"Euro",USD:"Dólar estadounidense",CNY:"Yuan chino",TRY:"Lira turca",RUB:"Rublo ruso"
};
const MONTHS: Record<string,number> = {
 enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12
};
function clean(input:string) {
  return input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ")
    .replace(/\s+/g," ").trim();
}
function parseNumber(raw:string) {
  const s=raw.replace(/\s/g,"").replace(/[^\d,.]/g,"");
  if(!s) return NaN;
  const comma=s.lastIndexOf(","),dot=s.lastIndexOf(".");
  const decimal=comma>dot?",":".";
  return Number(s.replace(decimal===","?/\./g:/,/g,"").replace(decimal,"."));
}
function readRate(html:string, id:string) {
  const escaped=id.replace(/[^a-z]/g,"");
  const anchor = new RegExp('<[^>]+id=["\\\']'+escaped+'["\\\'][^>]*>',"i").exec(html);
  if(!anchor) throw new Error("La página BCV no contiene el campo "+id);
  const segment=html.slice(anchor.index+anchor[0].length, anchor.index+anchor[0].length+1800);
  const strong=/<strong\b[^>]*>([\s\S]*?)<\/strong>/i.exec(segment);
  const text=clean(strong?strong[1]:segment.slice(0,450));
  const number=/\d{1,3}(?:\.\d{3})*,\d{2,10}|\d+[.,]\d{2,10}/.exec(text);
  const value=parseNumber(number?.[0]||"");
  if(!Number.isFinite(value)||value<=0||value>100000000)throw new Error("Cotización BCV no verificable para "+id);
  return value;
}
function readDate(html:string) {
  const target=clean(html);
  const dateText=target.match(/fecha\s*(?:valor|de\s*vigencia|de\s*referencia)\s*:?\s*(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)?[,]?\s*(\d{1,2})\s*(?:de\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s*(?:de\s*)?(20\d\d)/i);
  if(dateText) {
    const m=MONTHS[dateText[2].toLowerCase()];
    return dateText[3]+"-"+String(m).padStart(2,"0")+"-"+dateText[1].padStart(2,"0");
  }
  const numeric=target.match(/fecha\s*(?:valor|de\s*vigencia|de\s*referencia)\s*:?\s*(\d{2})[\/-](\d{2})[\/-](20\d\d)/i);
  if(numeric)return numeric[3]+"-"+numeric[2]+"-"+numeric[1];
  throw new Error("No se pudo verificar la fecha valor en el sitio oficial del BCV");
}
Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return Response.json({ok:false,error:"Only POST allowed"},{status:405});
  try {
    const response=await fetch(BCV_URL,{headers:{"Accept":"text/html","Cache-Control":"no-cache","User-Agent":"SITMAUD-BCV-Official-Rate-Reader/1.0"},redirect:"error",signal:AbortSignal.timeout(18000)});
    if(!response.ok)throw new Error("Sitio oficial BCV no disponible: HTTP "+response.status);
    const html=await response.text();
    if(html.length<1000||html.length>3000000)throw new Error("Respuesta oficial BCV incompleta o inesperada");
    const rates:Record<string,number>={};
    for(const code of Object.keys(NAMES)){
      try {rates[code]=readRate(html,code==="USD"?"dolar":code.toLowerCase());}
      catch(e){if(code==="EUR"||code==="USD")throw e;}
    }
    const effective_date=readDate(html);
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Caracas",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const age=(Date.parse(today+"T12:00:00Z")-Date.parse(effective_date+"T12:00:00Z"))/86400000;
    if(!Number.isFinite(age)||age<0||age>7)throw new Error("Fecha valor oficial futura o demasiado antigua");
    const [code,value]=Object.entries(rates).sort((a,b)=>b[1]-a[1])[0];
    const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!key)throw new Error("Credenciales de servidor no configuradas");
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:latest,error:latestError}=await db.from("udc_rates").select("effective_date").order("effective_date",{ascending:false}).limit(1).maybeSingle();
    if(latestError)throw latestError;
    if(latest?.effective_date && latest.effective_date>effective_date)
      return Response.json({ok:false,skipped:true,reason:"Fecha oficial anterior a la más reciente almacenada",effective_date});
    const {error}=await db.from("udc_rates").upsert({
      effective_date,udc_currency_code:code,udc_currency_name:NAMES[code],
      udc_value:value,rates_by_currency:rates,source_name:"Banco Central de Venezuela — fuente oficial",
      source_url:BCV_URL,source_published_at:null,fetched_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    },{onConflict:"effective_date"});
    if(error)throw error;
    return Response.json({ok:true,effective_date,udc_currency_code:code,udc_value:value,source_url:BCV_URL});
  }catch(error){
    console.error("SITMAUD BCV direct sync:",error);
    return Response.json({ok:false,source_url:BCV_URL,error:error instanceof Error?error.message:"Sin acceso a fuente oficial; no se modificaron tasas"},{status:502});
  }
});