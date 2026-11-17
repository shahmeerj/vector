/* /style-prediction-model: upload EGO designs and score them with the before-launch model.
   The model ships encrypted (/data/style-model.enc). The password unlocks it in the browser
   (PBKDF2-SHA256 600k -> AES-256-GCM); everything, images included, stays on this device. */
(function(){
"use strict";
var app=document.getElementById('app');
var S={meta:null,designs:[],drop:{launch_date:'',sale:'auto',other_styles:0},results:null,context:null,busy:false,msg:'',msgType:''};
var seq=0;

/* ---------- helpers ---------- */
function h(sel,attrs){
  var p=sel.split('.'),el=document.createElement(p[0]||'div');
  if(p.length>1)el.className=p.slice(1).join(' ');
  Object.keys(attrs||{}).forEach(function(k){
    var v=attrs[k];
    if(k.slice(0,2)==='on')el.addEventListener(k.slice(2),v);
    else if(k==='value')el.value=v;
    else if(k==='checked'||k==='disabled'||k==='selected'||k==='multiple')el[k]=!!v;
    else if(k==='style'&&typeof v==='object')Object.assign(el.style,v);
    else if(v!=null)el.setAttribute(k,v);
  });
  [].slice.call(arguments,2).forEach(function(c){
    if(c==null||c===false)return;
    (Array.isArray(c)?c:[c]).forEach(function(n){if(n!=null&&n!==false)el.appendChild(typeof n==='string'||typeof n==='number'?document.createTextNode(String(n)):n);});
  });
  return el;
}
var scorer=null;
var KEY_SLOT='vx_sp_key';
function b64(buf){return btoa(String.fromCharCode.apply(null,new Uint8Array(buf)));}
function unb64(s){return Uint8Array.from(atob(s),function(c){return c.charCodeAt(0);});}
var blobPromise=null;
function getBlob(){
  if(!blobPromise)blobPromise=fetch('/data/style-model.enc',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('fetch');return r.arrayBuffer();}).catch(function(e){blobPromise=null;throw e;});
  return blobPromise;
}
function deriveKey(password,salt){
  return crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']).then(function(base){
    return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:600000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},true,['decrypt']);
  });
}
/* resolves with true when unlocked, false for a wrong password; rejects if the file can't be loaded */
function unlock(password,rawKey){
  return getBlob().then(function(buf){
    var u=new Uint8Array(buf);
    if(String.fromCharCode(u[0],u[1],u[2],u[3])!=='VSM1')throw new Error('format');
    var salt=u.slice(4,20),iv=u.slice(20,32),ct=u.slice(32);
    var keyP=rawKey?crypto.subtle.importKey('raw',unb64(rawKey),{name:'AES-GCM'},true,['decrypt']):deriveKey(password,salt);
    return keyP.then(function(key){
      return crypto.subtle.decrypt({name:'AES-GCM',iv:iv},key,ct).then(function(plain){
        var stream=new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'));
        return new Response(stream).text().then(function(txt){
          scorer=window.StylePredict.create(JSON.parse(txt));
          return crypto.subtle.exportKey('raw',key).then(function(k){try{sessionStorage.setItem(KEY_SLOT,b64(k));}catch(e){}return true;});
        });
      },function(){return false;});
    });
  });
}
function lock(){scorer=null;try{sessionStorage.removeItem(KEY_SLOT);}catch(e){}}
function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem('vx_sp_'+k)||'null');localStorage.setItem('vx_sp_'+k,JSON.stringify(v));}catch(e){return null;}}
var fmt=function(n){return Math.round(n).toLocaleString('en-US');};
var LABEL={na:'Not set',RTW:'RTW',UNSTITCHED:'Unstitched','LITTLE EGO':'Little EGO',VALUE:'Value',SOUL:'Soul',PREMIUM:'Premium',Core:'Core',Bottoms:'Bottoms',
  digital_print:'Digital print',embroidered:'Embroidered',screen_print:'Screen print',solid:'Solid / plain',other:'Other',print:'Print (other)',
  SUMMER:'Summer',SPRING:'Spring',FALL:'Fall',WINTER:'Winter','STRAIGHT CUT':'Straight','LOOSE CUT':'Loose','A-LINE CUT':'A-line',
  '1':'1 piece','2':'2 piece','3':'3 piece','':'None',
  auto:'Auto (last year’s sale calendar)',none:'No sale',normal:'Typical clearance sale',heavy:'Big sale (e.g. 11.11, EOSS)'};
