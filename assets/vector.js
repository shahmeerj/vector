/* Vector shared behaviour: helpers (window.V) plus page-wide motion */
(function(){
"use strict";
const $=(s,c=document)=>c.querySelector(s),$$=(s,c=document)=>Array.from(c.querySelectorAll(s));
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const G=typeof gsap!=='undefined'&&typeof ScrollTrigger!=='undefined';
const MOTION=G&&!RM,EASE='expo.out';
if(MOTION){document.documentElement.classList.add('motion');gsap.registerPlugin(ScrollTrigger);}
const NS='http://www.w3.org/2000/svg';
function svgEl(t,a,p){const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;}
function smooth(p){if(!p.length)return'';let d='M '+p[0][0].toFixed(1)+' '+p[0][1].toFixed(1);for(let i=0;i<p.length-1;i++){const p0=p[i-1]||p[i],p1=p[i],p2=p[i+1],p3=p[i+2]||p2;const c1x=p1[0]+(p2[0]-p0[0])/6,c1y=p1[1]+(p2[1]-p0[1])/6,c2x=p2[0]-(p3[0]-p1[0])/6,c2y=p2[1]-(p3[1]-p1[1])/6;d+=' C '+c1x.toFixed(1)+' '+c1y.toFixed(1)+', '+c2x.toFixed(1)+' '+c2y.toFixed(1)+', '+p2[0].toFixed(1)+' '+p2[1].toFixed(1);}return d;}
function onView(el,fn,margin){if(!el)return;if(!('IntersectionObserver' in window)){fn();return;}const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){io.disconnect();fn();}});},{rootMargin:margin||'0px 0px -20% 0px'});io.observe(el);}
function whileVisible(el,cb){if(!el)return;if(!('IntersectionObserver' in window)){cb(true);return;}new IntersectionObserver(es=>cb(es[0].isIntersecting)).observe(el);}
function drawPath(path,svg,o){o=o||{};const L=path.getTotalLength();path.style.strokeDasharray=L;if(!MOTION){path.style.strokeDashoffset=0;return;}path.style.strokeDashoffset=L;
  if(o.scrub)gsap.to(path,{strokeDashoffset:0,ease:'none',scrollTrigger:{trigger:svg,start:o.start||'top 80%',end:o.end||'bottom 50%',scrub:1}});
  else onView(svg,()=>gsap.to(path,{strokeDashoffset:0,duration:o.dur||2,ease:'power2.inOut'}));}
const fmt=n=>Math.round(n).toLocaleString('en-US');
window.V={$,$$,RM,MOTION,EASE,svgEl,smooth,onView,whileVisible,drawPath,fmt};

let lenis=null;
if(MOTION&&window.Lenis){try{lenis=new Lenis({lerp:.09});lenis.on('scroll',ScrollTrigger.update);gsap.ticker.add(t=>lenis.raf(t*1000));gsap.ticker.lagSmoothing(0);}catch(e){lenis=null;}}
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a)return;const id=a.getAttribute('href');if(id.length<2)return;const t=$(id);if(!t)return;e.preventDefault();if(lenis)lenis.scrollTo(t,{offset:-40,duration:1.6});else t.scrollIntoView({behavior:RM?'auto':'smooth'});});

document.addEventListener('DOMContentLoaded',()=>{
  const nav=$('.nav'),prog=$('.nav-prog');let lastY=0,tk=false;
  const onScroll=()=>{if(tk)return;tk=true;requestAnimationFrame(()=>{const y=scrollY;if(nav){nav.classList.toggle('solid',y>30);nav.classList.toggle('hide',y>lastY&&y>500);}lastY=y;
    if(prog){const h=document.documentElement.scrollHeight-innerHeight;prog.style.transform='scaleX('+(h>0?Math.min(1,y/h):0)+')';}tk=false;});};
  addEventListener('scroll',onScroll,{passive:true});onScroll();

  /* words that brighten as you read */
  $$('[data-brighten]').forEach(p=>{const parts=p.textContent.split(/(\s+)/);p.textContent='';const ws=[];parts.forEach(t=>{if(!t||/^\s+$/.test(t)){p.appendChild(document.createTextNode(t));return;}const s=document.createElement('span');s.className='w';s.textContent=t;p.appendChild(s);ws.push(s);});
    if(MOTION)gsap.to(ws,{color:getComputedStyle(p).color,stagger:.05,ease:'none',scrollTrigger:{trigger:p,start:'top 80%',end:'bottom 45%',scrub:1}});});

  if(MOTION){
    $$('[data-rv]').forEach(el=>gsap.to(el,{opacity:1,y:0,filter:'blur(0px)',duration:1.2,ease:EASE,scrollTrigger:{trigger:el,start:'top 88%',once:true}}));
    gsap.from('.js-h1 .l > span',{yPercent:105,duration:1.4,ease:EASE,stagger:.1,delay:.1});
    gsap.from('[data-hero]',{opacity:0,y:18,filter:'blur(6px)',duration:1.2,ease:EASE,stagger:.12,delay:.45,clearProps:'filter'});
  }

  /* result strip numbers count up too */
  $$('.cs-res b').forEach(el=>{const m=el.textContent.trim().match(/^([^0-9]*)([0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/);if(!m)return;const raw=m[2];el.dataset.count=raw.replace(/,/g,'');el.dataset.dec=(raw.split('.')[1]||'').length;if(m[1])el.dataset.pre=m[1];if(m[3])el.dataset.suf=m[3];});
  /* numbers count up when they arrive */
  $$('[data-count]').forEach(el=>{const to=+el.dataset.count,dec=+(el.dataset.dec||0),pre=el.dataset.pre||'',suf=el.dataset.suf||'';
    const f=v=>pre+(dec?v.toFixed(dec):Math.round(v).toLocaleString('en-US'))+suf;el.textContent=f(to);
    if(!MOTION)return;onView(el,()=>{const o={v:0};el.textContent=f(0);gsap.to(o,{v:to,duration:2.4,delay:.5,ease:'power2.out',onUpdate:()=>{el.textContent=f(o.v);}});},'0px 0px -18% 0px');});

  /* chapter tracker built from each act's chapter label */
  const acts=$$('.act').filter(s=>s.id&&s.querySelector('.chap'));
  if(acts.length>1){const bar=document.createElement('nav');bar.className='chaps';bar.setAttribute('aria-label','Chapters');
    const links=acts.map(s=>{const c=s.querySelector('.chap'),n=c.querySelector('b').textContent,t=c.textContent.replace(n,'').trim();const a=document.createElement('a');a.href='#'+s.id;a.innerHTML='<b>'+n+'</b><span></span>';a.querySelector('span').textContent=t;bar.appendChild(a);return a;});
    document.body.appendChild(bar);
    const first=acts[0],last=acts[acts.length-1];
    const upd=()=>{const y=innerHeight*.45;let cur=-1;acts.forEach((s,i)=>{if(s.getBoundingClientRect().top<y)cur=i;});links.forEach((a,i)=>a.classList.toggle('on',i===cur));
      const show=first.getBoundingClientRect().top<innerHeight*.6&&last.getBoundingClientRect().bottom>innerHeight*.5;bar.classList.toggle('on',show);};
    addEventListener('scroll',upd,{passive:true});addEventListener('resize',upd);upd();}

  if(MOTION){if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>ScrollTrigger.refresh());addEventListener('load',()=>ScrollTrigger.refresh());}
});
})();
