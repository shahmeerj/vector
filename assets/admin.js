/* /admin: create, edit, publish and close job listings. Talks to /api/admin. */
(function(){
"use strict";
var app=document.getElementById('app');
var state={jobs:[],sheetUrl:'',job:null,dirty:false};

/* DOM helper: h('div.card',{onclick:fn},child,child) */
function h(sel,attrs){
  var p=sel.split('.'),el=document.createElement(p[0]||'div');
  if(p.length>1)el.className=p.slice(1).join(' ');
  Object.keys(attrs||{}).forEach(function(k){
    var v=attrs[k];
    if(k.slice(0,2)==='on')el.addEventListener(k.slice(2),v);
    else if(k==='value')el.value=v;
    else if(k==='checked'||k==='disabled'||k==='selected')el[k]=!!v;
    else if(v!=null)el.setAttribute(k,v);
  });
  [].slice.call(arguments,2).forEach(function(c){
    if(c==null||c===false)return;
    (Array.isArray(c)?c:[c]).forEach(function(n){if(n!=null&&n!==false)el.appendChild(typeof n==='string'?document.createTextNode(n):n);});
  });
  return el;
}

function api(action,data){
  return fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json','X-Vector-Admin':'1'},body:JSON.stringify(Object.assign({action:action},data||{}))})
    .then(function(r){return r.json().catch(function(){return{ok:false,error:'Something went wrong. Try again.'};}).then(function(d){d._status=r.status;return d;});});
}

function render(view){app.textContent='';app.appendChild(view);window.scrollTo(0,0);}

function login(message){
  var pw=h('input',{type:'password',id:'pw',autocomplete:'current-password',required:true});
  var err=h('span.e',{},message||'');
  var btn=h('button.btn.btn-blue',{type:'submit'},'Sign in');
  render(h('form.login',{onsubmit:function(e){
    e.preventDefault();btn.disabled=true;err.textContent='';
    api('login',{password:pw.value}).then(function(d){
      btn.disabled=false;
      if(d.ok){load();return;}
      err.textContent=d.error||'Sign-in failed.';pw.select();
    }).catch(function(){btn.disabled=false;err.textContent='Couldn’t connect. Try again.';});
  }},
    h('h1',{},'Job listings'),
    h('div.fld',{},h('label',{for:'pw'},'Password'),pw,err),
    btn));
  pw.focus();
}

function top(){
  return h('div.a-top',{},
    h('span.a-brand',{},'Vector admin'),
    h('nav',{},
      state.sheetUrl?h('a.a-link',{href:state.sheetUrl,target:'_blank',rel:'noopener'},'Open Sheet'):null,
      h('a.a-link',{href:'/careers',target:'_blank',rel:'noopener'},'View careers page'),
      h('button.a-link',{type:'button',onclick:function(){api('logout').then(function(){login();});}},'Sign out')));
}

function load(){
  return api('list').then(function(d){
    if(d._status===401){login();return;}
    if(!d.ok){render(h('div.a-wrap',{},h('p.msg',{},d.error||'Couldn’t load the listings.')));return;}
    state.jobs=d.jobs;state.sheetUrl=d.sheet_url||'';state.job=null;state.dirty=false;
    list();
  }).catch(function(){login('Couldn’t connect. Try again.');});
}

function blankJob(){return{title:'',status:'Draft',location:'',work_type:'',employment_type:'',salary:'',intro:'',responsibilities:'',requirements:'',nice_to_have:''};}

function subline(j){
  var n=Number(j.applications)||0;
  return[j.location,j.work_type,n===1?'1 application':n+' applications'].filter(Boolean).join(' · ');
}

function list(){
  var order={Open:0,Draft:1,Closed:2};
  var jobs=state.jobs.slice().sort(function(a,b){return order[a.status]-order[b.status];});
  render(h('div.a-wrap',{},top(),
    h('div.a-head',{},h('h1',{},'Job listings'),
      h('button.btn.btn-blue',{type:'button',onclick:function(){edit(blankJob());}},'New listing')),
    jobs.length?h('div.jobs',{},jobs.map(function(j){
      return h('button.job',{type:'button',onclick:function(){edit(JSON.parse(JSON.stringify(j)));}},
        h('span.job-t',{},j.title||'Untitled'),
        h('span.pill.'+j.status,{},j.status),
        h('span.job-s',{},subline(j)));
    })):h('p.empty',{},'No listings yet. Create your first one.')));
}

function edit(job){
  state.job=job;state.dirty=false;
  var errors={},msg=h('span.bar-msg'),acts=h('div.bar-acts');
  var discardArmed=false,deleteArmed=false,busy=false;

  function say(text,kind){msg.textContent=text||'';msg.className='bar-msg'+(kind?' '+kind:'');}
  function touch(){state.dirty=true;say('Unsaved changes');}

  function field(key,label,opts){
    opts=opts||{};
    var id='f-'+key,control;
    var bind={id:id,oninput:function(){job[key]=control.value;touch();},onchange:function(){job[key]=control.value;touch();}};
    if(opts.area)control=h('textarea',Object.assign({rows:opts.rows||5},bind));
    else if(opts.choices)control=h('select',bind,opts.choices.map(function(c){return h('option',{value:c},c||'Choose...');}));
    else control=h('input',Object.assign({type:'text',placeholder:opts.placeholder},bind));
    control.value=job[key]||'';
    return h('div.fld'+(opts.wide?'.wide':''),{'data-key':key},
      h('label',{for:id},label,opts.optional?h('em',{},' (optional)'):null),control,h('span.e'));
  }

  function showErrors(){
    app.querySelectorAll('.fld[data-key]').forEach(function(f){
      var e=errors[f.dataset.key];f.classList.toggle('bad',!!e);f.querySelector('.e').textContent=e||'';
    });
  }

  function save(status,then){
    if(busy)return;busy=true;drawActions();say('Saving...');
    errors={};showErrors();
    var payload=Object.assign({},job,{status:status});
    api('save',{job:payload}).then(function(d){
      busy=false;
      if(d._status===401){login('Your session ended. Sign in again.');return;}
      if(!d.ok){
        errors=d.errors||{};showErrors();drawActions();
        say(d.errors?'Fix the highlighted fields.':(d.error||'Couldn’t save.'),'err');
        var bad=app.querySelector('.fld.bad');if(bad)bad.scrollIntoView({block:'center',behavior:'smooth'});
        return;
      }
      var fresh=!job.id;
      Object.assign(job,d.job);state.dirty=false;
      if(fresh)state.jobs.push(job);
      else state.jobs=state.jobs.map(function(j){return j.id===job.id?job:j;});
      drawActions();drawUrl();
      say(status==='Open'?'Live. Changes can take a minute or two to appear.':'Saved.','good');
      if(then)then();
    }).catch(function(){busy=false;drawActions();say('Couldn’t connect. Your changes aren’t saved yet.','err');});
  }

  function preview(){
    var tab=window.open('about:blank','_blank');
    var go=function(){if(tab)tab.location.href='/careers/'+job.slug+'?preview=1';};
    if(job.id&&!state.dirty){go();return;}
    save(job.status,go);
  }

  function drawActions(){
    acts.textContent='';
    var s=job.status,add=function(cls,text,fn){acts.appendChild(h('button.btn.'+cls,{type:'button',disabled:busy,onclick:fn},text));};
    if(job.id&&!Number(job.applications)){
      add('btn-danger',deleteArmed?'Confirm delete':'Delete',function(){
        if(!deleteArmed){deleteArmed=true;drawActions();return;}
        busy=true;drawActions();say('Deleting...');
        api('delete',{id:job.id}).then(function(d){
          busy=false;deleteArmed=false;
          if(d.ok){load();return;}
          drawActions();say(d.error||'Couldn’t delete.','err');
        }).catch(function(){busy=false;deleteArmed=false;drawActions();say('Couldn’t connect. Try again.','err');});
      });
    }
    add('btn-line','Preview',preview);
    if(s==='Open'){
      add('btn-line','Close role',function(){save('Closed',function(){job.status='Closed';drawActions();drawUrl();});});
      add('btn-blue','Save changes',function(){save('Open');});
    }else{
      add('btn-line',s==='Closed'?'Save':'Save draft',function(){save(s);});
      add('btn-blue',s==='Closed'?'Reopen':'Publish',function(){save('Open',function(){job.status='Open';drawActions();drawUrl();});});
    }
  }

  var urlRow=h('p.url');
  function drawUrl(){
    urlRow.textContent='';
    if(job.slug&&job.status==='Open'){var u=location.origin+'/careers/'+job.slug;urlRow.appendChild(h('a',{href:u,target:'_blank',rel:'noopener'},u));}
    else urlRow.textContent=job.slug?'Status: '+job.status+'. Only you can see this listing in preview.':'';
    if(job.slug&&job.status==='Closed')urlRow.textContent='Status: Closed. The link stays up and says the role is closed.';
  }

  var back=h('button.a-link',{type:'button',onclick:function(){
    if(state.dirty&&!discardArmed){discardArmed=true;back.textContent='Discard changes?';return;}
    load();
  }},'← All listings');

  var dupe=job.id?h('button.a-link',{type:'button',onclick:function(){
    var c=JSON.parse(JSON.stringify(job));
    ['id','slug','apply_tab','created_at','updated_at','published_at','applications','_row'].forEach(function(k){delete c[k];});
    c.status='Draft';c.title=c.title+' (copy)';
    edit(c);state.dirty=true;
  }},'Duplicate'):null;

  render(h('div.a-wrap',{},top(),
    h('div.a-head',{},h('div',{},back,h('h1',{style:'margin-top:12px'},job.id?job.title:'New listing'),urlRow),dupe),
    h('div.ed',{},
      h('section.card',{},h('h2',{},'Role'),
        h('div.fields',{},
          field('title','Job title',{wide:true}),
          field('location','Location',{placeholder:'Karachi, Pakistan'}),
          field('salary','Salary',{optional:true,placeholder:'Leave blank to hide it'}),
          field('work_type','Work setup',{choices:['','Remote','Hybrid','On-site']}),
          field('employment_type','Type',{choices:['','Full-time','Part-time','Contract']}))),
      h('section.card',{},h('h2',{},'Job post'),h('p',{},'One bullet per line.'),
        h('div.fields',{},
          field('intro','Introduction',{wide:true,area:true,rows:4}),
          field('responsibilities','What you’ll do',{wide:true,area:true}),
          field('requirements','What you need',{wide:true,area:true}),
          field('nice_to_have','Nice to have',{wide:true,area:true,optional:true})))),
    h('div.bar',{},h('div.bar-in',{},msg,acts))));
  showErrors();drawActions();drawUrl();
  if(state.dirty)say('Unsaved changes');
}

window.addEventListener('beforeunload',function(e){if(state.dirty){e.preventDefault();e.returnValue='';}});
load();
})();
