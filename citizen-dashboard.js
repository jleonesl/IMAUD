/* SITMAUD · Portal del Contribuyente: navegación y resumen, sin datos simulados. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const els=()=>[...document.querySelectorAll('[data-citizen-view-panel]')];
const views=new Set(['inicio','obligaciones','cargar-pago','facturas','cuentas','informacion','ayuda']);
const fmt=n=>'Bs. '+new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
let currentPortal=null;
function navigate(to){
 if(!views.has(to))to='inicio';
 els().forEach(el=>el.hidden=el.dataset.citizenViewPanel!==to);
 document.querySelectorAll('[data-citizen-view]').forEach(el=>{
  const active=el.dataset.citizenView===to;
  if(el.closest('.citizen-nav')){if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')}
 });
 $('citizenSidebar')?.classList.remove('open');
 $('citizenMenuToggle')?.setAttribute('aria-expanded','false');
 const headings={inicio:'Inicio',obligaciones:'Mis obligaciones','cargar-pago':'Cargar pago',facturas:'Mis facturas',cuentas:'Cuentas oficiales',informacion:'Mi información',ayuda:'Ayuda y soporte'};
 if($('citizenSectionTitle'))$('citizenSectionTitle').textContent=to==='inicio'?'Portal del Contribuyente':headings[to];
 try{history.replaceState(null,'',location.pathname+location.search+'#'+to)}catch(_){}
 window.scrollTo({top:0,behavior:'instant'});
}
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-citizen-view]');
 if(nav){e.preventDefault();navigate(nav.dataset.citizenView);return}
 if(e.target.closest('#citizenMenuToggle')){
  const open=$('citizenSidebar')?.classList.toggle('open');
  $('citizenMenuToggle').setAttribute('aria-expanded',String(!!open));
 }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('citizenSidebar')?.classList.remove('open');$('citizenMenuToggle')?.setAttribute('aria-expanded','false')}});
function init(portal){
 if(!portal?.activated)return;
 currentPortal=portal;
 const obligations=Array.isArray(portal.obligations)?portal.obligations:[];
 const payments=Array.isArray(portal.payments)?portal.payments:[];
 const properties=Array.isArray(portal.properties)?portal.properties:[];
 const pending=obligations.filter(a=>a.status==='pending'||a.status==='partially_paid');
 const confirmed=payments.filter(p=>p.status==='confirmed'&&p.liquidated_at);
 const owed=pending.reduce((sum,a)=>sum+Math.max(0,Number(a.amount_bs||0)),0);
 const paid=confirmed.reduce((sum,p)=>sum+Number(p.amount_bs||0),0);
 const name=String(portal.name||'Contribuyente').toUpperCase();
 if($('citizenHeroGreeting'))$('citizenHeroGreeting').textContent='Bienvenido, '+name;
 if($('citizenHeroIdentity'))$('citizenHeroIdentity').textContent='Contrato: '+(portal.contract_number||'—')+'  ·  Cédula / RIF: '+(portal.identification||'—');
 if($('citizenTopName'))$('citizenTopName').textContent=name;
 if($('citizenDebtValue'))$('citizenDebtValue').textContent=obligations.length?fmt(owed):'—';
 if($('citizenDebtNote'))$('citizenDebtNote').textContent=obligations.length?pending.length+' obligación(es) con saldo registrado':'No hay obligaciones oficiales registradas';
 if($('citizenPaidValue'))$('citizenPaidValue').textContent=fmt(paid);
 if($('citizenPaidNote'))$('citizenPaidNote').textContent=confirmed.length+' pago(s) liquidados por Tesorería';
 if($('citizenStatusValue'))$('citizenStatusValue').textContent=obligations.length?(pending.length?'Con obligaciones pendientes':'Sin deuda registrada'):'Por determinar';
 if($('citizenStatusNote'))$('citizenStatusNote').textContent='No equivale a una solvencia oficial';
 if($('citizenHomeProperty')){
  $('citizenHomeProperty').innerHTML=properties.length
   ?properties.slice(0,2).map(p=>'<div class="citizen-info-row"><span><b>'+esc(p.address||'Inmueble')+'</b><br><small>'+esc([p.sector,p.parish].filter(Boolean).join(' · '))+'</small></span><span>'+esc(p.consolidated?'Cuenta matriz':'Inmueble')+'</span></div>').join('')
   :'<p class="citizen-empty">No hay inmuebles activos asociados.</p>';
 }
 if($('citizenRecentTransactions')){
  $('citizenRecentTransactions').innerHTML=payments.length?payments.slice(0,4).map(p=>
   '<div class="citizen-info-row"><div><b>'+esc(p.receipt)+'</b><br><small>'+
   esc(p.status==='confirmed'&&p.liquidated_at?'Liquidado por Tesorería':p.status==='reversed'?'Rechazado':'Pendiente de validación')+'</small></div><b>'+fmt(p.amount_bs)+'</b></div>').join(''):
   '<div class="citizen-empty-state"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 5h17l9 9v27H12z M29 5v10h9 M19 25h15 M19 31h12"/><circle cx="36" cy="36" r="9" fill="#fff"/><path d="m32 36 3 3 6-7"/></svg><strong>Aún no tienes operaciones registradas</strong><p>Cuando realices un pago, podrás ver aquí su estado.</p></div>';
 }
 // Los datos reales se consultan en la RPC. No asumir estado Solvente, tipología o cuentas.
 navigate(views.has(location.hash.slice(1))?location.hash.slice(1):'inicio');
}
function updateBanks(data){
 const host=$('citizenHomeBanks');if(!host)return;
 const list=Array.isArray(data?.accounts)?data.accounts:[];
 host.innerHTML=list.length?list.slice(0,2).map(a=>'<div class="citizen-info-row"><div><b>'+esc(a.bank||'Banco')+'</b><br><small>'+esc(a.method==='pago_movil'?'Pago móvil':'Transferencia')+'</small></div></div>').join(''):
 '<p class="citizen-empty">Aún no hay cuentas bancarias oficiales publicadas.</p>';
}
window.sitmaudCitizenDashboard={init,navigate,updateBanks};
})();