function lab(v){if(LABEL[v])return LABEL[v];return String(v).toLowerCase().replace(/(^|\s)\S/g,function(c){return c.toUpperCase();});}
var COLLECTIONS=['diva','casuals','signature','everyday','luxury','festive','pulse','loud'];
var CITY_COLS=[['karachi','Karachi'],['lahore','Lahore'],['islamabad','Islamabad'],['rawalpindi','Rawalpindi']];

/* ---------- colour detection (runs on the image in the browser) ---------- */
var PALETTE={BLACK:[22,22,24],CREAM:[240,229,200],WHITE:[246,246,244],PINK:[236,150,180],GREEN:[60,140,80],YELLOW:[240,210,60],'SKY BLUE':[135,195,235],
  'OFF WHITE':[234,230,218],MAROON:[110,25,40],BLUE:[40,90,190],BEIGE:[214,194,160],NAVY:[25,35,80],LILAC:[200,165,210],'MINT GREEN':[165,220,190],
  PURPLE:[110,50,140],ORANGE:[235,120,40],MUSTARD:[205,160,40],RED:[200,30,40],MAGENTA:[200,40,130],PEACH:[245,190,160],BROWN:[120,75,45],
  RUST:[170,80,40],GREY:[140,140,140],TEAL:[20,120,125],'SEA GREEN':[60,160,130],LAVENDER:[190,180,225],CORAL:[245,120,100]};
function lab3(c){
  var r=c[0]/255,g=c[1]/255,b=c[2]/255;
  var f=function(v){return v>0.04045?Math.pow((v+0.055)/1.055,2.4):v/12.92;};
  r=f(r);g=f(g);b=f(b);
  var x=(r*0.4124+g*0.3576+b*0.1805)/0.95047,y=r*0.2126+g*0.7152+b*0.0722,z=(r*0.0193+g*0.1192+b*0.9505)/1.08883;
  var t=function(v){return v>0.008856?Math.cbrt(v):7.787*v+16/116;};
  x=t(x);y=t(y);z=t(z);
  return[116*y-16,500*(x-y),200*(y-z)];
}
function nearest(rgb,allowed){
  var L=lab3(rgb),best=null,bd=1e9;
  Object.keys(PALETTE).forEach(function(k){
    if(allowed.indexOf(k)<0)return;
    var P=lab3(PALETTE[k]),d=Math.pow(L[0]-P[0],2)+Math.pow(L[1]-P[1],2)+Math.pow(L[2]-P[2],2);
    if(d<bd){bd=d;best=k;}
  });
  return best;
}
function detectColour(img){
  try{
    var W=80,Hh=100,c=document.createElement('canvas');c.width=W;c.height=Hh;
    var x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,W,Hh);
    var d=x.getImageData(0,0,W,Hh).data;
    // background = average of the outer border
    var bg=[0,0,0],n=0;
    for(var yy=0;yy<Hh;yy++)for(var xx=0;xx<W;xx++){
      if(xx>2&&xx<W-3&&yy>2&&yy<Hh-3)continue;
      var i=(yy*W+xx)*4;bg[0]+=d[i];bg[1]+=d[i+1];bg[2]+=d[i+2];n++;
    }
    bg=bg.map(function(v){return v/n;});
    var bins={};
    for(yy=Math.floor(Hh*0.2);yy<Math.floor(Hh*0.85);yy++)for(xx=Math.floor(W*0.2);xx<Math.floor(W*0.8);xx++){
      i=(yy*W+xx)*4;var r=d[i],g=d[i+1],b=d[i+2];
      if(Math.abs(r-bg[0])+Math.abs(g-bg[1])+Math.abs(b-bg[2])<45)continue;
      var k=(r>>4)+'-'+(g>>4)+'-'+(b>>4);
      var e=bins[k]||(bins[k]={n:0,r:0,g:0,b:0});e.n++;e.r+=r;e.g+=g;e.b+=b;
    }
    var top=null;Object.keys(bins).forEach(function(k){if(!top||bins[k].n>top.n)top=bins[k];});
    if(!top)return null;
    return nearest([top.r/top.n,top.g/top.n,top.b/top.n],S.meta.options.colour);
  }catch(e){return null;}
}

