const KEY='eineiro-business-recovery-v1';
const defaultState={
  onboarding:{completed:false,step:0},
  dashboard:{order:['owner-state','decisions','forecast','signals','money','team'],hidden:[]},
  forecast:{horizon:30,pinned:false,text:'Спрос стабилен. Проверьте внешние сигналы и залежавшиеся позиции перед изменением закупок.'},
  externalSignals:[
    {id:'fuel',title:'Топливо и логистика',severity:'warn',detail:'Рост стоимости доставки может изменить маржу.'},
    {id:'market',title:'Рыночный спрос',severity:'good',detail:'Спрос по ликвидным категориям выше среднего.'}
  ],
  ownerReport:{status:'green',summary:'Вмешательство не требуется',aiActions:['Перераспределены просроченные лиды','Созданы складские задачи','Остановлены скидки ниже допустимой маржи'],extraSales:46000},
  notifications:[
    {id:'n1',kind:'routine',title:'Синхронизация каталога завершена'},
    {id:'n2',kind:'owner',title:'Нужно подтвердить сделку ниже лимита'}
  ]
};
function load(){try{return JSON.parse(localStorage.getItem(KEY))||structuredClone(defaultState)}catch{return structuredClone(defaultState)}}
let state=load();const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

const guide=[
  {selector:'.nav-button[data-view="dashboard"]',title:'Главная',text:'Здесь только текущее состояние и исключения, которые требуют внимания.'},
  {selector:'.nav-button[data-view="sales"]',title:'Продажи',text:'ИИ следит за скоростью ответа, качеством диалога, скидками и повторными касаниями.'},
  {selector:'.nav-button[data-view="tasks"]',title:'Задачи',text:'Задачи создаются системой и распределяются по загрузке сотрудников.'},
  {selector:'.nav-button[data-view="warehouse"]',title:'Склад',text:'Зоны, стеллажи, полки и ячейки. ИИ подсказывает, куда перенести товар.'},
  {selector:'.nav-button[data-view="analytics"]',title:'Аналитика',text:'Стратегический уровень: прогноз, сильные и слабые места, внешние сигналы и решения.'}
];

function removeGuide(){document.querySelector('#eineiro-guide')?.remove();document.documentElement.classList.remove('eineiro-guided')}
function showGuide(step=0){removeGuide();if(step>=guide.length){state.onboarding.completed=true;state.onboarding.step=guide.length;save();return}const item=guide[step];const target=document.querySelector(item.selector);if(!target)return;state.onboarding.step=step;save();const rect=target.getBoundingClientRect();const overlay=document.createElement('div');overlay.id='eineiro-guide';overlay.innerHTML=`<div class="eg-dim"></div><div class="eg-focus" style="left:${Math.max(0,rect.left-8)}px;top:${Math.max(0,rect.top-8)}px;width:${rect.width+16}px;height:${rect.height+16}px"></div><div class="eg-note" style="left:${Math.min(innerWidth-330,Math.max(16,rect.right+18))}px;top:${Math.min(innerHeight-170,Math.max(16,rect.top))}px"><b>${esc(item.title)}</b><p>${esc(item.text)}</p><div><button data-guide="skip">Пропустить</button><button data-guide="next">${step===guide.length-1?'Готово':'Дальше'}</button></div></div>`;document.body.append(overlay);document.documentElement.classList.add('eineiro-guided')}

function ensureRecoveryNav(){const nav=document.querySelector('.nav');if(!nav||nav.querySelector('[data-recovery="owner"]'))return;const b=document.createElement('button');b.className='nav-button';b.dataset.recovery='owner';b.innerHTML='<span style="width:19px;text-align:center">◎</span><span>Владелец</span>';nav.append(b)}
function root(){return document.querySelector('#view-root')}
function title(a,b){const h=document.querySelector('.top-title h1'),p=document.querySelector('.top-title p');if(h)h.textContent=a;if(p)p.textContent=b}
function ownerView(){title('Состояние бизнеса','Только существенные отклонения и решения владельца');const decisions=state.notifications.filter(x=>x.kind==='owner');root().innerHTML=`<section class="view"><div class="core-grid cols-3"><article class="core-card"><div class="eyebrow">Состояние</div><div class="core-kpi">${state.ownerReport.status==='green'?'🟢':'🟠'}</div><div class="core-sub">${esc(state.ownerReport.summary)}</div></article><article class="core-card"><div class="eyebrow">Требует решения</div><div class="core-kpi">${decisions.length}</div><div class="core-sub">рутина сюда не попадает</div></article><article class="core-card"><div class="eyebrow">Доп. продажи от ИИ</div><div class="core-kpi">${new Intl.NumberFormat('ru-RU').format(state.ownerReport.extraSales)} ₽</div></article></div><div class="core-grid cols-2" style="margin-top:14px"><article class="core-card"><div class="core-topline"><div><div class="eyebrow">ПРОГНОЗ 30 ДНЕЙ</div><h3>${esc(state.forecast.text)}</h3></div><button class="core-btn" data-recovery-action="pin">${state.forecast.pinned?'Открепить':'Закрепить'}</button></div><div class="row-meta">К сведению владельца · не является автоматической командой</div></article><article class="core-card"><div class="eyebrow">ВНЕШНИЕ СИГНАЛЫ</div>${state.externalSignals.map(s=>`<div class="integration-row"><span class="core-badge ${s.severity}">${s.severity}</span><div><div class="row-title">${esc(s.title)}</div><div class="row-meta">${esc(s.detail)}</div></div></div>`).join('')}</article></div><article class="core-card" style="margin-top:14px"><div class="eyebrow">ЧТО СДЕЛАЛ ИИ</div>${state.ownerReport.aiActions.map(x=>`<div class="ai-event"><span class="core-badge ai">ИИ</span><div class="row-title">${esc(x)}</div></div>`).join('')}</article><article class="core-card" style="margin-top:14px"><div class="eyebrow">РЕШЕНИЯ ВЛАДЕЛЬЦА</div>${decisions.length?decisions.map(x=>`<div class="exception-row"><span class="core-badge bad">решение</span><div class="row-title">${esc(x.title)}</div><button class="core-btn" data-recovery-action="resolve" data-id="${x.id}">Решено</button></div>`).join(''):'<div class="core-sub">Вмешательство не требуется.</div>'}</article></section>`}

function maybeStartGuide(){if(state.onboarding.completed)return;setTimeout(()=>showGuide(state.onboarding.step||0),600)}
document.addEventListener('click',e=>{const g=e.target.closest('[data-guide]');if(g){if(g.dataset.guide==='skip'){state.onboarding.completed=true;save();removeGuide()}else showGuide((state.onboarding.step||0)+1);return}const nav=e.target.closest('[data-recovery="owner"]');if(nav){document.querySelectorAll('.nav-button').forEach(x=>x.classList.remove('active'));nav.classList.add('active');ownerView();return}const a=e.target.closest('[data-recovery-action]');if(!a)return;if(a.dataset.recoveryAction==='pin'){state.forecast.pinned=!state.forecast.pinned;save();ownerView()}if(a.dataset.recoveryAction==='resolve'){state.notifications=state.notifications.filter(x=>x.id!==a.dataset.id);state.ownerReport.status='green';state.ownerReport.summary='Вмешательство не требуется';save();ownerView()}});
const obs=new MutationObserver(()=>ensureRecoveryNav());obs.observe(document.documentElement,{subtree:true,childList:true});ensureRecoveryNav();maybeStartGuide();
