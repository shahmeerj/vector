/* Analytics events for Google Tag Manager (see README → Tracking).
   Inside a case-study overlay (an about:srcdoc iframe on the landing page) the
   events go to the landing page's dataLayer, so GTM only runs once. */
(function(){
"use strict";
var overlay=location.protocol==='about:'&&window.parent!==window;
function push(o){try{var w=overlay?window.parent:window;(w.dataLayer=w.dataLayer||[]).push(o);}catch(e){}}
var cs=location.pathname.match(/\/(tamba|personology|routines)(?:\.html)?$/);
if(cs&&!overlay)push({event:'case_study_view',case_study:cs[1],view_type:'page'});
window.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('a[href$="#call"],a[href$="#book"]');if(!a)return;
  var id=a.dataset.cta||(a.textContent||'').trim().replace(/\s+/g,' ').slice(0,60);
  if(!id)return; /* the overlay's synthetic scroll link: already counted inside the overlay */
  var pg=overlay?'overlay:'+((document.title||'').split(' ')[0].toLowerCase()||'case'):location.pathname;
  push({event:'book_call_click',cta_id:id,cta_page:pg});
},true);
})();

/* Lead attribution: remembers how a visitor first arrived and which
   "book a call" link they clicked, so /api/lead can record it with the form. */
(function(){
"use strict";
var S;try{S=window.localStorage;S.setItem('vx_t','1');S.removeItem('vx_t');}catch(e){return;}
var q=new URLSearchParams(location.search);
var keys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','li_fat_id'];
var has=keys.some(function(k){return q.get(k);});
var first=null;try{first=JSON.parse(S.getItem('vx_first')||'null');}catch(e){}
/* First touch wins. A later visit with campaign tags overrides only if the first visit had none. */
if(!first||(has&&!first.utm_source&&!first.gclid&&!first.li_fat_id)){
  var o={landing:location.href,referrer:document.referrer||'',first_seen:new Date().toISOString()};
  keys.forEach(function(k){o[k]=q.get(k)||'';});
  try{S.setItem('vx_first',JSON.stringify(o));}catch(e){}
}
/* On window, capture phase: runs before the overlay bridge, which stops propagation. */
window.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('a[href$="#call"]');if(!a)return;
  var id=a.dataset.cta||(a.textContent||'').trim().replace(/\s+/g,' ').slice(0,60);
  if(!id)return; /* e.g. the overlay's synthetic scroll link: keep the CTA recorded inside the overlay */
  var pg=location.pathname+location.hash;
  if(location.protocol==='about:'){/* case study opened as an overlay on the landing page */pg='overlay:'+((document.title||'').split(' ')[0].toLowerCase()||'case');}
  try{S.setItem('vx_cta',id);S.setItem('vx_cta_page',pg);}catch(err){}
},true);
})();
