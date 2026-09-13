const root=document.querySelector('#app');
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const money=v=>new Intl.NumberFormat('ru-RU').format(v)+' ₽';

const inventory={
  shelf:Array.from({length:18},(_,i)=>({id:`S-${i+1}`,name:['Полка Oak Line','Полка Graphite','Полка White Arc'][i%3]+` ${i+1}`,price:6900+i*310,relevance:.99-i*.01,slot:'shelf'})),
  vase:Array.from({length:36},(_,i)=>({id:`V-${i+1}`,name:['Ваза Sand','Ваза Glass','Ваза Stone'][i%3]+` ${i+1}`,price:1900+i*120,relevance:.99-i*.006,slot:'vase'})),
  book:Array.from({length:54},(_,i)=>({id:`B-${i+1}`,name:['Книга Art Objects','Книга Architecture','Книга Nordic Home'][i%3]+` ${i+1}`,price:900+i*65,relevance:.99-i*.004,slot:'book'})),
  headlight:Array.from({length:24},(_,i)=>({id:`H-${i+1}`,name:`Фара правая Focus III ${i+1}`,price:15400+i*470,relevance:.99-i*.009,slot:'headlight'})),
  chair:Array.from({length:28},(_,i)=>({id:`C-${i+1}`,name:`Кресло ${['Oslo','Loft','Nord'][i%3]} ${i+1}`,price:24900+i*390,relevance:.99-i*.007,slot:'chair'})),
  monitor:Array.from({length:30},(_,i)=>({id:`M-${i+1}`,name:`Монитор ${27+(i%3)*2}” 4K ${i+1}`,price:38900+i*520,relevance:.99-i*.007,slot:'monitor'}))
};

const presets={
  composition:{category:'home',slots:[
    {id:'shelf',label:'Полка',anchor:{x:46,y:48},relation:'wall'},
    {id:'vase',label:'Ваза',anchor:{x:40,y:38},relation:'on:shelf'},
    {id:'book',label:'Книга',anchor:{x:55,y:40},relation:'on:shelf'}
  ]},
  auto:{category:'auto',slots:[{id:'headlight',label:'Фара',anchor:{x:50,y:49},relation:'vehicle'}]},
  chair:{category:'home',slots:[{id:'chair',label:'Кресло',anchor:{x:50,y:58},relation:'floor'}]},
  tech:{category:'tech',slots:[{id:'monitor',label:'Монитор',anchor:{x:50,y:46},relation:'desk'}]}
};

let state={camera:false,clean:false,query:'',category:'home',stream:null,listening:false,catalogOpen:false,activeSlot:null,slots:[]};

