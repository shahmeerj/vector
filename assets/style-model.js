/* /style-prediction-model: rate a design 0-100, explain why, and predict units by city.
   The sales model ships encrypted (/data/style-model.enc); the password unlocks it in the
   browser (PBKDF2-SHA256 600k -> AES-256-GCM) and predictions run on this device.
   /api/style-rate reads product links and asks Claude to review the image. */
(function(){
"use strict";
var app=document.getElementById('app');
var S={meta:null,items:[],drop:{launch_date:'',sale:'auto'},busy:false};
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
  '1':'1 piece','2':'2 piece','3':'3 piece','':'Choose…',
  auto:'Auto (last year’s sale calendar)',none:'No sale',normal:'Typical clearance sale',heavy:'Big sale (e.g. 11.11, EOSS)'};
function lab(v){if(LABEL[v])return LABEL[v];return String(v).toLowerCase().replace(/(^|\s)\S/g,function(c){return c.toUpperCase();});}

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
  }},h('h1',{},'Style prediction'),h('p.sp-sub',{style:{marginBottom:'20px'}},'Enter the style prediction password.'),
    h('div.fld',{},h('label',{for:'pw'},'Password'),pw,err),btn));
  pw.focus();
}

/* ---------- reading a design (link, images, description) ---------- */
function sel(opts,value,onchange,id){
  return h('select',{id:id,onchange:function(e){onchange(e.target.value);}},opts.map(function(o){return h('option',{value:o,selected:String(o)===String(value)},lab(o));}));
}
function shrink(file){
  return new Promise(function(resolve,reject){
    var url=URL.createObjectURL(file),img=new Image();
    img.onload=function(){
      var m=Math.max(img.width,img.height),k=m>1024?1024/m:1,c=document.createElement('canvas');
      c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      var data=c.toDataURL('image/jpeg',0.85);
      resolve({url:url,colour:detectColour(img),image:{media_type:'image/jpeg',data:data.slice(data.indexOf(',')+1)}});
    };
    img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('image'));};
    img.src=url;
  });
}
function readDesign(payload){
  var key='';try{key=sessionStorage.getItem(KEY_SLOT)||'';}catch(e){}
  return fetch('/api/style-rate',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Style-Key':key},body:JSON.stringify(payload)})
    .then(function(r){return r.json().catch(function(){return{ok:false,error:'Something went wrong. Try again.'};}).then(function(d){d._status=r.status;return d;});});
}

/* ---------- scoring ---------- */
var BAND=[[3000,'<3k','under Rs 3,000'],[4500,'3-4.5k','Rs 3,000–4,500'],[6000,'4.5-6k','Rs 4,500–6,000'],[8000,'6-8k','Rs 6,000–8,000'],[11000,'8-11k','Rs 8,000–11,000'],[Infinity,'11k+','above Rs 11,000']];
function band(price){for(var i=0;i<BAND.length;i++)if(price<=BAND[i][0])return BAND[i];return BAND[BAND.length-1];}
function salesReasons(a){
  var ix=S.meta.index||{},out=[];
  var add=function(attr,key,name,plural){
    var v=(ix[attr]||{})[key];
    if(v==null||key==='na'||key==='other')return;
    if(v>=125)out.push({good:true,w:v/100,text:name+(plural?' sell':' sells')+' well for EGO: '+(v/100).toFixed(1)+'x the typical style’s first-month sales.'});
    else if(v<=75)out.push({good:false,w:100/Math.max(v,1),text:name+(plural?' have':' has')+' been weak for EGO: '+(100-v)+'% below the typical style’s first-month sales.'});
  };
  add('line',a.line,'The '+lab(a.line)+' line');
  add('pieces',a.pieces,lab(a.pieces).replace(' piece','-piece')+' styles',true);
  add('technique',a.technique,lab(a.technique)+' styles',true);
  add('fabric',a.fabric,lab(a.fabric));
  add('colour',a.colour,lab(a.colour));
  add('season_tag',a.season_tag,lab(a.season_tag)+' styles',true);
  if(Number(a.price)>0){var b=band(Number(a.price));add('price_band',b[1],'Styles priced '+b[2],true);}
  out.sort(function(x,y){return y.w-x.w;});
  return{good:out.filter(function(r){return r.good;}).slice(0,3),bad:out.filter(function(r){return !r.good;}).slice(0,3)};
}
function missing(it){var m=[];if(!it.attrs.line)m.push('line');if(!(Number(it.attrs.price)>0))m.push('price');return m;}
function score(it){
  it.result=null;
  if(missing(it).length)return;
  var a=it.attrs;
  try{
    var r=scorer.predictBatch({single:true,launch_date:S.drop.launch_date,sale:S.drop.sale,styles:[{id:it.id,design:it.name,line:a.line,pieces:a.pieces,fabric:a.fabric,
      technique:a.technique,cut:a.cut,season_tag:a.season_tag,colour:a.colour,price:Number(a.price),labels:a.collection?[a.collection]:[],eid:!!a.eid}]});
    it.result=r.results[0];it.context=r.context;
  }catch(e){it.result=null;}
}
/* sales score compares the design with other styles in its own line, so a strong line doesn't make every design look good */
function salesScore(it){var sc=it.result&&it.result.score;if(!sc)return null;return sc.line!=null?sc.line:sc.all;}
function rating(it){
  var s=salesScore(it);
  if(s==null)return null;
  return it.ai?Math.round((s+it.ai.design_score)/2):s;
}
function grade(n){return n>=70?['Strong','good']:n>=45?['Average','mid']:['Weak','bad'];}

var DEFAULTS={line:'',pieces:'na',fabric:'na',technique:'other',cut:'na',season_tag:'na',colour:'na',price:'',collection:'',eid:false};
function buildItem(resp,local,desc){
  var src=resp.source||{},ai=resp.ai,a=Object.assign({},DEFAULTS);
  var put=function(o){Object.keys(o||{}).forEach(function(k){var v=o[k];if(k in a&&v!=null&&v!==''&&v!=='unknown')a[k]=v;});};
  if(ai)put(ai.attrs);
  put(src.attrs); /* details stated on the product page win over what the image suggests */
  if(a.colour==='na'&&local.length&&local[0].colour)a.colour=local[0].colour;
  if(src.price>0)a.price=src.price;else if(ai&&ai.attrs.price>0)a.price=ai.attrs.price;
  var it={id:'d'+(++seq),name:src.title||(ai&&ai.attrs.design)||'Design '+(seq),url:src.url||'',desc:desc,
    imgs:local.map(function(l){return l.url;}).concat(src.images||[]),attrs:a,ai:ai||null,aiError:resp.ai_error,linkError:resp.link_error,open:false};
  score(it);
  it.open=missing(it).length>0;
  return it;
}

/* ---------- form ---------- */
var F={url:'',desc:'',files:[]};
var formBox,listBox,msgEl,goBtn;
function setMsg(t,type){if(msgEl){msgEl.textContent=t||'';msgEl.className='sp-msg'+(type?' '+type:'');}}
function addFiles(files){
  var list=[].slice.call(files||[]).filter(function(f){return /^image\//.test(f.type);});
  if(!list.length){setMsg('Choose image files (JPG, PNG or WebP).','err');return;}
  F.files=F.files.concat(list).slice(0,4);
  renderForm();
}
function submit(){
  var url=F.url.trim(),desc=F.desc.trim();
  if(!url&&!F.files.length&&!desc){setMsg('Add a product link, an image or a description.','err');return;}
  S.busy=true;goBtn.disabled=true;goBtn.textContent='Reading the design…';setMsg('This takes up to 30 seconds.','');
  Promise.all(F.files.map(shrink)).then(function(local){
    return readDesign({url:url,description:desc,images:local.map(function(l){return l.image;})}).then(function(resp){
      S.busy=false;
      if(resp._status===401){lock();login('Sign in again to continue.');return;}
      if(!resp.ok){local.forEach(function(l){URL.revokeObjectURL(l.url);});setMsg(resp.error||'Couldn’t read this design.','err');renderForm(true);return;}
      S.items.unshift(buildItem(resp,local,desc));
      F={url:'',desc:'',files:[]};
      renderForm();renderList();
      setMsg(resp.link_error||'',resp.link_error?'err':'');
      listBox.firstChild&&listBox.firstChild.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }).catch(function(){S.busy=false;setMsg('Couldn’t read this design. Check your connection and try again.','err');renderForm(true);});
}
function renderForm(keepMsg){
  var prev=msgEl?[msgEl.textContent,msgEl.className]:null;
  formBox.textContent='';
  var fileIn=h('input',{type:'file',accept:'image/*',multiple:true,onchange:function(e){addFiles(e.target.files);e.target.value='';}});
  var drop=h('label.drop',{
    ondragover:function(e){e.preventDefault();drop.classList.add('over');},
    ondragleave:function(){drop.classList.remove('over');},
    ondrop:function(e){e.preventDefault();drop.classList.remove('over');addFiles(e.dataTransfer.files);}},
    fileIn,h('strong',{},'Drop images here, or click to choose'),h('span',{},'Up to 4 images of the same design.'));
  var thumbs=F.files.length?h('div.thumbs',{},F.files.map(function(f,i){
    var u=URL.createObjectURL(f);
    return h('div.th',{},h('img',{src:u,alt:f.name,onload:function(){URL.revokeObjectURL(u);}}),
      h('button',{type:'button','aria-label':'Remove '+f.name,onclick:function(){F.files.splice(i,1);renderForm();}},'×'));
  })):null;
  msgEl=h('div.sp-msg');
  if(keepMsg&&prev){msgEl.textContent=prev[0];msgEl.className=prev[1];}
  goBtn=h('button.btn.btn-blue',{type:'submit'},'Rate this design');
  formBox.appendChild(h('form.card',{onsubmit:function(e){e.preventDefault();if(!S.busy)submit();}},
    h('h2',{},'Rate a design'),h('p',{},'Give a product link, images, or both. Add a description for anything the page or image doesn’t show.'),
    h('div.fld',{},h('label',{for:'u'},'Product link'),h('input',{type:'text',id:'u',inputmode:'url',placeholder:'https://wearego.com/products/…',value:F.url,oninput:function(e){F.url=e.target.value;}})),
    h('div.fld',{},h('label',{},'Images'),drop,thumbs),
    h('div.fld',{},h('label',{for:'ds'},'Description (optional)'),h('textarea',{id:'ds',rows:'3',placeholder:'e.g. 3-piece khaddar, digital print, Rs 4,490, winter collection',oninput:function(e){F.desc=e.target.value;}},F.desc)),
    h('div.sp-go',{},msgEl,goBtn)));
}

/* ---------- result cards ---------- */
function cityName(c){return c==='other'?'Rest of Pakistan':lab(c);}
function reasons(title,cls,items){
  if(!items.length)return null;
  return h('div.rs.'+cls,{},h('h4',{},title),h('ul',{},items.map(function(r){return h('li',{},r.text,h('span.src',{},r.src));})));
}
function editor(it){
  var o=S.meta.options,a=it.attrs;
  var upd=function(k){return function(v){a[k]=v;score(it);renderList();};};
  var withNone=function(list){return list.indexOf('na')>=0?list:['na'].concat(list);};
  return h('div.sp-ed',{},
    h('div.fields.four',{},
      h('div.fld',{},h('label',{},'Line'),sel(a.line?o.line:[''].concat(o.line),a.line,upd('line'))),
      h('div.fld',{},h('label',{},'Price (Rs)'),h('input',{type:'number',min:'0',step:'10',inputmode:'numeric',value:a.price,onchange:function(e){a.price=e.target.value;score(it);renderList();}})),
      h('div.fld',{},h('label',{},'Pieces'),sel(withNone(o.pieces),a.pieces,upd('pieces'))),
      h('div.fld',{},h('label',{},'Fabric'),sel(withNone(o.fabric),a.fabric,upd('fabric'))),
      h('div.fld',{},h('label',{},'Technique'),sel(o.technique,a.technique,upd('technique'))),
      h('div.fld',{},h('label',{},'Colour'),sel(withNone(o.colour),a.colour,upd('colour'))),
      h('div.fld',{},h('label',{},'Cut'),sel(withNone(o.cut),a.cut,upd('cut'))),
      h('div.fld',{},h('label',{},'Season'),sel(withNone(o.season_tag),a.season_tag,upd('season_tag')))),
    h('div.fields.four',{style:{marginTop:'12px'}},
      h('div.fld',{},h('label',{},'Launch date'),h('input',{type:'date',value:S.drop.launch_date,onchange:function(e){S.drop.launch_date=e.target.value;store('drop',S.drop);S.items.forEach(score);renderList();}})),
      h('div.fld',{style:{gridColumn:'span 2'}},h('label',{},'Sale running in the first 30 days'),sel(['auto','none','normal','heavy'],S.drop.sale,function(v){S.drop.sale=v;store('drop',S.drop);S.items.forEach(score);renderList();}))),
    h('p.hint',{},'Launch date and sale apply to every design on this page.'));
}
function card(it){
  var r=it.result,need=missing(it),n=rating(it),a=it.attrs;
  var img=it.imgs.length?h('img.ph',{src:it.imgs[0],alt:'',referrerpolicy:'no-referrer'}):h('div.ph.none',{},'No image');
  var meta=[a.line?lab(a.line):null,a.pieces!=='na'?lab(a.pieces):null,a.fabric!=='na'?lab(a.fabric):null,a.technique!=='other'?lab(a.technique):null,a.colour!=='na'?lab(a.colour):null,Number(a.price)>0?'Rs '+fmt(a.price):null].filter(Boolean).join(' · ');
  var head=h('div.rc-head',{},h('div',{},h('h3',{},it.name),h('div.meta',{},meta||'No details yet'),
      it.url?h('a.meta',{href:it.url,target:'_blank',rel:'noopener noreferrer'},'Open product page'):null),
    h('button.a-link',{type:'button',onclick:function(){it.imgs.forEach(function(u){if(/^blob:/.test(u))URL.revokeObjectURL(u);});S.items=S.items.filter(function(x){return x!==it;});renderList();}},'Remove'));
  var body;
  if(need.length){
    body=h('div.need',{},'Add the '+need.join(' and ')+' below to get the rating. '+(need.indexOf('price')>=0?'The price wasn’t on the page or in the description.':''));
  }else if(!r||n==null){
    body=h('div.need',{},'Couldn’t score this design. Check the details below.');
  }else{
    var g=grade(n),sr=salesReasons(a);
    var good=(it.ai?it.ai.likes.map(function(t){return{text:t,src:'Design'};}):[]).concat(sr.good.map(function(x){return{text:x.text,src:'Sales data'};}));
    var bad=(it.ai?it.ai.dislikes.map(function(t){return{text:t,src:'Design'};}):[]).concat(sr.bad.map(function(x){return{text:x.text,src:'Sales data'};}));
    var maxU=Math.max.apply(null,r.city.map(function(c){return c.units;}).concat([1]));
    body=h('div',{},
      h('div.rate',{},
        h('div.dial.'+g[1],{},h('b',{},String(n)),h('span',{},'out of 100')),
        h('div.rate-txt',{},h('div.verdict.'+g[1],{},g[0]),
          it.ai?h('p',{},it.ai.verdict):null,
          h('div.parts',{},h('span',{},'Sales history'+(r.score.line!=null?' (vs other '+lab(a.line)+' styles) ':' '),h('b',{},String(salesScore(it)))),
            it.ai?h('span',{},'Design review ',h('b',{},String(it.ai.design_score))):null,
            r.score.line!=null?h('span',{},'Vs all EGO launches ',h('b',{},String(r.score.all))):null))),
      it.ai?null:h('div.note',{},it.aiError==='not_configured'?'Design review is switched off, so this rating uses sales history only and nothing here judges the look of the design.':'The design review didn’t run this time, so this rating uses sales history only. Remove and rate again to retry.'),
      h('div.cols',{},reasons('What works','good',good),reasons('What doesn’t','bad',bad)),
      h('h4.sp-sec',{},'Expected online units, first 30 days'),
      h('div.units',{},h('b',{},fmt(r.likely)),h('span',{},'likely · range '+fmt(r.low)+'–'+fmt(r.high))),
      h('div.cities',{},r.city.slice().sort(function(x,y){return (x.city==='other')-(y.city==='other')||y.units-x.units;}).map(function(c){return h('div.city',{},h('span.cn',{},cityName(c.city)),h('span.cbar',{},h('i',{style:{width:Math.max(2,c.units/maxU*100)+'%'}})),h('span.cu',{},fmt(c.units)));})));
  }
  var det=h('details.det',{ontoggle:function(e){it.open=e.target.open;}},h('summary',{},'Details used'),editor(it));
  det.open=!!it.open;
  return h('div.card.rc',{},h('div.rc-grid',{},img,h('div',{},head,body,det)));
}
function renderList(){
  listBox.textContent='';
  S.items.forEach(function(it){listBox.appendChild(card(it));});
}

/* ---------- page ---------- */
function nextMonday(){var d=new Date();d.setDate(d.getDate()+((8-d.getDay())%7||7));return d.toISOString().slice(0,10);}
function render(){
  var v=S.meta.validation;
  app.textContent='';
  formBox=h('div');listBox=h('div.list');
  app.appendChild(h('div.a-wrap.sp',{},
    h('div.a-top',{},h('span.a-brand',{},'Vector · EGO'),h('nav',{},h('button.a-link',{type:'button',onclick:function(){lock();login();}},'Sign out'))),
    h('div.a-head',{},h('div',{},h('h1',{},'Is this design good?'),
      h('p.sp-sub',{},'Get a 0–100 rating for a design, the reasons behind it, and the units it’s likely to sell online in each city.'))),
    formBox,listBox,
    h('details.trust.card',{},h('summary',{},'How the rating works and how far to trust it'),
      h('ul',{},
        h('li',{},h('b',{},'The rating averages two scores.'),' Sales history: where the predicted units rank among launches in the same line over the last 2 years (50 = the median). Design review: Claude’s read of the image. 70+ is strong, under 45 is weak.'),
        h('li',{},h('b',{},'Sales history is tested.'),' On '+fmt(v.styles)+' styles across '+v.seasons+' seasons it ranked styles with a correlation of '+v.rank.toFixed(2)+', and '+Math.round(v.top20*100)+'% of its top-20% picks were real top-20% sellers. It knows line, fabric, price and colour, not the print.'),
        h('li',{},h('b',{},'The design review is an opinion.'),' It hasn’t been tested against EGO’s sales yet, so treat it as a second pair of eyes, not a forecast.'),
        h('li',{},h('b',{},'Units are rough.'),' Average error '+Math.round(v.wape*100)+'%; '+Math.round(v.coverage80*100)+'% of styles landed inside the range. Online sales only. City split comes from how each line has sold by city since May 2025.')))));
  renderForm();renderList();
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
