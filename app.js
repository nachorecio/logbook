(()=>{
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const PAGE=18;

/* ---------- time helpers ---------- */
const hm=m=>{m=Math.round(m||0);if(!m)return"";const s=m<0?"-":"";m=Math.abs(m);return s+Math.floor(m/60)+":"+String(m%60).padStart(2,"0")};
const hm0=m=>hm(m)||"0:00";
function toMin(v){
  if(v==null||v==="")return 0;
  if(typeof v==="number"){if(!isFinite(v)||v<0)return 0;if(v<1)return Math.round(v*1440);return Math.round(v*60)}
  if(v instanceof Date)return v.getHours()*60+v.getMinutes();
  let s=String(v).trim().replace(/h/i,":").replace(/[^\d:.,]/g,"");
  if(!s)return 0;
  if(s.includes(":")){const[h,m]=s.split(":");return (parseInt(h)||0)*60+(parseInt(m)||0)}
  s=s.replace(",",".");const n=parseFloat(s);return isFinite(n)?Math.round(n*60):0;
}
function clock(v){ // HH:MM clock time
  if(v==null||v==="")return"";
  if(typeof v==="number"){const m=Math.round((v%1)*1440);return String(Math.floor(m/60)%24).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
  let s=String(v).trim();
  let m=s.match(/(\d{1,2})[:.hH]?(\d{2})/);if(!m)return"";
  const h=+m[1],mi=+m[2];if(h>23||mi>59)return"";
  return String(h).padStart(2,"0")+":"+String(mi).padStart(2,"0");
}
const cMin=c=>{if(!c)return null;const[h,m]=c.split(":");return +h*60+ +m};
function block(dt,at){const a=cMin(dt),b=cMin(at);if(a==null||b==null)return 0;return (b-a+1440)%1440}
function toDate(v){
  if(v==null||v==="")return"";
  if(v instanceof Date&&!isNaN(v))return v.toISOString().slice(0,10);
  if(typeof v==="number"&&v>20000&&v<80000){const p=window.XLSX?XLSX.SSF.parse_date_code(v):null;if(p)return ok(p.y,p.m,p.d);const d=new Date(Date.UTC(1899,11,30)+Math.round(v)*864e5);return d.toISOString().slice(0,10)}
  const s=String(v).trim();
  let m=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);if(m)return ok(+m[1],+m[2],+m[3]);
  m=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);if(m){let y=+m[3];if(y<100)y+=y>60?1900:2000;return ok(y,+m[2],+m[1])}
  return"";
  function ok(y,mo,d){if(mo<1||mo>12||d<1||d>31||y<1950||y>2100)return"";return y+"-"+String(mo).padStart(2,"0")+"-"+String(d).padStart(2,"0")}
}
const fmtD=d=>d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(2,4):"";
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const ls={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
function toast(t){const el=$("#toast");el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2600)}

/* ---------- storage: local cache + cloud sync ---------- */
// E: id -> {k:"f"|"s", r:record, u:updatedMs, x:deleted}
const APP_VERSION="1.15.4";
let E=ls.get("lb_entries",{})||{};
let outbox=new Set(ls.get("lb_outbox",[]));
/* ajustes personales que viajan con la nube (nombre, licencia, configuración): registro x/cfg */
const SYNC_KEYS=["lb_owner","lb_simcfg","lb_ftrep","lb_goal","lb_prefs"];
function cfgCollect(){const v={};SYNC_KEYS.forEach(k=>{const x=localStorage.getItem(k);if(x!=null)try{v[k]=JSON.parse(x)}catch{}});return v}
function cfgApply(){const r=E.cfg;if(!r||r.x||!r.r?.vals)return;Object.entries(r.r.vals).forEach(([k,v])=>{if(SYNC_KEYS.includes(k))try{localStorage.setItem(k,JSON.stringify(v))}catch{}})}
function cfgPush(){E.cfg={k:"x",r:{id:"cfg",d:"",vals:cfgCollect()},u:Date.now()};outbox.add("cfg");persist();if(typeof soonSync==="function")soonSync()}
{const _set=ls.set;ls.set=(k,v)=>{const before=localStorage.getItem(k);_set(k,v);if(SYNC_KEYS.includes(k)&&localStorage.getItem(k)!==before)cfgPush()}}
if(E.cfg)cfgApply();else if(Object.keys(cfgCollect()).length)setTimeout(cfgPush,0);
const live=k=>Object.values(E).filter(e=>e.k===k&&!e.x).map(e=>e.r);
const allF=()=>live("f").sort((a,b)=>(a.d+(a.dt||"")).localeCompare(b.d+(b.dt||"")));
const allS=()=>live("s").sort((a,b)=>a.d.localeCompare(b.d));
function persist(){
  try{localStorage.setItem("lb_entries",JSON.stringify(E));localStorage.setItem("lb_outbox",JSON.stringify([...outbox]));return true}
  catch{toast("El almacenamiento del navegador está lleno.");return false}
}
function putRec(kind,rec){E[rec.id]={k:kind,r:rec,u:Date.now()};outbox.add(rec.id);persist();render();soonSync()}
function removeRec(kind,id){if(!E[id])return;E[id]={...E[id],x:1,u:Date.now()};outbox.add(id);persist();render();soonSync()}
function bulkPut(list){const t=Date.now();list.forEach(([k,r],i)=>{E[r.id]={k,r,u:t+i};outbox.add(r.id)});const ok=persist();render();soonSync(200);return ok}

const _cc=ls.get("lb_cloud",null);if(_cc&&_cc.url&&/\/(rest|auth)\/v1/i.test(_cc.url)){_cc.url=_cc.url.replace(/\/(rest|auth)\/v1.*$/i,"").replace(/\/+$/,"");ls.set("lb_cloud",_cc)}
const cloud={sb:null,user:null,cfg:ls.get("lb_cloud",null),syncing:false,last:ls.get("lb_lastsync",null),err:""};
function setSync(){
  const el=$("#sync");let cls="local",t="Solo este dispositivo";
  if(cloud.user){
    if(cloud.syncing)t="Sincronizando…";
    else if(!navigator.onLine){t="Sin conexión"+(outbox.size?` · ${outbox.size} pendientes`:"")}
    else if(cloud.err){t="Error de sincronización"}
    else{cls="";t=outbox.size?`${outbox.size} pendientes`:"Sincronizado"}
  }
  el.className="sync"+(cls?" "+cls:"");el.innerHTML="<i></i>"+esc(t);
  $("#cloudBanner").hidden=!!cloud.user||!(allF().length||allS().length);
}
let syncT=null;
function soonSync(ms=1500){clearTimeout(syncT);setSync();syncT=setTimeout(sync,ms)}
async function sync(){
  if(!cloud.sb||!cloud.user||!navigator.onLine||cloud.syncing)return setSync();
  cloud.syncing=true;cloud.err="";setSync();
  try{
    // push
    const ids=[...outbox];
    for(let i=0;i<ids.length;i+=500){
      const part=ids.slice(i,i+500).filter(id=>E[id]),sent={};
      const rows=part.map(id=>{const e=E[id];sent[id]=e.u;return {user_id:cloud.user.id,id,kind:e.k,d:e.r.d||null,data:{...e.r,_u:e.u},deleted:!!e.x}});
      if(!rows.length)continue;
      const {error}=await cloud.sb.from("entries").upsert(rows,{onConflict:"user_id,id"});
      if(error)throw error;
      part.forEach(id=>{if(E[id]&&E[id].u===sent[id])outbox.delete(id)});
      persist();
    }
    // pull (keyset on updated_at,id)
    let cur=ls.get("lb_pull",null),changed=false;
    for(let guard=0;guard<200;guard++){
      let q=cloud.sb.from("entries").select("id,kind,data,deleted,updated_at").order("updated_at",{ascending:true}).order("id",{ascending:true}).limit(1000);
      if(cur)q=q.or(`updated_at.gt."${cur.t}",and(updated_at.eq."${cur.t}",id.gt."${cur.id}")`);
      const {data,error}=await q;if(error)throw error;
      data.forEach(row=>{
        const {_u,...r}=row.data||{};const loc=E[row.id],srvU=+_u||0;
        if(!loc||!outbox.has(row.id)||srvU>=loc.u){E[row.id]={k:row.kind,r,u:srvU,x:row.deleted?1:0};outbox.delete(row.id);changed=true}
      });
      if(data.length){const l=data[data.length-1];cur={t:l.updated_at,id:l.id};ls.set("lb_pull",cur)}
      if(data.length<1000)break;
    }
    if(changed){persist();cfgApply();render();try{renderCover();renderOwner()}catch{}}
    cloud.last=new Date().toISOString();ls.set("lb_lastsync",cloud.last);
  }catch(e){cloud.err=e?.message||String(e);console.warn("sync",e)}
  cloud.syncing=false;setSync();renderCloud();
}
async function connectCloud(){
  cloud.sb=null;cloud.user=null;
  if(!cloud.cfg||!window.supabase){renderCloud();setSync();return}
  try{
    cloud.sb=window.supabase.createClient(cloud.cfg.url,cloud.cfg.key,{auth:{persistSession:true,autoRefreshToken:true,storageKey:"lb_auth"}});
    const {data}=await cloud.sb.auth.getSession();cloud.user=data.session?.user||null;
    cloud.sb.auth.onAuthStateChange((ev,sess)=>{const had=!!cloud.user;cloud.user=sess?.user||null;renderCloud();setSync();if(cloud.user&&!had)sync()});
  }catch(e){cloud.err="Configuración no válida: "+(e.message||e)}
  renderCloud();setSync();if(cloud.user)sync();
}
window.addEventListener("online",()=>soonSync(300));
try{matchMedia("(max-width:640px)").addEventListener("change",()=>{try{render()}catch{}})}catch{}
window.addEventListener("offline",setSync);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)soonSync(300)});
setInterval(()=>{if(!document.hidden)sync()},60000);
/* ---------- computations ---------- */
const FKEYS=["se","me","mp","tot","night","ifr","fpic","fcop","fdual","finst","tod","ton","ldd","ldn"];
function sum(list){const t={};FKEYS.forEach(k=>t[k]=0);list.forEach(f=>FKEYS.forEach(k=>t[k]+=+f[k]||0));return t}
/* saldo inicial: horas anteriores al primer vuelo registrado (registro x/open, se sincroniza) */
const OPEN_KEYS=[...FKEYS,"sim"];
function opening(){const r=(typeof live==="function"?live("x"):[]).find(x=>x.id==="open");const o={};OPEN_KEYS.forEach(k=>o[k]=+(r?.v?.[k])||0);o.date=r?.date||"";o.note=r?.note||"";o.on=!!r&&OPEN_KEYS.some(k=>o[k]);return o}
function withOpen(t){const o=opening(),r={...t};FKEYS.forEach(k=>r[k]=(+r[k]||0)+o[k]);return r}
/* aviación general vs Airbus (por tipo: A3xx, A20N, A21N = Airbus) */
const isAirbus=f=>/^A(3\d\d|2[01]N)/i.test(String(f.typ||"").trim());
function splitGA(F,withOp){const ab=sum(F.filter(isAirbus)),ga=sum(F.filter(f=>!isAirbus(f)));return {ab,ga:withOp?withOpen(ga):ga}}
function splitTable(F,withOp){const {ab,ga}=splitGA(F,withOp),R=[["PIC","fpic"],["Copiloto","fcop"],["Instructor","finst"],["Dual","fdual"],["Noche","night"],["IFR","ifr"],["Total","tot"]];
  return `<table class="rp-t split"><thead><tr><th class="l">Función</th><th>Aviación general</th><th>Airbus</th><th>Total</th></tr></thead><tbody>${R.map(([l,k])=>`<tr class="${k==="tot"?"tot":""}"><td class="l">${l}</td><td class="mono">${hm0(ga[k])}</td><td class="mono">${hm0(ab[k])}</td><td class="mono">${hm0(ga[k]+ab[k])}</td></tr>`).join("")}</tbody></table>`}
const addDays=(d,n)=>{const x=new Date(d+"T00:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};

/* FCL.060(b)(1): 3 despegues, aproximaciones y aterrizajes en los 90 días anteriores (avión o FFS).
   Se comprueba día a día: un día D es válido si en la ventana [D-89, D] hay al menos 3 despegues y 3 aterrizajes. */
function recency(F,S){
  const td=today(),to=[],ld=[];
  F.forEach(f=>{if(f.d>td)return;for(let i=0;i<(+f.tod||0)+(+f.ton||0);i++)to.push(f.d);for(let i=0;i<(+f.ldd||0)+(+f.ldn||0);i++)ld.push(f.d)});
  S.forEach(s=>{if(s.d>td)return;for(let i=0;i<(+s.tol||0);i++){to.push(s.d);ld.push(s.d)}});
  if(to.length<3||ld.length<3)return null;
  const cnt=(arr,D)=>{const a=addDays(D,-89);let n=0;for(const e of arr)if(e>=a&&e<=D)n++;return n};
  const ok=D=>cnt(to,D)>=3&&cnt(ld,D)>=3;
  let exp,days=[];
  if(ok(td)){let D=td;for(let k=0;k<100;k++){const nx=addDays(D,1);if(!ok(nx))break;D=nx}exp=D;
    for(let D2=td;D2<=addDays(exp,1);D2=addDays(D2,1))days.push({d:D2,to:cnt(to,D2),ld:cnt(ld,D2)})}
  else{let D=addDays(td,-1);for(let k=0;k<4000&&!ok(D);k++)D=addDays(D,-1);exp=D}
  const left=Math.round((new Date(exp)-new Date(td))/864e5);
  const n90={to:cnt(to,td),ld:cnt(ld,td)};
  // días en que baja el número de T/O o LDG en la ventana
  const drops=[];for(let k=1;k<days.length;k++){const a=days[k-1],b=days[k];if(b.to<a.to||b.ld<a.ld)drops.push(b)}
  return {exp,left,n90,days,drops,c:left<0?"b":left<=15?"w":"ok"}}
function renderSummary(){
  const F=allF(),S=bookS(),t=sum(F),sTot=S.reduce((a,s)=>a+(+s.tot||0),0);
  const cells=[["6","Total vuelo",t.tot,1],["10","PIC",t.fpic],["10","Copiloto",t.fcop],["10","Instructor",t.finst],["10","Dual",t.fdual],["5","Multi-pilot",t.mp],["9","Noche",t.night],["9","IFR",t.ifr],["11","FSTD",sTot]];
  if($("#sumTop"))$("#sumTop").innerHTML=cells.map(([n,k,v,b])=>`<div class="cell${b?" big":""}"><div class="k"><em>${n}</em>${k}</div><div class="v">${hm0(v)}</div>${b?`<div class="note">${fmtInt(F.length)} sectores · ${fmtInt(t.ldd+t.ldn)} aterrizajes</div>`:""}</div>`).join("");
  const td=today(), y=td.slice(0,4);
  const inR=(a,b)=>F.filter(f=>f.d>=a&&f.d<=b).reduce((s,f)=>s+(+f.tot||0),0);
  const lims=[["Últimos 28 días",inR(addDays(td,-27),td),100*60],["Año natural "+y,inR(y+"-01-01",td),900*60],["Últimos 12 meses",inR(addDays(td,-364),td),1000*60]];
  $("#ftl").innerHTML=lims.map(([l,v,max])=>{const p=Math.min(100,v/max*100),c=p>=95?" b":p>=85?" w":"";return `<div class="lim"><div class="lab"><span>${l}</span><span class="mono">${hm0(v)} / ${max/60}:00</span></div><div class="bar${c}"><i style="width:${p.toFixed(1)}%"></i></div></div>`}).join("");
  // recency: last 3 landings (aircraft + FSTD)
  const rc=recency(F,S);let rh;
  if(!rc)rh=`<div class="row"><span class="chip b">Sin datos</span><span class="note">Necesitas 3 despegues y 3 aterrizajes en los últimos 90 días.</span></div>`;
  const fc=recencyForecast(F,S),fcH=fc?`<div class="rcfc"><div class="row"><b>Con tu roster</b><span class="spacer"></span><select id="rcPf" aria-label="Sectores programados como PF"><option value="alt"${fc.mode==="alt"?" selected":""}>PF alternos</option><option value="all"${fc.mode==="all"?" selected":""}>Todos PF</option><option value="none"${fc.mode==="none"?" selected":""}>Ninguno PF</option></select></div>
    <div class="note">${fc.n} sectores programados hasta el ${fmtD(fc.last)}, ${fc.pf} como PF.</div>
    ${fc.after?`<div class="msg w">Caducaría el <b>${fmtD(fc.exp)}</b> y tienes un vuelo programado después, el ${fmtD(fc.after.d)} (${esc(fc.after.dp)}–${esc(fc.after.ap)}). Necesitas 3 despegues y aterrizajes antes, en avión o en FFS.</div>`:`<div class="msg ok">Con esos vuelos te mantienes al día${fc.exp?` hasta el <b>${fmtD(fc.exp)}</b>`:""}.</div>`}</div>`:"";
  if(rc)rh=`<div class="row"><span class="chip ${rc.c}">${rc.left<0?"Caducada":"Vigente"}</span><span>Válida hasta <b class="mono">${fmtD(rc.exp)}</b>${rc.left>=0?` (${rc.left} días)`:""}</span></div>
    <div class="types"><div><span>Despegues en los últimos 90 días</span><span class="mono">${rc.n90.to}</span></div><div><span>Aterrizajes en los últimos 90 días</span><span class="mono">${rc.n90.ld}</span></div><div><span>Último día con 3 T/O y 3 LDG</span><span class="mono">${fmtD(rc.exp)}</span></div></div>
    ${rc.days.length>1?`<div class="rcbar" aria-label="T/O y LDG en la ventana de 90 días, día a día">${rc.days.map(x=>{const m=Math.min(x.to,x.ld);return `<i class="${m>=6?"ok":m>=3?"w":"b"}" style="height:${Math.max(8,Math.min(100,m/Math.max(3,rc.n90.to,rc.n90.ld)*100))}%" data-tip="<b>${fmtD(x.d)}</b><br>${x.to} despegues · ${x.ld} aterrizajes en 90 días"></i>`}).join("")}</div><div class="note">Día a día desde hoy: cuántos despegues y aterrizajes te quedan en la ventana de 90 días si no vuelves a volar.${rc.drops.length?" Próximas bajadas: "+rc.drops.slice(0,5).map(x=>`${fmtD(x.d)} → ${Math.min(x.to,x.ld)}`).join(" · ")+".":""}</div>`:""}`;
  const last=F[F.length-1];
  rh+=fcH;
  rh+=`<p class="note">FCL.060(b): 3 despegues, aproximaciones y aterrizajes en los 90 días anteriores, en avión o en FFS (los T/O+LDG que anotes en la sesión). Se comprueba cada día: el último día válido es el último en el que los 90 días anteriores (incluido ese día) tienen al menos 3 despegues y 3 aterrizajes. ${last?"Último vuelo: "+fmtD(last.d)+" "+esc(last.dp)+"–"+esc(last.ap)+".":""}</p>`;
  $("#recent").innerHTML=rh;
  if($("#splitTbl")){$("#splitTbl").innerHTML=splitTable(F,true);const op=opening();$("#splitNote").textContent=op.on?`Aviación general incluye ${hm0(op.tot)} h del saldo inicial`:"Airbus = A319, A320, A321 y neo"}
  if($("#insTbl")){const AS=allS(),y=td.slice(0,4),y12=addDays(td,-364);
    const G=[["TRI / SFI · instructor",s=>ROLE_INS.includes(s.role)],["TRE / SFE · examinador",s=>ROLE_EXA.includes(s.role)],["Alumno y observador",s=>!ROLE_INS.includes(s.role)&&!ROLE_EXA.includes(s.role)]];
    const cell=(L)=>`<td class="mono">${hm0(L.reduce((a,s)=>a+(+s.tot||0),0))}<span class="note"> · ${L.length}</span></td>`;
    const rows=G.map(([l,fn])=>{const L=AS.filter(fn);return {l,L}}).filter(r=>r.L.length);
    $("#insTbl").innerHTML=rows.length?`<table class="rp-t split"><thead><tr><th class="l">Función</th><th>Total</th><th>${y}</th><th>12 meses</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="l">${r.l}</td>${cell(r.L)}${cell(r.L.filter(s=>s.d.startsWith(y)))}${cell(r.L.filter(s=>s.d>=y12))}</tr>`).join("")}<tr class="tot"><td class="l">Total simulador</td>${cell(AS)}${cell(AS.filter(s=>s.d.startsWith(y)))}${cell(AS.filter(s=>s.d>=y12))}</tr></tbody></table>`:`<p class="note">Aún no hay sesiones de simulador.</p>`;
    const lt=AS.filter(s=>ROLE_INS.includes(s.role)).map(s=>s.d).sort().pop(),le=AS.filter(s=>ROLE_EXA.includes(s.role)).map(s=>s.d).sort().pop();
    $("#insNote").textContent=[`Horas · sesiones.`,lt?`Última como TRI ${fmtD(lt)}.`:"",le?`Último chequeo como TRE ${fmtD(le)}.`:""].filter(Boolean).join(" ")}
  const byT={};F.forEach(f=>{const k=(f.typ||"—").toUpperCase();byT[k]=(byT[k]||0)+(+f.tot||0)});
  const tl=Object.entries(byT).sort((a,b)=>b[1]-a[1]);
  $("#types").innerHTML=tl.length?tl.map(([k,v])=>`<div><span>${esc(k)}</span><span class="mono">${hm0(v)}</span></div>`).join(""):`<p class="note">Aún no hay vuelos. Importa tu Excel o PDF, o añade el primero con +.</p>`;
}

/* ---------- logbook ---------- */
let page=null;
function filtered(){
  const q=$("#q").value.trim().toLowerCase(),y=$("#yr").value;
  const F=flFilters(),rk={pic:"fpic",cop:"fcop",inst:"finst",dual:"fdual"}[F.role];
  return allF().filter(f=>(!y||f.d.startsWith(y))&&(!q||[f.dp,f.ap,f.typ,f.reg,f.pic,f.rem].join(" ").toLowerCase().includes(q))&&(!rk||+f[rk]>0)&&(!F.typ||f.typ===F.typ)&&(!F.reg||f.reg===F.reg)&&(!F.night||+f.night>0)&&(!F.ldg||(+f.ldd||0)+(+f.ldn||0)>0));
}
function rowHTML(f){
  const v=x=>hm(x),n=x=>+x?x:"";
  return `<tr class="rec" data-id="${f.id}" data-d="${f.d}"><td>${fmtD(f.d)}</td><td>${esc(f.dp)}</td><td>${esc(f.dt)}</td><td>${esc(f.ap)}</td><td>${esc(f.at)}</td><td class="l">${esc(f.typ)}</td><td>${esc(f.reg)}</td><td>${v(f.se)}</td><td>${v(f.me)}</td><td>${v(f.mp)}</td><td><b>${v(f.tot)}</b></td><td class="l">${esc(f.pic)}</td><td>${n(f.tod)}</td><td>${n(f.ton)}</td><td>${n(f.ldd)}</td><td>${n(f.ldn)}</td><td class="split">${v(f.night)}</td><td>${v(f.ifr)}</td><td>${v(f.fpic)}</td><td>${v(f.fcop)}</td><td>${v(f.fdual)}</td><td>${v(f.finst)}</td><td class="rem">${esc(f.rem)}</td></tr>`;
}
function totRow(lab,t){
  return `<tr><td class="lab" colspan="7">${lab}</td><td>${hm0(t.se)}</td><td>${hm0(t.me)}</td><td>${hm0(t.mp)}</td><td>${hm0(t.tot)}</td><td></td><td>${t.tod}</td><td>${t.ton}</td><td>${t.ldd}</td><td>${t.ldn}</td><td class="split">${hm0(t.night)}</td><td>${hm0(t.ifr)}</td><td>${hm0(t.fpic)}</td><td>${hm0(t.fcop)}</td><td>${hm0(t.fdual)}</td><td>${hm0(t.finst)}</td><td></td></tr>`;
}
function renderLists(){
  const F=allF(),S=allS(),u=a=>[...new Set(a.filter(Boolean))].slice(-40);
  $("#typList").innerHTML=u(F.map(f=>f.typ)).map(x=>`<option value="${esc(x)}">`).join("");
  $("#regList").innerHTML=u(F.map(f=>f.reg)).map(x=>`<option value="${esc(x)}">`).join("");
  $("#simTypList").innerHTML=u(S.map(s=>s.typ)).map(x=>`<option value="${esc(x)}">`).join("");
  $("#simDevList").innerHTML=u(S.map(s=>s.dev)).map(x=>`<option value="${esc(x)}">`).join("");
  $("#countNote").textContent=`${F.length} vuelos · ${S.length} sesiones de simulador`;
  fillFilterLists(F);
}
function render(){try{renderBackup()}catch{};renderSummary();renderLog();renderSims();renderLists();if(view==="map")try{renderBigMap()}catch(e){console.warn(e)}if(view==="fat")try{renderFatigue()}catch(e){console.warn(e)}if(!document.activeElement?.closest?.("#opGrid,#opDate,#opNote"))try{renderOpen()}catch{}}

/* ---------- navigation ---------- */
let view="sum";
function go(v){view=v;$$("#tabs button").forEach(b=>{if(b.dataset.v===v)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
  $$("section.view").forEach(s=>s.hidden=s.id!=="v-"+v);$("#fab").hidden=v==="imp"||v==="set";$("#fab").setAttribute("aria-label",v==="sim"?"Añadir sesión":"Añadir vuelo");ls.set("lb_view",v);window.scrollTo(0,0);if(v==="st"){renderStats();renderReport()}if(v==="sum")renderCover();if(v==="map")renderBigMap();if(v==="fat")renderFatigue()}
$("#tabs").addEventListener("click",e=>{const b=e.target.closest("button");if(b)go(b.dataset.v)});
document.addEventListener("click",e=>{const g=e.target.closest("[data-go]");if(g)go(g.dataset.go)});
$("#q").addEventListener("input",()=>{page=null;renderLog()});
$("#yr").addEventListener("change",()=>{page=null;renderLog()});

/* ---------- flight form ---------- */
let editF=null;
const prefs=()=>ls.get("lb_prefs",{typ:"A320",op:"mp",role:"pic",pic:"SELF"});
function openFl(f,pre){
  editF=f||null;const p=prefs();
  $("#flTitle").textContent=f?"Editar vuelo":"Nuevo vuelo";
  $("#fd").value=f?.d||today();$("#ftyp").value=f?f.typ:p.typ;$("#freg").value=f?.reg||"";
  $("#fdp").value=f?.dp||"";$("#fdt").value=f?.dt||"";$("#fap").value=f?.ap||"";$("#fat").value=f?.at||"";
  $("#ftot").value=f?hm(f.tot):"";$("#fop").value=f?(f.mp?"mp":f.me?"me":f.se?"se":"mp"):p.op;
  $("#frole").value=f?(f.fpic?"pic":f.fcop?"cop":f.fdual?"dual":f.finst?"inst":"pic"):p.role;
  $("#fpic").value=f?f.pic:($("#frole").value==="pic"?p.pic:"");
  $("#ftod").value=f?f.tod||0:1;$("#fton").value=f?f.ton||0:0;$("#fldd").value=f?f.ldd||0:1;$("#fldn").value=f?f.ldn||0:0;
  $("#fnight").value=f?hm(f.night):"";$("#fifr").value=f?hm(f.ifr):"";$("#frem").value=f?.rem||"";$("#fcrew").value=f?.crew||"";
  $("#flLock").hidden=true;if(f){const n=lockedPageOf(f);if(n){$("#flLock").hidden=false;$("#flLock").textContent=`Este vuelo está en la página ${n} del libro, que cerraste. Si lo cambias, la página quedará marcada como modificada.`}}
  $("#flDel").hidden=!f;$("#flCard").hidden=!f;$("#flConfirm").hidden=true;$("#ftot").dataset.auto=f?"":"1";
  if(pre){const m={d:"#fd",dp:"#fdp",ap:"#fap",dt:"#fdt",at:"#fat",reg:"#freg",typ:"#ftyp",rem:"#frem",pic:"#fpic",crew:"#fcrew"};Object.entries(m).forEach(([k,s])=>{if(pre[k]!=null)$(s).value=pre[k]});if(pre.role)$("#frole").value=pre.role;$("#ftot").value="";}
  $("#fauto").checked=!f&&ls.get("lb_fauto",true);$("#fnInfo").textContent="";$("#acarsBox").hidden=true;$("#acarsBox").innerHTML="";
  calcHint();nightHint();$("#flDlg").hidden=false;setTimeout(()=>$(f?"#ftot":"#fdp").focus(),50);
}
function calcHint(){
  const b=block(clock($("#fdt").value),clock($("#fat").value));
  if(b&&$("#ftot").dataset.auto==="1")$("#ftot").value=hm(b);
  const t=toMin($("#ftot").value);
  $("#flCalc").textContent=t?`Total ${hm(t)} → se anota en ${({mp:"Multi-pilot",me:"SP ME",se:"SP SE"})[$("#fop").value]} y en ${({pic:"PIC",cop:"Copiloto",dual:"Dual",inst:"Instructor",picus:"PIC"})[$("#frole").value]}. IFR = ${$("#fifr").value||hm(t)}.`:"El total se calcula solo con las horas OUT/IN (calzos, UTC, cruza medianoche).";
}
["#fdt","#fat"].forEach(s=>$(s).addEventListener("input",calcHint));
$("#ftot").addEventListener("input",()=>{$("#ftot").dataset.auto="";calcHint()});
["#fop","#frole","#fifr"].forEach(s=>$(s).addEventListener("change",calcHint));
$("#frole").addEventListener("change",()=>{if($("#frole").value!=="pic"&&$("#fpic").value==="SELF")$("#fpic").value="";if($("#frole").value==="pic"&&!$("#fpic").value)$("#fpic").value="SELF"});
["#fdp","#fap","#freg","#ftyp"].forEach(s=>$(s).addEventListener("blur",e=>e.target.value=e.target.value.trim().toUpperCase()));
$("#flForm").addEventListener("submit",e=>{
  e.preventDefault();
  const tot=toMin($("#ftot").value),op=$("#fop").value,role=$("#frole").value;
  const ifrV=$("#fifr").value.trim();
  const f={id:editF?.id||uid(),d:$("#fd").value,dp:$("#fdp").value.trim().toUpperCase(),dt:clock($("#fdt").value),ap:$("#fap").value.trim().toUpperCase(),at:clock($("#fat").value),
    typ:$("#ftyp").value.trim().toUpperCase(),reg:$("#freg").value.trim().toUpperCase(),se:op==="se"?tot:0,me:op==="me"?tot:0,mp:op==="mp"?tot:0,tot,
    pic:$("#fpic").value.trim(),tod:+$("#ftod").value||0,ton:+$("#fton").value||0,ldd:+$("#fldd").value||0,ldn:+$("#fldn").value||0,
    night:toMin($("#fnight").value),ifr:ifrV===""?tot:toMin(ifrV),fpic:role==="pic"||role==="picus"?tot:0,fcop:role==="cop"?tot:0,fdual:role==="dual"?tot:0,finst:role==="inst"?tot:0,
    rem:$("#frem").value.trim()+(role==="picus"&&!/PICUS/i.test($("#frem").value)?" PICUS":""),crew:$("#fcrew").value.trim()};
  if(!f.d){toast("Pon la fecha.");return}
  if(!tot){toast("Falta el tiempo total de vuelo.");return}
  ls.set("lb_prefs",{typ:f.typ||prefs().typ,op,role,pic:role==="pic"?(f.pic||"SELF"):prefs().pic});
  const wasNew=!editF;putRec("f",f,editF?.d);$("#flDlg").hidden=true;page=null;toast(wasNew?"Vuelo guardado":"Vuelo actualizado");
  if(liveToClear){clearLive();liveToClear=false}if(confirmPlanned){removeRec("p",confirmPlanned);confirmPlanned=null}if(wasNew)showRetBar(f);
});
$("#flDel").onclick=()=>$("#flConfirm").hidden=false;
$("#flDelNo").onclick=()=>$("#flConfirm").hidden=true;
$("#flDelYes").onclick=()=>{removeRec("f",editF.id,editF.d);$("#flDlg").hidden=true;toast("Vuelo borrado")};

/* ---------- sim form ---------- */
let editS=null;
$("#simDel").onclick=()=>$("#simConfirm").hidden=false;
$("#simDelNo").onclick=()=>$("#simConfirm").hidden=true;
$("#simDelYes").onclick=()=>{removeRec("s",editS.id,editS.d);$("#simDlg").hidden=true;toast("Sesión borrada")};

$$("[data-close]").forEach(b=>b.onclick=()=>b.closest(".scrim").hidden=true);
$$(".scrim").forEach(s=>s.addEventListener("click",e=>{if(e.target===s)s.hidden=true}));
document.addEventListener("keydown",e=>{if(e.key==="Escape")$$(".scrim").forEach(s=>s.hidden=true)});
const findF=id=>E[id]&&!E[id].x&&E[id].k==="f"?E[id].r:null, findS=id=>E[id]&&!E[id].x&&E[id].k==="s"?E[id].r:null;
document.addEventListener("click",e=>{
  const r=e.target.closest("[data-id]");if(r&&!e.target.closest(".dlg")){const f=findF(r.dataset.id,r.dataset.d);if(f)openFl(f)}
  const s=e.target.closest("[data-sid]");if(s){const x=findS(s.dataset.sid,s.dataset.d);if(x)openSim(x)}
});
$("#addFl").onclick=()=>openFl();$("#addSim").onclick=()=>openSim();
$("#fab").onclick=()=>view==="sim"?openSim():openFl();

/* ---------- libraries (bundled, lazy) ---------- */
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("No se pudo cargar "+src));document.head.appendChild(s)})}
let xlsxP=null,pdfP=null;
const needXLSX=()=>xlsxP||(xlsxP=loadScript("vendor/xlsx.full.min.js"));
const needPDF=()=>pdfP||(pdfP=loadScript("vendor/pdf.min.js"));
/* ---------- import ---------- */
const FIELDS=[
 ["","— ignorar —"],["d","1 Fecha"],["dp","2 Salida lugar"],["dt","2 Salida hora"],["ap","3 Llegada lugar"],["at","3 Llegada hora"],["typ","4 Tipo/modelo"],["reg","4 Matrícula"],
 ["se","5 SE"],["me","5 ME"],["mp","5 Multi-pilot"],["tot","6 Total vuelo"],["pic","7 Nombre PIC"],["tod","8 T/O día"],["ton","8 T/O noche"],["ldd","8 LDG día"],["ldn","8 LDG noche"],
 ["night","9 Noche"],["ifr","9 IFR"],["fpic","10 PIC"],["fcop","10 Copiloto"],["fdual","10 Dual"],["finst","10 Instructor"],["sd","11 Sim fecha"],["styp","11 Sim tipo"],["stot","11 Sim tiempo"],["rem","12 Observaciones"],["crew","Tripulación / copiloto (nombre)"]];
const GUESS=[
 ["d",/^(fecha|date|dia|day)\b/],["dp",/(dep|salida|from|origen|origin).*(place|lugar|apt|airport|icao)?$/],["dt",/(dep|salida|off|out|std|atd).*(time|hora)|^(off|out|atd|block off)/],
 ["ap",/(arr|llegada|to|destino|dest).*(place|lugar|apt|airport|icao)?$/],["at",/(arr|llegada|on|in|sta|ata).*(time|hora)|^(on|in|ata|block on)/],
 ["typ",/(type|tipo|model|modelo|aircraft|avion|make)/],["reg",/(reg|matr)/],["mp",/(multi|^mp$|mcc)/],["se",/^se$|single.*engine|monomotor/],["me",/^me$|multi.*engine|multimotor/],
 ["tot",/(total|block|duraci|tiempo vuelo|flight time|tt)/],["pic",/(name|nombre).*pic|pic.*name|comandante|captain/],["tod",/(t\/?o|takeoff|despeg).*(day|dia)/],["ton",/(t\/?o|takeoff|despeg).*(night|noche)/],
 ["ldd",/(ldg|land|aterr).*(day|dia)/],["ldn",/(ldg|land|aterr).*(night|noche)/],["night",/^(night|noche|nocturno)/],["ifr",/(ifr|instrument)/],
 ["crew",/(crew|tripul|alumno|student|(co-?pil|sic|f\/?o).*(name|nombre))/],["fcop",/(co-?pil|copiloto|sic|f\/?o\b)/],["fdual",/dual/],["finst",/(instructor|instr|fi\b)/],["fpic",/^(pic|p1|piloto al mando)$|pilot.in.command/],["rem",/(remark|observ|coment|notes|notas)/]];
let imp=null; // {kind, rows, header, map, parsed}
const dz=$("#drop");
["dragenter","dragover"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add("over")}));
["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove("over")}));
dz.addEventListener("drop",e=>{const f=e.dataTransfer.files[0];if(f)handleFile(f)});
$("#file").addEventListener("change",e=>{const f=e.target.files[0];if(f)handleFile(f);e.target.value=""});
const area=$("#impArea");
function areaMsg(html){area.hidden=false;area.innerHTML=html}

async function handleFile(file){
  areaMsg(`<div class="row"><b>${esc(file.name)}</b><span class="note">Leyendo…</span></div><div class="prog"><i style="width:15%"></i></div>`);
  try{
    if(/\.json$/i.test(file.name))await readJSON(file);
    else if(/\.pdf$/i.test(file.name))await readPDF(file);
    else await readSheet(file);
  }catch(e){areaMsg(`<div class="msg b">No pude leer el archivo: ${esc(e.message||e)}. Si es un Excel, guárdalo como .xlsx o .csv e inténtalo otra vez.</div>`)}
}

async function readSheet(file){
  await needXLSX();
  const isCsv=/\.(csv|txt)$/i.test(file.name);
  const wb=isCsv?XLSX.read(await file.text(),{type:"string",raw:true}):XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false});
  imp={file:file.name,wb,sheet:wb.SheetNames[0]};
  loadSheet();
}
function loadSheet(){
  const ws=imp.wb.Sheets[imp.sheet];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:""});
  // header row: the row (within first 15) with most text cells matching guesses
  let best=0,bi=0;
  rows.slice(0,15).forEach((r,i)=>{const sc=r.filter(c=>typeof c==="string"&&GUESS.some(([,re])=>re.test(norm(c)))).length;if(sc>best){best=sc;bi=i}});
  // combine with next row if two-level headers
  const h1=rows[bi]||[],h2=rows[bi+1]||[];
  const twoLevel=h2.filter(c=>typeof c==="string"&&c.trim()).length>=3&&!toDate(rows[bi+1]?.[0]);
  let carry="";
  const header=h1.map((c,i)=>{if(String(c).trim())carry=String(c).trim();const sub=twoLevel?String(h2[i]||"").trim():"";return (sub?(String(c).trim()||carry)+" "+sub:String(c).trim())||("Col "+(i+1))});
  const data=rows.slice(bi+(twoLevel?2:1));
  const used=new Set();
  const map=header.map(h=>{const n=norm(h);for(const[k,re]of GUESS){if(!used.has(k)&&re.test(n)){used.add(k);return k}}return ""});
  if(!map.includes("d")){const di=data.length?header.findIndex((_,i)=>data.slice(0,10).filter(r=>toDate(r[i])).length>=3):-1;if(di>=0)map[di]="d"}
  Object.assign(imp,{kind:"sheet",header,rows:data,map});
  drawMapping();
}
const norm=s=>String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();

function drawMapping(){
  const {header,rows,map}=imp;
  const sample=i=>rows.slice(0,40).map(r=>r[i]).filter(v=>v!=="").slice(0,3).map(v=>typeof v==="number"&&v<1&&v>0?hm(v*1440)+" ("+v.toFixed(3)+")":String(v)).join(" · ");
  areaMsg(`
  <div class="row"><h3>${esc(imp.file)}</h3>${imp.wb.SheetNames.length>1?`<select id="shSel">${imp.wb.SheetNames.map(n=>`<option${n===imp.sheet?" selected":""}>${esc(n)}</option>`).join("")}</select>`:""}<span class="note">${rows.length} filas · revisa qué columna va a cada casilla del libro</span></div>
  <div style="overflow-x:auto"><table class="maptab">${header.map((h,i)=>`<tr><td><b>${esc(h)}</b></td><td class="note">${esc(sample(i))}</td><td><select data-ci="${i}">${FIELDS.map(([k,l])=>`<option value="${k}"${map[i]===k?" selected":""}>${l}</option>`).join("")}</select></td></tr>`).join("")}</table></div>
  <div class="row"><button class="btn pri" id="mapGo">Ver vista previa</button><button class="btn" id="aiSheet"${aiKey()?"":" disabled title=\"Añade tu clave de Claude en Ajustes\""}>Que lo interprete Claude</button><span class="note">Las horas pueden venir como 1:30, 1.5 o formato hora de Excel.</span></div>`);
  $$("#impArea select[data-ci]").forEach(s=>s.onchange=()=>imp.map[+s.dataset.ci]=s.value);
  $("#shSel")&&($("#shSel").onchange=e=>{imp.sheet=e.target.value;loadSheet()});
  $("#mapGo").onclick=()=>{imp.parsed=fromMapped();drawPreview()};
  $("#aiSheet").onclick=()=>aiParse(chunkRows(imp.rows.map(r=>r.map(c=>typeof c==="number"&&c>0&&c<1?hm(c*1440):(typeof c==="number"&&c>20000&&c<80000?toDate(c):c)).join(" | ")),40),imp.header.join(" | "));
}
function fromMapped(){
  const {rows,map}=imp,F=[],S=[];
  rows.forEach(r=>{
    const g=k=>{const i=map.indexOf(k);return i<0?"":r[i]};
    const d=toDate(g("d"));
    if(d){
      let tot=toMin(g("tot"));const dt=clock(g("dt")),at=clock(g("at"));
      if(!tot)tot=block(dt,at);
      const f=normF({d,dp:g("dp"),dt,ap:g("ap"),at,typ:g("typ"),reg:g("reg"),se:toMin(g("se")),me:toMin(g("me")),mp:toMin(g("mp")),tot,pic:g("pic"),tod:g("tod"),ton:g("ton"),ldd:g("ldd"),ldn:g("ldn"),
        night:toMin(g("night")),ifr:toMin(g("ifr")),fpic:toMin(g("fpic")),fcop:toMin(g("fcop")),fdual:toMin(g("fdual")),finst:toMin(g("finst")),rem:g("rem"),crew:g("crew")});
      if(f.tot)F.push(f);
    }
    const sd=toDate(g("sd"));
    if(sd){const st=toMin(g("stot"));if(st)S.push({id:uid(),d:sd,typ:String(g("styp")).trim(),tot:st,role:"",tol:0,rem:String(g("rem")).trim()})}
  });
  return {F,S};
}
function normF(o){
  const n=v=>Math.max(0,parseInt(v)||0),s=v=>String(v??"").trim();
  const f={id:uid(),d:o.d,dp:s(o.dp).toUpperCase().slice(0,5),dt:clock(o.dt),ap:s(o.ap).toUpperCase().slice(0,5),at:clock(o.at),typ:s(o.typ).toUpperCase(),reg:s(o.reg).toUpperCase(),
    se:+o.se||0,me:+o.me||0,mp:+o.mp||0,tot:+o.tot||0,pic:s(o.pic),tod:n(o.tod),ton:n(o.ton),ldd:n(o.ldd),ldn:n(o.ldn),night:+o.night||0,ifr:+o.ifr||0,
    fpic:+o.fpic||0,fcop:+o.fcop||0,fdual:+o.fdual||0,finst:+o.finst||0,rem:s(o.rem),crew:s(o.crew)};
  if(!f.tot)f.tot=Math.max(f.se+f.me+f.mp,f.fpic+f.fcop+f.fdual+f.finst);
  return f;
}
const keyF=f=>[f.d,f.dp,f.ap,f.dt||hm(f.tot)].join("|");
const keyS=s=>[s.d,s.typ.toLowerCase(),s.tot].join("|");

function drawPreview(){
  const {F,S}=imp.parsed;
  const AS0=allS(),exF=new Set(allF().map(keyF)),exS=new Set(AS0.map(keyS)),exExt=new Set(AS0.map(s=>s.ext).filter(Boolean)),satDays=new Set(AS0.filter(s=>/Simple Aviation/i.test(s.dev||"")).map(s=>s.d));
  F.forEach(f=>f._dup=exF.has(keyF(f)));S.forEach(s=>s._dup=s.ext?(exExt.has(s.ext)||(/^sat:/.test(s.ext)&&satDays.has(s.d))):exS.has(keyS(s)));
  const nF=F.filter(f=>!f._dup),nS=S.filter(s=>!s._dup),t=sum(nF);
  const warn=F.length===0&&S.length===0;
  areaMsg(`
   <div class="row"><h3>Vista previa · ${esc(imp.file)}</h3><span class="spacer"></span><button class="btn" id="backMap"${imp.kind==="sheet"?"":" hidden"}>Volver a columnas</button></div>
   ${warn?`<div class="msg w">No he encontrado filas con fecha y tiempo de vuelo. Revisa la asignación de columnas${imp.kind==="sheet"?" o prueba “Que lo interprete Claude”":""}.</div>`:
   `<div class="msg ok">${nF.length} vuelos nuevos (${hm0(t.tot)} h) y ${nS.length} sesiones de simulador. ${F.length-nF.length+S.length-nS.length?`${F.length-nF.length+S.length-nS.length} ya estaban en el libro y se saltan (tachados).`:""}</div>`}
   <div class="prev"><table><thead><tr><th>Fecha</th><th>Salida</th><th>Off</th><th>Llegada</th><th>On</th><th>Tipo</th><th>Matr.</th><th>MP</th><th>Total</th><th>PIC</th><th>LDG</th><th>Noche</th><th>F.PIC</th><th>F.COP</th><th>F.INS</th><th>Obs.</th></tr></thead><tbody>
   ${F.slice(0,400).map(f=>`<tr class="${f._dup?"dup":""}"><td>${fmtD(f.d)}</td><td>${esc(f.dp)}</td><td>${f.dt}</td><td>${esc(f.ap)}</td><td>${f.at}</td><td>${esc(f.typ)}</td><td>${esc(f.reg)}</td><td>${hm(f.mp)}</td><td>${hm(f.tot)}</td><td>${esc(f.pic)}</td><td>${f.ldd+f.ldn||""}</td><td>${hm(f.night)}</td><td>${hm(f.fpic)}</td><td>${hm(f.fcop)}</td><td>${hm(f.finst)}</td><td>${esc(f.rem)}</td></tr>`).join("")}
   ${S.map(s=>`<tr class="${s._dup?"dup":""}"><td>${fmtD(s.d)}</td><td colspan="5">SIM · ${esc(s.typ)}</td><td></td><td></td><td>${hm(s.tot)}</td><td colspan="6"></td><td>${esc(s.rem)}</td></tr>`).join("")}
   </tbody></table></div>
   ${F.length>400?`<p class="note">Mostrando 400 de ${F.length} vuelos; se importan todos.</p>`:""}
   <label class="row note"><input type="checkbox" id="fillMp"${imp.kind==="json"?"":" checked"}> Si una fila no trae multi-pilot ni SE/ME, anotar el total como multi-pilot; si no trae IFR, IFR = total</label>
   <label class="row note"><input type="checkbox" id="fillNight"${imp.kind==="json"?"":" checked"}> Calcular la noche y los T/O-LDG de noche cuando la fila no los trae (con horas off/on y aeropuertos conocidos)</label>
   <label class="row note">Si una fila no trae función (col. 10), anotar el total como <select id="fillRole"><option value="auto">PIC si el nombre PIC es SELF; si no, copiloto</option><option value="pic">PIC</option><option value="cop">Copiloto</option><option value=""${imp.kind==="json"?" selected":""}>No anotar</option></select></label>
   ${imp.parsed.C&&imp.parsed.C.length?`<label class="row note"><input type="checkbox" id="impCur" checked> Guardar también ${imp.parsed.C.length} caducidades (actualiza las que tengan el mismo nombre)</label>`:""}
   ${imp.parsed.O?`<label class="row note"><input type="checkbox" id="impOpen" checked> Guardar también el saldo inicial: <b>${hm0(+imp.parsed.O.tot||0)} h</b> anteriores${imp.parsed.O.date?" al "+fmtD(imp.parsed.O.date):""} (sustituye al de Ajustes)</label>`:""}
   <div class="row"><button class="btn pri" id="doImp"${nF.length+nS.length+(imp.parsed.O?1:0)+(imp.parsed.C?.length||0)?"":" disabled"}>Importar ${nF.length+nS.length} registros</button><div class="prog" style="flex:1;min-width:120px"><i id="impProg"></i></div></div>`);
  $("#backMap")&&($("#backMap").onclick=drawMapping);
  $("#doImp").onclick=()=>commit(nF,nS);
}
async function commit(F,S){
  $("#doImp").disabled=true;
  if($("#fillNight")?.checked){await loadApts();F.forEach((f,i)=>{if(!f.night&&!f.ton&&!f.ldn){const r=withNight(f);if(r)F[i]=r}})}
  if($("#fillMp")?.checked)F.forEach(f=>{if(!f.mp&&!f.se&&!f.me)f.mp=f.tot;if(!f.ifr)f.ifr=f.tot});
  const fr=$("#fillRole")?.value||"";
  if(fr)F.forEach(f=>{if(f.fpic||f.fcop||f.fdual||f.finst)return;const r=fr==="auto"?(/^(self|yo)$/i.test(f.pic)?"pic":"cop"):fr;f[r==="pic"?"fpic":"fcop"]=f.tot;if(r==="pic"&&!f.pic)f.pic="SELF"});
  F.forEach(f=>delete f._dup);S.forEach(s=>delete s._dup);
  const CX=imp.parsed?.C;if(CX&&CX.length&&$("#impCur")?.checked){const ex=new Map(live("c").map(c=>[c.name.toLowerCase(),c]));bulkPut(CX.map(c=>["c",{id:ex.get(c.name.toLowerCase())?.id||uid(),name:c.name,d:c.d,done:c.done||"",cat:c.cat||"",warn:+c.warn||60}]))}
  const O=imp.parsed?.O;if(O&&$("#impOpen")?.checked){const v={};OPEN_KEYS.forEach(k=>v[k]=+O[k]||0);putRec("x",{id:"open",d:"",date:O.date||"",note:O.note||"",v})}
  const ok=bulkPut([...F.map(r=>["f",r]),...S.map(r=>["s",r])]);
  $("#impProg").style.width="100%";page=null;
  area.insertAdjacentHTML("afterbegin",ok?`<div class="msg ok">Importado: ${F.length} vuelos y ${S.length} sesiones. ${cloud.user?"Se están subiendo a la nube.":"Guardados en este dispositivo."}</div>`:`<div class="msg b">El almacenamiento del navegador está lleno; no se pudo guardar todo.</div>`);
  toast("Importación completada");
}
/* PDF: text per page, rows by y-position */
async function readPDF(file){
  await needPDF();
  pdfjsLib.GlobalWorkerOptions.workerSrc="vendor/pdf.worker.min.js";
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;
  const pages=[];
  for(let p=1;p<=pdf.numPages;p++){
    const tc=await (await pdf.getPage(p)).getTextContent();
    const lines={};
    tc.items.forEach(it=>{if(!it.str.trim())return;const y=Math.round(it.transform[5]/3)*3;(lines[y]=lines[y]||[]).push([it.transform[4],it.str.trim()])});
    const txt=Object.keys(lines).sort((a,b)=>b-a).map(y=>lines[y].sort((a,b)=>a[0]-b[0]).map(x=>x[1]).join(" | ")).join("\n");
    pages.push(txt);
    area.querySelector(".prog i")&&(area.querySelector(".prog i").style.width=(15+p/pdf.numPages*60)+"%");
  }
  if(/Simple Aviation Training/.test(pages[0]||"")&&/logbook/i.test(pages[0]||"")){await satImport(pdf,file);return}
  imp={file:file.name,kind:"pdf",pages};
  const chars=pages.join("").replace(/\s|\|/g,"").length;
  if(chars<40){areaMsg(`<div class="msg w">Este PDF no tiene texto seleccionable (parece escaneado). Hazle OCR o expórtalo a Excel desde tu app de logbook e impórtalo aquí.</div>`);return}
  const heur=heuristicPDF(pages);
  const hasKey=!!aiKey();
  areaMsg(`<div class="row"><h3>${esc(file.name)}</h3><span class="note">${pdf.numPages} páginas leídas · ${heur.F.length} filas reconocidas en lectura rápida</span></div>
    ${hasKey?`<p>Tienes la clave de Claude configurada: es la opción más fiable para PDF.</p>`:`<p class="note">Para PDF con formatos complicados, añade tu clave de Claude en Ajustes y usa “Interpretar con Claude”.</p>`}
    <div class="row"><button class="btn${hasKey?" pri":""}" id="aiPdf"${hasKey?"":" disabled"}>Interpretar con Claude</button><button class="btn${hasKey?"":" pri"}" id="heurPdf"${heur.F.length?"":" disabled"}>Lectura rápida (${heur.F.length} filas)</button></div>
    <details><summary class="note">Ver texto extraído (página 1)</summary><pre style="white-space:pre-wrap;font-size:11px;max-height:240px;overflow:auto">${esc(pages[0].slice(0,4000))}</pre></details>`);
  $("#aiPdf").onclick=()=>aiParse(pages,"");
  $("#heurPdf").onclick=()=>{imp.parsed=heur;drawPreview()};
}
function heuristicPDF(pages){
  const F=[];
  pages.join("\n").split("\n").forEach(line=>{
    const cells=line.split(" | ");const d=toDate(cells[0]);if(!d)return;
    const icao=line.match(/\b[A-Z]{4}\b/g)||[],times=line.match(/\b\d{1,2}:\d{2}\b/g)||[];
    if(icao.length<2||times.length<3)return;
    const dt=clock(times[0]),at=clock(times[1]);let tot=block(dt,at)||toMin(times[2]);
    const reg=(line.match(/\b[A-Z]{1,2}-[A-Z0-9]{3,5}\b/)||[""])[0];
    const typ=(line.match(/\b(A3\d{2}[-\dA-Z]*|B7\d7[-\dA-Z]*|ATR\s?\d+|E\d{3}|CRJ\d+|C\d{3})\b/i)||[""])[0];
    F.push(normF({d,dp:icao[0],ap:icao[1],dt,at,tot,mp:tot,reg,typ}));
  });
  return {F,S:[]};
}
function chunkRows(lines,n){const out=[];for(let i=0;i<lines.length;i+=n)out.push(lines.slice(i,i+n).join("\n"));return out}

/* ---------- Claude API (optional, user's own key) ---------- */
const aiKey=()=>ls.get("lb_aikey","");
async function askClaude(prompt){
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":aiKey(),"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model:"claude-sonnet-5-5",max_tokens:8000,messages:[{role:"user",content:prompt}]})});
  if(!r.ok){const t=await r.text().catch(()=>"");const err=new Error(r.status===401?"Clave de Claude no válida":r.status===429?"rate":"Error "+r.status+" "+t.slice(0,120));err.status=r.status;throw err}
  const j=await r.json();const text=(j.content||[]).map(c=>c.text||"").join("");
  const a=text.indexOf("{"),b=text.lastIndexOf("}");if(a<0||b<a)throw new Error("Respuesta sin JSON");
  return JSON.parse(text.slice(a,b+1));
}
async function aiParse(chunks,header){
  if(!aiKey()){areaMsg(`<div class="msg w">Añade tu clave de Claude en Ajustes para usar esta opción.</div><button class="btn" data-go="set">Ir a Ajustes</button>`);return}
  if(!navigator.onLine){areaMsg(`<div class="msg w">Necesitas conexión para interpretar con Claude.</div>`);return}
  chunks=chunks.filter(c=>c.replace(/[\s|]/g,"").length>20);
  areaMsg(`<div class="row"><h3>Interpretando ${esc(imp.file)}</h3><span class="note" id="aiStat">0 / ${chunks.length}</span><span class="spacer"></span><button class="btn" id="aiStop">Parar</button></div><div class="prog"><i id="aiProg"></i></div><p class="note">Claude lee cada bloque y devuelve las filas. No cierres la app.</p>`);
  let stop=false;$("#aiStop").onclick=()=>stop=true;
  const F=[],S=[];let errs=0,lastErr="";
  for(let i=0;i<chunks.length&&!stop;i++){
    const prompt=`Eres un conversor de libros de vuelo de piloto (formato EASA FCL.050, columnas 1-12). Abajo hay ${imp.kind==="pdf"?"el texto de una página de un PDF":"filas de una hoja de cálculo"}: una fila por línea, celdas separadas por " | ".${header?"\nCabeceras de columna: "+header:""}
Devuelve SOLO un objeto JSON con esta forma exacta:
{"flights":[{"date":"YYYY-MM-DD","dep":"LEBL","depTime":"HH:MM","arr":"LEMD","arrTime":"HH:MM","type":"A320","reg":"EC-ABC","se":"H:MM","me":"H:MM","mp":"H:MM","total":"H:MM","picName":"","toDay":0,"toNight":0,"ldgDay":0,"ldgNight":0,"night":"H:MM","ifr":"H:MM","pic":"H:MM","copilot":"H:MM","dual":"H:MM","instructor":"H:MM","remarks":""}],"sims":[{"date":"YYYY-MM-DD","type":"FFS A320","total":"H:MM","remarks":""}]}
Reglas: una entrada por fila de vuelo; las fechas tipo 05/03/24 son día/mes/año; ignora cabeceras y filas de totales ("total this page", "total from previous pages", "total time"); si una fila es una sesión de simulador (columna 11 o tipo FFS/FTD/FNPT/SIM) va en "sims"; campos ausentes = "" o 0; no inventes datos. Si no hay filas, devuelve {"flights":[],"sims":[]}.

${chunks[i]}`;
    try{
      const r=await askClaude(prompt);
      (r?.flights||[]).forEach(o=>{const d=toDate(o.date);if(!d)return;const f=normF({d,dp:o.dep,dt:o.depTime,ap:o.arr,at:o.arrTime,typ:o.type,reg:o.reg,se:toMin(o.se),me:toMin(o.me),mp:toMin(o.mp),tot:toMin(o.total)||block(clock(o.depTime),clock(o.arrTime)),pic:o.picName,tod:o.toDay,ton:o.toNight,ldd:o.ldgDay,ldn:o.ldgNight,night:toMin(o.night),ifr:toMin(o.ifr),fpic:toMin(o.pic),fcop:toMin(o.copilot),fdual:toMin(o.dual),finst:toMin(o.instructor),rem:o.remarks});if(f.tot)F.push(f)});
      (r?.sims||[]).forEach(o=>{const d=toDate(o.date),t=toMin(o.total);if(d&&t)S.push({id:uid(),d,typ:String(o.type||"").trim(),tot:t,role:"",tol:0,rem:String(o.remarks||"").trim()})});
    }catch(e){
      if(e.status===401){areaMsg(`<div class="msg b">La clave de Claude no es válida. Revísala en Ajustes.</div>`);return}
      if(e.status===429||e.message==="rate"){await new Promise(r=>setTimeout(r,8000));i--;continue}
      errs++;lastErr=e.message;
    }
    $("#aiStat").textContent=`${i+1} / ${chunks.length} · ${F.length} vuelos`;$("#aiProg").style.width=((i+1)/chunks.length*100)+"%";
  }
  imp.parsed={F,S};drawPreview();
  if(errs)area.insertAdjacentHTML("afterbegin",`<div class="msg w">${errs} bloque(s) no se pudieron leer (${esc(lastErr)}). Revisa la vista previa antes de importar.</div>`);
}
async function readJSON(file){
  const j=JSON.parse(await file.text());
  const F=(j.flights||[]).map(f=>({...f,id:f.id||uid()})).filter(f=>f.d),S=(j.sims||[]).map(s=>({...s,id:s.id||uid()})).filter(s=>s.d);
  imp={file:file.name,kind:"json",parsed:{F,S,O:j.opening&&typeof j.opening==="object"?j.opening:null,C:Array.isArray(j.expiries)?j.expiries.filter(c=>c&&c.name&&c.d):null}};drawPreview();
}
/* ---------- export ---------- */
function saveBlob(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000)}
async function exportXlsx(){
  await needXLSX();
  const F=allF().map(f=>({Fecha:fmtD(f.d),"Salida":f.dp,"Off":f.dt,"Llegada":f.ap,"On":f.at,"Tipo":f.typ,"Matrícula":f.reg,"SE":hm(f.se),"ME":hm(f.me),"Multi-pilot":hm(f.mp),"Total":hm(f.tot),"Nombre PIC":f.pic,"T/O día":f.tod,"T/O noche":f.ton,"LDG día":f.ldd,"LDG noche":f.ldn,"Noche":hm(f.night),"IFR":hm(f.ifr),"PIC":hm(f.fpic),"Copiloto":hm(f.fcop),"Dual":hm(f.fdual),"Instructor":hm(f.finst),"Observaciones":f.rem,"Tripulación":f.crew||""}));
  const S=allS().map(s=>({Fecha:fmtD(s.d),"Tipo FSTD":s.typ,"Centro / dispositivo":s.dev||"","Sesión":s.kind||"","Módulo":s.mod||"","Tiempo":hm(s.tot),"Rol":s.role,"T/O+LDG":s.tol,"Aprox. instr.":s.app||0,"En el libro":s.inBook===false?"No":"Sí","Escenario":s.scen||"","Observaciones":s.rem}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(F),"Vuelos");XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(S),"Simulador");
  const out=XLSX.write(wb,{type:"array",bookType:"xlsx"});
  saveBlob(new Blob([out],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"logbook_"+today()+".xlsx");
}
function backupBlob(){return new Blob([JSON.stringify({app:"pilot-logbook",version:APP_VERSION,exported:new Date().toISOString(),flights:allF(),sims:allS(),expiries:live("c"),...(opening().on?{opening:(({on,...o})=>o)(opening())}:{})},null,1)],{type:"application/json"})}
function exportJson(){saveBlob(backupBlob(),"logbook_backup_"+today()+".json");ls.set("lb_lastbackup",today());renderBackup()}
async function shareBackup(){
  const name="logbook_backup_"+today()+".json",file=new File([backupBlob()],name,{type:"application/json"});
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:"Copia del logbook"});ls.set("lb_lastbackup",today());renderBackup();toast("Copia enviada");return}catch(e){if(e&&e.name==="AbortError")return}}
  exportJson();
}
function renderBackup(){
  const last=ls.get("lb_lastbackup",""),n=last?Math.round((Date.parse(today())-Date.parse(last))/864e5):null,has=allF().length+allS().length>0;
  if($("#bkNote"))$("#bkNote").textContent=last?`Última copia: ${fmtD(last)} (hace ${n} días)`:"Aún no has hecho ninguna copia";
  const b=$("#bkBanner");if(b){b.hidden=!has||(n!=null&&n<7);b.querySelector("span").textContent=last?`Hace ${n} días de tu última copia de seguridad.`:"Aún no has guardado ninguna copia de seguridad de tu libro.";}
}
$("#exportBtn").onclick=exportXlsx;$("#exportBtn2").onclick=exportXlsx;$("#exportJson").onclick=exportJson;
document.addEventListener("click",e=>{if(e.target.closest("[data-backup]"))shareBackup()});

/* ---------- settings ---------- */
function renderCloud(){
  const p=$("#cloudPanel");if(!p)return;
  const c=cloud;
  if(!c.cfg){
    p.innerHTML=`<h3>Sincronización en la nube</h3>
      <p class="note">Conecta tu proyecto gratuito de Supabase para tener los mismos datos en el móvil y en el ordenador. Los pasos están en la guía <code>LEEME.md</code>.</p>
      <div class="f"><label for="cUrl">Project URL</label><input id="cUrl" placeholder="https://xxxx.supabase.co" autocomplete="off" inputmode="url"></div>
      <div class="f"><label for="cKey">anon public key</label><input id="cKey" placeholder="eyJhbGciOi…" autocomplete="off"></div>
      <div class="row"><button class="btn pri" id="cSave">Guardar</button><span class="note" id="cMsg"></span></div>`;
    $("#cSave").onclick=()=>{const url=$("#cUrl").value.trim().replace(/\/(rest|auth)\/v1.*$/i,"").replace(/\/+$/,""),key=$("#cKey").value.trim();
      if(!/^https:\/\/.+/.test(url)||key.length<30){$("#cMsg").textContent="Revisa la URL (empieza por https://) y la clave anon.";return}
      cloud.cfg={url,key};ls.set("lb_cloud",cloud.cfg);connectCloud()};
    return;
  }
  if(!c.user){
    p.innerHTML=`<h3>Sincronización en la nube</h3>
      <p class="note">Proyecto: <code>${esc(c.cfg.url.replace("https://",""))}</code></p>
      ${c.err?`<div class="msg b">${esc(c.err)}</div>`:""}
      <div class="f"><label for="cMail">Email</label><input id="cMail" type="email" autocomplete="username"></div>
      <div class="f"><label for="cPass">Contraseña</label><input id="cPass" type="password" autocomplete="current-password"></div>
      <div class="row"><button class="btn pri" id="cIn">Entrar</button><button class="btn" id="cUp">Crear mi cuenta</button><span class="spacer"></span><button class="btn" id="cReset">Cambiar proyecto</button></div>
      <p class="note" id="cMsg">La primera vez pulsa “Crear mi cuenta”; en los demás dispositivos, “Entrar” con el mismo email y contraseña.</p>`;
    const cred=()=>({email:$("#cMail").value.trim(),password:$("#cPass").value});
    $("#cIn").onclick=async()=>{$("#cMsg").textContent="Entrando…";const {error}=await cloud.sb.auth.signInWithPassword(cred());if(error)$("#cMsg").textContent=traduce(error.message)};
    $("#cUp").onclick=async()=>{const cr=cred();if(cr.password.length<8){$("#cMsg").textContent="Usa una contraseña de 8 caracteres o más.";return}
      $("#cMsg").textContent="Creando cuenta…";const {data,error}=await cloud.sb.auth.signUp(cr);
      if(error)$("#cMsg").textContent=traduce(error.message);else if(!data.session)$("#cMsg").textContent="Cuenta creada. Confirma el email que te ha llegado y luego pulsa “Entrar”.";};
    $("#cReset").onclick=()=>{cloud.cfg=null;ls.set("lb_cloud",null);connectCloud()};
    return;
  }
  p.innerHTML=`<h3>Sincronización en la nube</h3>
    <dl class="kv"><dt>Cuenta</dt><dd>${esc(c.user.email)}</dd><dt>Proyecto</dt><dd>${esc(c.cfg.url.replace("https://",""))}</dd><dt>Última sincronización</dt><dd>${c.last?new Date(c.last).toLocaleString("es-ES"):"—"}</dd><dt>Pendientes de subir</dt><dd>${outbox.size}</dd></dl>
    ${c.err?`<div class="msg b">${esc(c.err)}</div>`:""}
    <div class="row"><button class="btn pri" id="cNow">Sincronizar ahora</button><span class="spacer"></span><button class="btn" id="cOut">Cerrar sesión</button></div>
    <div class="confirm" id="cOutConfirm" hidden><span>${outbox.size?`Hay ${outbox.size} cambios sin subir que se perderán. `:""}Se borrará la copia de este dispositivo (en la nube sigue todo).</span><button class="btn danger" id="cOutYes">Cerrar sesión</button><button class="btn" id="cOutNo">Cancelar</button></div>`;
  $("#cNow").onclick=()=>sync();
  $("#cOut").onclick=()=>$("#cOutConfirm").hidden=false;
  $("#cOutNo").onclick=()=>$("#cOutConfirm").hidden=true;
  $("#cOutYes").onclick=async()=>{await cloud.sb.auth.signOut();E={};outbox=new Set();persist();ls.set("lb_pull",null);ls.set("lb_lastsync",null);cloud.last=null;render();renderCloud()};
}
function traduce(m){
  if(/Invalid login/i.test(m))return"Email o contraseña incorrectos.";
  if(/Email not confirmed/i.test(m))return"Falta confirmar el email: abre el enlace que te llegó.";
  if(/already registered/i.test(m))return"Ese email ya tiene cuenta: pulsa “Entrar”.";
  if(/Signups not allowed/i.test(m))return"El registro está cerrado en tu proyecto (bien): usa “Entrar”.";
  if(/fetch/i.test(m))return"No hay conexión con Supabase. Revisa la URL o tu conexión.";
  return m;
}
function renderAiKey(){const k=aiKey();$("#aiKey").value="";$("#aiKey").placeholder=k?"Guardada ("+k.slice(0,10)+"…)":"sk-ant-…";$("#aiKeyNote").textContent=k?"Clave guardada en este dispositivo.":"Sin clave: el PDF usa la lectura rápida."}
$("#aiKeySave").onclick=()=>{const v=$("#aiKey").value.trim();if(!v.startsWith("sk-")){$("#aiKeyNote").textContent="La clave empieza por sk-ant-…";return}ls.set("lb_aikey",v);renderAiKey();toast("Clave guardada")};
$("#aiKeyDel").onclick=()=>{ls.set("lb_aikey","");renderAiKey()};
$("#sync").onclick=()=>go("set");
/* ---------- estadísticas ---------- */
const DOW=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const MES=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
let stPreset=ls.get("lb_stpreset","12m"),stFrom="",stTo="";
function stRange(){
  const td=today(),y=+td.slice(0,4);
  switch(stPreset){
    case "90d":return [addDays(td,-89),td];
    case "12m":return [addDays(td,-364),td];
    case "ytd":return [y+"-01-01",td];
    case "ly":return [(y-1)+"-01-01",(y-1)+"-12-31"];
    case "custom":return [stFrom||"1900-01-01",stTo||td];
    default:return ["1900-01-01","2999-12-31"];
  }
}
const inRange=(d,[a,b])=>d>=a&&d<=b;
const dowOf=d=>(new Date(d+"T00:00:00Z").getUTCDay()+6)%7;
const pct=(a,b)=>b?Math.round(a/b*100):0;

// tooltip
const tip=document.createElement("div");tip.className="vtip";tip.hidden=true;document.body.appendChild(tip);
document.addEventListener("pointermove",e=>{
  const t=e.target.closest?.("[data-tip]");
  if(!t){tip.hidden=true;return}
  tip.innerHTML=t.dataset.tip;tip.hidden=false;
  const w=tip.offsetWidth,h=tip.offsetHeight;
  tip.style.left=Math.max(8,Math.min(innerWidth-w-8,e.clientX-w/2))+"px";
  tip.style.top=(e.clientY-h-14<8?e.clientY+18:e.clientY-h-14)+"px";
});
document.addEventListener("pointerleave",()=>tip.hidden=true);

function niceMax(v){if(v<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(v))),n=v/p;return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p}
// column chart: items [{label, v (number), tip}]; unit "h" means v in minutes shown as hours
function colChart(el,items,{unit="h",height=200,labelEvery=1,accentLast=false}={}){
  const W=Math.max(280,el.clientWidth||600),H=height,padL=40,padB=24,padT=10,padR=6;
  const toY=unit==="h"?(v=>v/60):(v=>v);
  const max=niceMax(Math.max(...items.map(i=>toY(i.v)),0)),n=items.length;
  const cw=(W-padL-padR)/Math.max(1,n),bw=Math.max(2,Math.min(42,cw-2));
  const y=v=>padT+(H-padT-padB)*(1-v/max);
  labelEvery=Math.max(labelEvery,Math.ceil(34/cw));
  let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`;
  for(let k=0;k<=4;k++){const v=max*k/4,yy=y(v);s+=`<line x1="${padL}" x2="${W-padR}" y1="${yy}" y2="${yy}" class="grid"/><text x="${padL-6}" y="${yy+4}" class="ax" text-anchor="end">${unit==="h"?Math.round(v):Math.round(v*10)/10}</text>`}
  items.forEach((it,i)=>{
    const v=toY(it.v),x=padL+i*cw+(cw-bw)/2,yy=y(v),h=Math.max(0,H-padB-yy);
    const cls=accentLast&&i===n-1?"bar now":"bar";
    if(h>0){const r=Math.min(4,bw/2,h);s+=`<path class="${cls}" d="M${x},${H-padB} V${yy+r} Q${x},${yy} ${x+r},${yy} H${x+bw-r} Q${x+bw},${yy} ${x+bw},${yy+r} V${H-padB} Z"/>`}
    s+=`<rect x="${padL+i*cw}" y="${padT}" width="${cw}" height="${H-padT-padB}" fill="transparent" data-tip="${esc(it.tip||it.label+": "+(unit==="h"?hm0(it.v)+" h":it.v))}"/>`;
    if(i%labelEvery===0)s+=`<text x="${padL+i*cw+cw/2}" y="${H-7}" class="ax" text-anchor="middle">${esc(it.label)}</text>`;
  });
  s+=`<line x1="${padL}" x2="${W-padR}" y1="${H-padB}" y2="${H-padB}" class="base"/></svg>`;
  el.innerHTML=s;
}
// line chart (cumulative)
function lineChart(el,pts,{height=200}={}){
  const W=Math.max(280,el.clientWidth||600),H=height,padL=48,padB=24,padT=12,padR=10;
  if(pts.length<2){el.innerHTML=`<p class="note">Necesito al menos dos meses con vuelos.</p>`;return}
  const max=niceMax(pts[pts.length-1].v/60),n=pts.length;
  const x=i=>padL+(W-padL-padR)*i/(n-1),y=v=>padT+(H-padT-padB)*(1-v/60/max);
  let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`;
  for(let k=0;k<=4;k++){const v=max*k/4,yy=padT+(H-padT-padB)*(1-k/4);s+=`<line x1="${padL}" x2="${W-padR}" y1="${yy}" y2="${yy}" class="grid"/><text x="${padL-6}" y="${yy+4}" class="ax" text-anchor="end">${Math.round(v)}</text>`}
  const d=pts.map((p,i)=>(i?"L":"M")+x(i).toFixed(1)+","+y(p.v).toFixed(1)).join("");
  s+=`<path d="${d} L${x(n-1)},${H-padB} L${x(0)},${H-padB} Z" class="area"/><path d="${d}" class="line"/>`;
  const step=Math.ceil(n/Math.max(2,Math.floor((W-padL-padR)/62)));
  pts.forEach((p,i)=>{if((i%step===0&&n-1-i>=step*0.6)||i===n-1)s+=`<text x="${x(i)}" y="${H-7}" class="ax" text-anchor="${i===n-1?"end":"middle"}">${esc(p.label)}</text>`;
    s+=`<rect x="${x(i)-(W-padL-padR)/(2*(n-1))}" y="${padT}" width="${(W-padL-padR)/(n-1)}" height="${H-padT-padB}" fill="transparent" data-tip="${esc(p.tip)}"/>`});
  const lp=pts[n-1];s+=`<circle cx="${x(n-1)}" cy="${y(lp.v)}" r="4.5" class="dot"/><text x="${x(n-1)-8}" y="${y(lp.v)-10}" class="lbl" text-anchor="end">${hm0(lp.v)}</text>`;
  el.innerHTML=s+`<line x1="${padL}" x2="${W-padR}" y1="${H-padB}" y2="${H-padB}" class="base"/></svg>`;
}
// horizontal ranking
function rankList(el,rows,{fmt=v=>v,max:mx,sub}={}){
  if(!rows.length){el.innerHTML=`<p class="note">Sin datos en este periodo.</p>`;return}
  const max=mx||Math.max(...rows.map(r=>r.v));
  el.innerHTML=rows.map(r=>`<div class="rk" data-tip="${esc(r.tip||"")}"><span class="rk-l">${esc(r.label)}${r.sub?`<small>${esc(r.sub)}</small>`:""}</span><span class="rk-b"><i style="width:${(r.v/max*100).toFixed(1)}%"></i></span><span class="rk-v">${fmt(r.v)}</span></div>`).join("");
}
function count(arr,keyFn,valFn=()=>1){const m=new Map();arr.forEach(x=>{const k=keyFn(x);if(!k)return;m.set(k,(m.get(k)||0)+valFn(x))});return m}

function renderStats(){
  if(view!=="st")return;
  const R=stRange(),F=allF().filter(f=>inRange(f.d,R)),S=allS().filter(s=>inRange(s.d,R)),t=sum(F);
  $("#stPeriod").textContent=F.length?`${fmtD(F[0].d)} – ${fmtD(F[F.length-1].d)} · ${F.length} sectores`:"Sin vuelos en este periodo";
  // KPIs
  const days=new Set(F.map(f=>f.d)).size,apts=new Set(F.flatMap(f=>[f.dp,f.ap]).filter(Boolean)).size,regs=new Set(F.map(f=>f.reg).filter(Boolean)).size;
  const longest=F.reduce((a,f)=>!a||f.tot>a.tot?f:a,null),sTot=S.reduce((a,s)=>a+(+s.tot||0),0);
  const kp=[["Horas de vuelo",hm0(t.tot),"col. 6"],["Sectores",F.length,""],["Días volados",days,days?`${(F.length/days).toFixed(1)} sectores/día`:""],["Sector medio",F.length?hm0(t.tot/F.length):"0:00",""],
    ["Sector más largo",longest?hm0(longest.tot):"—",longest?`${longest.dp}–${longest.ap} · ${fmtD(longest.d)}`:""],["Aeropuertos",apts,""],["Matrículas",regs,""],["Aterrizajes",t.ldd+t.ldn,t.ldn?`${t.ldn} de noche`:""],
    ["Noche",hm0(t.night),pct(t.night,t.tot)+" % del total"],["Simulador",hm0(sTot),`${S.length} sesiones`]];
  $("#stKpi").innerHTML=kp.map(([k,v,s])=>`<div class="cell"><div class="k">${k}</div><div class="v">${v}</div>${s?`<div class="note">${esc(s)}</div>`:""}</div>`).join("");
  renderMap(F);
  // monthly or yearly
  const span=F.length?(new Date(F[F.length-1].d)-new Date(F[0].d))/864e5:0;
  const byYear=span>3*365;
  const mm=count(F,f=>byYear?f.d.slice(0,4):f.d.slice(0,7),f=>+f.tot||0);
  let keys=[];
  if(F.length){
    if(byYear){for(let y=+F[0].d.slice(0,4);y<=+F[F.length-1].d.slice(0,4);y++)keys.push(String(y))}
    else{let [y,m]=(R[0]>"1900"?R[0]:F[0].d).slice(0,7).split("-").map(Number);const end=(R[1]<"2999"?R[1]:F[F.length-1].d).slice(0,7);
      for(let g=0;g<400;g++){const k=y+"-"+String(m).padStart(2,"0");if(k>end)break;keys.push(k);if(++m>12){m=1;y++}}}
  }
  $("#stMonthsT").textContent=byYear?"Horas por año":"Horas por mes";
  const mItems=keys.map(k=>({label:byYear?k:MES[+k.slice(5)-1]+(k.slice(5)==="01"||keys.length<=12?"":"")+(k.slice(5)==="01"&&keys.length>12?" "+k.slice(2,4):""),v:mm.get(k)||0,tip:`<b>${byYear?k:MES[+k.slice(5)-1]+" "+k.slice(0,4)}</b><br>${hm0(mm.get(k)||0)} h · ${F.filter(f=>f.d.startsWith(k)).length} sectores`}));
  colChart($("#stMonths"),mItems,{labelEvery:keys.length>24?3:keys.length>14?2:1,accentLast:!byYear&&R[1]>=today()});
  heatCal($("#stHeat"),F,R);
  renderYears();renderPassport(F);renderActivity(F,R);
  // cumulative all-time
  const AF=allF(),cm=count(AF,f=>f.d.slice(0,7),f=>+f.tot||0),ck=[...cm.keys()].sort();let acc=0;
  lineChart($("#stCum"),ck.map(k=>{acc+=cm.get(k);return {label:MES[+k.slice(5)-1]+" "+k.slice(2,4),v:acc,tip:`<b>${MES[+k.slice(5)-1]} ${k.slice(0,4)}</b><br>Acumulado ${hm0(acc)} h`}}));
  // roles
  const roles=[["PIC",t.fpic,"c1"],["Copiloto",t.fcop,"c2"],["Instructor",t.finst,"c3"],["Dual",t.fdual,"c4"]],rt=roles.reduce((a,r)=>a+r[1],0);
  const _splitP=F.length?`<div class="rp-x">${splitTable(F,false)}</div>`:"";
  $("#stRoles").innerHTML=_splitP+(rt?`<div class="stack">${roles.filter(r=>r[1]).map(([l,v,c])=>`<i class="${c}" style="flex:${v}" data-tip="<b>${l}</b><br>${hm0(v)} h · ${pct(v,rt)} %"></i>`).join("")}</div>
    <div class="legend">${roles.filter(r=>r[1]).map(([l,v,c])=>`<span><i class="${c}"></i>${l} <b class="mono">${hm0(v)}</b> <span class="note">${pct(v,rt)} %</span></span>`).join("")}</div>`:`<p class="note">Sin horas de función en el periodo.</p>`);
  const ops=[["Multi-pilot",t.mp],["SP multimotor",t.me],["SP monomotor",t.se]].filter(o=>o[1]);
  $("#stOps").innerHTML=ops.map(([l,v])=>`<span>${l} <b class="mono">${hm0(v)}</b></span>`).join(" · ")+(t.ifr?` · <span>IFR <b class="mono">${hm0(t.ifr)}</b> (${pct(t.ifr,t.tot)} %)</span>`:"");
  // destinations
  const base=[...count(F,f=>f.dp).entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
  const dest=[...count(F.filter(f=>f.ap&&f.ap!==base),f=>f.ap).entries()].sort((a,b)=>b[1]-a[1]).slice(0,12);
  $("#stDestT").textContent="Destinos más volados"+(base?` (sin contar ${base})`:"");
  rankList($("#stDest"),dest.map(([k,v])=>({label:k,v,tip:`<b>${k}</b><br>${v} llegadas`})),{fmt:v=>v+"×"});
  const rts=count(F.filter(f=>f.dp&&f.ap),f=>[f.dp,f.ap].sort().join(" ⇄ "));
  const rtsT=count(F.filter(f=>f.dp&&f.ap),f=>[f.dp,f.ap].sort().join(" ⇄ "),f=>+f.tot||0);
  rankList($("#stRoutes"),[...rts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>({label:k,sub:`medio ${hm0(rtsT.get(k)/v)}`,v,tip:`<b>${k}</b><br>${v} sectores · ${hm0(rtsT.get(k))} h`})),{fmt:v=>v+"×"});
  const rg=count(F,f=>f.reg,f=>+f.tot||0),rgN=count(F,f=>f.reg);
  rankList($("#stRegs"),[...rg.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>({label:k,v,sub:`${rgN.get(k)} sectores`,tip:`<b>${k}</b><br>${hm0(v)} h`})),{fmt:hm0});
  const ty=count(F,f=>f.typ||"—",f=>+f.tot||0);
  rankList($("#stTypes"),[...ty.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>({label:k,v,sub:pct(v,t.tot)+" %"})),{fmt:hm0});
  // weekday / hour / duration
  const dw=Array(7).fill(0),dwN=Array(7).fill(0);F.forEach(f=>{const i=dowOf(f.d);dw[i]+=+f.tot||0;dwN[i]++});
  colChart($("#stDow"),DOW.map((l,i)=>({label:l,v:dw[i],tip:`<b>${l}</b><br>${hm0(dw[i])} h · ${dwN[i]} sectores`})),{height:170});
  const hr=Array(24).fill(0);F.forEach(f=>{if(f.dt)hr[+f.dt.slice(0,2)]++});
  colChart($("#stHour"),hr.map((v,i)=>({label:String(i).padStart(2,"0"),v,tip:`<b>${String(i).padStart(2,"0")}:00–${String(i).padStart(2,"0")}:59 UTC</b><br>${v} salidas`})),{unit:"n",height:170,labelEvery:3});
  const bk=Array(11).fill(0);F.forEach(f=>{bk[Math.min(10,Math.floor((+f.tot||0)/30))]++});
  colChart($("#stDur"),bk.map((v,i)=>({label:i===10?"5h+":hm0(i*30),v,tip:`<b>${i===10?"5:00 o más":hm0(i*30)+"–"+hm0(i*30+29)}</b><br>${v} sectores`})),{unit:"n",height:170,labelEvery:2});
  // records
  const byDay=count(F,f=>f.d,f=>+f.tot||0),bestDay=[...byDay.entries()].sort((a,b)=>b[1]-a[1])[0];
  const bestM=[...count(F,f=>f.d.slice(0,7),f=>+f.tot||0).entries()].sort((a,b)=>b[1]-a[1])[0];
  const secDay=[...count(F,f=>f.d).entries()].sort((a,b)=>b[1]-a[1])[0];
  const rec=[["Primer vuelo",F[0]?`${fmtD(F[0].d)} · ${F[0].dp}–${F[0].ap}`:"—"],["Último vuelo",F.length?`${fmtD(F[F.length-1].d)} · ${F[F.length-1].dp}–${F[F.length-1].ap}`:"—"],
    ["Día con más horas",bestDay?`${fmtD(bestDay[0])} · ${hm0(bestDay[1])} h`:"—"],["Día con más sectores",secDay?`${fmtD(secDay[0])} · ${secDay[1]}`:"—"],
    ["Mes con más horas",bestM?`${MES[+bestM[0].slice(5)-1]} ${bestM[0].slice(0,4)} · ${hm0(bestM[1])} h`:"—"],["País/zona más visitado",(()=>{const z=count(F.filter(f=>f.ap&&f.ap!==base),f=>zoneOf(f.ap));const b=[...z.entries()].sort((a,b)=>b[1]-a[1])[0];return b?`${b[0]} · ${b[1]} llegadas`:"—"})()]];
  {let far=null;F.forEach(f=>{const d=fDist(f);if(d!=null&&(!far||d>far.d))far={d,f}});if(far)rec.splice(2,0,["Vuelo más lejano",`${far.f.dp}–${far.f.ap} · ${fmtInt(far.d)} nm`]);}
  $("#stRec").innerHTML=rec.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");
  // countries
  const zc=count(F.filter(f=>f.ap),f=>zoneOf(f.ap));
  rankList($("#stZones"),[...zc.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>({label:k,v})),{fmt:v=>v+"×"});
  // sims
  const sr=count(S,s=>s.role||"—",s=>+s.tot||0);
  renderPoster();
  rankList($("#stSim"),[...sr.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>({label:k,v,sub:`${S.filter(s=>(s.role||"—")===k).length} sesiones`})),{fmt:hm0});
}
const ZONES={LE:"España",GC:"Canarias",LP:"Portugal",LF:"Francia",EG:"Reino Unido",EI:"Irlanda",LI:"Italia",ED:"Alemania",ET:"Alemania",LS:"Suiza",LO:"Austria",EH:"Países Bajos",EB:"Bélgica",EL:"Luxemburgo",EK:"Dinamarca",ES:"Suecia",EN:"Noruega",EF:"Finlandia",LG:"Grecia",LC:"Chipre",LM:"Malta",LD:"Croacia",LJ:"Eslovenia",LH:"Hungría",LK:"Chequia",EP:"Polonia",LR:"Rumanía",LB:"Bulgaria",LT:"Turquía",LL:"Israel",GM:"Marruecos",DA:"Argelia",DT:"Túnez",HE:"Egipto",BI:"Islandia",EY:"Lituania",EV:"Letonia",EE:"Estonia",LY:"Serbia",LW:"Macedonia del N.",LA:"Albania",LQ:"Bosnia",LU:"Moldavia",UK:"Ucrania",UU:"Rusia",OE:"Arabia Saudí",OM:"EAU",OT:"Catar",GV:"Cabo Verde",LX:"Gibraltar",LN:"Mónaco",GO:"Senegal"};

$("#stPresets").addEventListener("click",e=>{const b=e.target.closest("button[data-p]");if(!b)return;stPreset=b.dataset.p;ls.set("lb_stpreset",stPreset);syncPresetUI();renderStats();renderReport()});
function syncPresetUI(){$$("#stPresets button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.p===stPreset));$("#stCustom").hidden=stPreset!=="custom"}
["#stFrom","#stTo"].forEach(s=>$(s).addEventListener("change",()=>{stFrom=$("#stFrom").value;stTo=$("#stTo").value;renderStats();renderReport()}));
let rsT;addEventListener("resize",()=>{clearTimeout(rsT);rsT=setTimeout(()=>{renderStats();renderCover()},200)});

/* ---------- informes ---------- */
let repType=ls.get("lb_reptype","period");
const owner=()=>ls.get("lb_owner",{name:"",lic:""});
function renderReport(){
  if(view!=="st")return;
  $$("#repTypes button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.r===repType));
  const R=stRange(),F=allF().filter(f=>inRange(f.d,R)),S=allS().filter(s=>inRange(s.d,R)),t=sum(F),o=owner();
  const per=stPreset==="all"?"Todo el historial":`${fmtD(R[0]>"1900"?R[0]:(F[0]?.d||""))} – ${fmtD(R[1]<"2999"?R[1]:today())}`;
  const head=(title)=>`<div class="rp-head"><div><div class="rp-k">Pilot Logbook · EASA FCL.050</div><h2>${title}</h2><div class="note">${esc(per)}</div></div><div class="rp-who"><b>${esc(o.name||"Titular sin nombre")}</b>${o.lic?`<br>Licencia ${esc(o.lic)}`:""}<br><span class="note">Generado ${fmtD(today())}</span></div></div>`;
  const totTable=(T,sTot)=>`<div class="rp-x"><table class="rp-t"><thead><tr><th>Total vuelo</th><th>Multi-pilot</th><th>SP SE</th><th>SP ME</th><th>PIC</th><th>Copiloto</th><th>Dual</th><th>Instructor</th><th>Noche</th><th>IFR</th><th>T/O</th><th>LDG</th><th>FSTD</th></tr></thead>
    <tbody><tr><td><b>${hm0(T.tot)}</b></td><td>${hm0(T.mp)}</td><td>${hm0(T.se)}</td><td>${hm0(T.me)}</td><td>${hm0(T.fpic)}</td><td>${hm0(T.fcop)}</td><td>${hm0(T.fdual)}</td><td>${hm0(T.finst)}</td><td>${hm0(T.night)}</td><td>${hm0(T.ifr)}</td><td>${T.tod+T.ton}</td><td>${T.ldd+T.ldn}</td><td>${hm0(sTot)}</td></tr></tbody></table></div>`;
  const sTot=S.reduce((a,s)=>a+(+s.tot||0),0);
  let h="";
  $("#easaOnlyWrap").hidden=repType!=="easa";
  if(repType==="easa"){$("#repOut").classList.add("is-easa");easaRender(R).then(h=>{if(repType==="easa")$("#repOut").innerHTML=h});return}
  $("#repOut").classList.remove("is-easa");
  if(repType==="period"){
    h=head("Informe de horas del periodo")+totTable(t,sTot)+
    `<h3>Detalle de vuelos (${F.length})</h3><div class="rp-scroll"><table class="rp-t rp-list"><thead><tr><th>Fecha</th><th>Salida</th><th>Off</th><th>Llegada</th><th>On</th><th>Tipo</th><th>Matr.</th><th>Total</th><th>Función</th><th>Noche</th><th>LDG</th><th>Obs.</th></tr></thead><tbody>
    ${F.map(f=>`<tr><td>${fmtD(f.d)}</td><td>${esc(f.dp)}</td><td>${f.dt}</td><td>${esc(f.ap)}</td><td>${f.at}</td><td>${esc(f.typ)}</td><td>${esc(f.reg)}</td><td><b>${hm(f.tot)}</b></td><td>${f.fpic?"PIC":f.fcop?"COP":f.finst?"INS":f.fdual?"DUAL":""}</td><td>${hm(f.night)}</td><td>${(+f.ldd||0)+(+f.ldn||0)||""}</td><td>${esc(f.rem)}</td></tr>`).join("")}</tbody></table></div>`+
    (S.length?`<h3>Sesiones FSTD (${S.length})</h3><div class="rp-scroll"><table class="rp-t rp-list"><thead><tr><th>Fecha</th><th>Tipo</th><th>Tiempo</th><th>Rol</th><th>Obs.</th></tr></thead><tbody>${S.map(s=>`<tr><td>${fmtD(s.d)}</td><td>${esc(s.typ)}</td><td>${hm(s.tot)}</td><td>${esc(s.role)}</td><td>${esc(s.rem)}</td></tr>`).join("")}</tbody></table></div>`:"");
  }else if(repType==="cert"){
    const AF=allF(),AT=withOpen(sum(AF)),AS=allS(),td=today(),OPc=opening(),rc=recency(AF,AS),sg=sigPng();
    const simH=fn=>AS.filter(fn).reduce((a,s)=>a+(+s.tot||0),0),simN=fn=>AS.filter(fn).length;
    const byT=[...count(AF,f=>f.typ||"—",f=>+f.tot||0).entries()].sort((a,b)=>b[1]-a[1]),picT=count(AF,f=>f.typ||"—",f=>+f.fpic||0),copT=count(AF,f=>f.typ||"—",f=>+f.fcop||0);
    const lic=live("c").filter(c=>curCat(c)==="lic"&&c.d).sort((a,b)=>a.d.localeCompare(b.d));
    h=`<div class="cert">`+head("Certificado de experiencia de vuelo").replace(esc(per),"Datos a "+fmtD(td))+
    `<p>Resumen de la experiencia de vuelo de <b>${esc(o.name||"—")}</b>${o.lic?`, licencia <b>${esc(o.lic)}</b>`:""}${o.title?`, ${esc(o.title)}`:""}, según su libro de vuelo (EASA FCL.050)${OPc.on?`, incluidas ${hm0(OPc.tot)} h anteriores al ${fmtD(OPc.date)} arrastradas del libro en papel`:""}.</p>
    <h3>Totales</h3>${totTable(AT,AS.filter(s=>s.inBook!==false).reduce((a,s)=>a+(+s.tot||0),0)+OPc.sim)}
    <h3>Aviación general y Airbus</h3><div class="rp-x">${splitTable(AF,true)}</div>
    <h3>Experiencia por tipo de aeronave</h3><div class="rp-x"><table class="rp-t"><thead><tr><th>Tipo</th><th>Total</th><th>PIC</th><th>Copiloto</th><th>Sectores</th><th>Desde</th><th>Hasta</th></tr></thead><tbody>${byT.map(([k,v])=>{const fs=AF.filter(f=>(f.typ||"—")===k);return `<tr><td>${esc(k)}</td><td><b>${hm0(v)}</b></td><td>${hm0(picT.get(k))}</td><td>${hm0(copT.get(k))}</td><td>${fmtInt(fs.length)}</td><td>${fmtD(fs[0].d)}</td><td>${fmtD(fs[fs.length-1].d)}</td></tr>`}).join("")}</tbody></table></div>${OPc.on?`<p class="note">Las ${hm0(OPc.tot)} h anteriores al ${fmtD(OPc.date)} no están desglosadas por tipo.</p>`:""}
    <h3>Simulador (FSTD)</h3><table class="rp-t"><thead><tr><th>Función</th><th>Horas</th><th>Sesiones</th></tr></thead><tbody>
      <tr><td>Instructor (TRI/SFI)</td><td>${hm0(simH(s=>ROLE_INS.includes(s.role)))}</td><td>${simN(s=>ROLE_INS.includes(s.role))}</td></tr>
      <tr><td>Examinador (TRE/SFE)</td><td>${hm0(simH(s=>ROLE_EXA.includes(s.role)))}</td><td>${simN(s=>ROLE_EXA.includes(s.role))}</td></tr>
      <tr><td>Alumno / tripulante</td><td>${hm0(simH(s=>!ROLE_INS.includes(s.role)&&!ROLE_EXA.includes(s.role)))}</td><td>${simN(s=>!ROLE_INS.includes(s.role)&&!ROLE_EXA.includes(s.role))}</td></tr></tbody></table>
    <h3>Actividad reciente</h3><table class="rp-t"><tbody>${[[90,"Últimos 90 días"],[365,"Últimos 12 meses"],[730,"Últimos 24 meses"]].map(([d,l])=>{const L=AF.filter(f=>f.d>=addDays(td,-d+1)),x=sum(L);return `<tr><td>${l}</td><td><b>${hm0(x.tot)}</b> h</td><td>${fmtInt(L.length)} sectores</td><td>${x.ldd+x.ldn} aterrizajes</td></tr>`}).join("")}
      <tr><td>Experiencia reciente (FCL.060)</td><td colspan="3">${rc?(rc.left<0?"Caducada desde "+fmtD(rc.exp):"Válida hasta "+fmtD(rc.exp)):"—"}</td></tr></tbody></table>
    ${lic.length?`<h3>Licencias y habilitaciones</h3><table class="rp-t"><thead><tr><th>Licencia / habilitación</th><th>Última</th><th>Válida hasta</th></tr></thead><tbody>${lic.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.done?fmtD(c.done):"—"}</td><td>${fmtD(c.d)}</td></tr>`).join("")}</tbody></table>`:""}
    <div class="cert-sig"><p>Certifico que los datos de este resumen se corresponden con las anotaciones de mi libro de vuelo.</p>${sg?`<img src="${sg}" alt="Firma" class="sig-img">`:"<br><br>"}<div>______________________________<br>${esc(o.name||"Firma del titular")} · ${fmtD(td)}</div></div></div>`;
  }else if(repType==="cv"){
    const AF=allF(),AT=withOpen(sum(AF)),AS=allS(),td=today(),OPc=opening();
    const byT=[...count(AF,f=>f.typ||"—",f=>+f.tot||0).entries()].sort((a,b)=>b[1]-a[1]);
    const picT=count(AF,f=>f.typ||"—",f=>+f.fpic||0);
    const last=(d)=>sum(AF.filter(f=>f.d>=addDays(td,-d+1)));
    h=head("Resumen de experiencia de vuelo").replace(esc(per),"Total a "+fmtD(td))+totTable(AT,AS.reduce((a,s)=>a+(+s.tot||0),0)+OPc.sim)+`<h3>Aviación general y Airbus</h3><div class="rp-x">${splitTable(AF,true)}</div>`+(OPc.on?`<p class="note">Incluye el saldo inicial: ${hm0(OPc.tot)} h anteriores${OPc.date?" al "+fmtD(OPc.date):""}.</p>`:"")+
    `<h3>Experiencia por tipo</h3><div class="rp-x"><table class="rp-t"><thead><tr><th>Tipo</th><th>Total</th><th>PIC</th><th>Sectores</th><th>Primer vuelo</th><th>Último vuelo</th></tr></thead><tbody>${byT.map(([k,v])=>{const fs=AF.filter(f=>(f.typ||"—")===k);return `<tr><td>${esc(k)}</td><td><b>${hm0(v)}</b></td><td>${hm0(picT.get(k))}</td><td>${fs.length}</td><td>${fmtD(fs[0].d)}</td><td>${fmtD(fs[fs.length-1].d)}</td></tr>`}).join("")}</tbody></table></div>
    <h3>Actividad reciente</h3><table class="rp-t"><thead><tr><th></th><th>Total</th><th>PIC</th><th>Sectores</th><th>LDG</th></tr></thead><tbody>${[[90,"Últimos 90 días"],[365,"Últimos 12 meses"],[730,"Últimos 24 meses"]].map(([d,l])=>{const x=last(d),n=AF.filter(f=>f.d>=addDays(td,-d+1)).length;return `<tr><td>${l}</td><td><b>${hm0(x.tot)}</b></td><td>${hm0(x.fpic)}</td><td>${n}</td><td>${x.ldd+x.ldn}</td></tr>`}).join("")}</tbody></table>`;
  }else if(repType==="ftl"){
    // monthly table + max rolling 28 days within each month
    const AF=allF(),byDay=count(AF,f=>f.d,f=>+f.tot||0);
    const months=[...new Set(F.map(f=>f.d.slice(0,7)))].sort();
    const roll=d=>{let s=0;for(let i=0;i<28;i++)s+=byDay.get(addDays(d,-i))||0;return s};
    const roll365=d=>{let s=0;for(let i=0;i<365;i++)s+=byDay.get(addDays(d,-i))||0;return s};
    const rows=months.map(m=>{let mx=0,md="";const [y,mo]=m.split("-").map(Number),nd=new Date(Date.UTC(y,mo,0)).getUTCDate();
      for(let dd=1;dd<=nd;dd++){const d=m+"-"+String(dd).padStart(2,"0");if(d>today())break;const v=roll(d);if(v>mx){mx=v;md=d}}
      const end=m+"-"+String(nd).padStart(2,"0")>today()?today():m+"-"+String(nd).padStart(2,"0");
      return {m,tot:F.filter(f=>f.d.startsWith(m)).reduce((a,f)=>a+(+f.tot||0),0),mx,md,y12:roll365(end)}});
    const yrs=[...new Set(F.map(f=>f.d.slice(0,4)))].sort();
    const chip=(v,l)=>{const p=v/l;return `<span class="chip ${p>=1?"b":p>=.9?"w":"ok"}">${Math.round(p*100)} %</span>`};
    h=head("Control de horas de vuelo · ORO.FTL.210")+
    `<p class="note">Límites: 100 h en cualquier periodo de 28 días consecutivos · 900 h por año natural · 1000 h en 12 meses consecutivos. Calculado con el tiempo total de vuelo (col. 6) como block time.</p>
    <div class="rp-x"><table class="rp-t"><thead><tr><th>Mes</th><th>Horas del mes</th><th>Pico 28 días</th><th>Fecha del pico</th><th>% de 100 h</th><th>12 meses a fin de mes</th><th>% de 1000 h</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td>${MES[+r.m.slice(5)-1]} ${r.m.slice(0,4)}</td><td>${hm0(r.tot)}</td><td><b>${hm0(r.mx)}</b></td><td>${fmtD(r.md)}</td><td>${chip(r.mx,6000)}</td><td>${hm0(r.y12)}</td><td>${chip(r.y12,60000)}</td></tr>`).join("")}</tbody></table></div>
    <h3>Años naturales</h3><table class="rp-t"><thead><tr><th>Año</th><th>Horas</th><th>% de 900 h</th></tr></thead><tbody>${yrs.map(y=>{const v=AF.filter(f=>f.d.startsWith(y)).reduce((a,f)=>a+(+f.tot||0),0);return `<tr><td>${y}</td><td>${hm0(v)}</td><td>${chip(v,54000)}</td></tr>`}).join("")}</tbody></table>`;
  }else if(repType==="sim"){
    const byR=[...count(S,s=>s.role||"—",s=>+s.tot||0).entries()].sort((a,b)=>b[1]-a[1]);
    const byTy=[...count(S,s=>s.typ||"—",s=>+s.tot||0).entries()].sort((a,b)=>b[1]-a[1]);
    h=head("Informe de simulador (FSTD)")+`<table class="rp-t"><thead><tr><th>Sesiones</th><th>Horas</th><th>Como instructor/examinador</th><th>Como alumno/tripulante</th></tr></thead><tbody><tr><td>${S.length}</td><td><b>${hm0(sTot)}</b></td><td>${hm0(S.filter(s=>/TRI|TRE|SFI/.test(s.role||"")).reduce((a,s)=>a+(+s.tot||0),0))}</td><td>${hm0(S.filter(s=>!/TRI|TRE|SFI/.test(s.role||"")).reduce((a,s)=>a+(+s.tot||0),0))}</td></tr></tbody></table>
    <div class="two"><div><h3>Por rol</h3><table class="rp-t"><tbody>${byR.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${hm0(v)}</td><td>${S.filter(s=>(s.role||"—")===k).length} ses.</td></tr>`).join("")}</tbody></table></div>
    <div><h3>Por tipo de FSTD</h3><table class="rp-t"><tbody>${byTy.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${hm0(v)}</td></tr>`).join("")}</tbody></table></div></div>
    <h3>Sesiones</h3><div class="rp-scroll"><table class="rp-t rp-list"><thead><tr><th>Fecha</th><th>FSTD</th><th>Sesión</th><th>Tiempo</th><th>Rol</th><th>Escenario</th><th>Obs.</th></tr></thead><tbody>${S.map(s=>`<tr><td>${fmtD(s.d)}</td><td>${esc([s.dev,s.typ].filter(Boolean).join(" · "))}</td><td>${esc([s.kind,s.mod].filter(Boolean).join(" "))}</td><td>${hm(s.tot)}</td><td>${esc(s.role)}</td><td class="l">${esc(s.scen||"")}</td><td>${esc(s.rem)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  h+=signLine();
  $("#repOut").innerHTML=h;
}
$("#repTypes").addEventListener("click",e=>{const b=e.target.closest("button[data-r]");if(!b)return;repType=b.dataset.r;ls.set("lb_reptype",repType);renderReport()});
$("#repPrint").onclick=()=>{document.body.classList.add("printing");setTimeout(()=>{try{window.print()}catch{}document.body.classList.remove("printing")},50)};
$("#repXlsx").onclick=async()=>{if(repType==="easa"){toast("Para el libro EASA usa Imprimir / PDF; en Excel usa “Exportar todo”.");return}
  await needXLSX();const R=stRange(),F=allF().filter(f=>inRange(f.d,R)),S=allS().filter(s=>inRange(s.d,R));
  const wb=XLSX.utils.book_new(),tbl=$("#repOut").querySelectorAll("table");
  tbl.forEach((t,i)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.table_to_sheet(t),("Tabla "+(i+1)).slice(0,31)));
  saveBlob(new Blob([XLSX.write(wb,{type:"array",bookType:"xlsx"})],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"informe_"+repType+"_"+today()+".xlsx");
};
const OPEN_UI=[["tot","6 · Total"],["se","5 · SE"],["me","5 · ME"],["mp","5 · Multi-pilot"],["night","9 · Noche"],["ifr","9 · IFR"],["fpic","10 · PIC"],["fcop","10 · Copiloto"],["fdual","10 · Dual"],["finst","10 · Instructor"],["sim","11 · FSTD"],["tod","8 · T/O día",1],["ton","8 · T/O noche",1],["ldd","8 · LDG día",1],["ldn","8 · LDG noche",1]];
function renderOpen(){const o=opening();$("#opGrid").innerHTML=OPEN_UI.map(([k,l,n])=>`<div class="f"><label for="op_${k}">${l}</label><input id="op_${k}" class="mono" inputmode="numeric" placeholder="${n?"0":"0:00"}" value="${o[k]?(n?o[k]:hm(o[k])):""}"></div>`).join("");$("#opDate").value=o.date;$("#opNote").value=o.note;
  $("#opState").textContent=o.on?`Activo: ${hm0(o.tot)} h se suman a la portada, a “total from previous pages” de la primera página del libro EASA y al resumen de experiencia.`:"Sin saldo inicial."}
$("#opSave").onclick=()=>{const v={};OPEN_UI.forEach(([k,,n])=>{const x=$("#op_"+k).value.trim();v[k]=n?(parseInt(x)||0):toMin(x)});putRec("x",{id:"open",d:"",date:$("#opDate").value,note:$("#opNote").value.trim(),v});toast("Saldo inicial guardado");renderOpen();render()};
$("#opDel").onclick=()=>{removeRec("x","open");toast("Saldo inicial quitado");renderOpen();render()};
function renderOwner(){const o=owner();$("#oName").value=o.name||"";$("#oLic").value=o.lic||"";$("#oTitle").value=o.title||""}
$("#oSave").onclick=()=>{ls.set("lb_owner",{name:$("#oName").value.trim(),lic:$("#oLic").value.trim(),title:$("#oTitle").value.trim()});toast("Datos guardados");renderReport();renderCover()};
syncPresetUI();

/* ---------- aeropuertos y geodesia ---------- */
const RAD=Math.PI/180;
let APT=null,IATA=null,aptP=null,CUST=null;
function loadApts(){
  if(aptP)return aptP;
  aptP=(window.LB_AIRPORTS_RAW?Promise.resolve():loadScript("airports.js")).then(()=>{
    APT=new Map();IATA=new Map();
    window.LB_AIRPORTS_RAW.split("\n").forEach(l=>{const p=l.split("|");const a={i:p[0],la:+p[1],lo:+p[2],iata:p[3],n:p[4],c:p[5],cc:p[6]};APT.set(a.i,a);if(a.iata&&!IATA.has(a.iata))IATA.set(a.iata,a)});
    render();
  }).catch(e=>{console.warn(e);aptP=null});
  return aptP;
}
function custMap(){if(!CUST){CUST=new Map();live("a").forEach(a=>CUST.set(a.i,{...a,la:+a.la,lo:+a.lo,custom:1}))}return CUST}
function apt(code){
  if(!code)return null;code=String(code).trim().toUpperCase();
  const c=custMap().get(code);if(c)return c;
  if(!APT)return null;
  return APT.get(code)||(code.length===3?IATA.get(code):null)||null;
}
function gcNm(a,b){const p1=a.la*RAD,p2=b.la*RAD,dp=p2-p1,dl=(b.lo-a.lo)*RAD;const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*3440.065*Math.asin(Math.min(1,Math.sqrt(h)))}
function gcPt(a,b,f){
  const p1=a.la*RAD,l1=a.lo*RAD,p2=b.la*RAD,l2=b.lo*RAD;
  const d=2*Math.asin(Math.sqrt(Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin((l2-l1)/2)**2));
  if(d<1e-9)return {la:a.la,lo:a.lo};
  const A=Math.sin((1-f)*d)/Math.sin(d),B=Math.sin(f*d)/Math.sin(d);
  const x=A*Math.cos(p1)*Math.cos(l1)+B*Math.cos(p2)*Math.cos(l2),y=A*Math.cos(p1)*Math.sin(l1)+B*Math.cos(p2)*Math.sin(l2),z=A*Math.sin(p1)+B*Math.sin(p2);
  return {la:Math.atan2(z,Math.hypot(x,y))/RAD,lo:Math.atan2(y,x)/RAD};
}
const distMemo=new Map();
function fDist(f){
  const k=f.dp+"-"+f.ap;if(distMemo.has(k)&&APT)return distMemo.get(k);
  const A=apt(f.dp),B=apt(f.ap),v=A&&B?gcNm(A,B):null;if(APT)distMemo.set(k,v);return v;
}
// Elevación solar (algoritmo simplificado del Almanaque Náutico, ±0,1°)
function sunElev(ms,lat,lon){
  const d=ms/864e5-10957.5;
  const g=(357.529+0.98560028*d)*RAD,q=280.459+0.98564736*d;
  const L=(q+1.915*Math.sin(g)+0.020*Math.sin(2*g))*RAD,e=(23.439-0.00000036*d)*RAD;
  const ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)),dec=Math.asin(Math.sin(e)*Math.sin(L));
  const gmst=((18.697374558+24.06570982441908*d)%24+24)%24;
  const ha=(gmst*15+lon)*RAD-ra;
  return Math.asin(Math.sin(lat*RAD)*Math.sin(dec)+Math.cos(lat*RAD)*Math.cos(dec)*Math.cos(ha))/RAD;
}
const NIGHT_EL=-6; // EASA: noche = entre fin y comienzo del crepúsculo civil (sol 6° bajo el horizonte)
function nightCalc(d,dp,dt,ap,at,tot){
  const A=apt(dp),B=apt(ap);if(!A||!B||!d||!dt)return null;
  const blk=at?block(dt,at):tot;if(!blk)return null;
  const t0=Date.parse(d+"T"+dt+":00Z");if(isNaN(t0))return null;
  let n=0;const st=blk>480?2:1;
  for(let m=0;m<blk;m+=st){const w=Math.min(st,blk-m),mid=m+w/2,p=gcPt(A,B,mid/blk);if(sunElev(t0+mid*6e4,p.la,p.lo)<NIGHT_EL)n+=w}
  return {night:Math.round(n),toN:sunElev(t0,A.la,A.lo)<NIGHT_EL,ldN:sunElev(t0+blk*6e4,B.la,B.lo)<NIGHT_EL,blk,nm:gcNm(A,B)};
}
function withNight(f){
  const r=nightCalc(f.d,f.dp,f.dt,f.ap,f.at,f.tot);if(!r)return null;
  const to=(+f.tod||0)+(+f.ton||0),ld=(+f.ldd||0)+(+f.ldn||0);
  return {...f,night:Math.min(r.night,+f.tot||r.night),tod:r.toN?0:to,ton:r.toN?to:0,ldd:r.ldN?0:ld,ldn:r.ldN?ld:0};
}
const regionName=(()=>{let dn=null;try{dn=new Intl.DisplayNames(["es"],{type:"region"})}catch{}return cc=>{try{return dn?dn.of(cc):cc}catch{return cc}}})();
function zoneOf(code){
  if(!code)return "";if(/^GC/.test(code))return "Canarias";
  const a=apt(code);if(a&&a.cc)return regionName(a.cc);
  return ZONES[code.slice(0,2)]||("Otros ("+code.slice(0,2)+")");
}
const fmtInt=n=>Math.round(n).toLocaleString("es-ES");

/* ---------- formulario: noche automática ---------- */
function nightHint(){
  const dp=$("#fdp").value.trim().toUpperCase(),ap=$("#fap").value.trim().toUpperCase();
  const A=apt(dp),B=apt(ap),parts=[];
  if(A)parts.push(`${A.i} ${A.c||A.n}`);if(B)parts.push(`${B.i} ${B.c||B.n}`);
  let s=parts.length===2?parts.join(" → ")+` · ${fmtInt(gcNm(A,B))} nm`:"";
  const miss=[dp&&dp.length>=3&&!A&&APT?dp:"",ap&&ap.length>=3&&!B&&APT?ap:""].filter(Boolean);
  if(miss.length)s+=(s?" · ":"")+`${miss.join(", ")} no está en la base: añádelo en Ajustes para calcular noche y distancia.`;
  if($("#fauto").checked){
    const r=nightCalc($("#fd").value,dp,clock($("#fdt").value),ap,clock($("#fat").value),toMin($("#ftot").value));
    if(r){
      $("#fnight").value=hm(r.night);
      const to=(+$("#ftod").value||0)+(+$("#fton").value||0),ld=(+$("#fldd").value||0)+(+$("#fldn").value||0);
      $("#ftod").value=r.toN?0:to;$("#fton").value=r.toN?to:0;$("#fldd").value=r.ldN?0:ld;$("#fldn").value=r.ldN?ld:0;
      s+=(s?" · ":"")+`Noche ${hm0(r.night)} · despegue de ${r.toN?"noche":"día"} · aterrizaje de ${r.ldN?"noche":"día"}`;
    }else if(dp&&ap&&A&&B)s+=(s?" · ":"")+"Pon las horas OUT/IN para calcular la noche.";
  }
  $("#fnInfo").textContent=s;
}
["#fdp","#fap","#fd","#fdt","#fat","#ftot"].forEach(s=>$(s).addEventListener("input",()=>{if(!APT)loadApts();nightHint()}));
$("#fauto").addEventListener("change",()=>{ls.set("lb_fauto",$("#fauto").checked);nightHint()});
["#fnight","#ftod","#fton","#fldd","#fldn"].forEach(s=>$(s).addEventListener("input",()=>{if($("#fauto").checked){$("#fauto").checked=false;$("#fnInfo").textContent="Cálculo automático desactivado porque has editado la noche o los T/O-LDG."}}));

/* ---------- ajustes: herramientas de datos y aeropuertos propios ---------- */
function nightCandidates(){return allF().filter(f=>nightCalc(f.d,f.dp,f.dt,f.ap,f.at,f.tot))}
$("#nightAll").onclick=async()=>{await loadApts();const n=nightCandidates().length;$("#nightCount").textContent=n;$("#nightConfirm").hidden=!n;if(!n)$("#nightMsg").textContent="No hay vuelos con horas off/on y aeropuertos conocidos."};
$("#nightNo").onclick=()=>$("#nightConfirm").hidden=true;
$("#nightYes").onclick=()=>{
  const ch=[];allF().forEach(f=>{const r=withNight(f);if(r&&(r.night!==f.night||r.ton!==f.ton||r.ldn!==f.ldn||r.tod!==f.tod||r.ldd!==f.ldd))ch.push(["f",r])});
  bulkPut(ch);$("#nightConfirm").hidden=true;$("#nightMsg").textContent=`Recalculado: ${ch.length} vuelos han cambiado.`;toast("Noche recalculada");
};
function renderApts(){
  const L=live("a").sort((a,b)=>a.i.localeCompare(b.i));
  $("#caList").innerHTML=L.length?L.map(a=>`<div class="row"><b class="mono">${esc(a.i)}</b><span>${esc(a.n||"")}</span><span class="note mono">${(+a.la).toFixed(3)}, ${(+a.lo).toFixed(3)}</span><span class="spacer"></span><button class="btn" data-adel="${a.id}">Quitar</button></div>`).join(""):`<p class="note">Ninguno.</p>`;
  if(APT){const miss=new Set();allF().forEach(f=>{[f.dp,f.ap].forEach(c=>{if(c&&!apt(c))miss.add(c)})});
    $("#missApts").textContent=miss.size?`Aeropuertos de tu libro sin coordenadas: ${[...miss].slice(0,40).join(", ")}${miss.size>40?"…":""}`:"Todos los aeropuertos de tu libro tienen coordenadas."}
}
$("#caAdd").onclick=()=>{
  const i=$("#caI").value.trim().toUpperCase(),la=parseFloat($("#caLa").value.replace(",",".")),lo=parseFloat($("#caLo").value.replace(",","."));
  if(!/^[A-Z0-9]{3,4}$/.test(i)||!(Math.abs(la)<=90)||!(Math.abs(lo)<=180)){toast("Revisa el código y las coordenadas (grados decimales).");return}
  const old=live("a").find(a=>a.i===i);
  putRec("a",{id:old?.id||uid(),d:"",i,la,lo,n:$("#caN").value.trim()});["#caI","#caLa","#caLo","#caN"].forEach(s=>$(s).value="");toast("Aeropuerto guardado");
};
$("#caList").addEventListener("click",e=>{const b=e.target.closest("[data-adel]");if(b)removeRec("a",b.dataset.adel)});

/* ---------- caducidades ---------- */
const daysTo=d=>Math.round((Date.parse(d+"T00:00:00Z")-Date.parse(today()+"T00:00:00Z"))/864e5);
const CUR_CATS=[["doc","Documentación personal"],["lic","Licencias y habilitaciones"],["rec","Experiencia reciente y chequeos"],["cur","Cursos"]];
const CUR_PRESETS=[["Pasaporte",120,"doc"],["DNI",120,"doc"],["Tarjeta de compañía",60,"doc"],["Certificado médico Clase 1",45,"lic"],["Habilitación de tipo A320",90,"lic"],["IR(A) A320",90,"lic"],["Low Visibility A320",60,"lic"],["Competencia lingüística (ELP)",90,"lic"],["Habilitación TRI",90,"lic"],["Certificado de examinador TRE",90,"lic"],["TRI · refresher",60,"rec"],["TRI · evaluación de competencia",60,"rec"],["TRE · refresher",60,"rec"],["TRE · chequeo observado por inspector",60,"rec"],["OPC",60,"rec"],["LPC",60,"rec"],["Line check",60,"rec"],["Módulo EBT",60,"rec"],["CRM recurrente",60,"cur"],["Mercancías peligrosas",60,"cur"],["SEP · emergencias y seguridad",60,"cur"]];
const curCat=c=>c.cat||(CUR_PRESETS.find(p=>p[0]===c.name)?.[2])||(/pasaporte|passport|dni|id card|tarjeta|company card/i.test(c.name)?"doc":/m[eé]dic|rating|habilit|\bIR\b|visibility|english|ELP|TRI|TRE|both seats/i.test(c.name)?"lic":/check|OPC|LPC|EBT|recency|ART|TRT|route/i.test(c.name)?"rec":"cur");
function curState(c){const n=daysTo(c.d),w=+c.warn||60;return n<0?{cls:"b",txt:"Caducado",n}:n<=Math.min(30,w)?{cls:"b",txt:n===0?"Hoy":`${n} días`,n}:n<=w?{cls:"w",txt:`${n} días`,n}:{cls:"ok",txt:n>90?`${Math.round(n/30.4)} meses`:`${n} días`,n}}
function renderCur(){
  const C=live("c").filter(c=>c.d).sort((a,b)=>a.d.localeCompare(b.d)),rc=recency(allF(),allS());
  const row=c=>{const s=curState(c);return `<div class="cur" data-tip="${c.done?`<b>${esc(c.name)}</b><br>Última vez ${fmtD(c.done)}`:""}"><span class="chip ${s.cls}">${s.txt}</span><span class="cur-n">${esc(c.name)}</span><span class="mono">${fmtD(c.d)}</span></div>`};
  const rcRow=rc?`<div class="cur" data-tip="Calculada con tus despegues y aterrizajes: 3 de cada en los 90 días anteriores"><span class="chip ${rc.c}">${rc.left<0?"Caducada":rc.left>90?Math.round(rc.left/30.4)+" meses":rc.left+" días"}</span><span class="cur-n">Experiencia reciente <span class="note">· FCL.060</span></span><span class="mono">${fmtD(rc.exp)}</span></div>`:"";
  const openG=ls.get("lb_curopen",{});
  const groups=CUR_CATS.map(([k,l])=>{const L=C.filter(c=>curCat(c)===k);const extra=k==="rec"?rcRow:"";if(!L.length&&!extra)return "";
    const st=L.map(c=>({c,s:curState(c)}));if(k==="rec"&&rc)st.push({c:{name:"Experiencia reciente",d:rc.exp},s:{cls:rc.c,n:rc.left}});
    const al=st.filter(x=>x.s.cls!=="ok").length,nx=st.slice().sort((a,b)=>a.c.d.localeCompare(b.c.d))[0];
    const worst=st.some(x=>x.s.cls==="b")?"b":st.some(x=>x.s.cls==="w")?"w":"ok";
    const sum=al?`<span class="chip ${worst}">${al} en aviso</span>`:`<span class="chip ok">Al día</span>`;
    return `<details class="curg" data-g="${k}"${openG[k]?" open":""}><summary><span class="curg-h">${l}</span><span class="note">${st.length} · próx. ${esc(nx.c.name)} ${fmtD(nx.c.d)}</span>${sum}</summary><div class="curg-b">${extra}${L.map(row).join("")}</div></details>`}).join("");
  $("#curList").innerHTML=C.length||rcRow?groups:`<div class="empty" style="padding:12px"><span>Apunta cuándo caducan tu médico, OPC, LPC, TRI/TRE… y te aviso con antelación.</span></div>`;
  const al=C.filter(c=>curState(c).cls!=="ok");
  const rec=recencyState();
  const items=al.map(c=>`<b>${esc(c.name)}</b> ${curState(c).n<0?"caducado el":"caduca el"} ${fmtD(c.d)}`);
  if(rec&&rec.cls!=="ok")items.push(`<b>Experiencia reciente</b> ${rec.left<0?"caducada":"caduca en "+rec.left+" días"}`);
  $("#curBanner").hidden=!items.length;$("#curBanner").innerHTML=`<span class="cb-k">Avisos</span><span>${items.join(" · ")}</span>`;
}
document.addEventListener("change",e=>{if(e.target.id==="rcPf"){ls.set("lb_rcpf",e.target.value);renderSummary()}});
$("#curList").addEventListener("toggle",e=>{const d=e.target.closest?.("details[data-g]");if(!d)return;const o=ls.get("lb_curopen",{});o[d.dataset.g]=d.open;ls.set("lb_curopen",o)},true);
/* previsión con el roster: vuelos programados futuros, PF según ajuste (alternos / todos / ninguno) */
function recencyForecast(F,S){
  const td=today(),mode=ls.get("lb_rcpf","alt"),P=live("p").filter(p=>!p.sim&&p.d>td&&p.dp&&p.ap).sort((a,b)=>(a.d+(a.std||"")).localeCompare(b.d+(b.std||"")));
  if(!P.length)return null;
  const to=[],ld=[];
  F.forEach(f=>{if(f.d>td)return;for(let i=0;i<(+f.tod||0)+(+f.ton||0);i++)to.push(f.d);for(let i=0;i<(+f.ldd||0)+(+f.ldn||0);i++)ld.push(f.d)});
  S.forEach(s=>{if(s.d>td)return;for(let i=0;i<(+s.tol||0);i++){to.push(s.d);ld.push(s.d)}});
  let pf=true;const pfF=[];P.forEach(p=>{const me=mode==="all"||(mode==="alt"&&pf);if(me){to.push(p.d);ld.push(p.d);pfF.push(p)}pf=!pf});
  to.sort();ld.sort();
  const cnt=(arr,D)=>{const a=addDays(D,-89);let n=0;for(const e of arr)if(e>=a&&e<=D)n++;return n},ok=D=>cnt(to,D)>=3&&cnt(ld,D)>=3;
  let gap=null;if(!ok(td))gap=td;else{let D=td;for(let k=0;k<500;k++){const nx=addDays(D,1);if(!ok(nx)){gap=nx;break}D=nx}}
  const exp=gap?addDays(gap,-1):null,after=gap?P.find(p=>p.d>=gap):null;
  return {mode,n:P.length,pf:pfF.length,last:P[P.length-1].d,exp,after}
}
function recencyState(){const r=recency(allF(),allS());return r?{left:r.left,cls:r.c}:null}
let curDraft=[];
function openCur(){
  curDraft=live("c").map(c=>({...c})).sort((a,b)=>(a.d||"").localeCompare(b.d||""));
  curDraft.forEach(c=>c.cat=curCat(c));
  if(!curDraft.length)curDraft=[["Certificado médico Clase 1",45,"lic"],["OPC",60,"rec"],["LPC",60,"rec"]].map(([name,warn,cat])=>({id:uid(),name,d:"",warn,cat,_new:1}));
  drawCur();$("#curDlg").hidden=false;
}
function drawCur(){
  const rowH=(c,i)=>`<div class="currow" data-i="${i}"><input class="cn" value="${esc(c.name)}" aria-label="Nombre" id="cn${i}"><select class="cc" aria-label="Grupo">${CUR_CATS.map(([k,l])=>`<option value="${k}"${k===c.cat?" selected":""}>${l}</option>`).join("")}</select><label class="cdn"><span>Última</span><input class="cdo" type="date" value="${c.done||""}" aria-label="Última vez"></label><label class="cdn"><span>Caduca</span><input class="cd" type="date" value="${c.d||""}" aria-label="Caduca" id="cd${i}"></label><label class="cw"><input type="number" min="0" max="365" value="${+c.warn||60}" aria-label="Avisar días antes" id="cw${i}"><span>días antes</span></label><button type="button" class="btn" data-cdel="${i}" aria-label="Quitar">✕</button></div>`;
  $("#curRows").innerHTML=CUR_CATS.map(([k,l])=>{const idx=curDraft.map((c,i)=>[c,i]).filter(([c])=>(c.cat||"cur")===k);return idx.length?`<h4 class="curg-h">${l}</h4>`+idx.map(([c,i])=>rowH(c,i)).join(""):""}).join("");
  const used=new Set(curDraft.map(c=>c.name));
  $("#curPreset").innerHTML=`<option value="">Añadir…</option>`+CUR_PRESETS.filter(p=>!used.has(p[0])).map(p=>`<option>${esc(p[0])}</option>`).join("")+`<option value="__custom">Otro (escribe el nombre)</option>`;
}
function readCur(){$$("#curRows .currow").forEach(r=>{const i=+r.dataset.i,c=curDraft[i];c.name=r.querySelector(".cn").value.trim();c.d=r.querySelector(".cd").value;c.done=r.querySelector(".cdo").value;c.cat=r.querySelector(".cc").value;c.warn=+r.querySelector(".cw input").value||60})}
$("#curPreset").addEventListener("change",e=>{readCur();const v=e.target.value;if(!v)return;const p=CUR_PRESETS.find(x=>x[0]===v);curDraft.push({id:uid(),name:v==="__custom"?"":v,d:"",warn:p?p[1]:60,cat:p?p[2]:"cur",_new:1});drawCur();const rows=$$("#curRows .currow");rows[rows.length-1]?.querySelector(v==="__custom"?".cn":".cd")?.focus()});
$("#curRows").addEventListener("click",e=>{const b=e.target.closest("[data-cdel]");if(!b)return;readCur();curDraft.splice(+b.dataset.cdel,1);drawCur()});
$("#curSave").onclick=()=>{
  readCur();
  const keep=new Set(curDraft.map(c=>c.id));
  live("c").forEach(c=>{if(!keep.has(c.id))removeRec("c",c.id)});
  const ch=curDraft.filter(c=>c.name&&c.d).map(c=>{const {_new,_del,...r}=c;return ["c",r]});
  bulkPut(ch);$("#curDlg").hidden=true;toast("Caducidades guardadas");renderCur();
};
$("#curOpen").onclick=openCur;
$("#curIcs").onclick=()=>{
  const C=live("c").filter(c=>c.d);if(!C.length){toast("No hay caducidades con fecha.");return}
  const st=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,""),z=d=>d.replace(/-/g,""),nx=d=>addDays(d,1).replace(/-/g,"");
  const ev=C.map(c=>["BEGIN:VEVENT",`UID:${c.id}@pilot-logbook`,`DTSTAMP:${st}`,`DTSTART;VALUE=DATE:${z(c.d)}`,`DTEND;VALUE=DATE:${nx(c.d)}`,`SUMMARY:Caduca: ${c.name.replace(/[,;]/g," ")}`,
    "BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${c.name.replace(/[,;]/g," ")} caduca el ${fmtD(c.d)}`,`TRIGGER:-P${+c.warn||60}D`,"END:VALARM","BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${c.name.replace(/[,;]/g," ")} caduca en 7 días`,"TRIGGER:-P7D","END:VALARM","END:VEVENT"].join("\r\n"));
  saveBlob(new Blob([["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Pilot Logbook//ES","CALSCALE:GREGORIAN",...ev,"END:VCALENDAR"].join("\r\n")],{type:"text/calendar"}),"caducidades.ics");
};

/* ---------- mapa ---------- */
let GEO=null,geoP=null;
function loadGeo(){
  if(geoP)return geoP;
  geoP=(window.LB_GEO?Promise.resolve():loadScript("geo.js")).then(()=>{
    const q=window.LB_GEO.q,dec=arr=>arr.map(d=>{const pts=[];let x=0,y=0,a=1e9,b=-1e9,c=1e9,e=-1e9;for(let i=0;i<d.length;i+=2){x+=d[i];y+=d[i+1];const X=x/q,Y=y/q;pts.push([X,Y]);if(X<a)a=X;if(X>b)b=X;if(Y<c)c=Y;if(Y>e)e=Y}pts.bb=[a,b,c,e];return pts});
    GEO={land:dec(window.LB_GEO.land),borders:dec(window.LB_GEO.borders)};
  }).catch(e=>{console.warn(e);geoP=null});
  return geoP;
}
function routeData(F){
  const R=new Map(),P=new Map(),miss=new Set();
  F.forEach(f=>{const A=apt(f.dp),B=apt(f.ap);if(!A||!B){if(f.dp&&!A)miss.add(f.dp);if(f.ap&&!B)miss.add(f.ap);return}
    const [a,b]=A.i<B.i?[A,B]:[B,A],k=a.i+"-"+b.i,r=R.get(k)||{a,b,n:0,plan:true};r.n++;if(!f._plan)r.plan=false;R.set(k,r);
    [A,B].forEach(x=>{const p=P.get(x.i)||{a:x,n:0};p.n++;P.set(x.i,p)})});
  return {routes:[...R.values()].sort((x,y)=>x.n-y.n),apts:[...P.values()].sort((x,y)=>y.n-x.n),miss:[...miss]};
}
function fitProj(apts,W,H,pad){
  let la0=90,la1=-90,lo0=180,lo1=-180;
  apts.forEach(p=>{la0=Math.min(la0,p.a.la);la1=Math.max(la1,p.a.la);lo0=Math.min(lo0,p.a.lo);lo1=Math.max(lo1,p.a.lo)});
  if(!apts.length){la0=34;la1=60;lo0=-12;lo1=28}
  const latC=(la0+la1)/2,lonC=(lo0+lo1)/2,c=Math.cos(latC*RAD);
  let w=Math.max((lo1-lo0)*c,4),h=Math.max(la1-la0,3);
  const s=Math.min((W-2*pad)/w,(H-2*pad)/h);
  return {latC,lonC,c,s};
}
function tok(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()}
function drawMap(ctx,W,H,P,data,o={}){
  const k=o.k||1,px=o.px||0,py=o.py||0;
  const X=lo=>W/2+px+(lo-P.lonC)*P.c*P.s*k,Y=la=>H/2+py-(la-P.latC)*P.s*k;
  const col={sea:o.sea||tok("--map-sea"),land:o.land||tok("--map-land"),border:o.border||tok("--map-border"),route:o.route||tok("--s1"),base:o.base||tok("--s2"),ink:o.ink||tok("--ink"),halo:o.sea||tok("--map-sea")};
  ctx.fillStyle=col.sea;ctx.fillRect(0,0,W,H);
  if(GEO){
    const lo0=P.lonC-(W/2+px)/(P.c*P.s*k),lo1=P.lonC+(W/2-px)/(P.c*P.s*k),la1=P.latC+(H/2+py)/(P.s*k),la0=P.latC-(H/2-py)/(P.s*k);
    const vis=bb=>!(bb[1]<lo0||bb[0]>lo1||bb[3]<la0||bb[2]>la1);
    ctx.fillStyle=col.land;ctx.beginPath();
    GEO.land.forEach(r=>{if(!vis(r.bb))return;r.forEach(([lo,la],i)=>i?ctx.lineTo(X(lo),Y(la)):ctx.moveTo(X(lo),Y(la)));ctx.closePath()});
    ctx.fill("evenodd");
    ctx.strokeStyle=col.border;ctx.lineWidth=o.bw||0.8;ctx.beginPath();
    GEO.borders.forEach(r=>{if(!vis(r.bb))return;r.forEach(([lo,la],i)=>i?ctx.lineTo(X(lo),Y(la)):ctx.moveTo(X(lo),Y(la)))});ctx.stroke();
  }
  const sc=o.scale||1,maxR=Math.max(1,...data.routes.map(r=>r.n)),maxA=Math.max(1,...data.apts.map(a=>a.n));
  ctx.lineCap="round";ctx.strokeStyle=col.route;
  const hl=o.hl;data.routes.forEach(r=>{const f=r.n/maxR,on=!hl||r.a.i===hl||r.b.i===hl;ctx.globalAlpha=!on?0.07:hl?0.95:r.plan?0.95:0.35+0.55*Math.sqrt(f);ctx.lineWidth=(r.plan?1.6:(1+2.6*Math.sqrt(f)))*sc;ctx.setLineDash(r.plan?[6*sc,5*sc]:[]);ctx.beginPath();
    const N=Math.max(8,Math.min(48,Math.round(gcNm(r.a,r.b)/40)));let pl=null;
    for(let i=0;i<=N;i++){const p=gcPt(r.a,r.b,i/N);let lo=p.lo;if(pl!=null&&Math.abs(lo-pl)>180)lo+=lo<pl?360:-360;pl=lo;i?ctx.lineTo(X(lo),Y(p.la)):ctx.moveTo(X(lo),Y(p.la))}ctx.stroke()});
  ctx.setLineDash([]);ctx.globalAlpha=1;
  const base=data.apts[0]?.a.i,pts=[];
  data.apts.slice().reverse().forEach(p=>{const x=X(p.a.lo),y=Y(p.a.la),r=(2.2+4.2*Math.sqrt(p.n/maxA))*sc;pts.push({x,y,r,p});
    ctx.globalAlpha=hl&&o.conn&&!o.conn.has(p.a.i)?0.25:1;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fillStyle=p.a.i===base?col.base:col.route;ctx.fill();ctx.lineWidth=1.5*sc;ctx.strokeStyle=col.halo;ctx.stroke();ctx.globalAlpha=1;if(p.a.i===hl){ctx.beginPath();ctx.arc(x,y,r+4*sc,0,7);ctx.lineWidth=2.5*sc;ctx.strokeStyle=col.ink;ctx.stroke()}});
  if(o.labels!==false){
    const placed=[],fs=Math.round(11*sc);ctx.font=`600 ${fs}px ${tok("--f-mono")}`;ctx.textBaseline="middle";
    (hl?[...data.apts.filter(p=>p.a.i===hl),...data.apts.filter(p=>p.a.i!==hl&&o.conn?.has(p.a.i))]:data.apts).slice(0,o.maxLabels||14).forEach(p=>{const x=X(p.a.lo),y=Y(p.a.la),t=p.a.i,w=ctx.measureText(t).width,r=(2.2+4.2*Math.sqrt(p.n/maxA))*sc;
      for(const [dx,dy,al] of [[r+4,0,"left"],[-r-4,0,"right"],[0,-r-fs*0.8,"center"],[0,r+fs*0.8,"center"]]){
        const x0=al==="left"?x+dx:al==="right"?x+dx-w:x-w/2,bb=[x0-2,y+dy-fs/2-1,x0+w+2,y+dy+fs/2+1];
        if(bb[0]<0||bb[2]>W||bb[1]<0||bb[3]>H)continue;
        if(placed.some(q=>!(bb[2]<q[0]||bb[0]>q[2]||bb[3]<q[1]||bb[1]>q[3])))continue;
        if(pts.some(q=>q.p!==p&&Math.hypot(q.x-(bb[0]+bb[2])/2,q.y-(bb[1]+bb[3])/2)<q.r+w/2&&Math.abs(q.y-(bb[1]+bb[3])/2)<q.r+fs/2))continue;
        placed.push(bb);ctx.textAlign=al;ctx.lineWidth=3*sc;ctx.strokeStyle=col.halo;ctx.strokeText(t,x+dx,y+dy);ctx.fillStyle=col.ink;ctx.fillText(t,x+dx,y+dy);break}
    });
  }
  return pts;
}
const MAP={k:1,px:0,py:0,pts:[],data:null,P:null,key:""};
function renderMap(F){
  const cv=$("#stMap");if(!cv)return;
  const box=cv.parentElement,W=box.clientWidth||600,H=Math.round(Math.min(520,Math.max(280,W*0.52))),dpr=window.devicePixelRatio||1;
  if(!APT||!GEO){Promise.all([loadApts(),loadGeo()]).then(()=>renderStats());$("#stMapNote").textContent="Cargando mapa…";return}
  const data=routeData(F),key=stPreset+stFrom+stTo+F.length+W;
  if(key!==MAP.key){MAP.key=key;MAP.k=1;MAP.px=0;MAP.py=0;MAP.P=fitProj(data.apts,W,H,34)}
  MAP.data=data;cv.width=W*dpr;cv.height=H*dpr;cv.style.height=H+"px";
  const ctx=cv.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
  MAP.pts=drawMap(ctx,W,H,MAP.P,data,{k:MAP.k,px:MAP.px,py:MAP.py});
  // distance strip
  let nm=0,n=0,blk=0,far=null;F.forEach(f=>{const d=fDist(f);if(d!=null){nm+=d;n++;blk+=+f.tot||0;if(!far||d>far.d)far={d,f}}});
  const km=nm*1.852;
  $("#stDist").innerHTML=[["Distancia",`${fmtInt(nm)} nm`,`${fmtInt(km)} km`],["Vueltas a la Tierra",(km/40075).toLocaleString("es-ES",{maximumFractionDigits:1}),"por el ecuador"],["Hacia la Luna",Math.round(km/384400*100)+" %","de 384.400 km"],["Velocidad media",blk?fmtInt(nm/(blk/60))+" kt":"—","distancia ÷ block"],["Más lejos",far?`${fmtInt(far.d)} nm`:"—",far?`${far.f.dp}–${far.f.ap}`:""],["Rutas distintas",data.routes.length,`${data.apts.length} aeropuertos`]]
    .map(([k,v,s])=>`<div class="cell"><div class="k">${k}</div><div class="v">${v}</div><div class="note">${esc(s)}</div></div>`).join("");
  $("#stMapNote").textContent=(data.miss.length?`Sin coordenadas (no aparecen): ${data.miss.slice(0,12).join(", ")}${data.miss.length>12?"…":""}. Añádelos en Ajustes. `:"")+"Rueda o botones para acercar; arrastra para mover.";
}
(function mapUI(){
  const cv=$("#stMap");if(!cv)return;let drag=null;
  const redraw=()=>{if(!MAP.P)return;const W=cv.clientWidth,H=cv.clientHeight,dpr=window.devicePixelRatio||1,ctx=cv.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);MAP.pts=drawMap(ctx,W,H,MAP.P,MAP.data,{k:MAP.k,px:MAP.px,py:MAP.py});cv.style.touchAction=MAP.k>1?"none":"pan-y"};
  const zoom=(f,cx,cy)=>{const W=cv.clientWidth,H=cv.clientHeight;cx??=W/2;cy??=H/2;const nk=Math.max(1,Math.min(40,MAP.k*f)),r=nk/MAP.k;MAP.px=(MAP.px-(cx-W/2))*r+(cx-W/2);MAP.py=(MAP.py-(cy-H/2))*r+(cy-H/2);MAP.k=nk;if(nk===1){MAP.px=0;MAP.py=0}redraw()};
  cv.addEventListener("wheel",e=>{e.preventDefault();const b=cv.getBoundingClientRect();zoom(e.deltaY<0?1.25:0.8,e.clientX-b.left,e.clientY-b.top)},{passive:false});
  cv.addEventListener("pointerdown",e=>{if(e.pointerType==="touch"&&MAP.k===1)return;drag={x:e.clientX,y:e.clientY,px:MAP.px,py:MAP.py};cv.setPointerCapture(e.pointerId)});
  cv.addEventListener("pointerup",()=>drag=null);cv.addEventListener("pointercancel",()=>drag=null);
  cv.addEventListener("pointermove",e=>{
    if(drag){MAP.px=drag.px+e.clientX-drag.x;MAP.py=drag.py+e.clientY-drag.y;redraw();cv.removeAttribute("data-tip");return}
    const b=cv.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;let best=null,bd=14;
    MAP.pts.forEach(q=>{const d=Math.hypot(q.x-x,q.y-y)-q.r;if(d<bd){bd=d;best=q}});
    if(best){const a=best.p.a;cv.dataset.tip=`<b>${esc(a.i)}${a.iata?" · "+esc(a.iata):""}</b><br>${esc(a.n)}${a.c&&a.c!==a.n?", "+esc(a.c):""}<br>${best.p.n} sectores`}else cv.removeAttribute("data-tip");
  });
  $("#mapIn").onclick=()=>zoom(1.5);$("#mapOut").onclick=()=>zoom(1/1.5);$("#mapFit").onclick=()=>{MAP.k=1;MAP.px=0;MAP.py=0;redraw()};
})();

/* ---------- pestaña Mapa ---------- */
const MPB={k:1,px:0,py:0,pts:[],data:null,P:null,key:"",sel:"",sort:"n",dir:-1,all:false,inclBase:ls.get("lb_mpbase",false),y:ls.get("lb_mpy","all"),g:ls.get("lb_mpg","")};
const isRTS=f=>f.dp===f.ap&&/vuelta a calzos/i.test(f.rem||"");
function mpFlights(){
  const td=today();let F=allF();
  if(MPB.g==="ab")F=F.filter(isAirbus);else if(MPB.g==="ga")F=F.filter(f=>!isAirbus(f));
  if(MPB.y==="12m")F=F.filter(f=>f.d>=addDays(td,-364));else if(MPB.y!=="all")F=F.filter(f=>f.d.startsWith(MPB.y));
  return F;
}
function mpStats(F){
  const A=new Map(),yrs=new Set(F.map(f=>f.d.slice(0,4)));let arr=0;
  const get=c=>{let x=A.get(c);if(!x){x={i:c,n:0,dep:0,ldg:0,min:0,first:"",last:"",years:new Set(),to:new Map()};A.set(c,x)}return x};
  F.forEach(f=>{if(isRTS(f))return;
    if(f.dp){const d=get(f.dp);d.dep++;d.to.set(f.ap,(d.to.get(f.ap)||0)+1)}
    if(f.ap){const a=get(f.ap);a.n++;arr++;a.ldg+=(+f.ldd||0)+(+f.ldn||0);a.min+=+f.tot||0;a.years.add(f.d.slice(0,4));if(!a.first||f.d<a.first)a.first=f.d;if(!a.last||f.d>a.last)a.last=f.d;a.to.set(f.dp,(a.to.get(f.dp)||0)+1)}});
  const ny=Math.max(1,yrs.size);
  const list=[...A.values()].map(x=>{const a=apt(x.i);return {...x,a,name:a?(a.n||""):"",city:a?.c||"",cty:a?.cc?regionName(a.cc):"",avg:x.n/ny,ny:x.years.size}});
  return {list,arr,ny};
}
function renderBigMap(){
  if(view!=="map")return;
  const cv=$("#bigMap");if(!cv)return;
  const F=allF(),ys=[...new Set(F.map(f=>f.d.slice(0,4)))].sort().reverse();
  if(MPB.y!=="all"&&MPB.y!=="12m"&&!ys.includes(MPB.y))MPB.y="all";
  $("#mpY").innerHTML=`<option value="all">Todo el libro</option><option value="12m">Últimos 12 meses</option>`+ys.map(y=>`<option value="${y}">${y}</option>`).join("");$("#mpY").value=MPB.y;
  $$("#mpG button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.g===MPB.g));
  if(!APT||!GEO){Promise.all([loadApts(),loadGeo()]).then(()=>renderBigMap());$("#mpK").textContent="Cargando mapa…";return}
  const R=mpFlights(),{list,arr,ny}=mpStats(R);
  const fs=!!document.fullscreenElement,box=cv.parentElement,W=box.clientWidth||600,H=fs?Math.max(300,innerHeight-110):Math.round(Math.min(Math.max(380,innerHeight*0.66),Math.max(320,W*0.62))),dpr=window.devicePixelRatio||1;
  const data=routeData(R.filter(f=>!isRTS(f))),key=MPB.y+MPB.g+R.length+W+"x"+H+"|"+MPB.sel;
  if(key!==MPB.key){MPB.key=key;MPB.k=1;MPB.px=0;MPB.py=0;
    let fitA=data.apts;
    if(MPB.sel){const c=new Set([MPB.sel]);data.routes.forEach(r=>{if(r.a.i===MPB.sel)c.add(r.b.i);if(r.b.i===MPB.sel)c.add(r.a.i)});const sa=data.apts.filter(p=>c.has(p.a.i));if(sa.length>=2)fitA=sa}
    else if(data.apts.length>30){const tot=data.apts.reduce((a,p)=>a+p.n,0),core=data.apts.filter(p=>p.n>=tot*0.002);if(core.length>=5)fitA=core}
    MPB.P=fitProj(fitA,W,H,40)}
  MPB.data=data;cv.width=W*dpr;cv.height=H*dpr;cv.style.height=H+"px";
  mpDraw();
  const lab=MPB.y==="all"?"Todo el libro":MPB.y==="12m"?"Últimos 12 meses":MPB.y,gl={"":"",ab:" · Airbus",ga:" · Aviación general"}[MPB.g];
  $("#mpT").textContent=lab+gl;
  $("#mpK").textContent=`${fmtInt(R.length)} sectores · ${hm0(R.reduce((a,f)=>a+(+f.tot||0),0))} h`;
  const ctys=count(list.filter(x=>x.n),x=>x.cty||"—",x=>x.n),base=[...list].sort((a,b)=>b.dep-a.dep)[0];
  let nm=0;R.forEach(f=>{const d=fDist(f);if(d)nm+=d});
  const top=[...list].filter(x=>x.i!==base?.i).sort((a,b)=>b.n-a.n)[0];
  $("#mpKpi").innerHTML=[["Aeropuertos",fmtInt(list.length),`${fmtInt(list.filter(x=>x.n).length)} con llegadas`],["Países",fmtInt(ctys.size),""],["Rutas distintas",fmtInt(data.routes.length),""],["Llegadas",fmtInt(arr),`${(arr/ny).toLocaleString("es-ES",{maximumFractionDigits:0})} al año de media`],["Base",base?base.i:"—",base?`${fmtInt(base.dep)} salidas`:""],["Destino favorito",top?top.i:"—",top?`${fmtInt(top.n)} llegadas · ${pct(top.n,arr)} %`:""],["Distancia",fmtInt(nm)+" nm",fmtInt(nm*1.852)+" km"]]
    .map(([k,v,s])=>`<div class="cell"><div class="k">${k}</div><div class="v">${v}</div><div class="note">${esc(s)}</div></div>`).join("");
  // tabla
  const q=$("#mpQ").value.trim().toLowerCase();
  const baseI=base?.i,LA=list.filter(x=>x.n&&(MPB.inclBase||x.i!==baseI)),arrT=Math.max(1,LA.reduce((a,x)=>a+x.n,0));
  let L=LA.filter(x=>(!q||[x.i,x.a?.iata,x.name,x.city,x.cty].some(v=>String(v||"").toLowerCase().includes(q))));
  const sk=MPB.sort,dir=MPB.dir;L.sort((a,b)=>{const va=a[sk],vb=b[sk];return (typeof va==="string"?String(va).localeCompare(vb):(va-vb))*dir||b.n-a.n});
  const maxN=Math.max(1,...LA.map(x=>x.n)),shown=MPB.all||q?L:L.slice(0,40);
  const th=(k,l,c="")=>`<th class="${c}" data-sk="${k}"${sk===k?` aria-sort="${dir<0?"descending":"ascending"}"`:""}>${l}${sk===k?(dir<0?" ↓":" ↑"):""}</th>`;
  $("#mpTbl").innerHTML=L.length?`<table class="mpt"><thead><tr><th>#</th>${th("i","Aeropuerto","l")}${th("n","Llegadas")}<th class="pc">% del total</th>${th("avg","Media/año")}${th("ny","Años")}${th("ldg","Aterrizajes PF")}${th("first","Primera")}${th("last","Última")}</tr></thead><tbody>${shown.map((x,i)=>`<tr data-ap="${esc(x.i)}" class="${x.i===MPB.sel?"on":""}"><td>${i+1}</td><td class="l ap"><b>${esc(x.i)}</b>${x.a?.iata?" · "+esc(x.a.iata):""}<span>${esc([x.city||x.name,x.cty].filter(Boolean).join(" · "))}</span></td><td><b>${fmtInt(x.n)}</b></td><td class="pc l"><i style="width:${Math.max(2,Math.round(70*x.n/maxN))}px"></i>${(x.n/arrT*100).toLocaleString("es-ES",{maximumFractionDigits:1})} %</td><td>${x.avg.toLocaleString("es-ES",{maximumFractionDigits:1})}</td><td>${x.ny}</td><td>${fmtInt(x.ldg)}</td><td>${fmtD(x.first)}</td><td>${fmtD(x.last)}</td></tr>`).join("")}</tbody></table>`:`<p class="note">Sin llegadas en este periodo.</p>`;
  $("#mpBase").checked=!!MPB.inclBase;$("#mpBaseL").lastChild.textContent=` Incluir la base${baseI?" ("+baseI+")":""}`;
  $("#mpMore").innerHTML=!q&&L.length>40?`<button class="btn sm" id="mpAll">${MPB.all?"Ver solo los 40 primeros":`Ver los ${L.length} aeropuertos`}</button><span class="note">Media/año = llegadas ÷ ${ny} año${ny>1?"s":""} con vuelos en el periodo. Años = años distintos en que fuiste.</span>`:`<span class="note">Media/año = llegadas ÷ ${ny} año${ny>1?"s":""} con vuelos en el periodo.</span>`;
  rankList($("#mpCty"),[...ctys.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([k,v])=>({label:k,v,sub:`${pct(v,arr)} % de las llegadas`})),{fmt:fmtInt});
  mpSelCard(list,arr);
}
function mpDraw(){
  const cv=$("#bigMap");if(!MPB.P||!cv)return;const W=cv.clientWidth,H=cv.clientHeight,dpr=window.devicePixelRatio||1,ctx=cv.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
  let conn=null;if(MPB.sel){conn=new Set([MPB.sel]);MPB.data.routes.forEach(r=>{if(r.a.i===MPB.sel)conn.add(r.b.i);if(r.b.i===MPB.sel)conn.add(r.a.i)})}
  MPB.pts=drawMap(ctx,W,H,MPB.P,MPB.data,{k:MPB.k,px:MPB.px,py:MPB.py,hl:MPB.sel||null,conn,maxLabels:MPB.sel?24:Math.round(14+MPB.k*4),scale:W>700?1.1:1});
}
function mpSelCard(list,arr){
  const el=$("#mpSel"),x=list.find(z=>z.i===MPB.sel);
  if(!x){el.innerHTML=`<h3>Aeropuerto</h3><p class="note">Toca un aeropuerto en el mapa o en la tabla para ver sus rutas, cuántas veces has llegado y cuándo fue la primera y la última vez.</p>`;return}
  const a=x.a,routes=[...new Map([...x.to.entries()]).entries()].sort((p,q)=>q[1]-p[1]).slice(0,10);
  el.innerHTML=`<div class="row"><h3>${esc(x.i)}${a?.iata?" · "+esc(a.iata):""}</h3><span class="spacer"></span><button class="btn sm" id="mpClr">Quitar</button></div>
   <div><b>${esc(a?.n||"")}</b><div class="note">${esc([a?.c,x.cty].filter(Boolean).join(" · "))}</div></div>
   <div class="types"><div><span>Llegadas</span><span class="mono">${fmtInt(x.n)} · ${pct(x.n,arr)} %</span></div><div><span>Salidas</span><span class="mono">${fmtInt(x.dep)}</span></div><div><span>Aterrizajes como PF</span><span class="mono">${fmtInt(x.ldg)}</span></div><div><span>Horas de los vuelos de llegada</span><span class="mono">${hm0(x.min)}</span></div><div><span>Media por año</span><span class="mono">${x.avg.toLocaleString("es-ES",{maximumFractionDigits:1})}</span></div><div><span>Años distintos</span><span class="mono">${x.ny}</span></div><div><span>Primera vez</span><span class="mono">${fmtD(x.first)}</span></div><div><span>Última vez</span><span class="mono">${fmtD(x.last)}</span></div></div>
   ${routes.length?`<h3>Conectado con</h3><div class="types">${routes.map(([k,v])=>`<div><span>${esc(k)} <span class="note">${esc(apt(k)?.c||"")}</span></span><span class="mono">${fmtInt(v)}</span></div>`).join("")}</div>`:""}`;
}
(function bigMapUI(){
  const cv=$("#bigMap");if(!cv)return;let drag=null;const ptr=new Map();let pinch=null;
  const zoom=(f,cx,cy)=>{const W=cv.clientWidth,H=cv.clientHeight;cx??=W/2;cy??=H/2;const nk=Math.max(1,Math.min(60,MPB.k*f)),r=nk/MPB.k;MPB.px=(MPB.px-(cx-W/2))*r+(cx-W/2);MPB.py=(MPB.py-(cy-H/2))*r+(cy-H/2);MPB.k=nk;if(nk===1){MPB.px=0;MPB.py=0}mpDraw()};
  const near=(x,y)=>{let best=null,bd=14;MPB.pts.forEach(q=>{const d=Math.hypot(q.x-x,q.y-y)-q.r;if(d<bd){bd=d;best=q}});return best};
  cv.addEventListener("wheel",e=>{e.preventDefault();const b=cv.getBoundingClientRect();zoom(e.deltaY<0?1.25:0.8,e.clientX-b.left,e.clientY-b.top)},{passive:false});
  cv.addEventListener("pointerdown",e=>{cv.setPointerCapture(e.pointerId);ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptr.size===2){const [p,q]=[...ptr.values()];pinch={d:Math.hypot(p.x-q.x,p.y-q.y),k:MPB.k};drag=null}else drag={x:e.clientX,y:e.clientY,px:MPB.px,py:MPB.py,moved:false}});
  const up=e=>{ptr.delete(e.pointerId);if(ptr.size<2)pinch=null;
    if(drag&&!drag.moved&&e.type==="pointerup"){const b=cv.getBoundingClientRect(),hit=near(e.clientX-b.left,e.clientY-b.top);MPB.sel=hit?(hit.p.a.i===MPB.sel?"":hit.p.a.i):"";renderBigMap()}drag=null};
  cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",up);
  cv.addEventListener("pointermove",e=>{
    if(ptr.has(e.pointerId))ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch&&ptr.size===2){const [p,q]=[...ptr.values()],d=Math.hypot(p.x-q.x,p.y-q.y),b=cv.getBoundingClientRect();zoom((pinch.k*d/pinch.d)/MPB.k,(p.x+q.x)/2-b.left,(p.y+q.y)/2-b.top);return}
    if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;if(drag.moved){MPB.px=drag.px+dx;MPB.py=drag.py+dy;mpDraw();cv.removeAttribute("data-tip")}return}
    const b=cv.getBoundingClientRect(),best=near(e.clientX-b.left,e.clientY-b.top);
    if(best){const a=best.p.a;cv.dataset.tip=`<b>${esc(a.i)}${a.iata?" · "+esc(a.iata):""}</b><br>${esc(a.n)}${a.c&&a.c!==a.n?", "+esc(a.c):""}<br>${best.p.n} sectores`;cv.style.cursor="pointer"}else{cv.removeAttribute("data-tip");cv.style.cursor=""}
  });
  $("#mpIn").onclick=()=>zoom(1.5);$("#mpOut").onclick=()=>zoom(1/1.5);$("#mpFit").onclick=()=>{MPB.k=1;MPB.px=0;MPB.py=0;mpDraw()};
  $("#mpFs").onclick=()=>{const p=$("#mpPanel");if(document.fullscreenElement)document.exitFullscreen();else (p.requestFullscreen?p.requestFullscreen():p.webkitRequestFullscreen?.())?.catch?.(()=>toast("Tu navegador no permite pantalla completa aquí"))};
  document.addEventListener("fullscreenchange",()=>{$("#mpFs").textContent=document.fullscreenElement?"Salir":"Pantalla completa";MPB.key="";setTimeout(renderBigMap,60)});
  $("#mpY").onchange=e=>{MPB.y=e.target.value;ls.set("lb_mpy",MPB.y);MPB.sel="";renderBigMap()};
  $("#mpG").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;MPB.g=b.dataset.g;ls.set("lb_mpg",MPB.g);MPB.sel="";renderBigMap()});
  $("#mpQ").addEventListener("input",()=>renderBigMap());
  $("#mpBase").onchange=e=>{MPB.inclBase=e.target.checked;ls.set("lb_mpbase",MPB.inclBase);renderBigMap()};
  $("#mpTbl").addEventListener("click",e=>{const h=e.target.closest("th[data-sk]");if(h){const k=h.dataset.sk;if(MPB.sort===k)MPB.dir*=-1;else{MPB.sort=k;MPB.dir=["i","first"].includes(k)?1:-1}renderBigMap();return}
    const r=e.target.closest("tr[data-ap]");if(r){MPB.sel=r.dataset.ap===MPB.sel?"":r.dataset.ap;renderBigMap();$("#mpPanel").scrollIntoView({behavior:"smooth",block:"start"})}});
  document.addEventListener("click",e=>{if(e.target.id==="mpAll"){MPB.all=!MPB.all;renderBigMap()}if(e.target.id==="mpClr"){MPB.sel="";renderBigMap()}});
  $("#cvExpand").onclick=()=>{const r=cvRange;if(r.startsWith("y:"))MPB.y=r.slice(2);else if(r==="all")MPB.y="all";MPB.key="";go("map")};
  let rt;addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{if(view==="map"){MPB.key="";renderBigMap()}},200)});
})();

/* ---------- pestaña Fatiga ---------- */
const FT={rep:ls.get("lb_ftrep",{min:55,from:"2016"}),scope:ls.get("lb_ftscope","ab"),sim:ls.get("lb_ftsim",true)!==false,sel:"",cache:null,key:""};
const FT_TZ="Europe/Madrid";
const _ftFmt=new Intl.DateTimeFormat("en-CA",{timeZone:FT_TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
function ftOff(ms){const p={};_ftFmt.formatToParts(new Date(ms)).forEach(x=>p[x.type]=x.value);const loc=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);return Math.round((loc-Math.floor(ms/6e4)*6e4)/6e4)}
const ftL=(ms,off)=>{const t=new Date(ms+off*6e4);return {d:t.toISOString().slice(0,10),m:t.getUTCHours()*60+t.getUTCMinutes()}};
const ftHM=m=>String(Math.floor(((m%1440)+1440)%1440/60)).padStart(2,"0")+":"+String(((m%60)+60)%60).padStart(2,"0");
function ftOverlap(a,b,w0,w1){/* minutos de [a,b] (min locales absolutos) dentro de la ventana diaria [w0,w1) (w1 puede pasar de 1440) */
  let s=0;for(let d=Math.floor(a/1440)-1;d<=Math.floor(b/1440);d++){const x=d*1440+w0,y=d*1440+w1;s+=Math.max(0,Math.min(b,y)-Math.max(a,x))}return s}
function ftBuild(){
  const AF=allF(),key=JSON.stringify(FT.rep)+FT.scope+FT.sim+AF.length+allS().length+(AF[AF.length-1]?.id||"");
  if(FT.cache&&FT.key===key)return FT.cache;
  const baseC=count(AF.filter(isAirbus),f=>f.dp),base=[...baseC.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||"LEBL";
  const F=(FT.scope==="ab"?AF.filter(isAirbus):AF).filter(f=>f.d&&f.dt&&(f.at||f.tot)).map(f=>{const s=Date.parse(f.d+"T"+f.dt+":00Z");let e=f.at?Date.parse(f.d+"T"+f.at+":00Z"):s+(+f.tot||0)*6e4;if(e<s)e+=864e5;return {f,s,e}}).sort((a,b)=>a.s-b.s);
  const D=[];let cur=null;
  F.forEach(x=>{if(!cur||x.s-cur.end>=8*36e5){cur={fl:[x.f],start:x.s,end:x.e,first:x};D.push(cur)}else{cur.fl.push(x.f);cur.end=Math.max(cur.end,x.e)}});
  D.forEach((d,i)=>{
    const fb=+d.first.f.tot||0,atBase=d.first.f.dp===base&&d.first.f.d.slice(0,4)>=String(FT.rep.from);d.repBefore=atBase?(+FT.rep.min||55):(fb>180?60:45);d.report=d.start-d.repBefore*6e4;d.off=ftOff(d.report);
    d.fdp=(d.end-d.report)/6e4;d.duty=d.fdp+20;d.sectors=Math.max(1,d.fl.filter(f=>!isRTS(f)).length);d.block=d.fl.reduce((a,f)=>a+(+f.tot||0),0);
    const R=ftL(d.report,d.off),E=ftL(d.end+20*6e4,d.off);d.ld=R.d;d.rm=R.m;d.em=E.m;d.ed=E.d;
    const a=Math.round(d.report/6e4)+d.off,b=Math.round(d.end/6e4)+20+d.off;
    d.max=fdpMax(d.rm,d.sectors);d.pct=d.fdp/d.max;
    d.early=d.rm>=300&&d.rm<360;d.vearly=d.rm<300;d.wocl=ftOverlap(a,b,120,300)>0;d.late=!d.wocl&&(d.em>=1380||d.em<120)&&(b-a)>0;
    d.noct=ftOverlap(a,b,1320,1800);
    d.route=[d.fl[0].dp,...d.fl.map(f=>f.ap)].join("–");d.restAt=d.fl[d.fl.length-1].ap;
    if(i){const p=D[i-1];d.rest=(d.report-(p.end+20*6e4))/6e4;d.restAway=p.restAt!==base;d.restReq=Math.max(p.duty,d.restAway?600:720);d.short=d.rest<d.restReq}else d.rest=null;
  });
  const S=FT.sim?allS().filter(s=>s.d).map(s=>({d:s.d,tot:+s.tot||0,duty:(+s.tot||0)+60,s})):[];
  // por día
  const dayBlock=new Map(),dayDuty=new Map(),air=new Set(),act=new Set();
  D.forEach(d=>{dayBlock.set(d.ld,(dayBlock.get(d.ld)||0)+d.block);dayDuty.set(d.ld,(dayDuty.get(d.ld)||0)+d.duty);air.add(d.ld);act.add(d.ld);if(d.ed!==d.ld)act.add(d.ed)});
  S.forEach(x=>{dayDuty.set(x.d,(dayDuty.get(x.d)||0)+x.duty);act.add(x.d)});
  const all=[...act].sort();if(!all.length){FT.cache={D,S,M:new Map(),Y:new Map(),base};FT.key=key;return FT.cache}
  const first=all[0],last=all[all.length-1]>today()?all[all.length-1]:today();
  // ventanas móviles
  const roll={b28:new Map(),d7:new Map(),d14:new Map(),d28:new Map(),run:new Map()};
  const days=[];for(let x=first;x<=last;x=addDays(x,1))days.push(x);
  const win=(map,n,out)=>{let s=0;days.forEach((x,i)=>{s+=map.get(x)||0;if(i>=n)s-=map.get(days[i-n])||0;out.set(x,s)})};
  win(dayBlock,28,roll.b28);win(dayDuty,7,roll.d7);win(dayDuty,14,roll.d14);win(dayDuty,28,roll.d28);
  let r=0;days.forEach(x=>{r=air.has(x)?r+1:0;roll.run.set(x,r)});
  // meses
  const M=new Map(),mk=k=>{let m=M.get(k);if(!m){m={k,block:0,duty:0,fdps:0,sectors:0,sims:0,simMin:0,act:new Set(),air:new Set(),early:0,vearly:0,wocl:0,late:0,noct:0,hi:0,over:0,short:0,heavy:0,run:0,b28:0,d7:0,d28:0,D:[],S:[]};M.set(k,m)}return m};
  D.forEach(d=>{const m=mk(d.ld.slice(0,7));m.D.push(d);m.block+=d.block;m.duty+=d.duty;m.fdps++;m.sectors+=d.sectors;m.early+=d.early;m.vearly+=d.vearly;m.wocl+=d.wocl;m.late+=d.late;m.noct+=d.noct;m.hi+=d.pct>=0.9&&d.pct<=1;m.over+=d.pct>1;m.short+=!!d.short;m.heavy+=d.sectors>=4});
  S.forEach(x=>{const m=mk(x.d.slice(0,7));m.S.push(x);m.sims++;m.simMin+=x.tot;m.duty+=x.duty});
  days.forEach(x=>{const m=M.get(x.slice(0,7));if(!m)return;if(act.has(x))m.act.add(x);if(air.has(x))m.air.add(x);m.run=Math.max(m.run,roll.run.get(x));m.b28=Math.max(m.b28,roll.b28.get(x));m.d7=Math.max(m.d7,roll.d7.get(x));m.d28=Math.max(m.d28,roll.d28.get(x))});
  M.forEach(m=>{const [y,mo]=m.k.split("-").map(Number),dim=new Date(Date.UTC(y,mo,0)).getUTCDate(),lim=m.k===today().slice(0,7)?+today().slice(8):dim;
    m.dim=lim;m.off=Math.max(0,lim-m.act.size);m.offReq=Math.round((mo===2?11:12)*lim/dim);
    const p={carga:m.block/60*0.1+Math.max(0,m.b28/60-90)*0.5,madrug:m.early*1.5+m.vearly*2,wocl:m.wocl*2.5,tarde:m.late*1,fdp:m.hi*1+m.over*3,desc:m.short*3,dias:Math.max(0,m.run-5)*2+Math.max(0,m.offReq-m.off)*1.5,sect:m.heavy*0.3};
    m.parts=p;m.score=Object.values(p).reduce((a,v)=>a+v,0)});
  // niveles por quintiles de tu propio historial
  const sc=[...M.values()].filter(m=>m.fdps).map(m=>m.score).sort((a,b)=>a-b),q=f=>sc.length?sc[Math.min(sc.length-1,Math.floor(f*sc.length))]:0;
  const th=[q(.2),q(.4),q(.6),q(.8),q(.95)];M.forEach(m=>{m.lvl=!m.fdps&&!m.sims?-1:m.score<th[0]?0:m.score<th[1]?1:m.score<th[2]?2:m.score<th[3]?3:m.score<th[4]?4:5});
  // años
  const Y=new Map();M.forEach(m=>{const y=m.k.slice(0,4);let a=Y.get(y);if(!a){a={y,block:0,fdps:0,early:0,vearly:0,wocl:0,late:0,short:0,hi:0,over:0,noct:0,b28:0,run:0,score:0,n:0,top:null,act:0};Y.set(y,a)}
    ["block","fdps","early","vearly","wocl","late","short","hi","over","noct"].forEach(k=>a[k]+=m[k]);a.act+=m.act.size;a.b28=Math.max(a.b28,m.b28);a.run=Math.max(a.run,m.run);if(m.fdps){a.score+=m.score;a.n++;if(!a.top||m.score>a.top.score)a.top=m}});
  FT.cache={D,S,M,Y,base,th,first,last,roll};FT.key=key;return FT.cache;
}
const ftLab=["Muy baja","Baja","Media","Alta","Muy alta","Extrema"];
function renderFatigue(){
  if(view!=="fat")return;
  $$("#ftScope button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.s===FT.scope));$("#ftSim").checked=FT.sim;
  {const ys=[...new Set(allF().filter(isAirbus).map(f=>f.d.slice(0,4)))].sort();if(!ys.includes(String(FT.rep.from)))ys.unshift(String(FT.rep.from));$("#ftRepFrom").innerHTML=ys.map(y=>`<option${y===String(FT.rep.from)?" selected":""}>${y}</option>`).join("");$("#ftRepMin").value=FT.rep.min;}
  const {D,M,Y,base,th}=ftBuild();
  if(!D.length){$("#ftKpi").innerHTML="";$("#ftHeat").innerHTML=`<p class="note">Necesito vuelos con hora OUT e IN para calcular las actividades.</p>`;["#ftTop","#ftLow","#ftYears","#ftMonth","#ftLg"].forEach(s=>$(s).innerHTML="");return}
  $("#ftK").textContent=`${fmtInt(D.length)} actividades de vuelo · base ${base} · horas locales de ${FT_TZ.split("/")[1]}`;
  const n=D.length,pc=x=>(x/n*100).toLocaleString("es-ES",{maximumFractionDigits:1})+" %",ms=[...M.values()].filter(m=>m.fdps);
  const top=ms.slice().sort((a,b)=>b.score-a.score)[0],maxB=ms.reduce((a,m)=>m.b28>a.b28?m:a,ms[0]),maxR=ms.reduce((a,m)=>m.run>a.run?m:a,ms[0]);
  const mName=k=>MES[+k.slice(5)-1]+" "+k.slice(0,4);
  $("#ftKpi").innerHTML=[["Actividades de vuelo",fmtInt(n),`FDP media ${hm0(D.reduce((a,d)=>a+d.fdp,0)/n)} h`],["Madrugones",fmtInt(D.filter(d=>d.early||d.vearly).length),`${pc(D.filter(d=>d.early||d.vearly).length)} · firma antes de las 06:00`],["Noches (WOCL)",fmtInt(D.filter(d=>d.wocl).length),pc(D.filter(d=>d.wocl).length)+" · entre 02:00 y 04:59"],["Finales tardíos",fmtInt(D.filter(d=>d.late).length),"fin entre 23:00 y 01:59"],["FDP ≥ 90 % del máximo",fmtInt(D.filter(d=>d.pct>=.9).length),`${D.filter(d=>d.pct>1).length} por encima de la tabla`],["Descansos bajo mínimo",fmtInt(D.filter(d=>d.short).length),"ORO.FTL.235 / conv. 13.13"],["Máx. días seguidos volando",maxR?maxR.run:0,maxR?mName(maxR.k)+" · convenio: 6":""],["Máx. block en 28 días",maxB?hm0(maxB.b28):"—",maxB?mName(maxB.k)+" · límite 100 h":""],["Mes con más carga",top?mName(top.k):"—",top?"índice "+Math.round(top.score):""]]
    .map(([k,v,s])=>`<div class="cell"><div class="k">${k}</div><div class="v">${v}</div><div class="note">${esc(s)}</div></div>`).join("");
  // mapa de calor
  const ys=[...Y.keys()].sort().reverse();
  let g=`<div class="ftg"><div></div>${MES.map(m=>`<div class="h">${m}</div>`).join("")}<div class="h">Año</div>`;
  ys.forEach(y=>{const a=Y.get(y);g+=`<div class="y">${y}</div>`;
    for(let i=1;i<=12;i++){const k=y+"-"+String(i).padStart(2,"0"),m=M.get(k);
      if(!m||m.lvl<0){g+=`<div class="c e">·</div>`;continue}
      g+=`<div class="c ft${m.lvl}${FT.sel===k?" on":""}" data-k="${k}" data-tip="<b>${mName(k)}</b> · ${ftLab[m.lvl]}<br>Índice ${Math.round(m.score)} · ${hm0(m.block)} h block · ${m.fdps} actividades<br>${m.early+m.vearly} madrugones · ${m.wocl} noches · ${m.late} finales tardíos<br>${m.short} descansos bajo mínimo · ${m.run} días seguidos · ${m.off} días sin actividad">${Math.round(m.score)}<small>${hm0(m.block).split(":")[0]} h</small></div>`}
    g+=`<div class="yt">${a.n?Math.round(a.score/a.n):"—"}</div>`});
  $("#ftHeat").innerHTML=g+"</div>";
  $("#ftLg").innerHTML=ftLab.map((l,i)=>`<span><i class="sw ft${i}"></i>${l}</span>`).join("")+`<span class="note">Niveles relativos a tu propio historial (quintiles). En cada casilla: índice y horas block. A la derecha, índice medio del año.</span>`;
  const rk=(L)=>L.map(m=>({label:mName(m.k),v:Math.round(m.score),sub:`${hm0(m.block)} h · ${m.early+m.vearly} madrug. · ${m.wocl} noches · ${m.short} desc. cortos · ${m.off} días sin act.`,k:m.k}));
  const R1=ms.slice().sort((a,b)=>b.score-a.score).slice(0,10),R2=ms.filter(m=>m.fdps>=4).sort((a,b)=>a.score-b.score).slice(0,10);
  rankList($("#ftTop"),rk(R1),{fmt:v=>v});rankList($("#ftLow"),rk(R2),{fmt:v=>v});
  [["#ftTop",R1],["#ftLow",R2]].forEach(([s,L])=>[...$(s).children].forEach((el,i)=>{if(L[i]){el.dataset.k=L[i].k;el.style.cursor="pointer"}}));
  // años
  $("#ftYears").innerHTML=`<table class="rp-t mpt"><thead><tr><th class="l">Año</th><th>Block</th><th>vs 900 h</th><th>Actividades</th><th>Días con actividad</th><th>Madrugones</th><th>Noches WOCL</th><th>Finales tardíos</th><th>Horas nocturnas*</th><th>FDP ≥ 90 %</th><th>Desc. bajo mín.</th><th>Máx. 28 días</th><th>Máx. días seguidos</th><th>Índice medio</th><th class="l">Peor mes</th></tr></thead><tbody>${ys.map(y=>{const a=Y.get(y);return `<tr><td class="l"><b>${y}</b></td><td>${hm0(a.block)}</td><td>${Math.round(a.block/60/900*100)} %</td><td>${fmtInt(a.fdps)}</td><td>${fmtInt(a.act)}</td><td>${a.early+a.vearly}</td><td>${a.wocl}</td><td>${a.late}</td><td>${hm0(a.noct)}</td><td>${a.hi+a.over}</td><td>${a.short}</td><td>${hm0(a.b28)}</td><td>${a.run}</td><td><b>${a.n?Math.round(a.score/a.n):"—"}</b></td><td class="l">${a.top?MES[+a.top.k.slice(5)-1]:"—"}</td></tr>`}).join("")}</tbody></table><p class="note">* Horas de actividad entre las 22:00 y las 06:00 locales (actividad aérea nocturna, convenio art. 13.7).</p>`;
  if(!FT.sel||!M.get(FT.sel))FT.sel=top?.k||"";
  ftMonth(M.get(FT.sel),base);
  $("#ftHow").innerHTML=ftHowHTML(base,th);
}
function ftMonth(m,base){
  const el=$("#ftMonth");if(!m){el.innerHTML="";return}
  const mName=MES[+m.k.slice(5)-1]+" "+m.k.slice(0,4),p=m.parts;
  const parts=[["Carga (block y 28 días)",p.carga],["Madrugones",p.madrug],["Noches WOCL",p.wocl],["Finales tardíos",p.tarde],["FDP cerca o sobre el máximo",p.fdp],["Descansos bajo mínimo",p.desc],["Días seguidos y días libres",p.dias],["Actividades de 4+ sectores",p.sect]].filter(x=>x[1]>0.05);
  const tag=(c,t,b)=>c?`<span class="tag${b?" b":""}">${t}</span>`:"";
  el.innerHTML=`<div class="row"><h3>${mName} · índice ${Math.round(m.score)} · ${ftLab[Math.max(0,m.lvl)]}</h3></div>
   <div class="sumgrid dist">${[["Block",hm0(m.block)],["Actividad (duty)",hm0(m.duty)],["Actividades de vuelo",m.fdps],["Sectores",m.sectors],["Simuladores",m.sims],["Días sin actividad",`${m.off} / ${m.offReq} conv.`],["Máx. días seguidos",`${m.run} / 6 conv.`],["Máx. block 28 días",`${hm0(m.b28)} / 100`],["Máx. duty 7 días",`${hm0(m.d7)} / 60`],["Máx. duty 28 días",`${hm0(m.d28)} / 190`]].map(([k,v])=>`<div class="cell"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}</div>
   ${parts.length?`<div class="types">${parts.sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div><span>${k}</span><span class="mono">+${v.toLocaleString("es-ES",{maximumFractionDigits:1})}</span></div>`).join("")}</div>`:""}
   <div class="rp-x"><table class="rp-t mpt ftd"><thead><tr><th class="l">Día</th><th>Firma</th><th>Fin</th><th>FDP</th><th>Máx. tabla</th><th>%</th><th>Sect.</th><th>Block</th><th>Descanso previo</th><th class="l">Ruta</th><th class="l">Alertas</th></tr></thead><tbody>
   ${m.D.map(d=>`<tr><td class="l">${fmtD(d.ld)}</td><td>${ftHM(d.rm)}</td><td>${ftHM(d.em)}</td><td>${hm0(d.fdp)}</td><td>${hm0(d.max)}</td><td>${Math.round(d.pct*100)} %</td><td>${d.sectors}</td><td>${hm0(d.block)}</td><td>${d.rest==null?"—":d.rest>=2880?Math.round(d.rest/1440)+" d":hm0(d.rest)}${d.rest!=null&&d.rest<2880?`<span class="note"> / ${hm0(d.restReq)}${d.restAway?" fuera":""}</span>`:""}</td><td class="l fl">${esc(d.route)}</td><td class="l fl">${tag(d.vearly,"Firma < 05:00",1)}${tag(d.early,"Madrugón")}${tag(d.wocl,"WOCL",1)}${tag(d.late,"Fin tardío")}${tag(d.pct>1,"FDP > tabla",1)}${tag(d.pct>=.9&&d.pct<=1,"FDP ≥ 90 %")}${tag(d.short,"Descanso < mín.",1)}${tag(d.sectors>=4,d.sectors+" sectores")}</td></tr>`).join("")}
   ${m.S.map(x=>`<tr><td class="l">${fmtD(x.d)}</td><td colspan="6" class="l">Simulador ${esc(x.s.role||"")} · ${esc(x.s.typ||"")}</td><td>${hm0(x.tot)}</td><td></td><td class="l fl" colspan="2">${esc((x.s.rem||"").slice(0,80))}</td></tr>`).join("")}
   </tbody></table></div>`;
}
function ftHowHTML(base,th){return `<ul>
 <li><b>Actividades de vuelo:</b> sectores agrupados hasta que hay 8 h o más entre calzos y calzos. Solo hay horas OUT/IN reales, no las programadas, así que todo es una estimación.</li>
 <li><b>Firma:</b> en ${esc(base)}, ${+FT.rep.min||55} min antes del OUT del primer sector desde ${esc(String(FT.rep.from))} (lo cambias arriba). Fuera de base y antes de esa fecha, 45 min o 60 min si el primer sector dura más de 3 h block (convenio, art. 13.4, mínimo). <b>Fin de actividad:</b> calzos del último sector + 20 min (art. 13.10).</li>
 <li><b>FDP máximo:</b> tabla de ORO.FTL.205(b)(1) para tripulación aclimatada, sin extensiones ni descanso a bordo: de 13:00 h (firma 06:00–13:29) a 11:00 h (17:00–04:59), menos 30 min por sector a partir del tercero, mínimo 9:00 h. Se usa la hora local de ${FT_TZ} (aclimatado a base).</li>
 <li><b>Descanso mínimo:</b> el mayor entre la actividad anterior y 12 h en base (${esc(base)}) o 10 h fuera de base (ORO.FTL.235). El convenio permite reducirlo hasta 12 h en base y 10:30 h fuera (art. 13.13).</li>
 <li><b>Horarios perturbadores</b> (ORO.FTL.105 y CS FTL.1.235): madrugón = firma entre 05:00 y 05:59 (se marca aparte si es antes de las 05:00); noche = actividad que toca la ventana de 02:00 a 04:59 (WOCL); fin tardío = fin entre 23:00 y 01:59. Las horas nocturnas del convenio son las de 22:00 a 06:00 (art. 13.7).</li>
 <li><b>Límites acumulados</b> (ORO.FTL.210): 100 h block en 28 días, 900 h por año natural, duty de 60 h en 7 días, 110 h en 14 y 190 h en 28. <b>Convenio</b> (art. 12.2.1): máximo 6 días seguidos de actividad aérea y 12 días libres al mes (11 en febrero).</li>
 <li><b>Días sin actividad:</b> días sin vuelo ni simulador. La app no conoce tus imaginarias, oficina, cursos ni vacaciones, así que pueden no ser días libres reales.</li>
 <li><b>Simuladores:</b> cuentan como día de actividad y suman su tiempo + 1 h de briefing al duty. No llevan hora, así que no entran en descansos ni en horarios.</li>
 <li><b>Índice del mes</b> (cuanto más alto, más carga): 0,1 por hora block + 0,5 por hora de block en 28 días por encima de 90; 1,5 por madrugón y 2 si la firma es antes de las 05:00; 2,5 por noche WOCL; 1 por fin tardío; 1 por FDP al 90–100 % de la tabla y 3 si la pasa; 3 por descanso bajo mínimo; 2 por cada día seguido de vuelo por encima de 5; 1,5 por cada día sin actividad por debajo de 12; 0,3 por actividad de 4 o más sectores.</li>
 <li><b>Niveles</b> (colores): quintiles de tus propios meses con vuelo; los cortes actuales son ${th.map(x=>Math.round(x)).join(" · ")}. No es un modelo biomatemático de fatiga (tipo SAFE o FAID): sirve para comparar tus meses entre sí.</li></ul>`}
(function fatigueUI(){
  if(!$("#v-fat"))return;
  $("#ftScope").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;FT.scope=b.dataset.s;ls.set("lb_ftscope",FT.scope);FT.sel="";renderFatigue()});
  $("#ftSim").onchange=e=>{FT.sim=e.target.checked;ls.set("lb_ftsim",FT.sim);renderFatigue()};
  const saveRep=()=>{FT.rep={min:Math.max(30,Math.min(120,parseInt($("#ftRepMin").value)||55)),from:$("#ftRepFrom").value};ls.set("lb_ftrep",FT.rep);renderFatigue()};
  $("#ftRepMin").onchange=saveRep;$("#ftRepFrom").onchange=saveRep;
  const pick=k=>{FT.sel=k;renderFatigue();$("#ftMonth").scrollIntoView({behavior:"smooth",block:"start"})};
  $("#ftHeat").addEventListener("click",e=>{const c=e.target.closest(".c[data-k]");if(c)pick(c.dataset.k)});
  ["#ftTop","#ftLow"].forEach(s=>$(s).addEventListener("click",e=>{const r=e.target.closest("[data-k]");if(r)pick(r.dataset.k)}));
})();

/* ---------- importadores específicos: SAT, Pitulin, LSC ---------- */
const simKindOf=t=>{const T=String(t).toUpperCase();for(const [re,k] of [[/\bLPC\b/,"LPC"],[/\bOPC\b/,"OPC"],[/SKILL TEST/,"Skill test"],[/COMMAND COURSE|\bUPG/,"Mando (upgrade)"],[/\bLOFT\b/,"LOFT"],[/\bEBT\b/,"EBT EVAL"],[/\bHT\b|TYPE RATING|\bJOC\b|\bMCC\b/,"Curso de tipo"],[/RENOV|REVA/,"LPC"]])if(re.test(T))return k;return "Otro"};
const simTypOf=t=>{const T=String(t).toUpperCase();return /APT/.test(T)?"APT":/FTD|FST\.2/.test(T)?"FTD":"FFS"};
const isTreText=t=>/LPC|REVALID|RENEWAL|RENOV|RENO\b|REVA\b|SKILL TEST/i.test(t);
const hm2m=s=>{const m=String(s||"").match(/(\d+):(\d\d)/);return m?+m[1]*60+ +m[2]:0};
async function satParsePDF(pdf){
  const rows=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p),tc=await page.getTextContent(),H=page.view[3];
    const W=tc.items.filter(it=>it.str.trim()).map(it=>({x:it.transform[4],top:H-it.transform[5],t:it.str.trim()}));
    const an=W.filter(w=>w.x<35&&/^\d\d-$/.test(w.t)&&w.top>60).sort((a,b)=>a.top-b.top),days=[];
    for(let i=0;i<an.length;i+=2)days.push(an[i]);
    const foot=W.filter(w=>/^(Report|Total)\b/.test(w.t)).map(w=>w.top);
    days.forEach((d,i)=>{const lo=d.top-3,hi=i+1<days.length?days[i+1].top-3:Math.min(...foot.filter(f=>f>lo),H);
      const B=W.filter(w=>w.top>=lo&&w.top<hi),col=(a,b)=>B.filter(w=>w.x>=a&&w.x<b).sort((p,q)=>Math.round(p.top)-Math.round(q.top)||p.x-q.x).map(w=>w.t).join(" ");
      rows.push({date:col(0,40),off:col(75,130),on:col(130,155),typ:col(155,205),reg:col(205,252),syn:col(598,640),isyn:col(640,680),rem:col(750,900)})});
  }
  const ok=rows.filter(r=>/(\d\d)-\s*(\d\d)-\s*(\d{4})/.test(r.date)&&/\d:\d\d/.test(r.off)&&/\d:\d\d/.test(r.on));
  // franja exacta → una sesión (tope = calzos); franjas solapadas el mismo día → una sesión (tope = unión)
  const g=new Map();ok.forEach(r=>{const [,dd,mm,yy]=r.date.match(/(\d\d)-\s*(\d\d)-\s*(\d{4})/),d=`${yy}-${mm}-${dd}`,k=d+"|"+r.off+"|"+r.on;if(!g.has(k))g.set(k,{d,off:r.off,on:r.on,rows:[]});g.get(k).rows.push(r)});
  const slots=[...g.values()].map(s=>{const a=hm2m(s.off);let b=hm2m(s.on);if(b<=a)b+=1440;const raw=s.rows.reduce((x,r)=>x+hm2m(r.isyn||r.syn),0);return {...s,a,b,raw,t:Math.min(raw,b-a)}});
  const byD=new Map();slots.forEach(s=>{if(!byD.has(s.d))byD.set(s.d,[]);byD.get(s.d).push(s)});
  const S=[],merged=[];let total=0;
  byD.forEach(L=>{L.sort((x,y)=>x.a-y.a);let cur=[L[0]];const cl=[];
    for(const s of L.slice(1)){if(s.a<Math.max(...cur.map(x=>x.b)))cur.push(s);else{cl.push(cur);cur=[s]}}cl.push(cur);
    cl.forEach(c=>{const iv=c.map(x=>[x.a,x.b]).sort((p,q)=>p[0]-q[0]);let U=0,[ca,cb]=iv[0];for(const [a,b] of iv.slice(1)){if(a<=cb)cb=Math.max(cb,b);else{U+=cb-ca;[ca,cb]=[a,b]}}U+=cb-ca;
      const raw=c.reduce((x,s)=>x+s.raw,0),t=Math.min(c.reduce((x,s)=>x+s.t,0),U),rs=c.flatMap(s=>s.rows);total+=raw;
      if(raw>t)merged.push({d:c[0].d,raw,t,n:rs.length});
      const rem=[...new Set(rs.map(r=>r.rem))].join(" / "),dev=rs[0].reg.replace(/\s+/g," ").trim();
      S.push({id:uid(),d:c[0].d,typ:simTypOf(rs[0].typ+" "+dev),dev:dev+" · Simple Aviation Training",kind:simKindOf(rem),mod:"",tot:t,role:isTreText(rem)?"TRE":"TRI",tol:0,app:0,rem,scen:"",inBook:false,ext:"sat:"+c[0].d+" "+c[0].off})})});
  return {S:S.sort((a,b)=>a.d.localeCompare(b.d)),merged,rows:ok.length,total};
}
async function satImport(pdf,file){
  const r=await satParsePDF(pdf);
  imp={file:file.name,kind:"sat",parsed:{F:[],S:r.S}};
  drawPreview();
  area.insertAdjacentHTML("afterbegin",`<div class="msg ok">Informe de Simple Aviation Training: ${r.rows} líneas (${hm0(r.total)} h) → ${r.S.length} sesiones (${hm0(r.S.reduce((a,s)=>a+s.tot,0))} h). ${r.merged.length?`He juntado alumnos de la misma sesión o franjas solapadas en ${r.merged.length} días (${r.merged.slice(0,6).map(m=>fmtD(m.d)).join(", ")}${r.merged.length>6?"…":""}).`:""} Las LPC, revalidaciones, renovaciones y skill tests van como TRE. Las sesiones que ya tienes no se duplican.</div>`);
}
/* Pitulin · Exámenes: pegar el texto del archivo */
const MES_ES={ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,sept:9,oct:10,nov:11,dic:12};
function pitulinParse(txt){
  const L=txt.split(/\n/).map(s=>s.trim()).filter(Boolean),out=[];
  for(let i=0;i<L.length;i++){const m=L[i].match(/^(\d{1,2})\s+([a-záéíóú]+)\.?\s+(\d{4})$/i);if(!m||!MES_ES[m[2].toLowerCase()])continue;
    const kind=(L[i+1]||"").toUpperCase(),name=L[i+2]||"";if(!/REVALID|RENOVA|SKILL|CONVERS|ATPL|OTRA/.test(kind))continue;
    const d=`${m[3]}-${String(MES_ES[m[2].toLowerCase()]).padStart(2,"0")}-${m[1].padStart(2,"0")}`;out.push({d,kind:kind.charAt(0)+kind.slice(1).toLowerCase(),name})}
  return out;
}
function pitulinApply(list){
  const S=allS(),add=[],upd=[],per=new Map();
  list.forEach(x=>{if(x.d>today())return;if(!per.has(x.d))per.set(x.d,[]);per.get(x.d).push(x)});
  per.forEach((L,d)=>{const same=S.filter(s=>s.d===d&&(ROLE_INS.includes(s.role)||ROLE_EXA.includes(s.role)));
    const names=L.map(x=>x.name).join(", "),kinds=[...new Set(L.map(x=>x.kind))].join(" + ");
    if(same.length){same.forEach(s=>{if(s.role!=="TRE"&&(isTreText(s.rem)||same.length===1))upd.push({...s,role:"TRE",kind:s.kind==="Otro"?"LPC":s.kind,rem:s.rem.includes(L[0].name)?s.rem:(s.rem?s.rem+" · ":"")+kinds+" "+names})})}
    else if(!S.some(s=>s.ext===`pit:${d}`))add.push({id:uid(),d,typ:"FFS",dev:"A320 FFS",kind:/skill/i.test(kinds)?"Skill test":"LPC",mod:"",tot:Math.min(240,120*L.length),role:"TRE",tol:0,app:0,rem:`${kinds} · ${names} · tiempo estimado`,scen:"",inBook:false,ext:`pit:${d}`})});
  return {add,upd};
}
/* LSC: pegar fecha + vuelo */
function lscParse(txt){return txt.split(/\n/).map(l=>{const m=l.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\D+(?:VY|VLG)?\s*0*(\d{1,4})/i);if(!m)return null;const y=m[3].length===2?"20"+m[3]:m[3];return {d:`${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`,flt:String(+m[4])}}).filter(Boolean)}
function lscApply(list,inst){
  const F=allF(),hit=[],miss=[];
  list.forEach(x=>{const f=F.find(f=>f.d===x.d&&String(f.flt||"").replace(/\D/g,"").replace(/^0+/,"")===x.flt);if(!f){miss.push(x);return}
    const r={...f,rem:/\bLSC\b/.test(f.rem||"")?f.rem:((f.rem?f.rem+" · ":"")+"LSC")};if(inst&&f.fpic)r.finst=f.tot;hit.push(["f",r])});
  if(hit.length)bulkPut(hit);return {n:hit.length,miss};
}
(function specialImportUI(){
  const el=$("#pitGo");if(!el)return;
  el.onclick=()=>{const L=pitulinParse($("#pitTxt").value);if(!L.length){$("#pitMsg").innerHTML=`<div class="msg w">No he reconocido exámenes. Copia el texto del Archivo de Exámenes de Pitulin (año por año) y pégalo aquí.</div>`;return}
    const {add,upd}=pitulinApply(L);if(add.length||upd.length)bulkPut([...add.map(s=>["s",s]),...upd.map(s=>["s",s])]);
    $("#pitMsg").innerHTML=`<div class="msg ok">${L.length} exámenes leídos: ${add.length} sesiones TRE nuevas y ${upd.length} sesiones de SAT marcadas como TRE. ${L.length-add.length-upd.length>0?"El resto ya estaban.":""}</div>`;render()};
  $("#lscGo").onclick=()=>{const L=lscParse($("#lscTxt").value);if(!L.length){$("#lscMsg").innerHTML=`<div class="msg w">Pon una línea por vuelo: fecha y número, por ejemplo 14/10/2026 VY1822.</div>`;return}
    const r=lscApply(L,$("#lscInst").checked);
    $("#lscMsg").innerHTML=`<div class="msg ${r.miss.length?"w":"ok"}">${r.n} vuelos marcados como LSC.${r.miss.length?` No encuentro ${r.miss.length}: ${r.miss.slice(0,8).map(x=>fmtD(x.d)+" VY"+x.flt).join(", ")}${r.miss.length>8?"…":""}.`:""}</div>`;render()};
})();

/* ---------- calendario de actividad ---------- */
function heatCal(el,F,R){
  const W=Math.max(280,el.clientWidth||600),byDay=count(F,f=>f.d,f=>+f.tot||0);
  const end=R[1]<today()?R[1]:today();let maxW=Math.floor((W-34)/(11+2));maxW=Math.max(12,Math.min(53,maxW));
  let start=addDays(end,-(maxW*7-1));if(R[0]>start&&R[0]>"1900")start=R[0];
  const s0=addDays(start,-dowOf(start)),weeks=Math.ceil((Date.parse(end)-Date.parse(s0))/864e5/7+1e-9)||1;
  const cs=Math.max(8,Math.min(16,Math.floor((W-34)/weeks)-2)),g=2,top=16,left=30,H=top+7*(cs+g)+4;
  let s=`<svg viewBox="0 0 ${left+weeks*(cs+g)} ${H}" width="${left+weeks*(cs+g)}" height="${H}" role="img">`;
  ["L","","X","","V","","D"].forEach((t,i)=>{if(t)s+=`<text x="0" y="${top+i*(cs+g)+cs-1}" class="ax">${t}</text>`});
  let lastM="";
  for(let w=0;w<weeks;w++)for(let d=0;d<7;d++){
    const day=addDays(s0,w*7+d);if(day<start||day>end)continue;
    const v=byDay.get(day)||0,lv=v===0?0:v<=180?1:v<=300?2:v<=420?3:4;
    if(d===0||day===start){const m=day.slice(0,7);if(m!==lastM&&(+day.slice(8)<=7||day===start)){lastM=m;s+=`<text x="${left+w*(cs+g)}" y="11" class="ax">${MES[+m.slice(5)-1]}</text>`}}
    s+=`<rect x="${left+w*(cs+g)}" y="${top+d*(cs+g)}" width="${cs}" height="${cs}" rx="2" class="h${lv}" data-tip="<b>${DOW[d]} ${fmtD(day)}</b><br>${v?hm0(v)+" h · "+F.filter(f=>f.d===day).length+" sectores":"Sin vuelo"}"/>`;
  }
  el.innerHTML=s+`</svg><div class="hlegend note">Menos <i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i> Más <span>· 1: hasta 3 h · 2: 3–5 h · 3: 5–7 h · 4: más de 7 h</span></div>`;
}

/* ---------- póster anual ---------- */
let posterYear=null;
async function renderPoster(){
  const cv=$("#poster");if(!cv||view!=="st")return;
  const AF=allF(),ys=[...new Set(AF.map(f=>f.d.slice(0,4)))].sort().reverse();
  if(!ys.length){$("#posterNote").textContent="Cuando tengas vuelos aparecerá aquí tu resumen anual.";return}
  if(!posterYear||!ys.includes(posterYear))posterYear=ys[0];
  $("#posterYear").innerHTML=ys.map(y=>`<option${y===posterYear?" selected":""}>${y}</option>`).join("");
  await Promise.all([loadApts(),loadGeo()]);try{await document.fonts.ready}catch{}
  const F=AF.filter(f=>f.d.startsWith(posterYear)),t=sum(F),W=1080,H=1350,ctx=cv.getContext("2d");
  cv.width=W;cv.height=H;
  const C={bg:tok("--cover"),ink:tok("--cover-ink"),soft:tok("--ink-soft"),sheet:tok("--sheet"),paper:tok("--paper"),s1:tok("--s1"),s2:tok("--s2"),inkD:tok("--ink"),band:tok("--band"),rule:tok("--rule")};
  const fD=tok("--f-display"),fB=tok("--f-body"),fM=tok("--f-mono"),o=owner();
  ctx.fillStyle=C.paper;ctx.fillRect(0,0,W,H);
  // cabecera
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,300);
  ctx.fillStyle=C.ink;ctx.textBaseline="alphabetic";ctx.textAlign="left";
  ctx.font=`600 26px ${fD}`;ctx.globalAlpha=.8;ctx.fillText(("PILOT LOGBOOK"+(o.name?" · "+o.name:"")).toUpperCase(),64,84);ctx.globalAlpha=1;
  ctx.font=`700 180px ${fD}`;ctx.fillText(posterYear,56,250);
  ctx.textAlign="right";ctx.font=`600 64px ${fM}`;ctx.fillText(hm0(t.tot),W-64,190);ctx.font=`600 24px ${fD}`;ctx.globalAlpha=.8;ctx.fillText("HORAS DE VUELO",W-64,236);ctx.globalAlpha=1;
  // mapa
  const data=routeData(F),mx=40,my=330,mw=W-80,mh=500;
  ctx.save();ctx.beginPath();ctx.rect(mx,my,mw,mh);ctx.clip();ctx.translate(mx,my);
  drawMap(ctx,mw,mh,fitProj(data.apts,mw,mh,40),data,{scale:1.6,maxLabels:10,sea:C.sheet,bw:1.2});ctx.restore();
  ctx.strokeStyle=C.rule;ctx.lineWidth=2;ctx.strokeRect(mx,my,mw,mh);
  // cifras
  let nm=0;F.forEach(f=>{const d=fDist(f);if(d)nm+=d});
  const apts=new Set(F.flatMap(f=>[f.dp,f.ap]).filter(Boolean)).size,days=new Set(F.map(f=>f.d)).size;
  const stats=[[F.length,"sectores"],[fmtInt(nm*1.852),"km"],[apts,"aeropuertos"],[days,"días volando"]];
  ctx.textAlign="left";
  stats.forEach(([v,l],i)=>{const x=64+i*(W-128)/4;ctx.fillStyle=C.inkD;ctx.font=`600 46px ${fM}`;ctx.fillText(String(v),x,922);ctx.fillStyle=C.soft;ctx.font=`600 22px ${fD}`;ctx.fillText(l.toUpperCase(),x,956)});
  // meses
  const mm=Array(12).fill(0);F.forEach(f=>mm[+f.d.slice(5,7)-1]+=+f.tot||0);const mmax=Math.max(...mm,1);
  const bx=64,by=1010,bw=440,bh=230;ctx.fillStyle=C.soft;ctx.font=`600 22px ${fD}`;ctx.fillText("HORAS POR MES",bx,by);
  mm.forEach((v,i)=>{const w=bw/12-8,h=(bh-60)*v/mmax,x=bx+i*bw/12,y=by+bh-30;ctx.fillStyle=C.s1;if(h>0){ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y-h,w,h,[4,4,0,0]):ctx.rect(x,y-h,w,h);ctx.fill()}
    ctx.fillStyle=C.soft;ctx.font=`500 17px ${fM}`;ctx.textAlign="center";ctx.fillText(MES[i][0],x+w/2,y+24);ctx.textAlign="left"});
  // destinos
  const base=[...count(F,f=>f.dp).entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
  const dest=[...count(F.filter(f=>f.ap&&f.ap!==base),f=>f.ap).entries()].sort((a,b)=>b[1]-a[1]).slice(0,5),dmax=dest[0]?.[1]||1;
  const dx=576;ctx.fillStyle=C.soft;ctx.font=`600 22px ${fD}`;ctx.fillText("DESTINOS FAVORITOS",dx,by);
  dest.forEach(([k,v],i)=>{const y=by+36+i*40,a=apt(k);ctx.fillStyle=C.inkD;ctx.font=`600 24px ${fM}`;ctx.fillText(k,dx,y+8);ctx.fillStyle=C.soft;ctx.font=`500 17px ${fB}`;ctx.fillText((a?.c||a?.n||"").slice(0,16),dx+80,y+8);
    ctx.fillStyle=C.band;ctx.fillRect(dx+250,y-8,120,14);ctx.fillStyle=C.s1;ctx.fillRect(dx+250,y-8,120*v/dmax,14);ctx.fillStyle=C.inkD;ctx.font=`600 20px ${fM}`;ctx.textAlign="right";ctx.fillText(v+"×",W-64,y+8);ctx.textAlign="left"});
  // pie
  const lg=F.reduce((a,f)=>!a||(+f.tot)>(+a.tot)?f:a,null);
  ctx.fillStyle=C.rule;ctx.fillRect(64,1270,W-128,2);ctx.fillStyle=C.soft;ctx.font=`500 21px ${fB}`;
  ctx.fillText(`Noche ${hm0(t.night)} h · ${t.ldd+t.ldn} aterrizajes${lg?` · Vuelo más largo ${lg.dp}–${lg.ap} ${hm0(lg.tot)}`:""}`,64,1310);
  $("#posterNote").textContent="";
}
$("#posterYear").addEventListener("change",e=>{posterYear=e.target.value;renderPoster()});
$("#posterPng").onclick=()=>{$("#poster").toBlob(b=>{if(b)saveBlob(b,`logbook_${posterYear}.png`)},"image/png")};

/* ---------- libro EASA (impresión) ---------- */
const EASA_ROWS=18;
function easaPages(){
  const ent=[...allF().map(f=>({k:"f",d:f.d,o:(f.dt||"99:99"),r:f})),...bookS().map(s=>({k:"s",d:s.d,o:"99:99z",r:s}))].sort((a,b)=>(a.d+a.o).localeCompare(b.d+b.o));
  const pages=[];for(let i=0;i<ent.length;i+=EASA_ROWS)pages.push(ent.slice(i,i+EASA_ROWS));return pages;
}
function easaReport(R,o={}){
  const pages=easaPages(),zero=()=>({...sum([]),sim:0});let prev=(()=>{const z=zero(),op=opening();for(const k in z)z[k]=op[k]||0;return z})();o.locks=o.locks||{};o.hashes=o.hashes||{};
  const certCell=n=>{const lk=o.locks[n];if(!lk)return `I certify that the entries in this log are true.<br><br>______________________<br>PILOT'S SIGNATURE`;return `I certify that the entries in this log are true.<br>${o.sig?`<img src="${o.sig}" class="sig-img" alt="Firma">`:"<br>"}<br>PILOT'S SIGNATURE · ${fmtD(lk.at)} · ${lk.hash}`};
  const add=(a,b)=>{const o={};for(const k in a)o[k]=a[k]+(b[k]||0);return o};
  const tot=rows=>{const t=sum(rows.filter(e=>e.k==="f").map(e=>e.r));t.sim=rows.filter(e=>e.k==="s").reduce((a,e)=>a+(+e.r.tot||0),0);return t};
  const H=m=>m?String(Math.floor(m/60)):"",M=m=>m?String(Math.round(m)%60).padStart(2,"0"):"";
  const hmc=m=>`<td class="h">${H(m)}</td><td class="m">${M(m)}</td>`,hmt=m=>`<td class="h">${Math.floor(m/60)}</td><td class="m">${String(Math.round(m)%60).padStart(2,"0")}</td>`;
  let out="",shown=0;
  pages.forEach((pg,pi)=>{
    const t=tot(pg),cum=add(prev,t);
    const inR=o.pages?o.pages.has(pi+1):pg.some(e=>e.d>=R[0]&&e.d<=R[1])&&(!o.onlyLocked||o.locks[pi+1]);
    if(inR&&shown<(o.max||120)){shown++;
      const rows=[...pg];while(rows.length<EASA_ROWS)rows.push(null);
      const L=rows.map(e=>{if(!e||e.k!=="f")return `<tr>${"<td></td>".repeat(7)}${"<td class='h'></td><td class='m'></td>".repeat(4)}<td></td><td></td><td></td><td></td><td></td></tr>`;const f=e.r;
        return `<tr class="rec" data-id="${f.id}"><td>${fmtD(f.d)}</td><td>${esc(f.dp)}</td><td>${esc(f.dt)}</td><td>${esc(f.ap)}</td><td>${esc(f.at)}</td><td class="l">${esc(f.typ)}</td><td>${esc(f.reg)}</td>${hmc(f.se)}${hmc(f.me)}${hmc(f.mp)}${hmc(f.tot)}<td class="l">${esc(f.pic)}</td><td>${+f.tod||""}</td><td>${+f.ton||""}</td><td>${+f.ldd||""}</td><td>${+f.ldn||""}</td></tr>`}).join("");
      const Rr=rows.map(e=>{if(!e)return `<tr>${"<td class='h'></td><td class='m'></td>".repeat(6)}<td></td><td></td><td class='h'></td><td class='m'></td><td></td></tr>`;
        if(e.k==="f"){const f=e.r;return `<tr class="rec" data-id="${f.id}">${hmc(f.night)}${hmc(f.ifr)}${hmc(f.fpic)}${hmc(f.fcop)}${hmc(f.fdual)}${hmc(f.finst)}<td></td><td></td><td class='h'></td><td class='m'></td><td class="l rem">${esc(f.rem)}</td></tr>`}
        const s=e.r;return `<tr class="rec" data-sid="${s.id}">${"<td class='h'></td><td class='m'></td>".repeat(6)}<td>${fmtD(s.d)}</td><td class="l">${esc(s.typ)}</td>${hmc(s.tot)}<td class="l rem">${esc([s.role,s.rem].filter(Boolean).join(" · "))}</td></tr>`}).join("");
      const tl=(lab,x)=>`<tr class="tt"><td colspan="7" class="lab">${lab}</td>${hmt(x.se)}${hmt(x.me)}${hmt(x.mp)}${hmt(x.tot)}<td></td><td>${x.tod}</td><td>${x.ton}</td><td>${x.ldd}</td><td>${x.ldn}</td></tr>`;
      const tr=(x)=>`<tr class="tt">${hmt(x.night)}${hmt(x.ifr)}${hmt(x.fpic)}${hmt(x.fcop)}${hmt(x.fdual)}${hmt(x.finst)}<td colspan="2"></td>${hmt(x.sim)}`;
      out+=`<div class="easa-spread"><div class="easa-half"><div class="easa-pn">${pi+1}</div><table class="easa">
        <colgroup><col style="width:7.6%"><col style="width:5.6%"><col style="width:5.2%"><col style="width:5.6%"><col style="width:5.2%"><col style="width:9.4%"><col style="width:7.6%">${"<col style='width:4.4%'><col style='width:2.8%'>".repeat(4)}<col style="width:9.4%"><col style="width:3.4%"><col style="width:3.4%"><col style="width:3.4%"><col style="width:3.4%"></colgroup>
        <thead><tr class="n"><th>1</th><th colspan="2">2</th><th colspan="2">3</th><th colspan="2">4</th><th colspan="4">5</th><th colspan="2" rowspan="2">MULTI-PILOT TIME</th><th colspan="2" rowspan="2">TOTAL TIME OF FLIGHT</th><th rowspan="2">NAME PIC</th><th colspan="4">8</th></tr>
        <tr><th rowspan="2">DATE<br><small>(dd/mm/yy)</small></th><th colspan="2">DEPARTURE</th><th colspan="2">ARRIVAL</th><th colspan="2">AIRCRAFT</th><th colspan="4">SINGLE PILOT TIME</th><th colspan="2">TAKEOFFS</th><th colspan="2">LANDINGS</th></tr>
        <tr class="s"><th>PLACE</th><th>TIME</th><th>PLACE</th><th>TIME</th><th>MAKE, MODEL, VARIANT</th><th>REGISTRATION</th><th colspan="2">SE</th><th colspan="2">ME</th><th class="h"></th><th class="m"></th><th class="h"></th><th class="m"></th><th>7</th><th class="v">DAY</th><th class="v">NIGHT</th><th class="v">DAY</th><th class="v">NIGHT</th></tr></thead>
        <tbody>${L}</tbody><tfoot>${tl("TOTAL THIS PAGE",t)}${tl("TOTAL FROM PREVIOUS PAGES",prev)}${tl("TOTAL TIME",cum)}</tfoot></table></div>
        <div class="easa-half"><div class="easa-pn r">${pi+1}</div><table class="easa">
        <colgroup>${"<col style='width:4.6%'><col style='width:3%'>".repeat(6)}<col style="width:7.6%"><col style="width:10.5%"><col style="width:4.4%"><col style="width:3%"><col></colgroup>
        <thead><tr class="n"><th colspan="4">9</th><th colspan="8">10</th><th colspan="4">11</th><th>12</th></tr>
        <tr><th colspan="4">OPERATIONAL CONDITION TIME</th><th colspan="8">PILOT FUNCTION TIME</th><th colspan="4">SYNTHETIC TRAINING DEVICES SESSION</th><th rowspan="2">REMARKS<br>AND ENDORSEMENTS</th></tr>
        <tr class="s"><th colspan="2">NIGHT</th><th colspan="2">IFR</th><th colspan="2">PILOT-IN-COMMAND</th><th colspan="2">CO-PILOT</th><th colspan="2">DUAL</th><th colspan="2">INSTRUCTOR</th><th>DATE<br><small>(dd/mm/yy)</small></th><th>TYPE</th><th colspan="2">TOTAL TIME OF SESSION</th></tr></thead>
        <tbody>${Rr}</tbody><tfoot>${tr(t)}<td rowspan="3" class="cert">${certCell(pi+1)}</td></tr>${tr(prev)}</tr>${tr(cum)}</tr></tfoot></table></div></div>${lockBar(pi+1,pg,o)}`;
    }
    prev=cum;
  });
  if(!out)out=`<p class="note">No hay páginas con entradas en este periodo.</p>`;
  else if(shown>=(o.max||120))out+=`<p class="note">Se muestran 120 páginas como máximo; acota el periodo para ver el resto.</p>`;
  return `<p class="note rp-hide">Formato del libro EASA (FCL.050): 18 líneas por página; los totales de “páginas anteriores” arrastran todo el libro. Al imprimir, cada mitad sale en un A4 apaisado.</p>`+out;
}

/* ---------- apariencia (temas) ---------- */
const SKINS={libro:{name:"Libro",desc:"Tapas azul marino y hoja pautada, como el libro de papel.",fonts:"Barlow+Condensed:wght@500;600;700&family=Source+Sans+3:wght@400;600;700&family=JetBrains+Mono:wght@400;600"},
  cabina:{name:"Cabina",desc:"Pantallas de cabina: fondo negro, valores en verde, tipografía B612 de Airbus.",fonts:"B612:wght@400;700&family=B612+Mono:wght@400;700"},
  carta:{name:"Carta",desc:"Carta aeronáutica: papel blanco, tinta azul y magenta, IBM Plex.",fonts:"IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600"}};
const fontsLoaded=new Set(["libro"]);
function loadSkinFonts(k){if(fontsLoaded.has(k)||!SKINS[k])return;fontsLoaded.add(k);const l=document.createElement("link");l.rel="stylesheet";l.href=`https://fonts.googleapis.com/css2?family=${SKINS[k].fonts}&display=swap`;document.head.appendChild(l)}
function applySkin(k,mode){
  const r=document.documentElement;k=SKINS[k]?k:"libro";r.dataset.skin=k;loadSkinFonts(k);
  if(mode==="light"||mode==="dark")r.dataset.theme=mode;else delete r.dataset.theme;
  const mc=document.querySelector('meta[name="theme-color"]');if(mc)setTimeout(()=>mc.setAttribute("content",tok("--cover")||"#1F3B5C"),50);
  setTimeout(()=>{MAP.key="";renderStats()},350);
}
function renderLook(){
  const cur=ls.get("lb_skin","libro"),mode=ls.get("lb_mode","auto");
  Object.keys(SKINS).forEach(loadSkinFonts);
  $("#skinPick").innerHTML=Object.entries(SKINS).map(([k,s])=>`<button class="skin${k===cur?" on":""}" data-skin-pick="${k}" aria-pressed="${k===cur}"><span class="sk-prev" data-skin="${k}"><span class="sk-top">PILOT LOGBOOK</span><span class="sk-body"><span class="sk-k">TOTAL VUELO</span><span class="sk-v">906:49</span><span class="sk-bars"><i style="height:40%"></i><i style="height:70%"></i><i style="height:55%"></i><i style="height:90%"></i><i style="height:65%"></i></span></span></span><b>${s.name}</b><span class="note">${s.desc}</span></button>`).join("");
  $$("#modePick button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.mode===mode));
  $("#modeNote").hidden=cur!=="cabina";
}
$("#skinPick").addEventListener("click",e=>{const b=e.target.closest("[data-skin-pick]");if(!b)return;ls.set("lb_skin",b.dataset.skinPick);applySkin(b.dataset.skinPick,ls.get("lb_mode","auto"));renderLook()});
$("#modePick").addEventListener("click",e=>{const b=e.target.closest("[data-mode]");if(!b)return;ls.set("lb_mode",b.dataset.mode);applySkin(ls.get("lb_skin","libro"),b.dataset.mode);renderLook()});
try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{MAP.key="";renderStats()})}catch{}
// vista de vuelos
function applyFlMode(){document.body.dataset.flmode="table"}

/* ---------- foto del ACARS ---------- */
const ACARS_PROMPT=`La imagen es una foto de la pantalla o impresión ACARS de un avión comercial (MCDU/ATSU de Airbus, impresora de cabina o EFB) con los tiempos OOOI de un vuelo. Puede estar inclinada, con reflejos o con texto verde/cian sobre negro.
Devuelve SOLO un objeto JSON con esta forma exacta:
{"flight":"VY1234","date":"YYYY-MM-DD","day":17,"from":"LEBL","to":"LEMD","out":"HH:MM","off":"HH:MM","on":"HH:MM","in":"HH:MM","reg":"EC-ABC","fuel_out":null,"fuel_in":null,"confidence":"alta","notes":""}
Reglas:
- OUT = calzos fuera (off blocks), OFF = despegue, ON = aterrizaje, IN = calzos (on blocks). Horas UTC tal como aparecen; 4 cifras HHMM se convierten a HH:MM.
- Aeropuertos en OACI de 4 letras si aparecen; si solo hay IATA de 3 letras, devuélvelo tal cual.
- "date" solo si la fecha completa es visible; si solo se ve el día del mes, ponlo en "day" y "date": null.
- Cualquier dato que no se lea con claridad = null. No inventes ni deduzcas horas que no se vean.
- "confidence": "alta", "media" o "baja" según lo legible que sea la foto. "notes": una frase breve si hay algo dudoso, en español.`;
async function shrinkImage(file,max=1600){
  try{
    const bmp=await createImageBitmap(file);const s=Math.min(1,max/Math.max(bmp.width,bmp.height));
    const c=document.createElement("canvas");c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);
    c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(b=>r(b||file),"image/jpeg",0.85));
  }catch{return file}
}
const blobB64=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=rej;r.readAsDataURL(b)});
async function visionJSON(prompt,blob){
  if(typeof window.LB_VISION==="function")return window.LB_VISION(prompt,blob);
  if(!aiKey())throw Object.assign(new Error("Para leer fotos necesitas tu clave de Claude en Ajustes."),{code:"nokey"});
  if(!navigator.onLine)throw new Error("Necesitas conexión para leer la foto.");
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":aiKey(),"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model:"claude-sonnet-5-5",max_tokens:1200,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:blob.type||"image/jpeg",data:await blobB64(blob)}},{type:"text",text:prompt}]}]})});
  if(!r.ok)throw new Error(r.status===401?"La clave de Claude no es válida (Ajustes).":r.status===429?"Demasiadas peticiones; prueba en un minuto.":"Error "+r.status+" al leer la foto.");
  const j=await r.json(),text=(j.content||[]).map(c=>c.text||"").join(""),a=text.indexOf("{"),b=text.lastIndexOf("}");
  if(a<0||b<a)throw new Error("No he podido interpretar la respuesta.");
  return JSON.parse(text.slice(a,b+1));
}
function acarsDate(o){
  const d=toDate(o.date);if(d)return d;
  const day=parseInt(o.day);if(!day||day<1||day>31)return $("#fd").value||today();
  const t=new Date();let y=t.getUTCFullYear(),m=t.getUTCMonth()+1;
  if(day>t.getUTCDate()){m--;if(!m){m=12;y--}}
  return y+"-"+String(m).padStart(2,"0")+"-"+String(day).padStart(2,"0");
}
async function readAcars(file){
  if(!file)return;
  const box=$("#acarsBox");box.hidden=false;
  const url=URL.createObjectURL(file);
  box.innerHTML=`<img src="${url}" alt="Foto del ACARS"><div class="ac-txt"><b>Leyendo el ACARS…</b><span class="note">Suele tardar unos segundos.</span></div>`;
  loadApts();
  try{
    const o=await visionJSON(ACARS_PROMPT,await shrinkImage(file));
    const out=clock(o.out),off=clock(o.off),on=clock(o.on),inn=clock(o.in);
    const dep=apt(o.from)?.i||String(o.from||"").toUpperCase(),arr=apt(o.to)?.i||String(o.to||"").toUpperCase();
    if(!out&&!inn&&!off&&!on)throw new Error("No veo tiempos OOOI en la foto. Prueba con otra más cercana y sin reflejos.");
    $("#fd").value=acarsDate(o);
    if(dep)$("#fdp").value=dep;if(arr)$("#fap").value=arr;
    $("#fdt").value=out||off;$("#fat").value=inn||on;
    if(o.reg&&/^[A-Z0-9]{1,2}-?[A-Z0-9]{2,5}$/i.test(o.reg))$("#freg").value=String(o.reg).toUpperCase();
    if(o.flight&&!$("#frem").value)$("#frem").value=String(o.flight).toUpperCase().replace(/\s+/g,"");
    $("#ftot").dataset.auto="1";$("#ftot").value="";
    calcHint();nightHint();
    const air=off&&on?block(off,on):0,blk=block(out||off,inn||on);
    const warn=[];if(!out||!inn)warn.push("faltan OUT o IN: he usado OFF/ON y el tiempo es de vuelo, no de calzos");if(!dep||!arr)warn.push("revisa los aeropuertos");if(o.confidence==="baja")warn.push("la foto se lee mal");if(o.notes)warn.push(o.notes);
    box.innerHTML=`<img src="${url}" alt="Foto del ACARS"><div class="ac-txt"><b>${esc(o.flight||"Vuelo")} · ${esc(dep||"····")} → ${esc(arr||"····")}</b>
      <span class="ac-oooi mono"><span>OUT <b>${out||"--:--"}</b></span><span>OFF <b>${off||"--:--"}</b></span><span>ON <b>${on||"--:--"}</b></span><span>IN <b>${inn||"--:--"}</b></span></span>
      <span class="note">Block ${hm0(blk)}${air?` · en vuelo ${hm0(air)}`:""}${o.fuel_out&&o.fuel_in?` · fuel ${esc(o.fuel_out)} → ${esc(o.fuel_in)}`:""}. Revisa los datos y pulsa Guardar.</span>
      ${warn.length?`<span class="ac-warn">${esc(warn.join(" · "))}</span>`:""}</div>`;
  }catch(e){
    box.innerHTML=`<img src="${url}" alt="Foto del ACARS"><div class="ac-txt"><b>No he podido leer la foto</b><span class="ac-warn">${esc(e.message||"Error desconocido")}</span>${e.code==="nokey"?`<button type="button" class="btn sm" data-go="set" onclick="this.closest('.scrim').hidden=true">Ir a Ajustes</button>`:""}</div>`;
  }
}
$("#acarsFile").addEventListener("change",e=>{const f=e.target.files[0];e.target.value="";readAcars(f)});
$("#acarsQuick").addEventListener("change",e=>{const f=e.target.files[0];e.target.value="";if(!f)return;openFl();readAcars(f)});

/* ---------- portada ---------- */
const MILES=[100,250,500,1000,1500,2000,2500,3000,4000,5000,7500,10000,15000,20000,25000,30000];
const fmtMonth=d=>new Date(d+"T00:00:00").toLocaleDateString("es-ES",{month:"short",year:"numeric"});
let cvRange=ls.get("lb_cvrange","");if(!/^(y:\d{4}|all|month|next)$/.test(cvRange))cvRange="y:"+today().slice(0,4);
function renderCover(){
  if(view!=="sum")return;
  const F=allF(),S=bookS(),OP=opening(),t=withOpen(sum(F)),o=owner(),sTot=S.reduce((a,s)=>a+(+s.tot||0),0)+OP.sim,td=today();
  $("#cvName").textContent=o.name||"Tu nombre";
  const first=OP.on&&OP.date?OP.date:F[0]?.d;
  const sub=[o.title,o.lic?`Licencia ${o.lic}`:"",first?`Libro abierto en ${first.slice(0,4)}`:"",OP.on?`incluye ${hm0(OP.tot)} h anteriores`:""].filter(Boolean).join(" · ");
  $("#cvSub").textContent=sub||"Pon tu nombre, licencia y cargo en Ajustes → Titular del libro";
  $("#cvH").textContent=Math.floor(t.tot/60).toLocaleString("es-ES");$("#cvM").textContent=String(Math.round(t.tot)%60).padStart(2,"0");
  const AS=allS(),simH=fn=>AS.filter(fn).reduce((a,s)=>a+(+s.tot||0),0),abT=sum(F.filter(isAirbus)).tot;
  const L=[["PIC",hm0(t.fpic)],["Copiloto",hm0(t.fcop)],["Airbus",hm0(abT)],["TRI",hm0(simH(s=>ROLE_INS.includes(s.role)))],["TRE",hm0(simH(s=>ROLE_EXA.includes(s.role)))]];
  const rc=recency(F,S),rcH=rc?`<div class="lgr rec ${rc.c}"><span class="lgr-k">Experiencia reciente</span><span class="lgr-v">${rc.left<0?"Caducada":"hasta "+fmtD(rc.exp)}</span><small>${rc.left<0?`desde ${fmtD(rc.exp)}`:`${rc.left} días`} · ${rc.n90.to} T/O y ${rc.n90.ld} LDG en 90 días</small></div>`:`<div class="lgr rec b"><span class="lgr-k">Experiencia reciente</span><span class="lgr-v">Sin datos</span></div>`;
  $("#cvLedger").innerHTML=L.map(([k,v])=>`<div class="lgr"><span class="lgr-k">${k}</span><span class="lgr-v">${v}</span></div>`).join("")+rcH;
  // mapa de la portada: 12 meses, toda la vida, este mes, próximo mes
  const cv=$("#cvMap"),box=cv.parentElement,W=box.clientWidth,H=box.clientHeight;
  {const m0=td.slice(0,7),nx=addDays(m0+"-28",7).slice(0,7),ys=[...new Set([...F.map(f=>f.d.slice(0,4)),td.slice(0,4)])].sort().reverse(),cy=cvRange.startsWith("y:")?cvRange.slice(2):"";
   $("#cvYear").innerHTML=(cy?"":`<option value="" selected>Año</option>`)+ys.map(y=>`<option value="${y}"${y===cy?" selected":""}>${y}</option>`).join("");
   $("#cvYear").classList.toggle("on",!!cy);
   $("#cvMonth").textContent=MES[+m0.slice(5)-1]+" "+m0.slice(2,4);$("#cvNext").textContent=MES[+nx.slice(5)-1]+" "+nx.slice(2,4);
   $$("#cvRange button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.cr===cvRange));}
  if(W&&H){
    if(!APT||!GEO){Promise.all([loadApts(),loadGeo()]).then(()=>renderCover())}
    else{
      const m0=td.slice(0,7),nx=addDays(m0+"-28",7).slice(0,7),flown=new Set(F.map(f=>f.d+"|"+f.dp+"|"+f.ap));
      const plan=live("p").filter(p=>!p.sim&&p.dp&&p.ap&&!flown.has(p.d+"|"+p.dp+"|"+p.ap)).map(p=>({d:p.d,dp:p.dp,ap:p.ap,_plan:true}));
      let R,label;
      if(cvRange.startsWith("y:")){const y=cvRange.slice(2);R=[...F.filter(f=>f.d.startsWith(y)),...plan.filter(p=>p.d.startsWith(y)&&p.d>=td)];label=y}
      else if(cvRange==="all"){R=F;label="todo el libro"}
      else if(cvRange==="month"){R=[...F.filter(f=>f.d.startsWith(m0)),...plan.filter(p=>p.d.startsWith(m0)&&p.d>=td)];label=MES[+m0.slice(5)-1]+" "+m0.slice(0,4)}
      else if(cvRange==="next"){R=plan.filter(p=>p.d.startsWith(nx));label=MES[+nx.slice(5)-1]+" "+nx.slice(0,4)+" · programado"}
      else{R=F;label="todo el libro"}
      const data=routeData(R),dpr=window.devicePixelRatio||1,nPlan=data.routes.filter(r=>r.plan).length;
      cv.width=W*dpr;cv.height=H*dpr;const ctx=cv.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
      const pad=Math.max(48,Math.round(H*0.16)),P=data.apts.length?fitProj(data.apts,W,H,pad):fitProj(routeData(F.slice(-300)).apts,W,H,pad);
      drawMap(ctx,W,H,P,data,{sea:tok("--cover"),land:tok("--cover-land"),border:tok("--cover-border"),route:tok("--gold"),base:tok("--cover-ink"),ink:tok("--cover-ink"),maxLabels:cvRange==="all"?10:8,bw:0.7});
      const sec=R.length,hrs=R.reduce((x,f)=>x+(+f.tot||0),0);
      $("#cvMapK").textContent=R.length?`${label} · ${data.routes.length} rutas · ${sec} sectores${hrs?" · "+hm0(hrs)+" h":""}${nPlan?" · discontinuas: programadas":""}`:(cvRange==="next"?`${label} · sin vuelos programados (importa el roster)`:`${label} · sin vuelos`);
    }
  }
  // este mes
  const m=td.slice(0,7),pm=addDays(m+"-01",-1).slice(0,7);
  const tm=F.filter(f=>f.d.startsWith(m)),tpm=F.filter(f=>f.d.startsWith(pm)),tmT=sum(tm).tot,tpmT=sum(tpm).tot;
  const days=new Set(tm.map(f=>f.d)).size,diff=tmT-tpmT;
  $("#thisMonth").innerHTML=`<div class="tm-big"><span class="mono">${hm0(tmT)}</span><span class="note">${MES[+m.slice(5)-1]} ${m.slice(0,4)} · ${tm.length} sectores · ${days} días</span></div>
    <div class="note">Mes anterior ${hm0(tpmT)} <span class="chip ${diff>=0?"ok":"w"}">${diff>=0?"+":"−"}${hm0(Math.abs(diff))}</span></div>`;
  const keys=[];{let [y,mo]=m.split("-").map(Number);for(let i=11;i>=0;i--){let mm=mo-i,yy=y;while(mm<1){mm+=12;yy--}keys.push(yy+"-"+String(mm).padStart(2,"0"))}}
  const byM=count(F,f=>f.d.slice(0,7),f=>+f.tot||0);
  sparkBars($("#tmSpark"),keys.map(k=>({v:byM.get(k)||0,tip:`<b>${MES[+k.slice(5)-1]} ${k.slice(0,4)}</b><br>${hm0(byM.get(k)||0)} h`})));
  renderMiles(F,t);
}
function sparkBars(el,items){
  const W=Math.max(120,el.clientWidth||240),H=56,n=items.length,cw=W/n,bw=Math.max(3,cw-4),max=Math.max(1,...items.map(i=>i.v));
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${items.map((it,i)=>{const h=Math.max(2,(H-4)*it.v/max),x=i*cw+(cw-bw)/2;return `<rect x="${x}" y="${H-h}" width="${bw}" height="${h}" rx="2" class="${i===n-1?"sb now":"sb"}" data-tip="${esc(it.tip)}"/>`}).join("")}</svg>`;
}
function renderMiles(F,t){
  const td=today(),r12=sum(F.filter(f=>f.d>=addDays(td,-364)));
  const rows=[["Tiempo total","tot"],["PIC","fpic"]];
  const goal=ls.get("lb_goal",null);
  const COLN={tot:"Total",fpic:"PIC",finst:"Instructor",night:"Noche",fcop:"Copiloto"};
  let h="";
  rows.forEach(([lab,col])=>{
    const v=t[col]||0,next=MILES.find(x=>x*60>v),prev=MILES.filter(x=>x*60<=v).pop()||0;if(!next)return;
    const rate=(r12[col]||0)/12,pct=Math.min(100,(v-prev*60)/((next-prev)*60)*100);
    const eta=rate>1?fmtMonth(addDays(td,Math.round((next*60-v)/rate*30.44))):null;
    h+=`<div class="mile"><div class="lab"><span>${lab} · próximo hito <b>${fmtInt(next)} h</b></span><span class="mono">${hm0(v)}</span></div><div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div><div class="note">Faltan ${hm0(next*60-v)} h${eta?` · al ritmo actual (${hm0(rate)} h/mes) llegarías hacia <b>${eta}</b>`:" · sin vuelos en los últimos 12 meses"}</div></div>`;
  });
  if(goal&&+goal.hours){
    const col=goal.col||"tot",v=t[col]||0,target=+goal.hours*60,rate=(r12[col]||0)/12,pct=Math.min(100,v/target*100),left=target-v;
    let line=left<=0?`<span class="chip ok">Conseguido</span>`:`Faltan ${hm0(left)} h`;
    if(left>0&&goal.date){const months=Math.max(0.1,(Date.parse(goal.date)-Date.parse(td))/864e5/30.44),need=left/months;line+=` · para el ${fmtD(goal.date)} necesitas <b>${hm0(need)} h/mes</b> <span class="chip ${rate>=need?"ok":"w"}">ahora ${hm0(rate)}</span>`}
    else if(left>0&&rate>1)line+=` · al ritmo actual hacia <b>${fmtMonth(addDays(td,Math.round(left/rate*30.44)))}</b>`;
    h+=`<div class="mile goal"><div class="lab"><span>Objetivo · ${esc(goal.label||COLN[col]+" "+goal.hours+" h")}</span><span class="mono">${hm0(v)} / ${goal.hours}:00</span></div><div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div><div class="note">${line}</div></div>`;
  }
  $("#miles").innerHTML=h||`<p class="note">Cuando tengas vuelos verás aquí el siguiente hito y la fecha estimada.</p>`;
}
// objetivo personal (ajustes)
function renderGoal(){const g=ls.get("lb_goal",null)||{};$("#gCol").value=g.col||"tot";$("#gHours").value=g.hours||"";$("#gDate").value=g.date||"";$("#gLabel").value=g.label||""}
$("#gSave").onclick=()=>{const hours=parseInt($("#gHours").value);if(!hours){toast("Pon las horas del objetivo.");return}ls.set("lb_goal",{col:$("#gCol").value,hours,date:$("#gDate").value,label:$("#gLabel").value.trim()});toast("Objetivo guardado");renderCover()};
$("#gDel").onclick=()=>{ls.set("lb_goal",null);renderGoal();renderCover();toast("Objetivo quitado")};

/* ---------- vuelo en directo (OOOI) ---------- */
let LV=ls.get("lb_live",null),liveToClear=false;
const OOOI=[["out","OUT","calzos fuera"],["off","OFF","despegue"],["on","ON","aterrizaje"],["in","IN","calzos puestos"]];
const utcNow=()=>{const d=new Date();return String(d.getUTCHours()).padStart(2,"0")+":"+String(d.getUTCMinutes()).padStart(2,"0")};
function saveLive(){ls.set("lb_live",LV);renderLiveBar()}
function openLive(){
  if(!LV){const p=prefs(),last=allF().slice(-1)[0],td=today(),flown=new Set(allF().filter(f=>f.d===td).map(f=>f.dp+f.ap)),nx=live("p").filter(q=>!q.sim&&q.d===td&&!flown.has(q.dp+q.ap)).sort((x,y)=>(x.std||"").localeCompare(y.std||""))[0];
    LV=nx?{d:"",dp:nx.dp,ap:nx.ap,flt:nx.flt,typ:p.typ||"",reg:nx.reg||last?.reg||"",plan:nx.id}:{d:"",dp:last?.ap||"",ap:"",flt:"",typ:p.typ||last?.typ||"",reg:last?.reg||""}}
  ["dp","ap","flt","typ","reg"].forEach(k=>$("#lv"+k[0].toUpperCase()+k.slice(1)).value=LV[k]||"");
  drawOOOI();$("#liveDlg").hidden=false;
}
function drawOOOI(){
  $("#oooi").innerHTML=OOOI.map(([k,l,s])=>LV[k]?`<div class="oo on"><span class="oo-l">${l}</span><input class="t oo-t" value="${LV[k]}" data-k="${k}" aria-label="${l}"><span class="oo-s">${s}</span><button type="button" class="oo-x" data-clear="${k}" aria-label="Borrar ${l}">✕</button></div>`
    :`<button type="button" class="oo" data-stamp="${k}"><span class="oo-l">${l}</span><span class="oo-t">Marcar</span><span class="oo-s">${s}</span></button>`).join("");
  const next=OOOI.find(([k])=>!LV[k]);$$("#oooi [data-stamp]").forEach(b=>b.classList.toggle("next",next&&b.dataset.stamp===next[0]));
  liveInfo();
}
function liveInfo(){
  $("#liveUtc").textContent=utcNow()+" UTC";
  if(!LV){return}
  const blk=LV.out?block(LV.out,LV.in||utcNow()):0,air=LV.off?block(LV.off,LV.on||utcNow()):0;
  const parts=[];if(LV.d)parts.push(fmtD(LV.d));if(LV.out)parts.push(`Block ${hm0(blk)}${LV.in?"":" y contando"}`);if(LV.off)parts.push(`En el aire ${hm0(air)}${LV.on?"":" y contando"}`);
  $("#liveInfo").textContent=(parts.join(" · ")||"Pulsa OUT al soltar calzos: la hora se marca en UTC y puedes corregirla.")+liveFdp();
  $("#lvSave").disabled=!((LV.out||LV.off)&&(LV.in||LV.on));
}
function renderLiveBar(){
  const bar=$("#liveBar");if(!LV||!(LV.out||LV.off)){bar.hidden=true;return}
  bar.hidden=false;const blk=block(LV.out||LV.off,LV.in||utcNow());
  bar.innerHTML=`<span class="dot"></span><b>${esc(LV.dp||"····")} → ${esc(LV.ap||"····")}</b><span class="mono">${OOOI.filter(([k])=>LV[k]).map(([k,l])=>l+" "+LV[k]).join(" · ")}</span><span class="spacer"></span><span class="mono">${hm0(blk)}</span><span class="note">${LV.in?"listo para guardar":"en curso"}</span>`;
}
$("#oooi").addEventListener("click",e=>{
  const s=e.target.closest("[data-stamp]"),x=e.target.closest("[data-clear]");
  if(s){const k=s.dataset.stamp;if(!LV.d)LV.d=today();LV[k]=utcNow();["dp","ap","flt","typ","reg"].forEach(f=>LV[f]=$("#lv"+f[0].toUpperCase()+f.slice(1)).value.trim().toUpperCase());if(navigator.vibrate)navigator.vibrate(30);saveLive();drawOOOI()}
  if(x){LV[x.dataset.clear]="";saveLive();drawOOOI()}
});
$("#oooi").addEventListener("change",e=>{const i=e.target.closest(".oo-t[data-k]");if(!i)return;const c=clock(i.value);if(c){LV[i.dataset.k]=c;i.value=c}else i.value=LV[i.dataset.k];saveLive();liveInfo()});
["lvDp","lvAp","lvFlt","lvTyp","lvReg"].forEach(id=>$("#"+id).addEventListener("input",e=>{if(!LV)return;LV[id.slice(2).toLowerCase()]=e.target.value.trim().toUpperCase();saveLive()}));
$("#lvUndo").onclick=()=>{const last=[...OOOI].reverse().find(([k])=>LV[k]);if(last){LV[last[0]]="";saveLive();drawOOOI()}};
$("#lvDiscard").onclick=()=>{$("#lvConfirm").hidden=false};
$("#lvNo").onclick=()=>$("#lvConfirm").hidden=true;
$("#lvYes").onclick=()=>{clearLive();$("#lvConfirm").hidden=true;$("#liveDlg").hidden=true};
function clearLive(){LV=null;ls.set("lb_live",null);renderLiveBar()}
$("#lvSave").onclick=()=>{
  const dt=LV.out||LV.off,at=LV.in||LV.on;
  $("#liveDlg").hidden=true;liveToClear=true;if(LV.plan)confirmPlanned=LV.plan;
  openFl(null,{d:LV.d||today(),dp:LV.dp,ap:LV.ap,dt,at,reg:LV.reg,typ:LV.typ,rem:LV.flt});
  if(!LV.out||!LV.in)$("#fnInfo").textContent="Faltan OUT o IN: el total es tiempo en el aire, no de calzos. Corrígelo si lo sabes.";
};
$("#liveBar").onclick=openLive;
$("#liveBtn").onclick=openLive;$("#cvLive").onclick=openLive;
setInterval(()=>{if(LV){renderLiveBar();if(!$("#liveDlg").hidden)liveInfo()}},15000);
renderLiveBar();

/* ---------- vuelta rápida ---------- */
let retT=null;
function showRetBar(f){
  if(!f.dp||!f.ap||f.dp===f.ap)return;
  const bar=$("#retBar");bar.hidden=false;
  bar.innerHTML=`<span>Guardado <b class="mono">${esc(f.dp)} → ${esc(f.ap)}</b>${f.at?` (IN ${f.at})`:""}.</span><button class="btn pri sm" id="retGo">+ Añadir la vuelta ${esc(f.ap)} → ${esc(f.dp)}</button><button class="btn sm" id="retX" aria-label="Cerrar">✕</button>`;
  $("#retGo").onclick=()=>{bar.hidden=true;openFl(null,{d:f.d,dp:f.ap,ap:f.dp,dt:"",at:"",reg:f.reg,typ:f.typ,pic:f.pic,role:f.fpic?"pic":f.fcop?"cop":f.finst?"inst":f.fdual?"dual":"",rem:""})};
  $("#retX").onclick=()=>bar.hidden=true;
  clearTimeout(retT);retT=setTimeout(()=>bar.hidden=true,90000);
  if(view!=="fl")go("fl");
}

/* ---------- filtros ---------- */
function flFilters(){return {role:$("#fRole").value,typ:$("#fTyp").value,reg:$("#fReg").value,night:$("#fNight").checked,ldg:$("#fLdg").checked}}
function filterCount(){const f=flFilters();return [f.role,f.typ,f.reg].filter(Boolean).length+(f.night?1:0)+(f.ldg?1:0)}
$("#flFiltBtn").onclick=()=>{$("#flFilters").hidden=!$("#flFilters").hidden};
["#fRole","#fTyp","#fReg"].forEach(s=>$(s).addEventListener("change",()=>{page=null;renderLog()}));
["#fNight","#fLdg"].forEach(s=>$(s).addEventListener("change",()=>{page=null;renderLog()}));
$("#fClear").onclick=()=>{$("#fRole").value="";$("#fTyp").value="";$("#fReg").value="";$("#fNight").checked=false;$("#fLdg").checked=false;$("#q").value="";$("#yr").value="";page=null;renderLog()};
function fillFilterLists(F){
  const keep=(sel,vals,lab)=>{const cur=sel.value;sel.innerHTML=`<option value="">${lab}</option>`+vals.map(v=>`<option${v===cur?" selected":""}>${esc(v)}</option>`).join("")};
  keep($("#fTyp"),[...new Set(F.map(f=>f.typ).filter(Boolean))].sort(),"Tipo: todos");
  keep($("#fReg"),[...new Set(F.map(f=>f.reg).filter(Boolean))].sort(),"Matrícula: todas");
  const n=filterCount();$("#flFiltBtn").textContent=n?`Filtros · ${n}`:"Filtros";
}

/* ---------- comparativa anual ---------- */
function multiLine(el,series,labels,{height=220}={}){
  const W=Math.max(280,el.clientWidth||600),H=height,padL=40,padB=24,padT=12,padR=12;
  const vals=series.flatMap(s=>s.v.filter(v=>v!=null));if(!vals.length){el.innerHTML=`<p class="note">Sin datos.</p>`;return}
  const max=niceMax(Math.max(1,...vals)/60),n=labels.length,x=i=>padL+(W-padL-padR)*i/(n-1),y=v=>padT+(H-padT-padB)*(1-v/60/max);
  let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`;
  for(let k=0;k<=4;k++){const yy=padT+(H-padT-padB)*(1-k/4);s+=`<line x1="${padL}" x2="${W-padR}" y1="${yy}" y2="${yy}" class="grid"/><text x="${padL-6}" y="${yy+4}" class="ax" text-anchor="end">${Math.round(max*k/4)}</text>`}
  labels.forEach((l,i)=>s+=`<text x="${x(i)}" y="${H-7}" class="ax" text-anchor="middle">${l}</text>`);
  series.forEach(se=>{let d="",pen=false;se.v.forEach((v,i)=>{if(v==null){pen=false;return}d+=(pen?"L":"M")+x(i).toFixed(1)+","+y(v).toFixed(1);pen=true});
    s+=`<path d="${d}" class="ml ${se.cls}${se.em?" em":""}"/>`;const li=se.v.map((v,i)=>v!=null?i:-1).filter(i=>i>=0).pop();if(li!=null&&li>=0)s+=`<circle cx="${x(li)}" cy="${y(se.v[li])}" r="${se.em?4.5:3}" class="mdot ${se.cls}"/>`});
  labels.forEach((l,i)=>{const tip=`<b>${l}</b><br>`+series.map(se=>`${se.label}: ${se.v[i]!=null?hm0(se.v[i])+" h":"—"}`).join("<br>");s+=`<rect x="${x(i)-(W-padL-padR)/(2*(n-1))}" y="${padT}" width="${(W-padL-padR)/(n-1)}" height="${H-padT-padB}" fill="transparent" data-tip="${esc(tip)}"/>`});
  el.innerHTML=s+`<line x1="${padL}" x2="${W-padR}" y1="${H-padB}" y2="${H-padB}" class="base"/></svg>`;
}
function renderYears(){
  const AF=allF(),ys=[...new Set(AF.map(f=>f.d.slice(0,4)))].sort().slice(-5),cy=today().slice(0,4),cm=+today().slice(5,7);
  const byM=count(AF,f=>f.d.slice(0,7),f=>+f.tot||0);
  const series=ys.map((y,i)=>({label:y,cls:"c"+Math.min(5,ys.length-i),em:y===cy,v:MES.map((_,mi)=>{const k=y+"-"+String(mi+1).padStart(2,"0");if((y===cy&&mi+1>cm)||k<(AF[0]?.d||"").slice(0,7))return null;return byM.get(k)||0})}));
  // la serie más reciente lleva el color 1
  multiLine($("#stYears"),series,MES);
  $("#stYearsLg").innerHTML=series.map(se=>{const tot=se.v.reduce((a,v)=>a+(v||0),0);return `<span><i class="${se.cls}"></i>${se.label} <b class="mono">${hm0(tot)}</b></span>`}).join("");
}

/* ---------- pasaporte de aeropuertos y comandantes ---------- */
function renderPassport(F){
  const AP=new Map();F.forEach(f=>{[f.dp,f.ap].forEach(c=>{if(!c)return;const p=AP.get(c)||{n:0,first:f.d,last:f.d};p.n++;if(f.d<p.first)p.first=f.d;if(f.d>p.last)p.last=f.d;AP.set(c,p)})});
  const rows=[...AP.entries()].sort((a,b)=>b[1].n-a[1].n),cc=new Set(rows.map(([c])=>apt(c)?.cc).filter(Boolean));
  $("#stPassK").textContent=`${rows.length} aeropuertos · ${cc.size} países`;
  $("#stPass").innerHTML=rows.length?`<table class="rp-t rp-list"><thead><tr><th>Aeropuerto</th><th>Ciudad</th><th>País</th><th>Visitas</th><th>Primera</th><th>Última</th></tr></thead><tbody>${rows.map(([c,p])=>{const a=apt(c);return `<tr><td><b>${esc(c)}</b>${a?.iata?` <span class="note">${a.iata}</span>`:""}</td><td class="l">${esc(a?.c||a?.n||"")}</td><td class="l">${a?regionName(a.cc):""}</td><td>${p.n}</td><td>${fmtD(p.first)}</td><td>${fmtD(p.last)}</td></tr>`}).join("")}</tbody></table>`:`<p class="note">Sin datos.</p>`;
  const who=f=>{const n=[];if(f.pic&&!/^(self|yo|propio)$/i.test(f.pic.trim()))n.push(f.pic.trim().toUpperCase());if(f.crew)n.push(f.crew.trim().toUpperCase());return n};
  const pc=new Map(),pn=new Map();F.forEach(f=>who(f).forEach(k=>{pc.set(k,(pc.get(k)||0)+(+f.tot||0));pn.set(k,(pn.get(k)||0)+1)}));
  rankList($("#stPics"),[...pc.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>({label:k,v,sub:`${pn.get(k)} sectores`})),{fmt:hm0});
  if(!pc.size)$("#stPics").innerHTML=`<p class="note">Aparecen aquí los comandantes (columna 7, cuando no eres tú el PIC) y la tripulación que anotes en cada vuelo.</p>`;
}

/* ---------- tarjeta de vuelo ---------- */
async function flightCard(f){
  await Promise.all([loadApts(),loadGeo()]);try{await document.fonts.ready}catch{}
  const W=1080,H=1080,cv=document.createElement("canvas");cv.width=W;cv.height=H;const ctx=cv.getContext("2d");
  const bg=tok("--cover"),ink=tok("--cover-ink"),gold=tok("--gold"),fD=tok("--f-display"),fB=tok("--f-body"),fM=tok("--f-mono"),o=owner();
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.fillStyle=gold;ctx.font=`600 24px ${fD}`;ctx.textBaseline="alphabetic";ctx.textAlign="left";
  ctx.fillText(new Date(f.d+"T00:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase(),60,80);
  const flt=(f.rem.match(/\b[A-Z]{2,3}\s?\d{2,4}[A-Z]?\b/)||[""])[0];
  if(flt){ctx.textAlign="right";ctx.fillText(flt,W-60,80);ctx.textAlign="left"}
  const A=apt(f.dp),B=apt(f.ap),mx=60,my=110,mw=W-120,mh=470;
  ctx.fillStyle="#FFFFFF";ctx.fillRect(mx,my,mw,mh);
  if(A&&B){const data=routeData([f]);ctx.save();ctx.beginPath();ctx.rect(mx,my,mw,mh);ctx.clip();ctx.translate(mx,my);
    drawMap(ctx,mw,mh,fitProj(data.apts,mw,mh,90),data,{scale:2.2,maxLabels:2,sea:"#DCE6EE",land:"#F8FAF9",border:"#C3CCCD",route:"#1F3B5C",base:"#C9A227",ink:"#16212B",bw:1.2});ctx.restore()}
  else{ctx.fillStyle="#8E9A9D";ctx.font=`500 26px ${fB}`;ctx.textAlign="center";ctx.fillText("Sin coordenadas para dibujar la ruta",W/2,my+mh/2);ctx.textAlign="left"}
  ctx.fillStyle=ink;ctx.font=`700 96px ${fM}`;ctx.fillText(`${f.dp||"····"}`,60,700);
  ctx.fillStyle=gold;ctx.font=`700 60px ${fD}`;ctx.fillText("→",365,692);
  ctx.fillStyle=ink;ctx.font=`700 96px ${fM}`;ctx.fillText(`${f.ap||"····"}`,450,700);
  ctx.font=`500 26px ${fB}`;ctx.globalAlpha=.75;ctx.fillText((A?.c||A?.n||"").slice(0,22),60,740);ctx.fillText((B?.c||B?.n||"").slice(0,22),450,740);ctx.globalAlpha=1;
  const tiles=[["OUT",f.dt||"—"],["IN",f.at||"—"],["BLOCK",hm0(f.tot)],["NOCHE",hm0(f.night)]];
  tiles.forEach(([k,v],i)=>{const x=60+i*240;ctx.fillStyle=gold;ctx.font=`600 20px ${fD}`;ctx.fillText(k,x,820);ctx.fillStyle=ink;ctx.font=`600 54px ${fM}`;ctx.fillText(v,x,878)});
  const role=f.fpic?"PIC":f.fcop?"Copiloto":f.finst?"Instructor":f.fdual?"Dual":"";
  const d=fDist(f);
  ctx.fillStyle=ink;ctx.globalAlpha=.85;ctx.font=`500 26px ${fB}`;ctx.fillText([f.typ,f.reg,role,d?fmtInt(d)+" nm":"",(+f.ldd||0)+(+f.ldn||0)?`${(+f.ldd||0)+(+f.ldn||0)} LDG`:""].filter(Boolean).join("   ·   "),60,950);ctx.globalAlpha=1;
  ctx.fillStyle=gold;ctx.fillRect(60,990,W-120,2);
  ctx.fillStyle=ink;ctx.globalAlpha=.7;ctx.font=`600 20px ${fD}`;ctx.fillText("PILOT LOGBOOK",60,1030);if(o.name){ctx.textAlign="right";ctx.fillText(o.name.toUpperCase(),W-60,1030);ctx.textAlign="left"}ctx.globalAlpha=1;
  cv.toBlob(b=>{if(b)saveBlob(b,`vuelo_${f.d}_${f.dp}-${f.ap}.png`)},"image/png");
}
$("#flCard").onclick=()=>{if(editF)flightCard(editF)};

/* ---------- actividad, FDP y descanso (ORO.FTL.205 / 235, tripulación aclimatada, sin extensiones) ---------- */
const REPORT_MIN=()=>+ls.get("lb_report",60)||60,POST_MIN=30;
function fdpMax(repLocalMin,sectors){
  const m=((repLocalMin%1440)+1440)%1440;let base;
  if(m>=360&&m<810)base=780;
  else if(m>=810&&m<1020)base=780-15*(Math.floor((m-810)/30)+1);
  else if(m>=1020||m<300)base=660;
  else base=720+15*Math.floor((m-300)/15);
  return Math.max(540,base-30*Math.max(0,sectors-2));
}
const localMin=ms=>{const t=new Date(ms);return t.getHours()*60+t.getMinutes()};
const localD=ms=>{const t=new Date(ms);return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")};
const hmUTC=ms=>{const t=new Date(ms);return String(t.getUTCHours()).padStart(2,"0")+":"+String(t.getUTCMinutes()).padStart(2,"0")};
const hmLoc=ms=>{const t=new Date(ms);return String(t.getHours()).padStart(2,"0")+":"+String(t.getMinutes()).padStart(2,"0")};
function duties(F){
  const L=F.filter(f=>f.d&&f.dt).sort((a,b)=>(a.d+a.dt).localeCompare(b.d+b.dt)),out=[];let cur=null;
  L.forEach(f=>{
    const start=Date.parse(f.d+"T"+f.dt+":00Z");let end=f.at?Date.parse(f.d+"T"+f.at+":00Z"):start+(+f.tot||0)*6e4;if(end<start)end+=864e5;
    if(!cur||start-cur.end>=10*36e5){cur={d:f.d,start,end,fl:[f]};out.push(cur)}else{cur.fl.push(f);cur.end=Math.max(cur.end,end)}
  });
  out.forEach((d,i)=>{d.report=d.start-REPORT_MIN()*6e4;d.fdp=(d.end-d.report)/6e4;d.duty=d.fdp+POST_MIN;d.sectors=d.fl.length;d.ld=localD(d.report);
    d.repLocal=localMin(d.report);d.max=fdpMax(d.repLocal,d.sectors);d.margin=d.max-d.fdp;d.block=d.fl.reduce((a,f)=>a+(+f.tot||0),0);
    d.rest=i?(d.report-(out[i-1].end+POST_MIN*6e4))/6e4:null});
  return out;
}
function dutyDays(D){return new Set(D.map(d=>d.ld))}
function renderActivity(F,R){
  const AF=allF(),DA=duties(AF),D=DA.filter(d=>inRange(d.d,R)),td=today();
  const el=$("#stAct");if(!el)return;
  if(!D.length){el.innerHTML=`<p class="note">Necesito vuelos con hora OUT para agrupar los días de actividad.</p>`;$("#stActK").textContent="";return}
  const days=dutyDays(D),from=R[0]>"1900"?R[0]:D[0].ld,to=R[1]<td?R[1]:td;
  let cal=0;for(let x=from;x<=to;x=addDays(x,1))cal++;
  const off=Math.max(0,cal-days.size);
  // rachas (sobre todo el historial)
  const all=dutyDays(DA);let streak=0,kind=all.has(td)?"act":"off";for(let x=td;;x=addDays(x,-1)){if((all.has(x)?"act":"off")!==kind)break;streak++;if(streak>400)break}
  let maxRun=0,run=0;for(let x=from;x<=to;x=addDays(x,1)){if(days.has(x)){run++;maxRun=Math.max(maxRun,run)}else run=0}
  const shortRest=D.filter(d=>d.rest!=null&&d.rest<720).length,over=D.filter(d=>d.margin<0).length,tight=D.filter(d=>d.margin>=0&&d.margin<60).length;
  const avgDuty=D.reduce((a,d)=>a+d.duty,0)/D.length,maxFdp=D.reduce((a,d)=>Math.max(a,d.fdp),0);
  // duty acumulado 7/14/28 días a fecha del último día del periodo
  const ref=Date.parse(to+"T23:59:00Z"),roll=n=>DA.filter(d=>d.report<=ref&&d.report>ref-n*864e5).reduce((a,d)=>a+d.duty,0);
  const lims=[["7 días",roll(7),60*60],["14 días",roll(14),110*60],["28 días",roll(28),190*60]];
  $("#stActK").textContent=`${D.length} días de actividad · ${off} libres · ${cal} días en el periodo`;
  el.innerHTML=`<div class="sumgrid dist">
    <div class="cell"><div class="k">Racha actual</div><div class="v">${streak} ${streak===1?"día":"días"}</div><div class="note">${kind==="act"?"de actividad seguida":"libres seguidos"}</div></div>
    <div class="cell"><div class="k">Máx. días seguidos</div><div class="v">${maxRun}</div><div class="note">de actividad en el periodo</div></div>
    <div class="cell"><div class="k">Duty medio</div><div class="v">${hm0(avgDuty)}</div><div class="note">presentación → calzos + ${POST_MIN} min</div></div>
    <div class="cell"><div class="k">FDP más larga</div><div class="v">${hm0(maxFdp)}</div><div class="note">${over?`<span class="chip b">${over} por encima del máx.</span>`:tight?`<span class="chip w">${tight} con < 1 h de margen</span>`:`<span class="chip ok">todas dentro</span>`}</div></div>
    <div class="cell"><div class="k">Descansos cortos</div><div class="v">${shortRest}</div><div class="note">menos de 12 h entre actividades</div></div>
    <div class="cell"><div class="k">Sectores / día</div><div class="v">${(D.reduce((a,d)=>a+d.sectors,0)/D.length).toFixed(1)}</div><div class="note">media en el periodo</div></div>
  </div>
  <div class="two" style="margin-top:12px">
   <div>
    <h3>Tiempo de actividad acumulado · ORO.FTL.210(a)</h3>
    ${lims.map(([l,v,max])=>{const p=Math.min(100,v/max*100),c=p>=95?" b":p>=85?" w":"";return `<div class="lim"><div class="lab"><span>Últimos ${l}</span><span class="mono">${hm0(v)} / ${max/60}:00</span></div><div class="bar${c}"><i style="width:${p.toFixed(1)}%"></i></div></div>`}).join("")}
    <p class="note">A fecha ${fmtD(to)}. Duty estimado: desde ${REPORT_MIN()} min antes del primer OUT hasta ${POST_MIN} min después del último IN. Solo cuenta vuelos; no incluye imaginarias, simulador ni oficina.</p>
   </div>
   <div>
    <h3>Calculadora FDP</h3>
    <div class="row"><label class="f"><span class="note">Presentación (hora local)</span><input type="time" id="fcRep" value="05:10"></label><label class="f"><span class="note">Sectores</span><input type="number" id="fcSec" min="1" max="10" value="4" style="width:70px"></label><label class="f"><span class="note">Calzos previstos (local)</span><input type="time" id="fcEnd"></label></div>
    <p id="fcOut" class="fc-out"></p>
    <p class="note">Tabla de ORO.FTL.205(b)(1) para tripulación aclimatada, sin extensiones ni descanso en vuelo. Hora local según la zona horaria de este dispositivo.</p>
   </div>
  </div>
  <h3 style="margin-top:12px">Días de actividad</h3>
  <div class="rp-scroll"><table class="rp-t rp-list"><thead><tr><th>Fecha</th><th>Presentación</th><th>Sect.</th><th>Ruta</th><th>Block</th><th>FDP</th><th>FDP máx</th><th>Margen</th><th>Descanso previo</th></tr></thead><tbody>
  ${[...D].reverse().slice(0,120).map(d=>{const c=d.margin<0?"b":d.margin<60?"w":"ok",rc=d.rest==null?"":d.rest<600?"b":d.rest<720?"w":"ok";
    return `<tr><td>${fmtD(d.ld)}</td><td>${hmLoc(d.report)} <span class="note">(${hmUTC(d.report)}Z)</span></td><td>${d.sectors}</td><td class="l">${esc([d.fl[0].dp,...d.fl.map(f=>f.ap)].join("–"))}</td><td>${hm0(d.block)}</td><td><b>${hm0(d.fdp)}</b></td><td>${hm0(d.max)}</td><td><span class="chip ${c}">${d.margin<0?"−":""}${hm0(Math.abs(d.margin))}</span></td><td>${d.rest==null?"—":`<span class="chip ${rc}">${d.rest>=1440?Math.floor(d.rest/1440)+" d "+hm0(d.rest%1440):hm0(d.rest)}</span>`}</td></tr>`}).join("")}
  </tbody></table></div>
  ${D.length>120?`<p class="note">Se muestran los 120 días más recientes.</p>`:""}`;
  const calc=()=>{const r=$("#fcRep").value,s=+$("#fcSec").value||1,e=$("#fcEnd").value;if(!r){$("#fcOut").textContent="";return}
    const rm=cMin(r),mx=fdpMax(rm,s),lim=(rm+mx)%1440;let t=`FDP máxima <b>${hm0(mx)}</b> → calzos como muy tarde a las <b>${hm(lim)}</b> hora local`;
    if(e){const em=((cMin(e)-rm)+1440)%1440,mg=mx-em;t+=` · prevista ${hm0(em)} <span class="chip ${mg<0?"b":mg<60?"w":"ok"}">${mg<0?"excede −":"margen "}${hm0(Math.abs(mg))}</span>`}
    $("#fcOut").innerHTML=t};
  ["#fcRep","#fcSec","#fcEnd"].forEach(s=>$(s).addEventListener("input",calc));calc();
}
// límite FDP en el vuelo en directo
function liveFdp(){
  if(!LV||!(LV.out||LV.off))return "";
  const d=LV.d||today(),out=Date.parse(d+"T"+(LV.out||LV.off)+":00Z"),todayF=allF().filter(f=>f.d===d&&f.dt);
  let start=out;todayF.forEach(f=>{const s=Date.parse(f.d+"T"+f.dt+":00Z");if(s<start&&out-s<10*36e5)start=s});
  const rep=start-REPORT_MIN()*6e4,plannedLeft=live("p").filter(p=>!p.sim&&p.d===d&&p.std&&p.std>(LV.out||LV.off)).length;
  const sectors=todayF.filter(f=>out-Date.parse(f.d+"T"+f.dt+":00Z")<10*36e5).length+1+plannedLeft,mx=fdpMax(localMin(rep),sectors),lim=rep+mx*6e4;
  return ` · Límite FDP ${hmUTC(lim)}Z (${hm0(mx)} máx, presentación ${hmLoc(rep)} local, ${sectors} sectores${plannedLeft?" incl. programados":""})`;
}

/* ---------- roster y vuelos programados ---------- */
const ROSTER_PROMPT=(ctx)=>`Esto es ${ctx} de la programación (roster) de un piloto de línea aérea. Extrae las actividades, una por sector de vuelo.
Devuelve SOLO un objeto JSON con esta forma: {"times":"UTC"|"local"|"desconocido","items":[{"date":"YYYY-MM-DD","kind":"flight"|"sim"|"standby"|"off"|"other","flight":"VY1234","from":"LEBL","to":"LEMD","std":"HH:MM","sta":"HH:MM","reg":"","report":"HH:MM","note":""}]}
Reglas: fechas completas (si el roster solo da el día, deduce mes y año del encabezado; hoy es ${today()}); códigos de aeropuerto tal como aparecen (OACI de 4 letras o IATA de 3); "kind":"flight" solo para sectores con origen y destino; simulador = "sim"; imaginarias y libres = "standby"/"off" sin vuelos; "times" indica si las horas del roster son UTC o locales si el documento lo dice; campos desconocidos = ""; no inventes nada.`;
let ros=null;
async function pdfText(file,onP){
  await needPDF();pdfjsLib.GlobalWorkerOptions.workerSrc="vendor/pdf.worker.min.js";
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise,pages=[];
  for(let p=1;p<=pdf.numPages;p++){const tc=await (await pdf.getPage(p)).getTextContent(),lines={};
    tc.items.forEach(it=>{if(!it.str.trim())return;const y=Math.round(it.transform[5]/3)*3;(lines[y]=lines[y]||[]).push([it.transform[4],it.str.trim()])});
    pages.push(Object.keys(lines).sort((a,b)=>b-a).map(y=>lines[y].sort((a,b)=>a[0]-b[0]).map(x=>x[1]).join(" | ")).join("\n"));onP&&onP(p/pdf.numPages)}
  return pages;
}
const rArea=$("#rosArea");
function rMsg(h){rArea.hidden=false;rArea.innerHTML=h}
async function readRoster(file,text){
  if(!aiKey()&&typeof window.LB_VISION!=="function"&&typeof window.LB_TEXT!=="function"){rMsg(`<div class="msg w">Para leer el roster necesitas tu clave de Claude en Ajustes.</div><button class="btn" data-go="set">Ir a Ajustes</button>`);return}
  rMsg(`<div class="row"><b>${esc(file?file.name:"Texto pegado")}</b><span class="note" id="rosStat">Leyendo…</span></div><div class="prog"><i id="rosProg" style="width:10%"></i></div>`);
  try{
    let results=[];
    if(file&&/image\//.test(file.type)){results=[await visionJSON(ROSTER_PROMPT("una foto"),await shrinkImage(file,2000))]}
    else{
      let chunks;
      if(file&&/\.pdf$/i.test(file.name))chunks=await pdfText(file,p=>$("#rosProg").style.width=(10+p*40)+"%");
      else chunks=[text||await file.text()];
      chunks=chunks.filter(c=>c.replace(/\s|\|/g,"").length>20);if(!chunks.length)throw new Error("No encuentro texto legible. Si es un PDF escaneado, hazle una foto o captura.");
      for(let i=0;i<chunks.length;i++){results.push(await textJSON(ROSTER_PROMPT("el texto de una página")+"\n\n"+chunks[i]));$("#rosProg").style.width=(50+50*(i+1)/chunks.length)+"%";$("#rosStat").textContent=`${i+1}/${chunks.length}`}
    }
    const items=[],times=results.find(r=>r&&r.times&&r.times!=="desconocido")?.times||"desconocido";
    results.forEach(r=>(r?.items||[]).forEach(o=>{const d=toDate(o.date);if(!d)return;items.push({d,kind:o.kind||"other",flt:String(o.flight||"").toUpperCase().replace(/\s+/g,""),dp:(apt(o.from)?.i||String(o.from||"").toUpperCase()),ap:(apt(o.to)?.i||String(o.to||"").toUpperCase()),std:clock(o.std),sta:clock(o.sta),reg:String(o.reg||"").toUpperCase(),rep:clock(o.report),note:String(o.note||"")})}));
    ros={items,times};drawRoster();
  }catch(e){rMsg(`<div class="msg b">${esc(e.message||e)}</div>`)}
}
async function textJSON(prompt){
  if(typeof window.LB_TEXT==="function")return window.LB_TEXT(prompt);
  return askClaude(prompt);
}
function drawRoster(){
  const {items,times}=ros,ex=new Set(live("p").map(p=>p.d+"|"+p.flt+"|"+p.dp)),exF=new Set(allF().map(f=>f.d+"|"+f.dp+"|"+f.ap));
  const fl=items.filter(i=>i.kind==="flight"&&i.dp&&i.ap),sims=items.filter(i=>i.kind==="sim"),other=items.filter(i=>!(i.kind==="flight"&&i.dp&&i.ap)&&i.kind!=="sim");
  const exS=new Set(live("p").filter(p=>p.sim).map(p=>p.d+"|"+p.std));sims.forEach(i=>i.dup=exS.has(i.d+"|"+i.std));
  fl.forEach(i=>{i.dup=ex.has(i.d+"|"+i.flt+"|"+i.dp);i.flown=exF.has(i.d+"|"+i.dp+"|"+i.ap)});
  rMsg(`<div class="row"><h3>Roster leído</h3><span class="note">${fl.length} sectores${sims.length?` · ${sims.length} sesiones de simulador`:""}${other.length?` · ${other.length} otras actividades (imaginaria, libre…) que no se importan`:""}</span></div>
   <label class="chk"><input type="checkbox" id="rosLocal"${times==="local"?" checked":""}> Las horas del roster son locales: convertir a UTC con la zona horaria de este dispositivo ${times==="desconocido"?"(no lo pone en el documento; compruébalo)":""}</label>
   <div class="prev"><table><thead><tr><th></th><th>Fecha</th><th>Vuelo</th><th>Ruta</th><th>STD</th><th>STA</th><th>Matr.</th><th></th></tr></thead><tbody>
   ${fl.map((i,k)=>`<tr class="${i.dup||i.flown?"dup":""}"><td><input type="checkbox" data-rk="${k}"${i.dup||i.flown?"":" checked"}></td><td>${fmtD(i.d)}</td><td>${esc(i.flt)}</td><td>${esc(i.dp)} → ${esc(i.ap)}</td><td>${i.std}</td><td>${i.sta}</td><td>${esc(i.reg)}</td><td class="note">${i.flown?"ya volado":i.dup?"ya programado":""}</td></tr>`).join("")}
   ${sims.map((i,k)=>`<tr class="${i.dup?"dup":""}"><td><input type="checkbox" data-rsim="${k}"${i.dup?"":" checked"}></td><td>${fmtD(i.d)}</td><td>SIM</td><td>${esc(i.note||i.flt||"Sesión de simulador")}</td><td>${i.std}</td><td>${i.sta}</td><td></td><td class="note">${i.dup?"ya programada":"irá a Simulador"}</td></tr>`).join("")}
   ${other.slice(0,30).map(i=>`<tr class="dup"><td></td><td>${fmtD(i.d)}</td><td colspan="5">${esc(i.kind)}${i.note?" · "+esc(i.note):""}${i.rep?" · presentación "+i.rep:""}</td><td></td></tr>`).join("")}
   </tbody></table></div>
   <div class="row"><button class="btn pri" id="rosGo">Añadir a programados</button><span class="note">Luego, en Vuelos, cada sector se confirma con los tiempos reales (a mano, con el ACARS o en directo).</span></div>`);
  $("#rosGo").onclick=()=>{
    const loc=$("#rosLocal").checked,sel=[...$$("#rosArea [data-rk]:checked")].map(c=>fl[+c.dataset.rk]);
    const conv=(d,hm)=>{if(!hm)return{d,t:""};if(!loc)return{d,t:hm};const [y,m,dd]=d.split("-").map(Number),[H,M]=hm.split(":").map(Number),x=new Date(y,m-1,dd,H,M);return{d:x.toISOString().slice(0,10),t:x.toISOString().slice(11,16)}};
    const recs=sel.map(i=>{const a=conv(i.d,i.std),b=conv(i.d,i.sta);return ["p",{id:uid(),d:a.d,flt:i.flt,dp:i.dp,ap:i.ap,std:a.t,sta:b.t,reg:i.reg,src:"roster"}]});
    [...$$("#rosArea [data-rsim]:checked")].map(c=>sims[+c.dataset.rsim]).forEach(i=>{const x=conv(i.d,i.std),z=conv(i.d,i.sta);recs.push(["p",{id:uid(),d:x.d,sim:true,std:x.t,sta:z.t,note:[i.flt,i.note].filter(Boolean).join(" ")||"Simulador",flt:"",dp:"",ap:"",src:"roster"}])});
    if(!recs.length){toast("No hay nada seleccionado.");return}
    bulkPut(recs);rMsg(`<div class="msg ok">${recs.length} actividades añadidas a programados: los vuelos en Vuelos y las sesiones en Simulador.</div>`);toast("Roster importado");
  };
}
$("#rosFile").addEventListener("change",e=>{const f=e.target.files[0];e.target.value="";if(f)readRoster(f)});
$("#rosText").onclick=()=>{const t=$("#rosPaste").value.trim();if(t.length<20){toast("Pega el texto del roster.");return}readRoster(null,t)};
let confirmPlanned=null;
function renderPlanned(){
  const td=today(),P=live("p").filter(p=>!p.sim).sort((a,b)=>(a.d+(a.std||"")).localeCompare(b.d+(b.std||""))),box=$("#planned");if(!box)return;
  if(!P.length){box.hidden=true;return}
  box.hidden=false;const past=P.filter(p=>p.d<td),up=P.filter(p=>p.d>=td);
  const row=p=>`<div class="pl${p.d<td?" past":""}${p.d===td?" today":""}"><span class="pl-d">${p.d===td?"Hoy":fmtD(p.d)}</span><span class="pl-r mono">${esc(p.flt||"")} ${esc(p.dp)} → ${esc(p.ap)}</span><span class="pl-t mono">${p.std||"--:--"}–${p.sta||"--:--"}Z</span><span class="pl-x">${esc(p.reg||"")}</span><span class="spacer"></span><button class="btn sm pri" data-pconf="${p.id}">Confirmar</button>${p.d===td?`<button class="btn sm" data-plive="${p.id}">● Directo</button>`:""}<button class="btn sm" data-pdel="${p.id}" aria-label="Quitar">✕</button></div>`;
  box.innerHTML=`<div class="row"><h3>Programados</h3><span class="note">${up.length} próximos${past.length?` · ${past.length} pasados sin confirmar`:""}</span><span class="spacer"></span><button class="btn sm" id="plIcs">Al calendario</button>${past.length?`<button class="btn sm" id="plPurge">Quitar pasados</button>`:""}</div>
    <div class="pl-list">${[...past.slice(-5),...up.slice(0,40)].map(row).join("")}</div>${up.length>40?`<p class="note">Mostrando 40 de ${up.length}.</p>`:""}`;
  $("#plIcs").onclick=()=>exportIcs(P.map(p=>({d:p.d,dt:p.std,at:p.sta,dp:p.dp,ap:p.ap,rem:p.flt,id:p.id,plan:1})),"programados");
  $("#plPurge")&&($("#plPurge").onclick=()=>{past.forEach(p=>removeRec("p",p.id));toast("Programados pasados quitados")});
}
$("#planned").addEventListener("click",e=>{
  const c=e.target.closest("[data-pconf]"),l=e.target.closest("[data-plive]"),x=e.target.closest("[data-pdel]");
  if(c){const p=live("p").find(q=>q.id===c.dataset.pconf);if(!p)return;confirmPlanned=p.id;openFl(null,{d:p.d,dp:p.dp,ap:p.ap,dt:p.std,at:p.sta,reg:p.reg,rem:p.flt});nightHint();$("#fnInfo").textContent="Horas programadas (STD/STA): cámbialas por las reales. "+$("#fnInfo").textContent}
  if(l){const p=live("p").find(q=>q.id===l.dataset.plive);if(!p)return;LV={d:"",dp:p.dp,ap:p.ap,flt:p.flt,typ:prefs().typ||"",reg:p.reg||allF().slice(-1)[0]?.reg||"",plan:p.id};saveLive();openLive()}
  if(x){removeRec("p",x.dataset.pdel)}
});

/* ---------- vuelos al calendario (.ics) ---------- */
function exportIcs(list,name){
  const st=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,""),z=(d,t)=>d.replace(/-/g,"")+"T"+t.replace(":","")+"00Z";
  const ev=list.filter(f=>f.d).map(f=>{
    const dt=f.dt||"00:00";let endD=f.d,at=f.at||f.dt||"00:00";if(f.at&&f.dt&&f.at<f.dt)endD=addDays(f.d,1);if(!f.at&&f.tot){const m=cMin(dt)+f.tot;endD=m>=1440?addDays(f.d,1):f.d;at=hm0(m%1440).padStart(5,"0")}
    const flt=(String(f.rem||"").match(/\b[A-Z]{2,3}\s?\d{2,4}[A-Z]?\b/)||[""])[0],title=`${f.plan?"(Prog.) ":""}${flt?flt+" ":""}${f.dp} → ${f.ap}`;
    const desc=f.plan?"Vuelo programado desde el roster":[f.tot?"Block "+hm0(f.tot):"",f.typ,f.reg,f.fpic?"PIC":f.fcop?"Copiloto":f.finst?"Instructor":"",+f.night?"Noche "+hm(f.night):""].filter(Boolean).join(" · ");
    return ["BEGIN:VEVENT",`UID:${f.id}@pilot-logbook`,`DTSTAMP:${st}`,f.dt?`DTSTART:${z(f.d,dt)}`:`DTSTART;VALUE=DATE:${f.d.replace(/-/g,"")}`,f.dt?`DTEND:${z(endD,at)}`:`DTEND;VALUE=DATE:${addDays(f.d,1).replace(/-/g,"")}`,`SUMMARY:${title.replace(/[,;]/g," ")}`,`DESCRIPTION:${desc.replace(/[,;]/g," ")}`,"END:VEVENT"].join("\r\n")});
  if(!ev.length){toast("No hay vuelos que exportar.");return}
  saveBlob(new Blob([["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Pilot Logbook//ES","CALSCALE:GREGORIAN",...ev,"END:VCALENDAR"].join("\r\n")],{type:"text/calendar"}),`vuelos_${name}.ics`);
}
$("#repIcs").onclick=()=>{const R=stRange();exportIcs(allF().filter(f=>inRange(f.d,R)),stPreset)};

/* ---------- firma ---------- */
const sigPng=()=>live("x").find(r=>r.id==="sig")?.png||"";
(function sigPad(){
  const cv=$("#sigPad");if(!cv)return;const ctx=cv.getContext("2d");let drawing=false,dirty=false,last=null;
  const pos=e=>{const b=cv.getBoundingClientRect();return [(e.clientX-b.left)*cv.width/b.width,(e.clientY-b.top)*cv.height/b.height]};
  ctx.lineWidth=3;ctx.lineCap="round";ctx.lineJoin="round";
  const ink=()=>{ctx.strokeStyle=tok("--ink")||"#16212B"};
  cv.addEventListener("pointerdown",e=>{drawing=true;dirty=true;last=pos(e);cv.setPointerCapture(e.pointerId);ink()});
  cv.addEventListener("pointermove",e=>{if(!drawing)return;const p=pos(e);ctx.beginPath();ctx.moveTo(...last);ctx.lineTo(...p);ctx.stroke();last=p});
  ["pointerup","pointercancel"].forEach(ev=>cv.addEventListener(ev,()=>drawing=false));
  $("#sigClear").onclick=()=>{ctx.clearRect(0,0,cv.width,cv.height);dirty=false};
  $("#sigSave").onclick=()=>{if(!dirty){toast("Dibuja tu firma primero.");return}
    // normaliza a tinta oscura para imprimir
    const c2=document.createElement("canvas");c2.width=cv.width;c2.height=cv.height;const x2=c2.getContext("2d");x2.drawImage(cv,0,0);x2.globalCompositeOperation="source-in";x2.fillStyle="#14213A";x2.fillRect(0,0,c2.width,c2.height);
    putRec("x",{id:"sig",d:"",png:c2.toDataURL("image/png")});toast("Firma guardada");renderSig()};
  $("#sigFile").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;
    try{const img=await new Promise((ok,ko)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=ko;i.src=URL.createObjectURL(f)});
      const k=Math.min(1,900/img.width),c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
      const x=c.getContext("2d");x.drawImage(img,0,0,c.width,c.height);const d=x.getImageData(0,0,c.width,c.height),p=d.data;
      // el papel blanco se vuelve transparente para que no tape las líneas de la página
      for(let i=0;i<p.length;i+=4){const l=(p[i]+p[i+1]+p[i+2])/3;if(l>=235)p[i+3]=0;else if(l>200)p[i+3]=Math.round(p[i+3]*(235-l)/35)}
      x.putImageData(d,0,0);putRec("x",{id:"sig",d:"",png:c.toDataURL("image/png")});toast("Firma guardada");renderSig()}
    catch{toast("No pude leer la imagen")}};
  $("#sigDel").onclick=()=>{removeRec("x","sig");ctx.clearRect(0,0,cv.width,cv.height);dirty=false;renderSig()};
})();
function renderSig(){const s=sigPng(),el=$("#sigCur");if(!el)return;el.innerHTML=s?`<img src="${s}" alt="Firma guardada" class="sig-img"><span class="note">Firma guardada: se imprime en los informes y en las páginas cerradas.</span>`:`<span class="note">Sin firma guardada.</span>`}
const signLine=()=>{const s=sigPng();return `<p class="rp-sign">Certifico que los datos de este informe son ciertos.${s?`<br><img src="${s}" class="sig-img" alt="Firma">`:" ____________________"}<br>Firma del piloto${owner().name?" · "+esc(owner().name):""}</p>`};

/* ---------- cierre de páginas del libro ---------- */
const pageLocks=()=>{const m={};live("g").forEach(g=>m[g.page]=g);return m};
async function sha(s){try{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(b)].slice(0,6).map(x=>x.toString(16).padStart(2,"0")).join("")}catch{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h.toString(16)}}
const pageCanon=pg=>pg.map(e=>{const r=e.r;return e.k==="f"?["f",r.d,r.dt,r.dp,r.ap,r.at,r.typ,r.reg,r.se,r.me,r.mp,r.tot,r.pic,r.tod,r.ton,r.ldd,r.ldn,r.night,r.ifr,r.fpic,r.fcop,r.fdual,r.finst,r.rem].join("|"):["s",r.d,r.typ,r.tot,r.role,r.rem].join("|")}).join("\n");
async function easaRender(R,extra={}){
  const pages=easaPages(),locks=pageLocks(),hashes={},only=$("#easaOnly")?.checked;
  for(let i=0;i<pages.length;i++){const n=i+1;if(locks[n]||pages[i].length===EASA_ROWS)hashes[n]=await sha(pageCanon(pages[i]))}
  return easaReport(R,{locks,hashes,sig:sigPng(),onlyLocked:only,...extra});
}
function lockBar(n,pg,o){
  const lk=o.locks[n],h=o.hashes[n],full=pg.length===EASA_ROWS;
  if(lk){const ok=lk.hash===h;return `<div class="lockbar ${ok?"ok":"bad"}"><span>${ok?"🔒":"⚠"} Página ${n} cerrada el ${fmtD(lk.at)} · huella <span class="mono">${lk.hash}</span>${ok?"":" · <b>el contenido ha cambiado desde el cierre</b> (se ha editado o insertado una entrada anterior)"}</span><span class="spacer"></span><button class="btn sm" data-unlock="${n}">Reabrir</button></div>`}
  return `<div class="lockbar"><span>Página ${n} · ${pg.length}/${EASA_ROWS} entradas${full?"":" · se cierra cuando esté completa"}</span><span class="spacer"></span><button class="btn sm pri" data-lock="${n}"${full?"":" disabled"}>Cerrar y firmar página</button></div>`;
}
document.addEventListener("click",async e=>{
  if(!e.target.closest("#repOut,#flPage,#simPageWrap,#v-sim"))return;
  const l=e.target.closest("[data-lock]"),u=e.target.closest("[data-unlock]");
  if(l){const n=+l.dataset.lock,pg=easaPages()[n-1];if(!pg)return;if(!sigPng()&&!confirmNoSig){toast("Sin firma guardada: se cierra con la huella. Puedes dibujar tu firma en Ajustes.");confirmNoSig=true}
    putRec("g",{id:"pg"+n,d:"",page:n,at:today(),hash:await sha(pageCanon(pg)),n:pg.length});toast(`Página ${n} cerrada`)}
  if(u){removeRec("g","pg"+u.dataset.unlock);toast("Página reabierta")}
});
let confirmNoSig=false;
$("#easaOnly")?.addEventListener("change",()=>renderReport());
function lockedPageOf(f){const pages=easaPages();for(let i=0;i<pages.length;i++)if(pages[i].some(e=>e.r.id===f.id))return pageLocks()[i+1]?i+1:0;return 0}

/* ================= SIMULADOR ================= */
const SIM_KINDS=["EBT EVAL","EBT MV","EBT SBT","LOFT","LPC","OPC","Skill test","Curso de tipo","Mando (upgrade)","Recurrente","Familiarización","Otro"];
const ROLE_INS=["TRI","SFI"],ROLE_EXA=["TRE","SFE"],ROLE_OWN=["Alumno PF","Alumno PM","Alumno","PF","PM"];
const roleGroup=r=>ROLE_EXA.includes(r)?"exa":ROLE_INS.includes(r)?"ins":ROLE_OWN.includes(r)?"own":"oth";
const simCfg=()=>Object.assign({checks:["LPC","OPC","Skill test","EBT EVAL"],chkGoal:2,insGoal:1,insMin:180,book:true},ls.get("lb_simcfg",{}));
const bookS=()=>allS().filter(s=>s.inBook!==false);
const DEF_TPL=[{name:"EBT EVAL",kind:"EBT EVAL",role:"TRE",tot:240},{name:"EBT SBT",kind:"EBT SBT",role:"TRI",tot:240},{name:"LOFT",kind:"LOFT",role:"TRI",tot:240},{name:"LPC",kind:"LPC",role:"TRE",tot:240},{name:"OPC",kind:"OPC",role:"TRE",tot:240},{name:"Curso de tipo",kind:"Curso de tipo",role:"TRI",tot:240},{name:"Mi OPC/LPC",kind:"LPC",role:"Alumno PF",tot:240}];
const simTpls=()=>{const r=live("x").find(x=>x.id==="simtpl");return r?.list?.length?r.list:DEF_TPL};
const tplHTML=()=>simTpls().map((t,i)=>`<button type="button" class="tchip" data-tpl="${i}">${esc(t.name)}</button>`).join("")+`<button type="button" class="tchip add" id="tplSave">+ Guardar como plantilla</button>`;

/* ----- formulario ----- */
function openSim(s,pre){
  editS=s||null;const last=allS().slice(-1)[0],src=s||pre||{};
  $("#simTitle").textContent=s?"Editar sesión":"Nueva sesión";
  $("#sd").value=src.d||today();$("#styp").value=src.typ??(last?.typ||"FFS A320");$("#sdev").value=src.dev??(last?.dev||"");
  $("#skind").innerHTML=`<option value="">—</option>`+SIM_KINDS.map(k=>`<option${k===(src.kind||"")?" selected":""}>${k}</option>`).join("");
  $("#smod").value=src.mod||"";$("#stot").value=src.tot?hm(src.tot):"4:00";
  const lastIns=allS().filter(x=>roleGroup(x.role)!=="own").slice(-1)[0];$("#srole").value=src.role||(lastIns?.role||"TRE");
  $("#stol").value=src.tol||"";$("#sapp").value=src.app||"";$("#srem").value=src.rem||"";$("#sscen").value=src.scen||"";
  $("#sbook").checked=s?s.inBook!==false:(roleGroup($("#srole").value)==="own"?true:simCfg().book);
  $("#simTpl").innerHTML=tplHTML();simCurUI();
  $("#simDel").hidden=!s;$("#simConfirm").hidden=true;$("#simDlg").hidden=false;$("#simPlanId").value=pre?.planId||"";
}
$("#srole").addEventListener("change",()=>{if(!editS)$("#sbook").checked=roleGroup($("#srole").value)==="own"?true:simCfg().book;simCurUI()});
function nextExpiry(kind,d){const [y,m]=d.split("-").map(Number),add=kind==="OPC"?6:12,dt=new Date(Date.UTC(y,m-1+add+1,0));return dt.toISOString().slice(0,10)}
function simCurUI(){
  const k=$("#skind").value,g=roleGroup($("#srole").value),C=live("c");if(g!=="own"){$("#scurWrap").hidden=true;return}
  const guess=k?C.find(c=>new RegExp("\\b"+k.split(" ")[0],"i").test(c.name)):null;
  $("#scurSel").innerHTML=`<option value="">No actualizar</option>`+C.map(c=>`<option value="${c.id}"${guess&&guess.id===c.id?" selected":""}>${esc(c.name)} (ahora ${fmtD(c.d)})</option>`).join("")+(k==="OPC"||k==="LPC"?`<option value="__new">Crear «${k}»</option>`:"");
  if(!guess&&(k==="OPC"||k==="LPC"))$("#scurSel").value="__new";
  $("#scurDate").value=(k==="OPC"||k==="LPC")&&$("#sd").value?nextExpiry(k,$("#sd").value):"";
  $("#scurWrap").hidden=false;
}
["#skind","#sd"].forEach(s=>$(s).addEventListener("change",simCurUI));
$("#simTpl").addEventListener("click",e=>{
  const b=e.target.closest("[data-tpl]");
  if(b){const t=simTpls()[+b.dataset.tpl];if(!t)return;
    if(t.kind)$("#skind").value=t.kind;if(t.role)$("#srole").value=t.role;if(t.tot)$("#stot").value=hm(t.tot);if(t.typ)$("#styp").value=t.typ;if(t.dev)$("#sdev").value=t.dev;if(t.mod!=null)$("#smod").value=t.mod;if(t.scen)$("#sscen").value=t.scen;
    if(!editS)$("#sbook").checked=roleGroup($("#srole").value)==="own"?true:simCfg().book;
    simCurUI();$$("#simTpl .tchip").forEach(x=>x.classList.toggle("on",x===b));return}
  if(e.target.closest("#tplSave")){
    const name=($("#skind").value||"Sesión")+($("#smod").value?" "+$("#smod").value:"")+" · "+$("#srole").value;
    const list=[...simTpls().filter(t=>t.name!==name),{name,kind:$("#skind").value,role:$("#srole").value,tot:toMin($("#stot").value),typ:$("#styp").value.trim(),dev:$("#sdev").value.trim(),mod:$("#smod").value.trim(),scen:$("#sscen").value.trim()}];
    putRec("x",{id:"simtpl",d:"",list});toast("Plantilla guardada: "+name);$("#simTpl").innerHTML=tplHTML();
  }
});
$("#simForm").addEventListener("submit",e=>{
  e.preventDefault();
  const g=roleGroup($("#srole").value);
  const s={id:editS?.id||uid(),d:$("#sd").value,typ:$("#styp").value.trim(),dev:$("#sdev").value.trim(),kind:$("#skind").value,mod:$("#smod").value.trim(),tot:toMin($("#stot").value),role:$("#srole").value,tol:+$("#stol").value||0,app:+$("#sapp").value||0,rem:$("#srem").value.trim(),scen:$("#sscen").value.trim(),inBook:$("#sbook").checked};
  if(!s.tot){toast("Falta el tiempo de sesión.");return}
  if(!s.d){toast("Pon la fecha.");return}
  const ch=[["s",s]];
  if(g==="own"&&$("#scurSel").value&&$("#scurDate").value){
    const v=$("#scurSel").value,old=live("c").find(c=>c.id===v);
    ch.push(["c",old?{...old,d:$("#scurDate").value}:{id:uid(),name:$("#skind").value||"Chequeo",d:$("#scurDate").value,warn:60}]);
  }
  const plan=$("#simPlanId").value;
  bulkPut(ch);if(plan)removeRec("p",plan);
  $("#simDlg").hidden=true;toast(editS?"Sesión actualizada":ch.length>1?"Sesión guardada y caducidad actualizada":"Sesión guardada");
});

/* ----- pestaña ----- */
function simFiltered(){
  const q=$("#sq").value.trim().toLowerCase(),y=$("#syr").value,g=$("#sgrp").value,k=$("#skf").value;
  return allS().filter(s=>(!y||s.d.startsWith(y))&&(!g||roleGroup(s.role)===g)&&(!k||s.kind===k)&&(!q||[s.typ,s.dev,s.kind,s.mod,s.rem,s.scen,s.role].join(" ").toLowerCase().includes(q)));
}
function renderSims(){
  const S=allS(),cfg=simCfg(),td=today(),y=td.slice(0,4),since12=addDays(td,-364);
  const sumT=a=>a.reduce((x,s)=>x+(+s.tot||0),0);
  const ins=S.filter(s=>roleGroup(s.role)==="ins"),exa=S.filter(s=>roleGroup(s.role)==="exa"),own=S.filter(s=>roleGroup(s.role)==="own");
  const checks12=exa.filter(s=>s.d>=since12&&cfg.checks.includes(s.kind));
  $("#simTop").innerHTML=[["Total FSTD",hm0(sumT(S)),`${S.length} sesiones`],["Año "+y,hm0(sumT(S.filter(s=>s.d.startsWith(y)))),`${S.filter(s=>s.d.startsWith(y)).length} sesiones`],["Últimos 12 meses",hm0(sumT(S.filter(s=>s.d>=since12))),`${S.filter(s=>s.d>=since12).length} sesiones`],["Como instructor",hm0(sumT(ins)),`${ins.length} sesiones`],["Como examinador",hm0(sumT(exa)),`${exa.length} sesiones`],["Propias",hm0(sumT(own)),`${own.length} sesiones`],["En el libro · col. 11",hm0(sumT(bookS())),"cuenta en totales EASA"]]
    .map(([k,v,n])=>`<div class="cell"><div class="k">${k}</div><div class="v">${v}</div><div class="note">${n}</div></div>`).join("");
  // mantenimiento TRI/TRE
  const C=live("c"),isAux=n=>/refresher|refresco|evaluaci|assessment|inspector|observad|supervis/i.test(n);
  const cTRI=C.find(c=>/\bTRI\b/i.test(c.name)&&!isAux(c.name)),cTRE=C.find(c=>(/\bTRE\b|examinador/i.test(c.name))&&!isAux(c.name));
  const doneOf=re=>C.filter(c=>re.test(c.name)).map(c=>c.done||"").filter(Boolean).sort().pop()||"";
  const ck=(ok,txt,sub)=>`<div class="ck ${ok?"ok":"no"}"><i>${ok?"✓":"·"}</i><span>${txt}${sub?`<small>${sub}</small>`:""}</span></div>`;
  const cur=c=>c?(()=>{const st=curState(c);return `<span class="chip ${st.cls}">${st.txt}</span> <span class="note">caduca ${fmtD(c.d)}</span>`})():`<span class="note">sin fecha · añade “Habilitación TRI” / “Certificado de examinador TRE” en Caducidades</span>`;
  let triH="",treH="";
  if(cTRI){const p0=addDays(cTRI.d,-365*3),inP=d=>!!(d&&d>p0&&d<=cTRI.d);
    const ses=ins.filter(s=>inP(s.d)&&(+s.tot||0)>=cfg.insMin&&!/APT/i.test(s.typ||"")),ref=doneOf(/TRI.*(refresher|refresco)|(refresher|refresco).*TRI/i),aoc=doneOf(/TRI.*(evaluaci|assessment|AoC)|(evaluaci|assessment).*TRI/i);
    const n=(ses.length>0?1:0)+(inP(ref)?1:0)+(inP(aoc)?1:0);
    triH=`<div class="ckl">${ck(ses.length>0,`Sesión de simulador de ${hm0(cfg.insMin)} h o más como instructor`,`${ses.length} en el periodo${ses.length?` · última ${fmtD(ses[ses.length-1].d)}`:""}`)}${ck(inP(ref),"Refresher de TRI",ref?`hecho ${fmtD(ref)}`:"añade “TRI · refresher” con la fecha en Caducidades")}${ck(inP(aoc),"Evaluación de competencia",aoc?`hecha ${fmtD(aoc)}`:"añade “TRI · evaluación de competencia” en Caducidades")}</div>
      <div class="row"><span class="chip ${n>=2?"ok":"w"}">${n} de 3</span><span class="note">FCL.940.TRI: cumplir 2 de los 3 dentro de la validez (${fmtD(p0)} – ${fmtD(cTRI.d)}); en revalidaciones alternas, una debe ser la evaluación de competencia.</span></div>`}
  if(cTRE){const p0=addDays(cTRE.d,-365*3),yrs=[0,1,2].map(i=>[addDays(cTRE.d,-365*(3-i)),addDays(cTRE.d,-365*(2-i))]),td=today();
    const chk=exa.filter(s=>s.d>p0&&s.d<=cTRE.d),ref=doneOf(/TRE.*(refresher|refresco)|(refresher|refresco).*TRE|examiner refresher/i),obs=doneOf(/inspector|observad|senior examiner/i),lastY=yrs[2];
    treH=`<div class="ckl">${yrs.map(([a,b],i)=>{const n=chk.filter(s=>s.d>a&&s.d<=b).length,fut=a>td;return ck(n>=2,`Año ${i+1} de validez: ${n} chequeos`,`${fmtD(addDays(a,1))} – ${fmtD(b)}${fut?" · aún no ha empezado":a<=td&&b>=td?" · en curso":""}`)}).join("")}
      ${ck(!!(ref&&ref>lastY[0]&&ref<=lastY[1]),"Refresher de examinador en el último año",ref?`hecho ${fmtD(ref)}`:"añade “TRE · refresher” en Caducidades")}${ck(!!(obs&&obs>lastY[0]&&obs<=lastY[1]),"Un chequeo observado por inspector o senior examiner en el último año",obs?`hecho ${fmtD(obs)}`:"añade “TRE · chequeo observado por inspector” en Caducidades")}</div>
      <p class="note">FCL.1025(b): al menos 2 skill tests, chequeos o evaluaciones de competencia cada año de validez, refresher de examinador y un chequeo observado en el último año. Comprueba los requisitos vigentes y los de tu autoridad.</p>`}
  $("#simMaint").innerHTML=`<div class="mt"><div class="lab"><b>TRI</b>${cur(cTRI)}</div>${triH||`
      <div class="lim"><div class="lab"><span>Sesiones como instructor de ${hm0(cfg.insMin)} h o más · 12 meses</span><span class="mono">${ins.filter(s=>s.d>=since12&&(+s.tot||0)>=cfg.insMin).length} / ${cfg.insGoal}</span></div></div>`}</div>
    <div class="mt"><div class="lab"><b>TRE</b>${cur(cTRE)}</div>${treH||`
      <div class="lim"><div class="lab"><span>Chequeos realizados · 12 meses</span><span class="mono">${checks12.length} / ${cfg.chkGoal}</span></div></div>`}</div>`;
  // mis chequeos
  const ownK=["OPC","LPC","EBT EVAL","Skill test","Recurrente"].map(k=>[k,own.filter(s=>s.kind===k).slice(-1)[0]]).filter(x=>x[1]);
  const ownC=C.filter(c=>/OPC|LPC|EBT|tipo|line check/i.test(c.name)).sort((a,b)=>a.d.localeCompare(b.d));
  $("#simOwn").innerHTML=(ownK.length?`<div class="types">${ownK.map(([k,s])=>`<div><span>Último ${k}</span><span class="mono">${fmtD(s.d)}</span></div>`).join("")}</div>`:`<p class="note">Registra tus propios OPC, LPC o módulos EBT con rol “Alumno PF/PM”: la app te propone actualizar su caducidad.</p>`)+
    (ownC.length?`<div class="curlist" style="margin-top:8px">${ownC.map(c=>{const st=curState(c);return `<div class="cur"><span class="chip ${st.cls}">${st.txt}</span><span class="cur-n">${esc(c.name)}</span><span class="mono">${fmtD(c.d)}</span></div>`}).join("")}</div>`:"");
  // próximas
  const P=live("p").filter(p=>p.sim&&p.d>=addDays(td,-7)).sort((a,b)=>(a.d+(a.std||"")).localeCompare(b.d+(b.std||"")));
  $("#simNext").innerHTML=(P.length?P.slice(0,8).map(p=>`<div class="pl${p.d===td?" today":""}${p.d<td?" past":""}"><span class="pl-d">${p.d===td?"Hoy":fmtD(p.d)}</span><span class="pl-r">${esc(p.note||"Sesión")}</span><span class="pl-t mono">${p.std||""}${p.sta?"–"+p.sta:""}</span><span class="spacer"></span><button class="btn sm pri" data-sreg="${p.id}">Registrar</button><button class="btn sm" data-pdel2="${p.id}" aria-label="Quitar">✕</button></div>`).join(""):`<p class="note">Sin sesiones programadas. Llegan desde el roster (Importar) o añádelas aquí.</p>`)+
    `<div class="row snew"><input type="date" id="snD" aria-label="Fecha"><input type="time" id="snT" aria-label="Hora"><input id="snN" placeholder="EBT M5 EVAL…" aria-label="Sesión"><button class="btn sm" id="snAdd">Programar</button></div>`;
  $("#snAdd").onclick=()=>{const d=$("#snD").value;if(!d){toast("Pon la fecha.");return}putRec("p",{id:uid(),d,sim:true,std:$("#snT").value,sta:"",note:$("#snN").value.trim(),flt:"",dp:"",ap:""});toast("Sesión programada")};
  // gráficos
  const months=[];{let [yy,mm]=td.slice(0,7).split("-").map(Number);for(let i=23;i>=0;i--){let m=mm-i,yr=yy;while(m<1){m+=12;yr--}months.push(yr+"-"+String(m).padStart(2,"0"))}}
  stackBars($("#simMonths"),months.map(k=>{const L=S.filter(s=>s.d.startsWith(k));return {label:MES[+k.slice(5)-1]+(k.endsWith("-01")?" "+k.slice(2,4):""),parts:[sumT(L.filter(s=>roleGroup(s.role)==="ins")),sumT(L.filter(s=>roleGroup(s.role)==="exa")),sumT(L.filter(s=>["own","oth"].includes(roleGroup(s.role))))],k}}),["Instructor","Examinador","Propias"]);
  $("#simMonthsLg").innerHTML=[["c1","Instructor"],["c2","Examinador"],["c3","Propias"]].map(([c,l])=>`<span><i class="${c}"></i>${l}</span>`).join("");
  const kk=count(S.filter(s=>s.kind),s=>s.kind,s=>+s.tot||0),kn=count(S.filter(s=>s.kind),s=>s.kind);
  rankList($("#simKinds"),[...kk.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>({label:k,v,sub:`${kn.get(k)} sesiones`})),{fmt:hm0});
  const dv=count(S,s=>[s.dev,s.typ].filter(Boolean).join(" · ")||"—",s=>+s.tot||0);
  rankList($("#simDevs"),[...dv.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>({label:k,v})),{fmt:hm0});
  // año a año y día de la semana
  const ys=[...new Set(S.map(s=>s.d.slice(0,4)))].sort();
  colChart($("#simYears"),ys.map(yy=>{const L=S.filter(s=>s.d.startsWith(yy));return {label:yy,v:sumT(L),tip:`<b>${yy}</b><br>${hm0(sumT(L))} h · ${L.length} sesiones`}}),{height:170,accentLast:true});
  const dw=Array(7).fill(0),dn=Array(7).fill(0);S.forEach(s=>{const i=dowOf(s.d);dw[i]+=+s.tot||0;dn[i]++});
  colChart($("#simDow"),DOW.map((l,i)=>({label:l,v:dw[i],tip:`<b>${l}</b><br>${hm0(dw[i])} h · ${dn[i]} sesiones`})),{height:170});
  renderSimList();
  const yy2=[...ys].reverse(),sel=$("#syr").value;
  $("#syr").innerHTML=`<option value="">Todos los años</option>`+yy2.map(x=>`<option${x===sel?" selected":""}>${x}</option>`).join("");
  if($("#skf").options.length<2)$("#skf").innerHTML=`<option value="">Tipo: todos</option>`+SIM_KINDS.map(k=>`<option>${k}</option>`).join("");
}
function stackBars(el,items,names){
  const W=Math.max(280,el.clientWidth||600),H=200,padL=36,padB=24,padT=10,padR=4,n=items.length,cw=(W-padL-padR)/n,bw=Math.max(3,Math.min(26,cw-3));
  const max=niceMax(Math.max(1,...items.map(i=>i.parts.reduce((a,b)=>a+b,0)))/60),y=v=>padT+(H-padT-padB)*(1-v/60/max);
  let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`;
  for(let k=0;k<=4;k++){const yy=padT+(H-padT-padB)*(1-k/4);s+=`<line x1="${padL}" x2="${W-padR}" y1="${yy}" y2="${yy}" class="grid"/><text x="${padL-6}" y="${yy+4}" class="ax" text-anchor="end">${Math.round(max*k/4)}</text>`}
  const every=Math.max(1,Math.ceil(34/cw));
  items.forEach((it,i)=>{let acc=0;const x=padL+i*cw+(cw-bw)/2;
    it.parts.forEach((v,j)=>{if(!v)return;const y0=y(acc),y1=y(acc+v);s+=`<rect x="${x}" y="${y1}" width="${bw}" height="${Math.max(1,y0-y1-1)}" rx="2" class="sk c${j+1}"/>`;acc+=v});
    s+=`<rect x="${padL+i*cw}" y="${padT}" width="${cw}" height="${H-padT-padB}" fill="transparent" data-tip="${esc(`<b>${MES[+it.k.slice(5)-1]} ${it.k.slice(0,4)}</b><br>`+names.map((nm,j)=>`${nm}: ${hm0(it.parts[j])}`).join("<br>"))}"/>`;
    if(i%every===0)s+=`<text x="${padL+i*cw+cw/2}" y="${H-7}" class="ax" text-anchor="middle">${esc(it.label)}</text>`});
  el.innerHTML=s+`<line x1="${padL}" x2="${W-padR}" y1="${H-padB}" y2="${H-padB}" class="base"/></svg>`;
}

/* ----- libro de simulador · formato EASA ----- */
const SIM_ROWS=18;
const shc=m=>+m?`<td class="h">${Math.floor(m/60)}</td><td class="m">${String(Math.round(m)%60).padStart(2,"0")}</td>`:`<td class="h"></td><td class="m"></td>`;
const shT=m=>`<td class="h">${Math.floor(m/60)}</td><td class="m">${String(Math.round(m)%60).padStart(2,"0")}</td>`;
function renderSimEasa(L,opt={}){
  const all=allS(),pages=[];for(let i=0;i<all.length;i+=SIM_ROWS)pages.push(all.slice(i,i+SIM_ROWS));
  const ids=new Set(L.map(s=>s.id)),o=owner(),sig=typeof sigPng==="function"?sigPng():"";
  const z=()=>({ins:0,exa:0,own:0,tot:0,ldg:0});let prev=z();
  const addT=(a,s)=>{const g=roleGroup(s.role),m=+s.tot||0;a[g==="ins"?"ins":g==="exa"?"exa":"own"]+=m;a.tot+=m;a.ldg+=+s.tol||0};
  let out="",shown=0;
  pages.forEach((pg,pi)=>{
    const t=z();pg.forEach(s=>addT(t,s));const cum={};for(const k in t)cum[k]=prev[k]+t[k];
    if((opt.pages?opt.pages.has(pi+1):pg.some(s=>ids.has(s.id)))&&shown<(opt.max||100)){shown++;
      const rows=[...pg];while(rows.length<SIM_ROWS)rows.push(null);
      const body=rows.map(s=>{if(!s)return `<tr><td></td><td></td><td></td><td></td><td></td>${"<td class='h'></td><td class='m'></td>".repeat(4)}<td></td><td></td></tr>`;const g=roleGroup(s.role),m=+s.tot||0;
        return `<tr class="rec" data-sid="${s.id}"><td>${fmtD(s.d)}</td><td class="l">${esc(s.typ||"")}</td><td class="l">${esc(s.dev||"")}</td><td class="l">${esc([s.kind,s.mod].filter(Boolean).join(" "))}</td><td>${esc(s.role||"")}</td>${shc(g==="ins"?m:0)}${shc(g==="exa"?m:0)}${shc(g==="own"||g==="oth"?m:0)}${shc(m)}<td>${+s.tol||""}</td><td class="l rem">${esc([s.scen,s.rem].filter(Boolean).join(" · "))}${s.inBook===false?" <i>(no col. 11)</i>":""}</td></tr>`}).join("");
      const ft=(lab,x)=>`<tr class="tt"><td colspan="5" class="lab">${lab}</td>${shT(x.ins)}${shT(x.exa)}${shT(x.own)}${shT(x.tot)}<td>${x.ldg}</td>`;
      out+=`<div class="sp-page"><div class="easa-pn">${pi+1}</div><div class="sp-k">SYNTHETIC TRAINING DEVICES SESSIONS · FCL.050</div>
        <table class="easa sp"><colgroup><col style="width:7.5%"><col style="width:8.5%"><col style="width:12%"><col style="width:11%"><col style="width:6.5%">${"<col style='width:4.3%'><col style='width:2.8%'>".repeat(4)}<col style="width:4%"><col></colgroup>
        <thead><tr class="n"><th colspan="14">11 · SYNTHETIC TRAINING DEVICES SESSION</th><th>12</th></tr>
        <tr><th rowspan="2">DATE<br><small>(dd/mm/yy)</small></th><th rowspan="2">TYPE</th><th rowspan="2">FSTD / CENTRE</th><th rowspan="2">SESSION</th><th rowspan="2">FUNCTION</th><th colspan="2">AS INSTRUCTOR</th><th colspan="2">AS EXAMINER</th><th colspan="2">TRAINEE / CREW</th><th colspan="2">TOTAL TIME OF SESSION</th><th rowspan="2">T/O<br>LDG</th><th rowspan="2">REMARKS AND ENDORSEMENTS</th></tr>
        <tr class="s"><th class="h">h</th><th class="m">min</th><th class="h">h</th><th class="m">min</th><th class="h">h</th><th class="m">min</th><th class="h">h</th><th class="m">min</th></tr></thead>
        <tbody>${body}</tbody><tfoot>${ft("TOTAL THIS PAGE",t)}<td rowspan="3" class="cert">I certify that the entries in this log are true.${sig?`<img src="${sig}" class="sig-img" alt="Firma">`:"<br><br>______________________"}<br>PILOT'S SIGNATURE${o.name?" · "+esc(o.name.toUpperCase()):""}</td></tr>${ft("TOTAL FROM PREVIOUS PAGES",prev)}</tr>${ft("TOTAL TIME",cum)}</tr></tfoot></table></div>`;
    }
    prev=cum;
  });
  if(!out)return `<p class="note">No hay páginas con sesiones para este filtro.</p>`;
  return out+(shown>=(opt.max||100)?`<p class="note">Se muestran 100 páginas como máximo; filtra por año para ver el resto.</p>`:"");
}
$("#sq").addEventListener("input",renderSimList);
["#syr","#sgrp","#skf"].forEach(s=>$(s).addEventListener("change",renderSimList));
$("#simNext").addEventListener("click",e=>{
  const r=e.target.closest("[data-sreg]"),x=e.target.closest("[data-pdel2]");
  if(r){const p=live("p").find(q=>q.id===r.dataset.sreg);if(!p)return;const nt=(p.note||"").toUpperCase(),k=SIM_KINDS.find(k=>k.toUpperCase().replace(/[()]/g,"").split(" ").every(w=>nt.includes(w)));const dur=p.std&&p.sta?block(p.std,p.sta):0;
    openSim(null,{d:p.d,kind:k||"",role:["EBT EVAL","LPC","OPC","Skill test"].includes(k)?"TRE":"TRI",rem:p.note||"",tot:dur||240,planId:p.id,mod:((p.note||"").match(/\bM\d\b|\bS\d{1,2}\b/i)||[""])[0].toUpperCase()})}
  if(x)removeRec("p",x.dataset.pdel2);
});
// ajustes del instructor
function renderSimCfg(){const c=simCfg();$("#scChecks").innerHTML=SIM_KINDS.map(k=>`<label class="chk"><input type="checkbox" value="${k}"${c.checks.includes(k)?" checked":""}> ${k}</label>`).join("");$("#scChk").value=c.chkGoal;$("#scIns").value=c.insGoal;$("#scInsMin").value=hm(c.insMin);$("#scBook").checked=c.book}
$("#scSave").onclick=()=>{ls.set("lb_simcfg",{checks:[...$$("#scChecks input:checked")].map(i=>i.value),chkGoal:+$("#scChk").value||0,insGoal:+$("#scIns").value||0,insMin:toMin($("#scInsMin").value)||180,book:$("#scBook").checked});toast("Guardado");renderSims()};

/* ================= VISTAS: TABLA / PÁGINA EASA E IMPRESIÓN ================= */
let flView=ls.get("lb_flview","table"),flLimit=200,bookPage=null;
const roleTxt=f=>f.fpic?"PIC":f.fcop?"Copiloto":f.finst?"Instructor":f.fdual?"Dual":"";
const narrow=()=>matchMedia("(max-width:640px)").matches;
function flCardsHTML(L,limit){
  const rows=L.slice(0,limit),t=sum(L);
  return `<div class="mlist">${rows.map(f=>{const ldg=(+f.ldd||0)+(+f.ldn||0);const info=[f.dt&&f.at?`${f.dt}–${f.at}`:"",f.typ,f.reg,roleTxt(f),ldg?ldg+" LDG":"",+f.night?"noche "+hm(f.night):""].filter(Boolean);
    return `<div class="mrow" data-id="${f.id}" role="button" tabindex="0"><div class="m1"><span class="md">${fmtD(f.d)}</span><span class="mr">${esc(f.dp)}<i>→</i>${esc(f.ap)}</span><b>${hm(f.tot)}</b></div><div class="m2">${info.map(esc).join(" · ")}</div>${f.rem?`<div class="m3">${esc(f.rem)}</div>`:""}</div>`}).join("")}</div><div class="mfoot">${L.length} vuelos · ${hm0(t.tot)} h · ${t.ldd+t.ldn} LDG</div>`;
}
function flTableHTML(L,{click=true,limit=Infinity}={}){
  if(click&&narrow())return flCardsHTML(L,limit);
  const rows=L.slice(0,limit),t=sum(L);
  return `<table class="tb"><thead><tr><th>Fecha</th><th>Salida</th><th>OUT</th><th>Llegada</th><th>IN</th><th>Tipo</th><th>Matrícula</th><th>Total</th><th>Función</th><th>PIC</th><th>Noche</th><th>IFR</th><th>T/O</th><th>LDG</th><th>Observaciones</th></tr></thead><tbody>
  ${rows.map(f=>`<tr${click?` class="rec" data-id="${f.id}"`:""}><td>${fmtD(f.d)}</td><td>${esc(f.dp)}</td><td>${esc(f.dt)}</td><td>${esc(f.ap)}</td><td>${esc(f.at)}</td><td class="l">${esc(f.typ)}</td><td>${esc(f.reg)}</td><td><b>${hm(f.tot)}</b></td><td>${roleTxt(f)}</td><td class="l">${esc(f.pic)}</td><td>${hm(f.night)}</td><td>${hm(f.ifr)}</td><td>${(+f.tod||0)+(+f.ton||0)||""}</td><td>${(+f.ldd||0)+(+f.ldn||0)||""}</td><td class="l rem">${esc(f.rem)}</td></tr>`).join("")}</tbody>
  <tfoot><tr><td colspan="7" class="lab">${L.length} vuelos</td><td>${hm0(t.tot)}</td><td colspan="2"></td><td>${hm0(t.night)}</td><td>${hm0(t.ifr)}</td><td>${t.tod+t.ton}</td><td>${t.ldd+t.ldn}</td><td></td></tr></tfoot></table>`;
}
function renderLog(){
  const all=allF(),list=filtered(),isF=list.length!==all.length;
  $$("#flViewSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.fv===flView));
  $("#flTableWrap").hidden=flView!=="table";$("#flPageWrap").hidden=flView!=="page";
  $("#pInfo").textContent=list.length?`${list.length} vuelos${isF?" (filtrados)":""} · ${hm0(sum(list).tot)} h`:(isF?"Ningún vuelo con ese filtro.":"Aún no hay vuelos: importa tu histórico (Importar) o añade uno con + Vuelo.");
  if(flView==="table"){
    const L=[...list].reverse();
    $("#flTable").innerHTML=L.length?flTableHTML(L,{limit:flLimit}):"";
    $("#flMore").hidden=L.length<=flLimit;$("#flMore").textContent=`Mostrar más (${Math.min(200,L.length-flLimit)} de ${L.length-flLimit} restantes)`;
  }else{
    const pages=easaPages(),n=Math.max(1,pages.length);
    if(bookPage==null||bookPage>n)bookPage=n;
    $("#bTot").textContent=n;$("#bNum").value=bookPage;
    if(!pages.length){$("#flPage").innerHTML=`<p class="note">El libro está vacío.</p>`;return}
    easaRender(["1900-01-01","2999-12-31"],{pages:new Set([bookPage]),onlyLocked:false}).then(h=>{if(flView==="page")$("#flPage").innerHTML=h});
  }
  const ys=[...new Set(all.map(f=>f.d.slice(0,4)))].sort().reverse(),sel=$("#yr").value;
  $("#yr").innerHTML=`<option value="">Todos los años</option>`+ys.map(y=>`<option${y===sel?" selected":""}>${y}</option>`).join("");
}
$("#flViewSeg").addEventListener("click",e=>{const b=e.target.closest("[data-fv]");if(!b)return;flView=b.dataset.fv;ls.set("lb_flview",flView);renderLog()});
$("#flMore").onclick=()=>{flLimit+=200;renderLog()};
$("#bPrev").onclick=()=>{bookPage=Math.max(1,(bookPage||1)-1);renderLog()};
$("#bNext").onclick=()=>{bookPage=(bookPage||1)+1;renderLog()};
$("#bNum").addEventListener("change",e=>{bookPage=Math.max(1,parseInt(e.target.value)||1);renderLog()});
$("#bDate").addEventListener("change",e=>{const d=e.target.value;if(!d)return;const pages=easaPages();let i=pages.findIndex(pg=>pg[pg.length-1].d>=d);if(i<0)i=pages.length-1;bookPage=i+1;renderLog()});
["#q","#yr"].forEach(s=>$(s).addEventListener(s==="#q"?"input":"change",()=>{flLimit=200}));

/* ----- simulador ----- */
let simView=ls.get("lb_simview2","table"),simPage=null,simLimit=200;
function simTableHTML(L,{click=true,limit=Infinity}={}){
  const rows=L.slice(0,limit),T=L.reduce((a,s)=>a+(+s.tot||0),0),by=g=>L.filter(s=>roleGroup(s.role)===g).reduce((a,s)=>a+(+s.tot||0),0);
  if(click&&narrow())return `<div class="mlist">${rows.map(s=>{const info=[s.typ,s.dev,s.role,+s.tol?s.tol+" T/O-LDG":"",s.inBook===false?"fuera del libro":""].filter(Boolean);
    return `<div class="mrow" data-sid="${s.id}" role="button" tabindex="0"><div class="m1"><span class="md">${fmtD(s.d)}</span><span class="mr">${esc([s.kind,s.mod].filter(Boolean).join(" ")||"Sesión")}</span><b>${hm(s.tot)}</b></div><div class="m2">${info.map(esc).join(" · ")}</div>${s.scen||s.rem?`<div class="m3">${esc([s.scen,s.rem].filter(Boolean).join(" · "))}</div>`:""}</div>`}).join("")}</div><div class="mfoot">${L.length} sesiones · ${hm0(T)} h · instructor ${hm0(by("ins"))} · examinador ${hm0(by("exa"))}</div>`;
  return `<table class="tb"><thead><tr><th>Fecha</th><th>Tipo FSTD</th><th>Centro / dispositivo</th><th>Sesión</th><th>Rol</th><th>Tiempo</th><th>T/O-LDG</th><th>Aprox.</th><th>Col. 11</th><th>Escenario y observaciones</th></tr></thead><tbody>
  ${rows.map(s=>`<tr${click?` class="rec" data-sid="${s.id}"`:""}><td>${fmtD(s.d)}</td><td class="l">${esc(s.typ)}</td><td class="l">${esc(s.dev||"")}</td><td class="l">${esc([s.kind,s.mod].filter(Boolean).join(" "))}</td><td>${esc(s.role)}</td><td><b>${hm(s.tot)}</b></td><td>${+s.tol||""}</td><td>${+s.app||""}</td><td>${s.inBook===false?"No":"Sí"}</td><td class="l rem">${esc([s.scen,s.rem].filter(Boolean).join(" · "))}</td></tr>`).join("")}</tbody>
  <tfoot><tr><td colspan="5" class="lab">${L.length} sesiones · instructor ${hm0(by("ins"))} · examinador ${hm0(by("exa"))} · propias ${hm0(by("own")+by("oth"))}</td><td>${hm0(T)}</td><td colspan="4"></td></tr></tfoot></table>`;
}
function simPages(){const all=allS(),p=[];for(let i=0;i<all.length;i+=SIM_ROWS)p.push(all.slice(i,i+SIM_ROWS));return p}
function renderSimList(){
  const L=simFiltered(),el=$("#simList");
  $$("#simViewSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.sv===simView));
  $("#simPager").hidden=simView!=="page";
  $("#simCount").textContent=`${L.length} sesiones · ${hm0(L.reduce((a,s)=>a+(+s.tot||0),0))} h`;
  if(simView==="table"){
    if(!L.length){el.innerHTML=`<div class="empty"><strong>Sin sesiones${$("#sq").value||$("#syr").value||$("#sgrp").value||$("#skf").value?" con ese filtro":""}</strong><span>Pulsa “+ Sesión” o usa una plantilla.</span></div>`;return}
    const R=[...L].reverse();
    el.innerHTML=`<div class="tbwrap">${simTableHTML(R,{limit:simLimit})}</div>`+(R.length>simLimit?`<button class="btn" id="simMore">Mostrar más (${R.length-simLimit} restantes)</button>`:"");
    $("#simMore")&&($("#simMore").onclick=()=>{simLimit+=200;renderSimList()});return;
  }
  const pages=simPages(),n=Math.max(1,pages.length);
  if(simPage==null||simPage>n)simPage=n;$("#spTot").textContent=n;$("#spNum").value=simPage;
  el.innerHTML=pages.length?renderSimEasa(allS(),{pages:new Set([simPage])}):`<p class="note">El libro de simulador está vacío.</p>`;
}
$("#simViewSeg").addEventListener("click",e=>{const b=e.target.closest("[data-sv]");if(!b)return;simView=b.dataset.sv;ls.set("lb_simview2",simView);renderSimList()});
$("#spPrev").onclick=()=>{simPage=Math.max(1,(simPage||1)-1);renderSimList()};
$("#spNext").onclick=()=>{simPage=(simPage||1)+1;renderSimList()};
$("#spNum").addEventListener("change",e=>{simPage=Math.max(1,parseInt(e.target.value)||1);renderSimList()});
$("#spDate").addEventListener("change",e=>{const d=e.target.value;if(!d)return;const pages=simPages();let i=pages.findIndex(pg=>pg[pg.length-1].d>=d);if(i<0)i=pages.length-1;simPage=i+1;renderSimList()});

/* ----- diálogo de impresión ----- */
let prCtx="fl";
const PR_WHAT={fl:[["book","Libro EASA completo (vuelos + simulador col. 11), doble página"],["table","Tabla de vuelos"]],sim:[["simbook","Libro de simulador · formato EASA"],["simtable","Tabla de sesiones de simulador"]]};
function openPrint(ctx){
  prCtx=ctx;$("#prWhat").innerHTML=PR_WHAT[ctx].map(([v,l])=>`<option value="${v}">${l}</option>`).join("");
  $("#prWhat").value=ctx==="fl"?(flView==="page"?"book":"table"):(simView==="page"?"simbook":"simtable");
  const n=ctx==="fl"?easaPages().length:simPages().length,cur=ctx==="fl"?(bookPage||n):(simPage||n);
  $("#prP1").value=1;$("#prP2").value=n;$("#prCurN").textContent=cur;
  const yr=today().slice(0,4);$("#prD1").value=yr+"-01-01";$("#prD2").value=today();
  const isBook=$("#prWhat").value.endsWith("book");$(`#prScope input[value="${isBook?((ctx==="fl"?flView:simView)==="page"?"cur":"all"):"filter"}"]`).checked=true;
  prUI();$("#prDlg").hidden=false;
}
function prUI(){
  const w=$("#prWhat").value,isBook=w==="book"||w==="simbook";
  $$('#prScope [data-book]').forEach(l=>l.hidden=!isBook);$$('#prScope [data-tab]').forEach(l=>l.hidden=isBook);
  const sc=$('#prScope input:checked');if(sc&&sc.closest("label").hidden){$(isBook?'#prScope input[value="all"]':'#prScope input[value="filter"]').checked=true}
  const s=$('#prScope input:checked').value;$("#prPages").hidden=s!=="pages";$("#prDates").hidden=s!=="dates";
  $("#prSum").textContent=prSummary();
}
function prSel(){
  const w=$("#prWhat").value,s=$('#prScope input:checked').value,isBook=w==="book"||w==="simbook";
  const pages=w==="book"?easaPages():w==="simbook"?simPages():null;
  if(isBook){
    const n=pages.length;let set=new Set();
    if(s==="all")for(let i=1;i<=n;i++)set.add(i);
    else if(s==="cur"&&n)set.add(Math.min(n,w==="book"?(bookPage||n):(simPage||n)));
    else if(s==="pages"){const a=Math.max(1,+$("#prP1").value||1),b=Math.min(n,+$("#prP2").value||n);for(let i=a;i<=b;i++)set.add(i)}
    else if(s==="dates"){const d1=$("#prD1").value||"1900-01-01",d2=$("#prD2").value||"2999-12-31";pages.forEach((pg,i)=>{if(pg.some(e=>e.d>=d1&&e.d<=d2))set.add(i+1)})}
    return {w,set,n};
  }
  let L=w==="table"?(s==="filter"?filtered():allF()):(s==="filter"?simFiltered():allS());
  if(s==="dates"){const d1=$("#prD1").value||"1900-01-01",d2=$("#prD2").value||"2999-12-31";L=(w==="table"?allF():allS()).filter(x=>x.d>=d1&&x.d<=d2)}
  return {w,L};
}
function prSummary(){const x=prSel();if(x.set)return x.set.size?`Se imprimirán ${x.set.size} ${x.set.size===1?"página":"páginas"} del libro (${x.w==="book"?"cada página en dos hojas A4 apaisadas: columnas 1–8 y 9–12":"una hoja A4 apaisada por página"}).`:"No hay páginas en esa selección.";return `Se imprimirán ${x.L.length} ${x.w==="table"?"vuelos":"sesiones"} en tabla.`}
["#prWhat","#prP1","#prP2","#prD1","#prD2"].forEach(s=>$(s).addEventListener("input",prUI));
$("#prScope").addEventListener("change",prUI);
$("#prGo").onclick=async()=>{
  const x=prSel(),o=owner();let h="";
  const head=(t,sub)=>`<div class="pr-head"><div><div class="rp-k">Pilot Logbook · EASA FCL.050</div><h2>${t}</h2><div class="note">${esc(sub)}</div></div><div class="rp-who"><b>${esc(o.name||"")}</b>${o.lic?`<br>Licencia ${esc(o.lic)}`:""}<br><span class="note">Impreso ${fmtD(today())}</span></div></div>`;
  if(x.set&&!x.set.size){toast("No hay páginas en esa selección.");return}
  if(x.w==="book")h=await easaRender(["1900-01-01","2999-12-31"],{pages:x.set,onlyLocked:false,max:5000});
  else if(x.w==="simbook")h=renderSimEasa(allS(),{pages:x.set,max:5000});
  else if(x.w==="table"){const L=[...x.L];h=head("Vuelos",L.length?`${fmtD(L[0].d)} – ${fmtD(L[L.length-1].d)}`:"")+flTableHTML(L,{click:false})+signLine()}
  else{const L=[...x.L];h=head("Sesiones de simulador",L.length?`${fmtD(L[0].d)} – ${fmtD(L[L.length-1].d)}`:"")+simTableHTML(L,{click:false})+signLine()}
  const area=$("#printArea");area.innerHTML=h;area.className="pa-"+x.w;
  $("#prDlg").hidden=true;document.body.classList.add("printing-area");
  setTimeout(()=>{try{window.print()}catch{}setTimeout(()=>{document.body.classList.remove("printing-area");area.innerHTML=""},300)},80);
};
$("#flPrint").onclick=()=>openPrint("fl");$("#simPrint").onclick=()=>openPrint("sim");

$("#cvRange").addEventListener("click",e=>{const b=e.target.closest("button[data-cr]");if(!b)return;cvRange=b.dataset.cr;ls.set("lb_cvrange",cvRange);renderCover()});
$("#cvYear").addEventListener("change",e=>{if(!e.target.value)return;cvRange="y:"+e.target.value;ls.set("lb_cvrange",cvRange);renderCover()});
/* ---------- boot ---------- */
window.LB={putRec,nightCalc,sunElev,apt,gcNm,loadApts,withNight,allF,allS,render:()=>render(),live};
$("#verNote").textContent="Versión "+APP_VERSION+" · funciona sin conexión; los cambios se suben al recuperar red.";
$("#file").setAttribute("accept",".xlsx,.xls,.csv,.pdf,.json");
const _render=render;render=function(){CUST=null;_render();setSync();renderCur();renderApts();renderPlanned();renderSig();renderCover();renderStats();renderReport()};
go(ls.get("lb_view","sum"));
try{localStorage.setItem("lb_skin",JSON.stringify("libro"))}catch{}applySkin("libro",ls.get("lb_mode","auto"));applyFlMode(ls.get("lb_flmode","table"));renderLook();
$("#repMin").value=REPORT_MIN();$("#repMinSave").onclick=()=>{ls.set("lb_report",Math.max(0,+$("#repMin").value||60));toast("Guardado");renderStats()};
renderSimCfg();
render();renderAiKey();renderOwner();renderOpen();renderGoal();connectCloud();
setTimeout(()=>loadApts(),400);
if("serviceWorker" in navigator&&location.protocol!=="file:"){
  navigator.serviceWorker.register("sw.js").then(reg=>{
    reg.addEventListener("updatefound",()=>{const w=reg.installing;w&&w.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller)toast("Nueva versión lista: cierra y abre la app.")})});
  }).catch(()=>{});
}
})();
