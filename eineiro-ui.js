const host = location.hostname.toLowerCase();
const preview = new URLSearchParams(location.search).get('surface');

export function surfaceForHost() {
  if (preview && ['market','business','admin'].includes(preview)) return preview;
  if (host.startsWith('business.')) return 'business';
  if (host.startsWith('admin.')) return 'admin';
  if (host === 'epbase.ru' || host === 'www.epbase.ru') return 'market';
  return null;
}

const icon = (name) => {
  const paths = {
    camera:'<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-2h4.6l1.2 2h2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"/><circle cx="12" cy="12.5" r="3.2"/>',
    heart:'<path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.8l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.4 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    arrow:'<path d="M5 12h14M14 7l5 5-5 5"/>',
    spark:'<path d="m12 2 1.7 5.1L19 9l-5.3 1.9L12 16l-1.7-5.1L5 9l5.3-1.9L12 2Z"/><path d="m19 15 .9 2.6L22.5 19l-2.6.9L19 22.5l-.9-2.6-2.6-.9 2.6-.9L19 15Z"/>',
    alert:'<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    trend:'<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.grid}</svg>`;
};

const marketScenes = [
  {id:'auto',eyebrow:'АВТО',title:'То, что должно подойти — сюда.',copy:'Покажи машину, деталь или проблему. EINEIRO поймёт контекст и покажет варианты прямо в сцене.',slot1:'Капот',slot2:'Фара',place:'garage'},
  {id:'home',eyebrow:'ДОМ',title:'Примерь до покупки.',copy:'Мебель, свет и предметы интерьера появляются в реальном масштабе — без каталога перед глазами.',slot1:'Кресло',slot2:'Свет',place:'living'},
  {id:'tech',eyebrow:'ТЕХНИКА',title:'Покажи задачу, не название.',copy:'Камера и голос превращают ситуацию в точный товарный запрос.',slot1:'Монитор',slot2:'Аудио',place:'desk'}
];

function sceneMarkup(scene){
  return `<div class="scene scene-${scene.place}" data-scene="${scene.id}">
    <div class="scan-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="scene-light"></div>
    <div class="scene-object object-a"><span>${scene.slot1}</span></div>
    <div class="scene-object object-b"><span>${scene.slot2}</span></div>
    <div class="anchor anchor-a"><b></b><span>slot 01</span></div>
    <div class="anchor anchor-b"><b></b><span>slot 02</span></div>
    <div class="camera-safe" aria-label="Camera safe zone"><div class="camera-reticle"><i></i></div></div>
  </div>`;
}

function renderMarket(root){
  let active=0;
  root.innerHTML=`<main class="market-shell">
    <header class="market-header"><a class="wordmark" href="#">EINEIRO<span>market</span></a><div class="market-actions"><button aria-label="Избранное">${icon('heart')}</button><button aria-label="Профиль">${icon('user')}</button></div></header>
    <section class="market-stage">
      <div class="market-copy"><div class="kicker" id="scene-kicker"></div><h1 id="scene-title"></h1><p id="scene-copy"></p><div class="scene-tabs" id="scene-tabs"></div></div>
      <div class="scene-wrap" id="scene-wrap"></div>
      <div class="market-hint"><span class="pulse-dot"></span> Пространство готово к запросу</div>
    </section>
    <nav class="camera-dock" aria-label="Основные действия"><button class="dock-side" aria-label="Избранное">${icon('heart')}</button><button class="camera-button" aria-label="Покажи, что хочешь"><span>${icon('camera')}</span><b></b></button><button class="dock-side" aria-label="Профиль">${icon('user')}</button><div class="dock-label">Покажи, что хочешь</div></nav>
  </main>`;
  const wrap=root.querySelector('#scene-wrap'), kicker=root.querySelector('#scene-kicker'), title=root.querySelector('#scene-title'), copy=root.querySelector('#scene-copy'), tabs=root.querySelector('#scene-tabs');
  const paint=()=>{const s=marketScenes[active]; kicker.textContent=s.eyebrow; title.textContent=s.title; copy.textContent=s.copy; wrap.innerHTML=sceneMarkup(s); tabs.innerHTML=marketScenes.map((x,i)=>`<button class="${i===active?'active':''}" data-i="${i}">${x.eyebrow}</button>`).join('');};
  root.addEventListener('click',e=>{const b=e.target.closest('[data-i]'); if(b){active=Number(b.dataset.i);paint();}}); paint();
}

const businessModules=[
  {tone:'critical',icon:'alert',label:'Нужно решение',value:'3',title:'Исключения',copy:'2 сделки ниже допустимой маржи · 1 просроченный SLA',action:'Разобрать'},
  {tone:'ai',icon:'spark',label:'EINEIRO сделал',value:'17',title:'Автопилот',copy:'Вернул 6 клиентов · перераспределил 8 лидов · скорректировал 3 цены',action:'История'},
  {tone:'good',icon:'trend',label:'Сегодня',value:'+12.8%',title:'Динамика',copy:'Выручка выше среднего дня. Узкое место — скорость упаковки.',action:'Подробнее'},
  {tone:'neutral',icon:'clock',label:'SLA',value:'04:12',title:'Первый ответ',copy:'Цель ≤ 05:00 · необработанных лидов: 0',action:'Продажи'}
];

function moduleCards(items=businessModules){return items.map(m=>`<article class="command-card ${m.tone}"><div class="card-top"><span class="card-icon">${icon(m.icon)}</span><span>${m.label}</span><strong>${m.value}</strong></div><h3>${m.title}</h3><p>${m.copy}</p><button>${m.action}${icon('arrow')}</button></article>`).join('')}

function shellHeader(mode){return `<header class="command-header"><div><a class="wordmark" href="#">EINEIRO<span>${mode}</span></a><p>${mode==='admin'?'Platform Control':'Adaptive Command Center'}</p></div><div class="status-pill"><i></i>${mode==='admin'?'Платформа стабильна':'Бизнес под контролем'}</div><button class="avatar">AV</button></header>`}

function renderBusiness(root){root.innerHTML=`<main class="command-shell">${shellHeader('business')}<section class="command-hero"><div><span class="kicker">13 СЕНТЯБРЯ · ВОСКРЕСЕНЬЕ</span><h1>Добрый день.<br><em>Вмешательство почти не требуется.</em></h1></div><div class="freedom-score"><span>Автономность</span><strong>92<small>%</small></strong><i style="--p:92%"></i></div></section><section class="exception-strip"><span>${icon('spark')} EINEIRO</span><p><b>За последние 24 часа:</b> 31 решение принято автоматически. Потенциально сохранено 48 600 ₽ маржи.</p><button>Что сделано ${icon('arrow')}</button></section><section class="command-grid">${moduleCards()}</section><section class="flow-panel"><div><span class="kicker">ЖИВОЙ ПОТОК</span><h2>Система показывает только то, что изменилось.</h2></div><div class="flow-rail"><article><i class="ok"></i><b>Продажи</b><span>0 без ответа</span></article><article><i class="ok"></i><b>Склад</b><span>94% в норме</span></article><article><i class="warn"></i><b>Упаковка</b><span>+18 мин к норме</span></article><article><i class="ok"></i><b>Публикации</b><span>Все каналы online</span></article></div></section></main>`}

function renderAdmin(root){const adminModules=[
  {tone:'good',icon:'check',label:'Core',value:'99.98%',title:'Доступность',copy:'API, Market и Business отвечают штатно.',action:'Сервисы'},
  {tone:'critical',icon:'alert',label:'Exceptions',value:'4',title:'Требуют внимания',copy:'2 интеграции · 1 очередь · 1 платёжный webhook',action:'Открыть'},
  {tone:'ai',icon:'spark',label:'AI control',value:'1 284',title:'Решений / час',copy:'Нормальная нагрузка. Ошибочных маршрутизаций не обнаружено.',action:'Наблюдение'},
  {tone:'neutral',icon:'trend',label:'Traffic',value:'72%',title:'Запас мощности',copy:'Текущий профиль нагрузки безопасен.',action:'Инфраструктура'}
];root.innerHTML=`<main class="command-shell admin-shell">${shellHeader('admin')}<section class="command-hero"><div><span class="kicker">PLATFORM OVERVIEW</span><h1>Не панель управления.<br><em>Панель исключений.</em></h1></div><div class="radar"><span></span><i></i><b>LIVE</b></div></section><section class="exception-strip admin-strip"><span>${icon('alert')} Приоритет</span><p><b>4 исключения из 12 418 активных процессов.</b> Остальное скрыто как штатно работающее.</p><button>Открыть очередь ${icon('arrow')}</button></section><section class="command-grid">${moduleCards(adminModules)}</section><section class="admin-map"><div><span class="kicker">SYSTEM PULSE</span><h2>Контур платформы</h2><p>Market → AI routing → Sellers → Logistics → Payments</p></div><div class="system-line"><b>MARKET</b><i></i><b>AI</b><i></i><b>SELLERS</b><i></i><b>LOGISTICS</b><i></i><b>PAYMENTS</b></div></section></main>`}

export function mountEineiro(surface){
  document.documentElement.dataset.eineiroSurface=surface;
  document.title=surface==='market'?'EINEIRO Market':surface==='business'?'EINEIRO Business':'EINEIRO Admin';
  const root=document.querySelector('#app');
  if(surface==='market')renderMarket(root); else if(surface==='business')renderBusiness(root); else renderAdmin(root);
}
