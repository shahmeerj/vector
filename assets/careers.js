/* Careers: roles that open in place on /careers, and the application form on
   /careers/<slug>/apply (validates, reads the CV and posts to /api/apply). */
(function(){
"use strict";

/* ---------- reveal on scroll ---------- */
(function(){
  var d=document.documentElement;if(!d.classList.contains('cmo'))return;d.classList.add('cmo-ready');
  var els=[].slice.call(document.querySelectorAll('[data-rv]'));
  if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in');});return;}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px'});
  els.forEach(function(e,i){e.style.transitionDelay=(e.getBoundingClientRect().top<innerHeight?Math.min(i,4)*90:0)+'ms';io.observe(e);});
})();

/* ---------- apply page: glow follows the pointer ---------- */
(function(){
  var sec=document.querySelector('.ap-body');if(!sec)return;
  sec.addEventListener('pointermove',function(e){var r=sec.getBoundingClientRect();sec.style.setProperty('--gx',(e.clientX-r.left)+'px');sec.style.setProperty('--gy',(e.clientY-r.top)+'px');});
})();

/* ---------- hero background: drifting blue dots (same as the audit page) ---------- */
(function(){
  var cv=document.getElementById('amb');if(!cv||!cv.getContext)return;
  var hero=cv.parentElement,ctx=cv.getContext('2d'),W=0,H=0,ps=[],t=0,run=true;
  var RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fieldA=function(x,y){return Math.sin(x*.004+t*.0003)*1.3+Math.cos(y*.005-t*.00025)*1.1;};
  function spawn(p,init){p.x=init?Math.random()*W:-10;p.y=Math.random()*H;p.vx=(Math.random()-.5)*.4;p.vy=(Math.random()-.5)*.4;p.r=.7+Math.random()*1.2;p.a=.25+Math.random()*.55;p.b=Math.random()<.22;}
  function size(){var hr=hero.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);W=hr.width;H=hr.height;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    var n=W<760?140:320;ps=[];for(var i=0;i<n;i++){var p={};spawn(p,true);ps.push(p);}}
  function frame(){t+=16;ctx.clearRect(0,0,W,H);
    for(var i=0;i<ps.length;i++){var p=ps[i],a=fieldA(p.x,p.y);p.vx+=Math.cos(a)*.012+.004;p.vy+=Math.sin(a)*.012;p.vx*=.97;p.vy*=.97;p.x+=p.vx;p.y+=p.vy;
      if(p.x>W+10||p.y<-10||p.y>H+10)spawn(p,false);
      ctx.fillStyle=p.b?'rgba(59,130,246,'+(p.a+.2)+')':'rgba(130,160,235,'+p.a*.6+')';ctx.beginPath();ctx.arc(p.x,p.y,p.b?p.r+.5:p.r,0,7);ctx.fill();}
  }
  size();frame();
  if(RM)return;
  (function loop(){if(run)frame();requestAnimationFrame(loop);})();
  var rt;addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(size,200);});
  if('IntersectionObserver' in window)new IntersectionObserver(function(e){run=e[0].isIntersecting;}).observe(hero);
})();

/* ---------- roles ---------- */
var roles=[].slice.call(document.querySelectorAll('.role'));
if(roles.length){
  var base=location.search.indexOf('preview=1')>-1?'?preview=1':'';
  var setOpen=function(li,open){
    li.classList.toggle('open',open);
    var b=li.querySelector('.role-btn');b.setAttribute('aria-expanded',String(open));
    li.querySelector('.role-tog-t').textContent=open?'Close':'View role';
  };
  roles.forEach(function(li){
    li.querySelector('.role-btn').addEventListener('click',function(){
      var open=!li.classList.contains('open');
      roles.forEach(function(o){if(o!==li&&o.classList.contains('open'))setOpen(o,false);});
      setOpen(li,open);
      /* The address bar follows the open role, so it can be copied and shared. */
      try{history.replaceState(null,'',open?'/careers/'+li.dataset.slug+base:'/careers'+base);}catch(e){}
      if(open)setTimeout(function(){
        var r=li.getBoundingClientRect();
        if(r.top<70||r.top>innerHeight*.5)window.scrollTo({top:scrollY+r.top-90,behavior:'smooth'});
      },420);
    });
  });
  var first=document.querySelector('.role.open');
  if(first)requestAnimationFrame(function(){window.scrollTo({top:scrollY+first.getBoundingClientRect().top-90});});

}

