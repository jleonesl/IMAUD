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

const BACKUP_URL = "https://bcv.today/api/v1/rate.json";
function todayCaracas():string {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Caracas",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function checkDate(value:string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error("Fecha de vigencia inválida");
  const age=(Date.parse(todayCaracas()+"T12:00:00Z")-Date.parse(value+"T12:00:00Z"))/86400000;
  if (!Number.isFinite(age)||age<0||age>3) throw Error("La tasa reportada está fuera de vigencia (máximo 3 días)");
}
type RateResult={effective_date:string,rates:Record<string,number>,source_name:string,source_url:string,source_published_at:string|null};
async function official():Promise<RateResult>{
  const resp=await fetch(BCV_URL,{headers:{"Accept":"text/html","Cache-Control":"no-cache","User-Agent":"SITMAUD-BCV-Rate-Sync/1.2"},signal:AbortSignal.timeout(15000),redirect:"error"});
  if(!resp.ok)throw Error("BCV oficial HTTP "+resp.status);
  const html=await resp.text();
  if(html.length<1000||html.length>3000000)throw Error("Contenido BCV incompleto");
  const rates:Record<string,number>={};
  for (const code of Object.keys(NAMES)){
    try { rates[code]=readRate(html,code==="USD"?"dolar":code.toLowerCase()); }
    catch(e) {if(code==="USD"||code==="EUR")throw e;}
  }
  const effective_date=readDate(html);
  checkDate(effective_date);
  return {effective_date,rates,source_name:"Banco Central de Venezuela",source_url:BCV_URL,source_published_at:null};
}
async function alternate():Promise<RateResult>{
  const resp=await fetch(BACKUP_URL,{headers:{"Accept":"application/json","Cache-Control":"no-cache"},signal:AbortSignal.timeout(15000),redirect:"error"});
  if(!resp.ok)throw Error("Consulta de respaldo HTTP "+resp.status);
  const body=await resp.json();
  const effective_date=String(body.effective_date||body.date||"");
  checkDate(effective_date);
  const rates:Record<string,number>={};
  for(const code of Object.keys(NAMES)){
    const rate=Number(body[code]);
    if(Number.isFinite(rate)&&rate>0&&rate<100000000)rates[code]=rate;
  }
  if(!rates.USD||!rates.EUR)throw Error("Respaldo sin cotizaciones válidas EUR/USD");
  let source_published_at:null|string=null;
  if(body.updated_at){
    const dt=new Date(body.updated_at);
    if(!Number.isFinite(dt.getTime()))throw Error("Fecha de publicación inválida");
    source_published_at=dt.toISOString();
  }
  return {effective_date,rates,source_name:"BCV Today (tasas BCV reproducidas)",source_url:BACKUP_URL,source_published_at};
}
Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return Response.json({ok:false,error:"Only POST allowed"},{status:405});
  try {
    let rate:RateResult;
    let primary_error:string|null=null;
    try {rate=await official();}
    catch(error){
      primary_error=error instanceof Error?error.message:String(error);
      console.warn("No se pudo consultar BCV; utilizando fuente alternativa:",primary_error);
      rate=await alternate();
    }
    const [winnerCode,winnerValue]=Object.entries(rate.rates).sort((a,b)=>b[1]-a[1])[0];
    const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!key)throw Error("Configuración de servidor incompleta");
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:latest,error:latestError}=await db.from("udc_rates").select("effective_date").order("effective_date",{ascending:false}).limit(1).maybeSingle();
    if(latestError)throw latestError;
    if(latest?.effective_date && latest.effective_date>rate.effective_date)
      return Response.json({ok:true,updated:false,reason:"La fuente consultada no publicó una fecha más reciente",source_url:rate.source_url,effective_date:rate.effective_date});
    const {data:existing,error:existingError}=await db.from("udc_rates").select("source_url").eq("effective_date",rate.effective_date).maybeSingle();
    if(existingError)throw existingError;
    if(existing?.source_url===BCV_URL && rate.source_url!==BCV_URL)
      return Response.json({ok:true,updated:false,reason:"Se conservó el registro obtenido del BCV directamente",source_url:BCV_URL,effective_date:rate.effective_date});
    const {error}=await db.from("udc_rates").upsert({
      effective_date:rate.effective_date,udc_currency_code:winnerCode,udc_currency_name:NAMES[winnerCode],
      udc_value:winnerValue,rates_by_currency:rate.rates,source_name:rate.source_name,
      source_url:rate.source_url,source_published_at:rate.source_published_at,
      fetched_at:new Date().toISOString(),updated_at:new Date().toISOString()
    },{onConflict:"effective_date"});
    if(error)throw error;
    return Response.json({ok:true,updated:true,effective_date:rate.effective_date,
      udc_currency_code:winnerCode,udc_value:winnerValue,source_name:rate.source_name,
      source_url:rate.source_url,official_site_accessible:primary_error===null});
  }catch(error){
    console.error("SITMAUD BCV sync failed:",error);
    return Response.json({ok:false,error:error instanceof Error?error.message:String(error),updated:false},{status:502});
  }
});
