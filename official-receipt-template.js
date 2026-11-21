/* SITMAUD | Approved institutional payment invoice, shared across staff and citizen portals. */
(function(){
'use strict';
const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const contributor=c=>c.kind==='juridico'?(c.legal_name||'—'):[c.first_name,c.last_name].filter(Boolean).join(' ')||c.legal_name||'—';
const receiptMonth=(x)=>x?new Date(x+'T12:00:00Z').toLocaleDateString('es-VE',{timeZone:'UTC',month:'long',year:'numeric'}):'—';
const receiptDate=(x)=>x?new Date(x).toLocaleDateString('es-VE',{timeZone:'America/Caracas',day:'2-digit',month:'2-digit',year:'numeric'}):'—';
const receiptMoney=(value)=>'Bs. '+new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0));
function render({payment:p,allocations,preview=false}){
if(!allocations?.length)throw Error('Factura sin obligaciones oficiales');
    const c=p.contributor||{},first=allocations[0].assessment,property=first.property||{};
    const periodLabels=[...new Set(allocations.map(a=>a.assessment.period_start).filter(Boolean).map(receiptMonth))];
    const billedPeriod=preview?'—':periodLabels.length<=3?periodLabels.join(' · '):periodLabels.slice(0,3).join(' · ')+' y '+(periodLabels.length-3)+' período(s) adicionales';
    const typology=property.organization?.billing_typology||property.typology_override||property.sector?.default_typology||'Sin clasificación';
    const address=property.address||'No registrada';
    const parish=property.parish_name||'No registrada';
    const sector=property.sector_name||'No registrado';
    const isVES=p.currency_code==='VES',paid=!preview&&p.status==='confirmed',pending=!preview&&p.status==='pending';
    const actualBs=Number((p.received_amount_bs??p.amount)||0), appliedBs=Number(p.amount||0);
    const extraBs=Math.max(0,Math.round((actualBs-appliedBs)*100)/100);
    const title=preview?'RECIBO DE PAGO':paid||pending?'RECIBO DE PAGO':'RECIBO ANULADO';
    const status=preview?'PLANTILLA SIN DATOS · NO ES UN RECIBO EMITIDO':paid?'PAGO CONFIRMADO':pending?'PAGO REGISTRADO · EN VERIFICACIÓN':'ANULADO · PAGO NO ACREDITADO';
    const doc='<article class="bill-paper sit-receipt" role="document">'+
      '<header class="sit-receipt-header">'+
        '<div class="sit-receipt-logo"><img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/2fb94317-165c-4058-ba6f-8d7b39165bc1.png" alt="Alcaldía Bolivariana del Municipio Miranda"></div>'+
        '<div class="sit-receipt-heading"><h1>'+safe(title)+'</h1><p>SERVICIO MUNICIPAL DE ASEO URBANO Y DOMICILIARIO</p></div>'+
        '<div class="sit-receipt-logo"><img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3ItUe8QrEZBnQYkWfCOxM5aX5ic/c48697a7-2c1f-4f88-aa38-2f8bb991ada2.png" alt="Instituto Municipal de Aseo Urbano y Domiciliario"></div>'+
      '</header>'+
      '<div class="sit-receipt-state '+(paid?'is-liquidated':pending?'is-pending':'is-reversed')+'">'+safe(status)+'</div>'+
      '<div class="sit-receipt-numbers"><div><span>N.º DE CONTRATO</span><b>'+safe(c.contract_number||'No registrado')+'</b></div><div><span>N.º DE FACTURA / RECIBO</span><b>'+safe(p.receipt_number)+'</b></div><div><span>FECHA DE EMISIÓN</span><b>'+safe(receiptDate(p.invoice_issued_at||p.created_at))+'</b></div></div>'+
      '<div class="sit-receipt-mid"><div class="sit-receipt-data">'+
        '<div><span>Contribuyente:</span><b>'+safe(contributor(c))+'</b></div>'+
        '<div><span>Cédula / RIF:</span><b>'+safe((c.identification_type||'')+'-'+(c.identification_number||''))+'</b></div>'+
        '<div><span>Dirección:</span><b>'+safe(address)+'</b></div>'+
        '<div><span>Sector / Parroquia:</span><b>'+safe(sector+' / '+parish)+'</b></div>'+
        '<div><span>Tipología:</span><b>'+safe(typology)+'</b></div>'+
      '</div><div class="sit-receipt-side"><div class="sit-receipt-period"><strong>PERÍODO FACTURADO</strong><span>'+safe(billedPeriod||'No definido')+'</span></div>'+
        '<div class="sit-receipt-verification"><strong>Identificación del documento</strong><span>'+safe(p.receipt_number)+'</span><small>Consultar en SITMAUD. La verificación digital mediante QR todavía no está habilitada.</small></div></div></div>'+
      '<div class="sit-receipt-charge"><div><strong>Concepto</strong><span>Servicio de aseo urbano y domiciliario</span></div><div><strong>'+(paid||pending?'Monto aplicado a mensualidades (Bs.)':'Monto anulado (Bs.)')+'</strong><b>'+safe(preview?'—':isVES?receiptMoney(p.amount):'Sin conversión a bolívares')+'</b></div></div>'+
      (!preview&&isVES?'<div class="sit-receipt-payment"><div><span>MONTO REALMENTE RECIBIDO</span><b>'+safe(receiptMoney(actualBs))+'</b></div><div><span>DIFERENCIA NO APLICADA A DEUDA</span><b>'+safe(receiptMoney(extraBs))+'</b></div></div>':'')+
      '<div class="sit-receipt-payment"><div><span>MÉTODO DE PAGO</span><b>'+safe(p.payment_method||'No registrado')+'</b></div><div><span>BANCO</span><b>'+safe(p.bank_code||'No consignado')+'</b></div><div><span>REFERENCIA</span><b>'+safe(p.external_reference||'No registrada')+'</b></div></div>'+
      '<div class="sit-receipt-payment"><div><span>MONTO UCD</span><b>'+safe(p.payment_udc_total==null?'—':String(p.payment_udc_total)+' UCD')+'</b></div><div><span>TASA BCV/UCD</span><b>'+safe(p.rate?String(p.rate.udc_value)+' · '+p.rate.effective_date:'No registrada')+'</b></div><div><span>ORIGEN DE LA TASA</span><b>'+safe(p.rate?.source_url||'No registrado')+'</b></div></div>'+
      '<footer class="sit-receipt-footer">Cuida la ciudad, cumple con tu servicio de aseo.</footer>'+
      '</article>';

return doc;
}
window.sitmaudOfficialReceipt={render};
})();