/* ---------- application form ---------- */
var form=document.getElementById('applyForm');if(!form)return;
var MAX=3*1024*1024,EXT=/\.(pdf|docx?)$/i;
var btn=document.getElementById('applyBtn'),btnText=btn.querySelector('.fb-t'),note=document.getElementById('applyNote');
var cvInput=document.getElementById('ap-cv'),drop=document.getElementById('cvDrop'),cvText=document.getElementById('cvText');
var dob=document.getElementById('ap-dob');
var cv=null;
/* Kept across retries so a resend after a timeout can't add a second row. */
var submissionId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2);

/* Applicants must be at least 16. */
var t=new Date();dob.max=new Date(Date.UTC(t.getFullYear()-16,t.getMonth(),t.getDate())).toISOString().slice(0,10);
var tint=function(el){el.classList.toggle('empty',!el.value);};
[dob].forEach(function(el){tint(el);el.addEventListener('change',function(){tint(el);});el.addEventListener('input',function(){tint(el);});});

function fieldEl(id){return form.querySelector('[data-field="'+id+'"]');}
function setError(id,msg){
  var f=fieldEl(id);if(!f)return;
  var e=f.querySelector('.err');if(e)e.textContent=msg||'';
  f.classList.toggle('bad',!!msg);
}
function val(name){var i=form.querySelector('[name="'+name+'"]');return i?i.value.trim():'';}

function pickFile(file){
  var hint=drop.querySelector('.drop-h');hint.textContent=hint.dataset.t||(hint.dataset.t=hint.textContent);
  setError('cv','');cv=null;drop.classList.remove('has');cvText.textContent='Upload your CV';
  if(!file)return;
  if(!EXT.test(file.name)){setError('cv','Upload a PDF or Word file.');return;}
  if(file.size>MAX){setError('cv','Your CV must be under 3 MB.');return;}
  if(!file.size){setError('cv','That file is empty.');return;}
  cv=file;cvText.textContent=file.name;drop.classList.add('has');
  hint.textContent=Math.max(1,Math.round(file.size/1024))+' KB. Click or drop another file to replace it.';
}
cvInput.addEventListener('change',function(){pickFile(cvInput.files[0]);});
['dragenter','dragover'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add('over');});});
['dragleave','drop'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove('over');});});
drop.addEventListener('drop',function(e){pickFile(e.dataTransfer.files[0]);});

var clearOn=function(e){var f=e.target.closest('.bad');if(f&&f.dataset.field!=='cv')setError(f.dataset.field,'');};
form.addEventListener('input',clearOn);form.addEventListener('change',clearOn);

function age(v){
  var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v);if(!m)return null;
  var now=new Date(),a=now.getFullYear()-m[1];
  if(now.getMonth()+1<+m[2]||(now.getMonth()+1===+m[2]&&now.getDate()<+m[3]))a--;
  return a;
}

function validate(){
  var bad=[];
  function check(id,ok,msg){setError(id,ok?'':msg);if(!ok)bad.push(id);}
  check('name',val('name').length>=2,'Add your full name.');
  var a=age(val('dob'));
  check('dob',a!==null&&a>=16&&a<=80,a===null?'Add your date of birth.':'Check your date of birth.');
  check('city',val('city').length>=2,'Add the city you live in.');
  check('email',/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email')),'Add a valid email.');
  check('phone',/^\+?[\d\s()-]{7,25}$/.test(val('phone')),'Add a valid number, with country code.');
  var li=val('linkedin');
  check('linkedin',!li||/^(https?:\/\/)?[^\s/]+\.[^\s]+$/i.test(li),'Add a full link, or leave it blank.');
  check('notice',!!val('notice'),'Add your notice period.');
  var s=val('salary').replace(/[,\s]/g,'');
  check('salary',!s||/^\d{1,9}$/.test(s),'Use numbers only, or leave it blank.');
  check('cv',!!cv,'Add your CV.');
  return bad;
}

function focusFirst(id){
  var f=fieldEl(id);if(!f)return;
  var i=f.querySelector('input,select,textarea');if(i)i.focus({preventScroll:true});
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
  var bad=validate();
  if(bad.length){fail('Please check the highlighted fields.');focusFirst(bad[0]);return;}

  form.classList.add('busy');btnText.textContent='Sending...';
  readBase64(cv).then(function(base64){
    var a=attribution();
    return fetch('/api/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      job_id:form.dataset.job,submission_id:submissionId,
      name:val('name'),dob:val('dob'),city:val('city'),email:val('email'),phone:val('phone'),
      linkedin:val('linkedin'),notice:val('notice'),salary:val('salary'),company_phone:val('company_phone'),
      cv:{name:cv.name,base64:base64},source:a.source,landing:a.landing,referrer:a.referrer
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