/* ---------- sign-in ---------- */
function login(message){
  var pw=h('input',{type:'password',id:'pw',autocomplete:'current-password',required:true});
  var err=h('span.e',{},message||'');
  var btn=h('button.btn.btn-blue',{type:'submit'},'Sign in');
  app.textContent='';
  app.appendChild(h('form.login',{onsubmit:function(e){
    e.preventDefault();btn.disabled=true;err.textContent='';
    btn.textContent='Unlocking…';
    unlock(pw.value).then(function(ok){btn.disabled=false;btn.textContent='Sign in';if(ok){boot();return;}err.textContent='Wrong password.';pw.select();})
      .catch(function(){btn.disabled=false;btn.textContent='Sign in';err.textContent='Couldn’t load the model. Check your connection and try again.';});
  }},h('h1',{},'Style prediction'),h('p.sp-sub',{style:{marginBottom:'20px'}},'Enter the style prediction password. The model unlocks in your browser.'),
    h('div.fld',{},h('label',{for:'pw'},'Password'),pw,err),btn));
  pw.focus();
}

/* ---------- designs ---------- */
var DEFAULTS={line:'UNSTITCHED',pieces:'3',fabric:'na',technique:'digital_print',cut:'na',season_tag:'na',price:'',collection:'',eid:false};
function nameFromFile(f){
  return f.name.replace(/\.[a-z0-9]+$/i,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60);
}
function addFiles(files){
  var list=[].slice.call(files||[]).filter(function(f){return /^image\//.test(f.type);});
  if(!list.length){setMsg('Choose image files (JPG, PNG or WebP).','err');return;}
  var room=60-S.designs.length;
  if(list.length>room){setMsg('Up to 60 designs at a time. Added the first '+room+'.','err');list=list.slice(0,room);}
  var batch=store('batch')||{};
  list.forEach(function(f){
    var d=Object.assign({},DEFAULTS,batch,{id:'d'+(++seq),url:URL.createObjectURL(f),file:f.name,design:nameFromFile(f),colour:'na',colourAuto:false});
    S.designs.push(d);
    var img=new Image();
    img.onload=function(){var c=detectColour(img);if(c&&!d.colourTouched){d.colour=c;d.colourAuto=true;renderDesigns();}};
    img.src=d.url;
  });
  S.results=null;
  render();
}
function removeDesign(id){
  var i=S.designs.findIndex(function(d){return d.id===id;});
  if(i>=0){URL.revokeObjectURL(S.designs[i].url);S.designs.splice(i,1);}
  S.results=null;render();
}
function sel(opts,value,onchange,id){
  return h('select',{id:id,onchange:function(e){onchange(e.target.value);}},opts.map(function(o){return h('option',{value:o,selected:String(o)===String(value)},lab(o));}));
}
function swatch(c){var p=PALETTE[c];return p?h('span.sw',{style:{background:'rgb('+p.join(',')+')'}}):null;}

function designCard(d,i){
  var o=S.meta.options,upd=function(k){return function(v){d[k]=v;S.results=null;markStale();};};
  return h('div.dz'+(d.bad?'.bad':''),{},
    h('div.dz-img',{},h('img',{src:d.url,alt:d.design}),h('span.dz-n',{},String(i+1)),
      h('button.dz-x',{type:'button',title:'Remove','aria-label':'Remove '+d.design,onclick:function(){removeDesign(d.id);}},'×')),
    h('div.dz-body',{},
      h('div.fld.wide',{},h('label',{},'Design name'),h('input',{type:'text',value:d.design,oninput:function(e){d.design=e.target.value;markStale();}})),
      h('div.fld.wide',{},h('label',{},'Colour',d.colourAuto?h('span.auto',{},'DETECTED · CHECK'):null),
        h('div',{style:{display:'flex',alignItems:'center',gap:'6px'}},swatch(d.colour),
          sel(o.colour,d.colour,function(v){d.colour=v;d.colourAuto=false;d.colourTouched=true;S.results=null;renderDesigns();}))),
      h('div.fld',{},h('label',{},'Line'),sel(o.line,d.line,upd('line'))),
      h('div.fld',{},h('label',{},'Pieces'),sel(o.pieces,d.pieces,upd('pieces'))),
      h('div.fld',{},h('label',{},'Fabric'),sel(o.fabric,d.fabric,upd('fabric'))),
      h('div.fld',{},h('label',{},'Technique'),sel(o.technique,d.technique,upd('technique'))),
      h('div.fld',{},h('label',{},'Cut'),sel(o.cut,d.cut,upd('cut'))),
      h('div.fld',{},h('label',{},'Season'),sel(o.season_tag,d.season_tag,upd('season_tag'))),
      h('div.fld',{},h('label',{},'Price (Rs)'),h('input',{type:'number',min:'0',step:'10',value:d.price,inputmode:'numeric',oninput:function(e){d.price=e.target.value;d.bad=false;markStale();}})),
      h('div.fld',{},h('label',{},'Collection'),sel([''].concat(COLLECTIONS),d.collection,upd('collection'))),
      h('label.chk',{},h('input',{type:'checkbox',checked:d.eid,onchange:function(e){d.eid=e.target.checked;markStale();}}),'Eid collection')));
}

var designsBox,resultsBox,barMsg,barBtn;
function renderDesigns(){
  if(!designsBox)return;
  designsBox.textContent='';
  S.designs.forEach(function(d,i){designsBox.appendChild(designCard(d,i));});
  updateBar();
}
function markStale(){if(resultsBox&&S.results===null&&resultsBox.firstChild){resultsBox.textContent='';}updateBar();}

/* ---------- apply to all ---------- */
function applyAllBox(){
  var o=S.meta.options,v={line:'',pieces:'',fabric:'',technique:'',season_tag:'',price:''};
  var ph=function(opts){return[''].concat(opts);};
  var s=function(k,opts){return h('select',{onchange:function(e){v[k]=e.target.value;}},ph(opts).map(function(x){return h('option',{value:x},x===''?'—':lab(x));}));};
  return h('div.applyall',{},h('h3',{},'Same for every design? Set it once'),
    h('div.fields.six',{},
      h('div.fld',{},h('label',{},'Line'),s('line',o.line)),
      h('div.fld',{},h('label',{},'Pieces'),s('pieces',o.pieces)),
      h('div.fld',{},h('label',{},'Fabric'),s('fabric',o.fabric)),
      h('div.fld',{},h('label',{},'Technique'),s('technique',o.technique)),
      h('div.fld',{},h('label',{},'Season'),s('season_tag',o.season_tag)),
      h('div.fld',{},h('label',{},'Price (Rs)'),h('input',{type:'number',min:'0',step:'10',inputmode:'numeric',oninput:function(e){v.price=e.target.value;}}))),
    h('div.row',{},h('button.btn.btn-line',{type:'button',onclick:function(){
      var set={};Object.keys(v).forEach(function(k){if(v[k]!=='')set[k]=v[k];});
      if(!Object.keys(set).length){setMsg('Pick at least one value to apply.','err');return;}
      S.designs.forEach(function(d){Object.assign(d,set);d.bad=false;});
      store('batch',Object.assign(store('batch')||{},set));
      S.results=null;renderDesigns();markStale();setMsg('Applied to '+S.designs.length+' design'+(S.designs.length===1?'':'s')+'.','good');
    }},'Apply to all designs')));
}

/* ---------- predict ---------- */
function predict(){
  if(!S.designs.length){setMsg('Add at least one design.','err');return;}
  var missing=S.designs.filter(function(d){return !(Number(d.price)>0);});
  if(missing.length){missing.forEach(function(d){d.bad=true;});renderDesigns();setMsg('Add a price for '+missing.length+' design'+(missing.length===1?'':'s')+' (outlined in red).','err');return;}
  if(!S.drop.launch_date){setMsg('Set the launch date.','err');return;}
  S.busy=true;updateBar();setMsg('Scoring '+S.designs.length+' designs…','');
  var payload={launch_date:S.drop.launch_date,sale:S.drop.sale,other_styles:S.drop.other_styles,
    styles:S.designs.map(function(d){return{id:d.id,design:d.design,line:d.line,pieces:d.pieces,fabric:d.fabric,technique:d.technique,cut:d.cut,
      season_tag:d.season_tag,colour:d.colour,price:Number(d.price),labels:d.collection?[d.collection]:[],eid:d.eid};})};
  setTimeout(function(){
    S.busy=false;
    if(!scorer){login('Sign in again to continue.');return;}
    try{var r=scorer.predictBatch(payload);}catch(e){setMsg('Couldn’t score these designs. Check the details and try again.','err');updateBar();return;}
    S.results=r.results;S.context=r.context;setMsg('Done. Results below.','good');renderResults();updateBar();
    resultsBox.scrollIntoView({behavior:'smooth',block:'start'});
  },30);
}

function cityUnits(r,key){var c=r.city.find(function(x){return x.city===key;});return c?c.units:0;}
function restUnits(r){var big=CITY_COLS.map(function(c){return c[0];});return r.city.filter(function(x){return big.indexOf(x.city)<0;}).reduce(function(a,x){return a+x.units;},0);}

function renderResults(){
  resultsBox.textContent='';
  if(!S.results)return;
  var byId={};S.designs.forEach(function(d){byId[d.id]=d;});
  var rows=S.results.slice().sort(function(a,b){return a.rank-b.rank;});
  var n=rows.length,maxHi=Math.max.apply(null,rows.map(function(r){return r.high;}).concat([1]));
  var tot={likely:0,low:0,high:0};rows.forEach(function(r){tot.likely+=r.likely;tot.low+=r.low;tot.high+=r.high;});
  var ctx=S.context,basis={actual:'actual sales',last_year:'the same weeks last year, adjusted for this year’s demand',latest:'the last 28 days'}[ctx.store_basis];
  var k20=Math.max(1,Math.round(n*0.2));
  var trs=rows.map(function(r){
    var d=byId[r.id]||{};
    var tag=n>=5?(r.rank<=k20?h('span.tag.top',{},'Top 20%'):(r.rank>n-k20?h('span.tag.low',{},'Bottom 20%'):null)):null;
    return h('tr',{},
      h('td.num',{},String(r.rank)),
      h('td',{},h('img.thumb',{src:d.url,alt:''})),
      h('td',{},h('div.nm',{},d.design||'Design'),h('div.meta',{},[lab(d.line),lab(d.pieces),d.fabric!=='na'?lab(d.fabric):null,lab(d.colour),'Rs '+fmt(d.price)].filter(Boolean).join(' · ')+(r.colourways>1?' · '+r.colourways+' colourways':''))),
      h('td.num',{},h('b',{},fmt(r.likely))),
      h('td',{},h('div.rng',{},h('i',{style:{left:(r.low/maxHi*100)+'%',width:Math.max(1,(r.high-r.low)/maxHi*100)+'%'}}),h('b',{style:{left:'calc('+(r.likely/maxHi*100)+'% - 1px)'}})),
        h('div.rng-l',{},fmt(r.low)+'–'+fmt(r.high))),
      h('td',{},tag),
      CITY_COLS.map(function(c){return h('td.num',{},fmt(cityUnits(r,c[0])));}),
      h('td.num',{},fmt(restUnits(r))));
  });
  var totCity=CITY_COLS.map(function(c){return rows.reduce(function(a,r){return a+cityUnits(r,c[0]);},0);});
  var totRest=rows.reduce(function(a,r){return a+restUnits(r);},0);
  trs.push(h('tr',{},h('td',{}),h('td',{}),h('td',{},h('b',{},'Total')),h('td.num',{},h('b',{},fmt(tot.likely))),h('td.meta',{},'Sum of ranges: '+fmt(tot.low)+'–'+fmt(tot.high)),h('td',{}),
    totCity.map(function(v){return h('td.num',{},h('b',{},fmt(v)));}),h('td.num',{},h('b',{},fmt(totRest)))));
  resultsBox.appendChild(h('div.card',{id:'results'},
    h('h2',{},'Predicted online units, first 30 days'),
    h('div.res-sum',{},
      h('span',{},'Launch ',h('b',{},new Date(ctx.launch_date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}))),
      h('span',{},'Styles in the drop ',h('b',{},String(ctx.drop_size))),
      h('span',{},'Store demand assumed ',h('b',{},fmt(ctx.store_units_prior28)+' units'),' in the 28 days before, from '+basis),
      h('span',{},'Sale intensity ',h('b',{},Math.round(ctx.sale_markdown*100)+'% average markdown'))),
    h('div.tbl-wrap',{},h('table.res',{},
      h('thead',{},h('tr',{},h('th.num',{},'#'),h('th',{}),h('th',{},'Design'),h('th.num',{},'Likely'),h('th',{},'80% range'),h('th',{}),
        CITY_COLS.map(function(c){return h('th.num',{},c[1]);}),h('th.num',{},'Rest of Pakistan'))),
      h('tbody',{},trs))),
    h('p.hint',{},'Likely = the model’s central estimate. 8 in 10 styles landed inside the range in testing. Ranks and the top/bottom 20% tags compare designs within this drop. City columns split the likely figure using how each line has sold by city since May 2025.'),
    h('div.res-acts',{},h('button.btn.btn-line',{type:'button',onclick:downloadCsv},'Download CSV'))));
}

function downloadCsv(){
  var byId={};S.designs.forEach(function(d){byId[d.id]=d;});
  var cities=S.meta.cities;
  var head=['rank','design','file','line','pieces','fabric','technique','cut','season','colour','price_rs','likely_units_30d','low_80','high_80'].concat(cities.map(function(c){return c+'_units';}));
  var lines=[head.join(',')];
  S.results.slice().sort(function(a,b){return a.rank-b.rank;}).forEach(function(r){
    var d=byId[r.id];
    var row=[r.rank,d.design,d.file,d.line,d.pieces,d.fabric,d.technique,d.cut,d.season_tag,d.colour,d.price,Math.round(r.likely),Math.round(r.low),Math.round(r.high)]
      .concat(cities.map(function(c){return Math.round(cityUnits(r,c));}));
    lines.push(row.map(function(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(','));
  });
  var a=h('a',{href:URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv'})),download:'ego-style-predictions-'+S.drop.launch_date+'.csv'});
  document.body.appendChild(a);a.click();a.remove();
}

/* ---------- bar ---------- */
function setMsg(t,type){S.msg=t;S.msgType=type||'';if(barMsg){barMsg.textContent=t;barMsg.className='bar-msg'+(type?' '+type:'');}}
function updateBar(){
  if(!barBtn)return;
  var n=S.designs.length;
  barBtn.disabled=S.busy||!n;
  barBtn.textContent=S.busy?'Scoring…':(n?'Predict '+n+' design'+(n===1?'':'s'):'Predict');
}

/* ---------- page ---------- */
function nextMonday(){var d=new Date();d.setDate(d.getDate()+((8-d.getDay())%7||7));return d.toISOString().slice(0,10);}

function render(){
  var m=S.meta,v=m.validation;
  app.textContent='';
  var fileIn=h('input',{type:'file',accept:'image/*',multiple:true,onchange:function(e){addFiles(e.target.files);e.target.value='';}});
  var drop=h('label.drop',{
    ondragover:function(e){e.preventDefault();drop.classList.add('over');},
    ondragleave:function(){drop.classList.remove('over');},
    ondrop:function(e){e.preventDefault();drop.classList.remove('over');addFiles(e.dataTransfer.files);}},
    fileIn,h('strong',{},'Drop design images here, or click to choose'),h('span',{},'Several at once, up to 60. Images stay in your browser and are only used to read the main colour.'));
  designsBox=h('div.designs');
  resultsBox=h('div');
  barMsg=h('div.bar-msg'+(S.msgType?'.'+S.msgType:''),{},S.msg);
  barBtn=h('button.btn.btn-blue',{type:'button',onclick:predict});
  var d=S.drop;
  app.appendChild(h('div.a-wrap.sp',{},
    h('div.a-top',{},h('span.a-brand',{},'Vector · EGO'),
      h('nav',{},h('button.a-link',{type:'button',onclick:function(){lock();login();}},'Sign out'))),
    h('div.a-head',{},h('div',{},h('h1',{},'Style sales prediction'),
      h('p.sp-sub',{},'Upload a drop’s designs and get each one’s predicted online units for its first 30 days, a likely range, its rank in the drop and a split by city.'))),
    h('div.card',{},h('h2',{},'Drop'),h('p',{},'Applies to every design in this batch.'),
      h('div.fields.three',{},
        h('div.fld',{},h('label',{for:'ld'},'Launch date'),h('input',{type:'date',id:'ld',value:d.launch_date,onchange:function(e){d.launch_date=e.target.value;store('drop',d);S.results=null;markStale();}})),
        h('div.fld',{},h('label',{for:'sale'},'Sale running in the first 30 days'),
          sel(['auto','none','normal','heavy'],d.sale,function(val){d.sale=val;store('drop',d);S.results=null;markStale();},'sale')),
        h('div.fld',{},h('label',{for:'oth'},'Other styles launching that week'),
          h('input',{type:'number',id:'oth',min:'0',max:'500',value:d.other_styles,oninput:function(e){d.other_styles=Number(e.target.value)||0;store('drop',d);S.results=null;markStale();}}))),
      h('p.hint',{},'“Auto” uses EGO’s sale calendar for the same weeks last year. Designs with the same name are treated as colourways of one design.')),
    h('div.card',{},h('h2',{},'Designs'),drop,S.designs.length?applyAllBox():null,designsBox),
    resultsBox,
    h('details.trust.card',{},h('summary',{},'How far to trust these numbers'),
      h('ul',{},
        h('li',{},'Tested on ',h('b',{},fmt(v.styles)+' EGO styles across '+v.seasons+' seasons'),' (2023–2026), each predicted using only data from before it.'),
        h('li',{},h('b',{},'Ranking is the strong part.'),' Rank correlation '+v.rank.toFixed(2)+'; '+Math.round(v.top20*100)+'% of predicted top-20% styles were real top-20% sellers (random picking would get 20%). EGO’s own buy quantities scored 0.40 on the same test.'),
        h('li',{},h('b',{},'Unit numbers are rough.'),' Average error '+Math.round(v.wape*100)+'%. '+Math.round(v.coverage80*100)+'% of styles landed inside the 80% range.'),
        h('li',{},h('b',{},'It can’t judge the print itself.'),' It knows which lines, fabrics, techniques, price points and colours sell, but within a line (unstitched especially) it can’t tell a winning print from a weak one. The image is only used to read the colour.'),
        h('li',{},h('b',{},'Online only.'),' Shopify online store and app sales; physical stores aren’t included. City split error: about '+m.city_validation.style_mae_pts.toFixed(1)+' share points per city per style.'),
        h('li',{},'Model trained on '+fmt(m.trained_on)+' styles, data to '+m.version+'. Use it to shortlist and size lines; make reorder calls on real sales after launch.'))),
    h('div.bar',{},h('div.bar-in',{style:{maxWidth:'1180px'}},barMsg,h('div.bar-acts',{},barBtn)))));
  renderDesigns();
  renderResults();
  updateBar();
}

function boot(){
  if(!scorer){
    var k=null;try{k=sessionStorage.getItem(KEY_SLOT);}catch(e){}
    if(!k){login();return;}
    app.textContent='';app.appendChild(h('div.login',{},h('p.sp-sub',{},'Loading…')));
    unlock(null,k).then(function(ok){if(ok)boot();else{lock();login();}}).catch(function(){login('Couldn’t load the model. Reload to try again.');});
    return;
  }
  S.meta=scorer.meta();
  var saved=store('drop');if(saved)Object.assign(S.drop,saved);
  if(!S.drop.launch_date||S.drop.launch_date<new Date().toISOString().slice(0,10))S.drop.launch_date=nextMonday();
  render();
}
boot();
})();
