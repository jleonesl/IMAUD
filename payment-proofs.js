/* SITMAUD · acceso a soportes bancarios privados vinculados a pagos DEMO */
(function(){
'use strict';
document.addEventListener('change',event=>{
 if(event.target.id!=='paymentProofFile')return;
 const file=event.target.files?.[0],hint=document.getElementById('paymentProofSelected');
 if(!hint)return;
 if(!file){hint.textContent='';return;}
 hint.textContent=file.name+' · '+(file.size/1048576).toFixed(2)+' MB';
 if(file.size>10485760){toast('El comprobante no puede superar 10 MB.');event.target.value='';hint.textContent='';}
});
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-proof-payment-id]');
 if(!button)return;
 const paymentId=button.dataset.proofPaymentId;
 if(!/^[0-9a-f-]{36}$/i.test(paymentId))return;
 // Abrir inmediatamente para que el navegador no bloquee el documento después de consultas async.
 const tab=window.open('about:blank','_blank');
 button.disabled=true;
 try{
  const {data,error}=await imaudClient.from('demo_payments').select('id,proof_storage_path').eq('id',paymentId).single();
  if(error)throw error;
  if(!data?.proof_storage_path)throw Error('Este pago no tiene comprobante bancario adjunto.');
  const result=await imaudClient.storage.from('imaud-payment-proofs').createSignedUrl(data.proof_storage_path,90);
  if(result.error||!result.data?.signedUrl)throw (result.error||Error('No fue posible generar el acceso privado.'));
  if(tab){tab.opener=null;tab.location.replace(result.data.signedUrl);}
  else{const link=document.createElement('a');link.href=result.data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';link.click();}
 }catch(e){
  if(tab)tab.close();
  console.error('Consulta de soporte bancario:',e);
  toast('No se pudo abrir el soporte: '+(e.message||'Acceso no disponible'));
 }finally{button.disabled=false;}
});
})();
