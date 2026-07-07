const { chromium } = require('playwright');
const mock=`
window.__tables={glas_touren:[],glas_stopps:[],glas_objekte:[],glas_objekt_positionen:[],glas_positionen:[],kunden:[{id:'k1',name:'FH Südwestfalen',adresse:'Baarstr 6\\n58636 Iserlohn',kdnr:'900',bereich:'glas'}],glas_termine:[],glas_einstellungen:[{id:'default'}],glas_mitarbeiter:[],glas_urlaub:[],kategorien:[],scheine:[]};
window.__tables.glas_objekte.push({id:'o1',kunde_id:'k1',kunde_name:'FH',name:'Haldener Str. 182',adresse:'Haldener Str. 182\\n58636 Iserlohn',template:'geko',lat:51.4,lng:7.2});
window.__tables.glas_objekte.push({id:'o2',kunde_id:'k1',kunde_name:'FH',name:'Im Alten Holz 131',adresse:'Im Alten Holz 131\\n58636 Iserlohn',template:'geko',lat:51.5,lng:7.3});
window.__tables.glas_objekt_positionen.push({id:'p1',objekt_id:'o1',nr:'10',art:'Glas- und Rahmenreinigung',qm:'120',intervall_typ:'feste_monate',feste_monate:'1',reihenfolge:0});
window.__tables.glas_objekt_positionen.push({id:'p2',objekt_id:'o2',nr:'10',art:'Glas- und Rahmenreinigung',qm:'340',intervall_typ:'feste_monate',feste_monate:'12',reihenfolge:0});
function mt(n){function r(){return window.__tables[n]||(window.__tables[n]=[]);}return{select(s){let x=r().slice();const wj=typeof s==='string'&&s.includes('glas_stopps(');const b={eq(c,v){x=x.filter(y=>y[c]===v);return b;},in(){return b;},order(){return b;},limit(){return b;},then(z){let o=x.map(y=>({...y}));if(wj&&n==='glas_touren')o=o.map(t=>({...t,glas_stopps:[]}));z({data:o,error:null});}};return b;},update(){return{eq(){return Promise.resolve({error:null});}};},upsert(){return Promise.resolve({error:null});},insert(){return Promise.resolve({error:null});},delete(){return{eq(){return Promise.resolve({error:null});}};}};}
window.supabase={createClient:()=>({from:mt,functions:{invoke:()=>Promise.resolve({})}})};
window.fetch=async()=>({ok:true,json:async()=>[]});window.jspdf={jsPDF:class{}};window.SignaturePad=class{isEmpty(){return true;}};
`;
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const results=[];const check=(n,c)=>results.push({n,ok:!!c});
// Desktop + Handy testen
for (const vp of [{w:1200,h:950,name:'Desktop'},{w:390,h:844,name:'Handy'}]) {
  const p=await b.newPage({viewport:{width:vp.w,height:vp.h}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(mock);await p.goto('http://localhost:8120/glas-admin.html',{waitUntil:'load'});await p.waitForTimeout(700);
  // Kunden-Hauptseite
  await p.evaluate(()=>goGlasTab('kunden'));await p.waitForTimeout(400);
  let t=await p.evaluate(()=>document.getElementById('view').innerText);
  check(vp.name+': Kunden-Kennzahlen (Kunden/Objekte)', t.includes('Kunden')&&t.includes('Objekte'));
  check(vp.name+': Kunde-Karte zeigt Objekt-Anzahl', /2 Objekte/.test(t));
  // Kunde-Detail -> Karten
  await p.evaluate(()=>goGlasKunde('k1'));await p.waitForTimeout(400);
  t=await p.evaluate(()=>document.getElementById('view').innerText);
  const cards=await p.evaluate(()=>document.querySelectorAll('.glas-objekt-card').length);
  const tiles=await p.evaluate(()=>document.querySelectorAll('.glas-stat-tile').length);
  check(vp.name+': Kunde-Detail hat 2 Objekt-Karten', cards===2);
  check(vp.name+': Kunde-Detail Kennzahlen (4 Kacheln)', tiles===4);
  check(vp.name+': Karte zeigt qm', t.includes('120 qm')||t.includes('qm'));
  // Handy: Karten nicht breiter als Viewport (kein horizontales Scrollen)
  if (vp.name==='Handy') {
    const overflow=await p.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth + 2);
    check('Handy: KEIN horizontales Überlaufen', !overflow);
    const cardW=await p.evaluate(()=>{const c=document.querySelector('.glas-objekt-card');return c?c.getBoundingClientRect().width:0;});
    check('Handy: Karte füllt Breite (1 Spalte, >300px)', cardW>300);
  }
  console.log(vp.name, JSON.stringify(errs.slice(0,2)));
  await p.close();
}
console.log(JSON.stringify(results));
await b.close();})();
