/* Application form on /careers/:slug: validates, reads the CV and posts to /api/apply. */
(function(){
"use strict";
var form=document.getElementById('applyForm');if(!form)return;
var MAX=3*1024*1024,EXT=/\.(pdf|docx?)$/i;
var btn=document.getElementById('applyBtn'),btnText=btn.querySelector('.fb-t'),note=document.getElementById('applyNote');
var cvInput=document.getElementById('ap-cv'),drop=document.getElementById('cvDrop'),cvText=document.getElementById('cvText');
var cv=null;
/* Kept across retries so a resend after a timeout can't add a second row. */
var submissionId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2);

function fieldEl(id){return form.querySelector('[data-field="'+id+'"]');}
function setError(id,msg){
  var f=fieldEl(id);if(!f)return;
  var e=f.querySelector('.err');if(e)e.textContent=msg||'';
  f.classList.toggle('bad',!!msg);
}
function val(name){var i=form.querySelector('[name="'+name+'"]');return i?i.value.trim():'';}

function pickFile(file){
  setError('cv','');cv=null;drop.classList.remove('has');cvText.textContent='Upload your CV';
  if(!file)return;
  if(!EXT.test(file.name)){setError('cv','Upload a PDF or Word file.');return;}
  if(file.size>MAX){setError('cv','Your CV must be under 3 MB.');return;}
  if(!file.size){setError('cv','That file is empty.');return;}
  cv=file;cvText.textContent=file.name;drop.classList.add('has');
}
cvInput.addEventListener('change',function(){pickFile(cvInput.files[0]);});
['dragenter','dragover'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add('over');});});
['dragleave','drop'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove('over');});});
drop.addEventListener('drop',function(e){pickFile(e.dataTransfer.files[0]);});

form.addEventListener('input',function(e){var f=e.target.closest('.bad');if(f&&f.dataset.field!=='cv')setError(f.dataset.field,'');});

function answers(){
  var out={};
  form.querySelectorAll('[data-question]').forEach(function(el){
    var id=el.dataset.question;
    if(el.dataset.kind==='multi'){out[id]=[].map.call(el.querySelectorAll('input:checked'),function(i){return i.value;});}
    else if(el.dataset.kind==='single'){var c=el.querySelector('input:checked');out[id]=c?c.value:'';}
    else{out[id]=el.value.trim();}
  });
  return out;
}

function validate(ans){
  var bad=[];
  function check(id,ok,msg){setError(id,ok?'':msg);if(!ok)bad.push(id);}
  check('name',val('name').length>=2,'Add your full name.');
  check('email',/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email')),'Add a valid email.');
  check('whatsapp',/^\+?[\d\s()-]{7,25}$/.test(val('whatsapp')),'Add a valid number, with country code.');
  check('location',val('location').length>=2,'Add your city and country.');
  check('linkedin',/linkedin\.com\/\S+/i.test(val('linkedin')),'Add a link to your LinkedIn profile.');
  check('cv',!!cv,'Add your CV.');
  form.querySelectorAll('[data-field][data-required]').forEach(function(f){
    var a=ans[f.dataset.field];check(f.dataset.field,!!(a&&a.length),'This one is required.');
  });
  check('salary',!!val('salary'),'Add your expected salary.');
  check('start',!!val('start'),'Add when you could start.');
  check('consent',document.getElementById('ap-consent').checked,'We need your agreement to store your application.');
  return bad;
}

function focusFirst(id){
  var f=fieldEl(id);if(!f)return;
  var i=f.querySelector('input,textarea');if(i)i.focus({preventScroll:true});
  f.scrollIntoView({block:'center',behavior:'smooth'});
}

function readBase64(file){
  return new Promise(function(ok,no){
    var r=new FileReader();
    r.onload=function(){ok(String(r.result).split(',')[1]||'');};
    r.onerror=function(){no(new Error('read failed'));};
    r.readAsDataURL(file);
  });
}

function attribution(){
  var first={};try{first=JSON.parse(localStorage.getItem('vx_first')||'{}')||{};}catch(e){}
  var q=new URLSearchParams(location.search);
  var src=[q.get('utm_source')||first.utm_source,q.get('utm_medium')||first.utm_medium,q.get('utm_campaign')||first.utm_campaign].filter(Boolean).join(' / ');
  return{source:src,landing:first.landing||location.href,referrer:first.referrer||document.referrer||''};
}

function fail(msg){note.textContent=msg;note.classList.add('is-err');}

form.addEventListener('submit',function(e){
  e.preventDefault();
  if(btn.disabled)return;
  note.textContent='';note.classList.remove('is-err');
  var ans=answers(),bad=validate(ans);
  if(bad.length){fail('Please check the highlighted fields.');focusFirst(bad[0]);return;}

  form.classList.add('busy');btnText.textContent='Sending...';
  readBase64(cv).then(function(base64){
    var a=attribution();
    return fetch('/api/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      job_id:form.dataset.job,submission_id:submissionId,
      name:val('name'),email:val('email'),whatsapp:val('whatsapp'),location:val('location'),linkedin:val('linkedin'),
      salary:val('salary'),start:val('start'),consent:true,company_phone:val('company_phone'),
      answers:ans,cv:{name:cv.name,base64:base64},source:a.source,landing:a.landing,referrer:a.referrer
    })});
  }).then(function(r){
    return r.json().catch(function(){return{ok:false};}).then(function(d){return{status:r.status,data:d};});
  }).then(function(res){
    form.classList.remove('busy');btnText.textContent='Send application';
    if(res.data.ok){
      document.getElementById('applyName').textContent=val('name').split(/\s+/)[0];
      form.hidden=true;
      var done=document.getElementById('applyDone');done.hidden=false;done.focus({preventScroll:true});
      done.scrollIntoView({block:'center',behavior:'smooth'});
      return;
    }
    if(res.data.errors){
      var ids=Object.keys(res.data.errors);
      ids.forEach(function(id){setError(id,res.data.errors[id]);});
      fail('Please check the highlighted fields.');focusFirst(ids[0]);return;
    }
    if(res.status===413){setError('cv','That file is too large. Keep it under 3 MB.');fail('Please check the highlighted fields.');return;}
    fail(res.data.error||'Your application didn’t go through. Please try again.');
  }).catch(function(){
    form.classList.remove('busy');btnText.textContent='Send application';
    fail('Your application didn’t go through. Check your connection and try again.');
  });
});
})();