function buildSlots(preset){state.category=preset.category;state.slots=preset.slots.map(s=>({...s,selected:inventory[s.id]?.[0]||null}));state.activeSlot=state.slots[0]?.id||null;}
buildSlots(presets.chair);
function slot(id){return state.slots.find(s=>s.id===id)}
function variants(id){return inventory[id]||[]}
function sceneObjects(){return state.slots.map((s,i)=>s.selected?`<button class="scene-slot scene-slot-${s.id}" style="--x:${s.anchor.x}%;--y:${s.anchor.y}%" data-a="slot" data-slot="${s.id}"><span class="scene-slot-label">${esc(s.label)}</span><b>${esc(s.selected.name)}</b><small>${variants(s.id).length} вариантов</small></button>`:'').join('')}
function slotTabs(){return state.slots.map(s=>`<button class="slot-tab ${state.activeSlot===s.id?'active':''}" data-a="slot" data-slot="${s.id}"><b>${esc(s.label)}</b><span>${esc(s.selected?.name||'не выбран')}</span></button>`).join('')}
function productCard(p,i){const s=slot(p.slot);return `<button class="product-card ${s?.selected?.id===p.id?'selected':''}" data-a="replace" data-slot="${p.slot}" data-id="${p.id}"><span class="product-rank">${String(i+1).padStart(2,'0')}</span><b>${esc(p.name)}</b><small>${Math.round(p.relevance*100)}% · ${money(p.price)}</small></button>`}
function draw(){const active=slot(state.activeSlot),list=active?variants(active.id):[];root.innerHTML=`<main class="mkt"><header class="mkt-head"><div class="mkt-brand">EINEIRO <span>market</span></div><div class="mkt-status">${state.camera?'LIVE CAMERA':'READY'}</div></header><section class="mkt-stage ${state.clean?'clean':''}"><div class="mkt-scene"><video id="camera" autoplay playsinline muted></video><div class="scene-fallback scene-${state.category}"></div><div class="scan-lines"></div><div class="safe-zone"></div>${sceneObjects()}<div class="intent"><b>${state.query?esc(state.query):'Покажи, что хочешь'}</b><span>${state.query?`${state.slots.length} объекта в сцене · у каждого свой каталог вариантов`:'Камера и голос — основной интерфейс запроса'}</span></div></div><div class="mkt-controls"><button data-a="fav">♡</button><button class="camera-main ${state.camera?'on':''}" data-a="camera">◎</button><button data-a="voice">${state.listening?'●':'◉'}</button></div>${state.camera&&state.slots.length?`<div class="slot-dock">${slotTabs()}<button class="catalog-toggle" data-a="catalog">Варианты</button></div>`:''}${state.catalogOpen&&active?`<aside class="catalog-drawer"><div class="catalog-head"><div><b>${esc(active.label)} — варианты</b><span>${list.length} релевантных товаров · выбор меняет только этот объект</span></div><button data-a="catalog">×</button></div><div class="catalog-grid">${list.map(productCard).join('')}</div></aside>`:''}<div class="mkt-side"><button data-a="clean">${state.clean?'Показать UI':'Clean View'}</button><button data-a="demo">Демо: полка + ваза + книга</button></div></section></main>`;if(state.camera&&state.stream){const v=$('#camera');v.srcObject=state.stream}}

async function camera(){if(state.camera){state.stream?.getTracks().forEach(t=>t.stop());state.stream=null;state.camera=false;state.catalogOpen=false;draw();return}try{state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});state.camera=true;draw()}catch{state.camera=true;draw()}}
function applyVoiceQuery(q){const text=q.toLowerCase();state.query=q;if(text.includes('полк')&&(text.includes('ваз')||text.includes('книг'))){buildSlots(presets.composition)}else if(text.includes('фар')){buildSlots(presets.auto)}else if(text.includes('монитор')){buildSlots(presets.tech)}else{buildSlots(presets.chair)}state.camera=true;state.catalogOpen=false;draw()}
function voice(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){applyVoiceQuery('Нужна полка, на которой стоит ваза и книга');return}const r=new SR();r.lang='ru-RU';r.interimResults=false;r.onstart=()=>{state.listening=true;draw()};r.onresult=e=>{state.listening=false;applyVoiceQuery(e.results[0][0].transcript)};r.onerror=()=>{state.listening=false;draw()};r.onend=()=>{state.listening=false;draw()};r.start()}

root.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;if(a==='camera')camera();if(a==='voice')voice();if(a==='clean'){state.clean=!state.clean;draw()}if(a==='slot'){state.activeSlot=b.dataset.slot;state.catalogOpen=true;draw()}if(a==='catalog'){state.catalogOpen=!state.catalogOpen;draw()}if(a==='replace'){const s=slot(b.dataset.slot);const p=variants(b.dataset.slot).find(x=>x.id===b.dataset.id);if(s&&p){s.selected=p;state.activeSlot=s.id;state.catalogOpen=false;draw()}}if(a==='demo'){state.query='Полка, на которой стоит ваза и книга';buildSlots(presets.composition);state.camera=true;state.catalogOpen=false;draw()}});
draw();
