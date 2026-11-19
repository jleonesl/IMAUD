/* SITMAUD · Registro de pagos del contribuyente.
   Solo obligaciones oficiales propias. El servidor cotiza UCD y Tesorería liquida. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const bs=n=>"Bs. "+new Intl.NumberFormat("es-VE",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0));
const money=n=>new Intl.NumberFormat("es-VE",{minimumFractionDigits:2,maximumFractionDigits:4}).format(Number(n||0));
const escape=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const allowed=["application/pdf","image/png","image/jpeg","image/webp"];
let client,portal,debts=[],banks=[],accounts=[],quote=null,busy=false;
function message(v){$("citizenPaymentMessage").textContent=v;}
function selection(){return [...document.querySelectorAll(".citizen-month-check:checked")].map(x=>x.value);}
function resetQuote(){quote=null;$("citizenPaymentQuote").textContent="Selecciona uno o varios meses y pulsa «Calcular importe oficial».";$("citizenPaymentSubmit").disabled=true;}
function accountChanged(){
 const method=$("citizenPaymentMethod").value,sel=$("citizenPaymentDestination");
 const matches=accounts.filter(a=>a.method===method);
 sel.innerHTML='<option value="">Selecciona cuenta receptora</option>'+matches.map(a=>'<option value="'+escape(a.id)+'">'+escape(a.bank+" · "+(a.account_number||a.mobile_number||""))+'</option>').join("");
 resetQuote();
}
async function init(supabase,account){
 client=supabase;portal=account;
 const root=$("citizenPaymentRegistration");
 root.hidden=false;
 const all=Array.isArray(account.obligations)?account.obligations:[];
 const held=new Set((account.payments||[]).filter(p=>p.status!=="reversed").flatMap(p=>Array.isArray(p.assessment_ids)?p.assessment_ids:[]));
 debts=all.filter(a=>a.status==="pending"&&a.period_start>="2027-01-01"&&!held.has(a.id));
 try{
  const {data,error}=await client.rpc("get_citizen_payment_options");
  if(error)throw error;
  banks=data?.banks||[];accounts=data?.accounts||[];
  if(!accounts.length){message("La Alcaldía todavía no ha publicado cuentas bancarias oficiales. El registro de pagos permanecerá deshabilitado hasta su publicación por el superusuario.");return;}
  if(!debts.length){message("No tienes meses oficiales pendientes disponibles para pagar. No se registrarán pagos sin obligaciones reales.");return;}
  $("citizenPaymentMonths").innerHTML=debts.map(d=>'<label class="citizen-pay-month"><input type="checkbox" class="citizen-month-check" value="'+escape(d.id)+'"><span>'+escape(d.period_start)+' · '+escape((account.properties||[]).find(p=>p.id===d.property_id)?.address||"Obligación oficial")+'</span><small>Mes pendiente · importe sujeto a tasa BCV del día</small></label>').join("");
  $("citizenPaymentBank").innerHTML='<option value="">Selecciona banco de origen</option>'+banks.map(b=>'<option value="'+escape(b.code)+'">'+escape(b.name)+'</option>').join("");
  $("citizenPaymentForm").hidden=false;
  message("Selecciona los meses y registra solo pagos realmente efectuados a las cuentas municipales publicadas.");
  accountChanged();
 }catch(e){message("No fue posible cargar los datos de pago: "+(e.message||"Error de conexión"));}
}
document.addEventListener("change",e=>{
 if(e.target.classList.contains("citizen-month-check"))resetQuote();
 if(e.target.id==="citizenPaymentMethod")accountChanged();
 if(e.target.id==="citizenPaymentDestination")resetQuote();
});
document.addEventListener("click",async e=>{
 if(e.target.id!=="citizenPaymentQuoteButton"||busy)return;
 const selected=selection();
 if(!selected.length){message("Selecciona al menos un mes pendiente.");return;}
 if(!accounts.find(a=>a.id===$("citizenPaymentDestination").value&&a.method===$("citizenPaymentMethod").value)){message("Selecciona una cuenta receptora municipal publicada.");return;}
 busy=true;e.target.disabled=true;message("Consultando tasa BCV y obligaciones oficiales…");
 try{
  const {data,error}=await client.rpc("quote_citizen_udc_payment",{p_contributor_id:portal.contributor_id,p_assessment_ids:selected});
  if(error)throw error;
  if(!data?.rate_id||!Array.isArray(data.allocations))throw Error("Cotización no disponible");
  quote={...data,ids:selected};
  $("citizenPaymentQuote").textContent="Tasa oficial "+escape(data.effective_date)+" · "+money(data.rate)+" Bs/UCD · "+money(data.total_udc)+" UCD · Total "+bs(data.total_bs)+". Esta cotización se verificará otra vez al enviar.";
  $("citizenPaymentSubmit").disabled=false;message("Cotización recibida. Adjunta un comprobante real de la transferencia o pago móvil.");
 }catch(err){resetQuote();message("No se pudo cotizar: "+(err.message||"Revisa la tasa BCV vigente y tus obligaciones"));}
 finally{busy=false;e.target.disabled=false;}
});
document.addEventListener("submit",async e=>{
 if(e.target.id!=="citizenPaymentForm")return;e.preventDefault();if(busy)return;
 const selected=selection(),form=e.target,submit=$("citizenPaymentSubmit"),file=form.elements.proof.files[0];
 if(!quote||JSON.stringify(selected)!==JSON.stringify(quote.ids)){message("Vuelve a cotizar los meses antes de enviar.");return;}
 if(!file||!allowed.includes(file.type)||file.size<1||file.size>10*1024*1024){message("Adjunta un PDF, JPG, PNG o WebP válido, máximo 10 MB.");return;}
 const method=form.elements.method.value,receiving=form.elements.receiving.value;
 const bank=form.elements.bank.value,ref=form.elements.reference.value.trim();
 if(!accounts.some(a=>a.id===receiving&&a.method===method)||!banks.some(b=>b.code===bank)||ref.length<3){message("Verifica método, cuenta receptora, banco y referencia.");return;}
 busy=true;submit.disabled=true;let uploaded=null;
 try{
  const {data:current,error:accessErr}=await client.rpc("get_my_citizen_portal");
  if(accessErr||!current?.activated||current.contributor_id!==portal.contributor_id)throw Error("Sesión vencida o expediente no verificado");
  const ext={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
  const id=crypto.randomUUID(),path=portal.contributor_id+"/citizen/"+id+"."+ext;
  message("Subiendo comprobante al almacenamiento privado…");
  const upload=await client.storage.from("imaud-payment-proofs").upload(path,file,{contentType:file.type,upsert:false});
  if(upload.error)throw upload.error;
  uploaded=path;
  message("Registrando pago pendiente y verificando de nuevo la tasa UCD…");
  const {data,error}=await client.rpc("register_citizen_udc_payment",{
   p_contributor_id:portal.contributor_id,p_assessment_ids:quote.ids,
   p_payment_method:method,p_external_reference:ref,p_bank_code:bank,
   p_evidence_path:path,p_paid_at:new Date().toISOString(),
   p_expected_rate_id:quote.rate_id,p_expected_total_bs:quote.total_bs,
   p_municipal_account_id:receiving
  });
  if(error)throw error;
  uploaded=null;
  message("Solicitud registrada: "+(data?.receipt_number||"")+" · "+bs(data?.amount_bs)+". Estado: PENDIENTE DE VERIFICACIÓN. Este registro no es un recibo liquidado.");
  form.hidden=true;$("citizenPaymentQuote").textContent="";
  // Actualiza los movimientos desde el servidor sin volver a crear otra operación.
  const fresh=await client.rpc("get_my_citizen_portal");
  if(!fresh.error&&fresh.data?.activated){
   const rows=fresh.data.payments||[];
   $("citizenPayments").innerHTML=rows.length?rows.map(p=>'<div class="citizen-item"><div><b>'+escape(p.receipt)+'</b><small>'+escape(p.status==="confirmed"?"Pago confirmado":p.status==="reversed"?"Reversado":"Pendiente de validación")+'</small></div><b>'+bs(p.amount_bs)+'</b></div>').join(""):"<p>No existen pagos oficiales registrados.</p>";
  }
 }catch(err){
  if(uploaded){await client.storage.from("imaud-payment-proofs").remove([uploaded]).catch(()=>{});}
  message("No se pudo registrar el pago: "+(err.message||"Error de servicio")+". Comprueba tus movimientos antes de reintentar.");
 }finally{busy=false;submit.disabled=false;}
});
window.sitmaudCitizenPayment={init};
})();