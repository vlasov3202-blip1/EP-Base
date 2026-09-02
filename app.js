const STORAGE_KEY = 'ep-base-mvp-v1';

const icons = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  car: '<path d="M5 17h14l-1.2-5.1A2.5 2.5 0 0 0 15.4 10H8.6a2.5 2.5 0 0 0-2.4 1.9L5 17Z"/><path d="m7 10 1.2-3h7.6l1.2 3M5 17v2M19 17v2M7.5 14h.01M16.5 14h.01"/>',
  package: '<path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5v8l-9 5-9-5V8Z"/><path d="M12 13v8"/>',
  warehouse: '<path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-9h10v9M7 15h10M10 12v9M14 12v9"/>',
  finance: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5L4 17l3 3 7.7-8.3a4 4 0 0 0 0-5.4Z"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  move: '<path d="M7 7h11l-3-3M17 17H6l3 3M18 7l-3 3M6 17l3-3"/>',
  tasks: '<path d="m4 6 2 2 4-4M12 6h8M4 13l2 2 4-4M12 13h8M4 20l2 2 4-4M12 20h8"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  box: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.box}</svg>`;
}

const seedData = {
  vehicles: [
    { id: 'CAR-001', make: 'Hyundai', model: 'Solaris', year: 2017, color: 'Белый', vin: 'Z94K241CBHR•••431', stage: 72, parts: 42, cost: 465000, revenue: 538000 },
    { id: 'CAR-002', make: 'Volkswagen', model: 'Polo', year: 2016, color: 'Серебристый', vin: 'XW8ZZZ61ZGG•••827', stage: 48, parts: 31, cost: 410000, revenue: 274000 },
    { id: 'CAR-003', make: 'Ford', model: 'Focus III', year: 2013, color: 'Чёрный', vin: 'X9FMXXEEBMD•••184', stage: 89, parts: 56, cost: 350000, revenue: 611000 },
    { id: 'CAR-004', make: 'Skoda', model: 'Rapid', year: 2018, color: 'Синий', vin: 'XW8AC6NH0JK•••596', stage: 24, parts: 18, cost: 530000, revenue: 92000 },
  ],
  parts: [
    { id: 'EP-000125', name: 'Двигатель G4FC 1.6', vehicleId: 'CAR-001', category: 'Двигатель', price: 185000, status: 'listed', location: { zone: 'A', rack: '01', shelf: '1' }, addedAt: '2026-09-02T16:12:00Z' },
    { id: 'EP-000124', name: 'АКПП A6GF1', vehicleId: 'CAR-001', category: 'Трансмиссия', price: 98000, status: 'ready', location: { zone: 'A', rack: '02', shelf: '1' }, addedAt: '2026-09-02T14:35:00Z' },
    { id: 'EP-000123', name: 'Бампер передний', vehicleId: 'CAR-002', category: 'Кузов', price: 17500, status: 'reserved', location: { zone: 'B', rack: '03', shelf: '2' }, addedAt: '2026-09-01T18:20:00Z' },
    { id: 'EP-000122', name: 'Фара правая ксенон', vehicleId: 'CAR-003', category: 'Оптика', price: 24300, status: 'listed', location: { zone: 'B', rack: '01', shelf: '3' }, addedAt: '2026-09-01T16:05:00Z' },
    { id: 'EP-000121', name: 'Дверь передняя левая', vehicleId: 'CAR-004', category: 'Кузов', price: 22000, status: 'removed', location: { zone: 'C', rack: '02', shelf: '1' }, addedAt: '2026-09-01T13:41:00Z' },
    { id: 'EP-000120', name: 'Блок ABS', vehicleId: 'CAR-002', category: 'Электрика', price: 13400, status: 'sold', location: { zone: 'A', rack: '04', shelf: '3' }, addedAt: '2026-08-31T12:00:00Z' },
    { id: 'EP-000119', name: 'Капот', vehicleId: 'CAR-003', category: 'Кузов', price: 28500, status: 'listed', location: { zone: 'C', rack: '01', shelf: '1' }, addedAt: '2026-08-30T09:30:00Z' },
    { id: 'EP-000118', name: 'Зеркало левое', vehicleId: 'CAR-004', category: 'Кузов', price: 8900, status: 'ready', location: { zone: 'B', rack: '02', shelf: '2' }, addedAt: '2026-08-29T17:11:00Z' },
    { id: 'EP-000117', name: 'Компрессор кондиционера', vehicleId: 'CAR-001', category: 'Навесное', price: 14500, status: 'listed', location: { zone: 'A', rack: '03', shelf: '2' }, addedAt: '2026-08-29T12:52:00Z' },
    { id: 'EP-000116', name: 'Магнитола штатная', vehicleId: 'CAR-002', category: 'Салон', price: 7500, status: 'sold', location: { zone: 'A', rack: '05', shelf: '4' }, addedAt: '2026-08-28T11:02:00Z' },
  ],
  activities: [
    { type: 'sale', title: 'Продан блок ABS', subtitle: 'Volkswagen Polo · 13 400 ₽', time: '18 мин' },
    { type: 'part', title: 'Добавлен двигатель G4FC', subtitle: 'Hyundai Solaris · EP-000125', time: '1 ч' },
    { type: 'move', title: 'Перемещён передний бампер', subtitle: 'На склад B-03-2', time: '3 ч' },
    { type: 'sale', title: 'Продана штатная магнитола', subtitle: 'Volkswagen Polo · 7 500 ₽', time: 'вчера' },
  ],
};

const statusLabels = {
  removed: 'Снята',
  ready: 'Подготовлена',
  listed: 'Опубликована',
  reserved: 'Забронирована',
  sold: 'Продана',
};

const navigation = [
  { id: 'dashboard', label: 'Главная', short: 'Главная', icon: 'dashboard' },
  { id: 'donors', label: 'Автомобили', short: 'Авто', icon: 'car' },
  { id: 'parts', label: 'Запчасти', short: 'Детали', icon: 'package' },
  { id: 'warehouse', label: 'Склад', short: 'Склад', icon: 'warehouse' },
  { id: 'finance', label: 'Финансы', short: 'Деньги', icon: 'finance' },
];

const pageCopy = {
  dashboard: ['Главная', 'Сводка по Easy Parts'],
  donors: ['Автомобили-доноры', 'Закупка, разбор и окупаемость'],
  parts: ['Каталог запчастей', 'Все детали и их текущий статус'],
  warehouse: ['Склад', 'Зоны, стеллажи и полки'],
  finance: ['Финансы', 'Вложения, продажи и прибыль'],
};

function cloneSeed() {
  return JSON.parse(JSON.stringify(seedData));
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : cloneSeed();
  } catch {
    return cloneSeed();
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // The interface still works if private browsing blocks storage.
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(value) {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(value || 0))} ₽`;
}

function vehicleName(vehicleId) {
  const vehicle = data.vehicles.find((item) => item.id === vehicleId);
  return vehicle ? `${vehicle.make} ${vehicle.model}` : 'Без автомобиля';
}

function locationCode(location) {
  if (!location) return 'Не размещена';
  return `${location.zone}-${location.rack}-${location.shelf}`;
}

let data = loadData();
let ui = {
  activeView: 'dashboard',
  partFilter: 'all',
  query: '',
  modalOpen: false,
};

const app = document.querySelector('#app');

function navMarkup(mobile = false) {
  return navigation.map((item) => `
    <button class="nav-button ${ui.activeView === item.id ? 'active' : ''}" data-action="navigate" data-view="${item.id}" aria-label="${item.label}">
      ${icon(item.icon)}
      <span>${mobile ? item.short : item.label}</span>
    </button>
  `).join('');
}

function renderApp() {
  const [title, subtitle] = pageCopy[ui.activeView];
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">EP</div>
          <div class="brand-copy"><strong>EP Base</strong><span>Easy Parts</span></div>
        </div>
        <div class="sidebar-label">Рабочая зона</div>
        <nav class="nav" aria-label="Основная навигация">${navMarkup()}</nav>
        <div class="sidebar-footer">
          <div class="eyebrow">MVP · 0.1</div>
          <p>Данные этой версии сохраняются на текущем устройстве.</p>
        </div>
      </aside>
      <main class="content">
        <header class="topbar">
          <div class="top-title">
            <h1>${title}</h1>
            <p>${subtitle}</p>
          </div>
          <div class="top-actions">
            <label class="search-box" aria-label="Поиск деталей">
              ${icon('search')}
              <input id="global-search" type="search" placeholder="Название или EP-код" value="${escapeHtml(ui.query)}" autocomplete="off" />
            </label>
            <button class="button button-primary" data-action="add-part">${icon('plus')}<span>Добавить деталь</span></button>
          </div>
        </header>
        <div id="view-root">${renderView()}</div>
      </main>
    </div>
    <nav class="mobile-nav" aria-label="Мобильная навигация">${navMarkup(true)}</nav>
    ${ui.modalOpen ? renderAddPartModal() : ''}
  `;
}

function renderView() {
  const renderers = {
    dashboard: renderDashboard,
    donors: renderDonors,
    parts: renderParts,
    warehouse: renderWarehouse,
    finance: renderFinance,
  };
  return renderers[ui.activeView]();
}

function metricCard(label, value, note, iconName, tone = '') {
  return `
    <article class="metric-card">
      <div class="metric-head"><span>${label}</span><span class="metric-icon ${tone}">${icon(iconName)}</span></div>
      <div class="metric-value">${value}</div>
      <div class="metric-note">${note}</div>
    </article>
  `;
}

function renderDashboard() {
  const inStock = data.parts.filter((part) => part.status !== 'sold');
  const listed = data.parts.filter((part) => part.status === 'listed');
  const sold = data.parts.filter((part) => part.status === 'sold');
  const stockValue = inStock.reduce((sum, part) => sum + Number(part.price), 0);
  const soldValue = sold.reduce((sum, part) => sum + Number(part.price), 0);

  return `
    <section class="view">
      <div class="hero">
        <div>
          <div class="eyebrow">Сегодня на складе</div>
          <h2>Каждая деталь<br>на своём месте.</h2>
          <p>Быстрый учёт от автомобиля-донора до продажи. Без потерянных запчастей и записей в разных блокнотах.</p>
        </div>
        <div class="hero-visual">
          <div class="part-tag">
            <div class="eyebrow">Маркировка детали</div>
            <div class="tag-id">EP-000126</div>
            <div class="tag-line"><span>Solaris · 2017</span><strong>A-01-2</strong></div>
          </div>
        </div>
      </div>
      <div class="metrics">
        ${metricCard('Деталей на складе', inStock.length, '<span class="positive">●</span> учёт активен', 'package')}
        ${metricCard('Опубликовано', listed.length, 'готовы к продаже', 'upload', 'blue')}
        ${metricCard('Стоимость остатков', money(stockValue), 'по цене продажи', 'finance', 'yellow')}
        ${metricCard('Продано в базе', money(soldValue), `${sold.length} позиции`, 'receipt', 'green')}
      </div>
      <div class="dashboard-grid">
        <section class="panel">
          <div class="panel-header">
            <div class="panel-title"><h3>Последние события</h3><p>Что происходило с деталями</p></div>
            <button class="link-button" data-action="navigate" data-view="parts">Все детали ${icon('arrow')}</button>
          </div>
          <ul class="activity-list">
            ${data.activities.slice(0, 4).map((activity) => `
              <li class="activity-item">
                <span class="activity-icon ${activity.type}">${icon(activity.type === 'sale' ? 'receipt' : activity.type === 'move' ? 'move' : 'package')}</span>
                <span class="activity-copy"><strong>${escapeHtml(activity.title)}</strong><span>${escapeHtml(activity.subtitle)}</span></span>
                <span class="activity-time">${escapeHtml(activity.time)}</span>
              </li>
            `).join('')}
          </ul>
        </section>
        <section class="panel">
          <div class="panel-header">
            <div class="panel-title"><h3>Требует внимания</h3><p>Очередь работы</p></div>
          </div>
          <ul class="task-list">
            <li class="task-item"><span class="task-dot"></span><span class="task-copy"><strong>Подготовить к продаже</strong><span>Мойка, проверка, фото</span></span><span class="task-count">${data.parts.filter((p) => p.status === 'removed').length}</span></li>
            <li class="task-item"><span class="task-dot"></span><span class="task-copy"><strong>Забронировано</strong><span>Проверить срок брони</span></span><span class="task-count">${data.parts.filter((p) => p.status === 'reserved').length}</span></li>
            <li class="task-item"><span class="task-dot"></span><span class="task-copy"><strong>Не опубликовано</strong><span>Готово, но нет объявления</span></span><span class="task-count">${data.parts.filter((p) => p.status === 'ready').length}</span></li>
          </ul>
        </section>
      </div>
    </section>
  `;
}

function filteredParts() {
  const query = ui.query.trim().toLocaleLowerCase('ru');
  return data.parts.filter((part) => {
    const matchesStatus = ui.partFilter === 'all' || part.status === ui.partFilter;
    const haystack = `${part.id} ${part.name} ${part.category} ${vehicleName(part.vehicleId)} ${locationCode(part.location)}`.toLocaleLowerCase('ru');
    return matchesStatus && (!query || haystack.includes(query));
  });
}

function statusOptions(current) {
  return Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`).join('');
}

function renderParts() {
  const parts = filteredParts();
  const filters = [['all', 'Все'], ...Object.entries(statusLabels)];
  return `
    <section class="view">
      <div class="page-tools">
        <div class="filters" aria-label="Фильтр по статусу">
          ${filters.map(([value, label]) => `<button class="filter-button ${ui.partFilter === value ? 'active' : ''}" data-action="filter-parts" data-filter="${value}">${label}</button>`).join('')}
        </div>
        <span class="eyebrow">Найдено: ${parts.length}</span>
      </div>
      <section class="panel">
        ${parts.length ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Деталь</th><th>Автомобиль</th><th>Категория</th><th>Место</th><th>Цена</th><th>Статус</th></tr></thead>
              <tbody>
                ${parts.map((part) => `
                  <tr>
                    <td><div class="part-name"><span class="part-thumb">${icon('wrench')}</span><span><strong>${escapeHtml(part.name)}</strong><span>${escapeHtml(part.id)}</span></span></div></td>
                    <td>${escapeHtml(vehicleName(part.vehicleId))}</td>
                    <td>${escapeHtml(part.category)}</td>
                    <td><span class="location-code">${escapeHtml(locationCode(part.location))}</span></td>
                    <td><span class="money">${money(part.price)}</span></td>
                    <td><select class="status-select" data-action="change-status" data-part-id="${escapeHtml(part.id)}" data-status="${part.status}" aria-label="Статус ${escapeHtml(part.name)}">${statusOptions(part.status)}</select></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state"><div>${icon('search')}<strong>Ничего не найдено</strong><p>Измени фильтр или поисковый запрос.</p></div></div>`}
      </section>
    </section>
  `;
}

function renderDonors() {
  return `
    <section class="view">
      <div class="page-tools">
        <div class="filters"><button class="filter-button active">Активные · ${data.vehicles.length}</button><button class="filter-button">Архив</button></div>
        <button class="button button-secondary" data-action="toast" data-message="Добавление автомобиля — следующий этап">${icon('plus')} Автомобиль</button>
      </div>
      <div class="donor-grid">
        ${data.vehicles.map((vehicle) => {
          const result = vehicle.revenue - vehicle.cost;
          return `
            <article class="donor-card">
              <div class="donor-cover">${icon('car')}<span class="donor-code">${vehicle.id}</span></div>
              <div class="donor-body">
                <h3>${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)} · ${vehicle.year}</h3>
                <div class="donor-meta"><span>${escapeHtml(vehicle.color)}</span><span>${escapeHtml(vehicle.vin)}</span></div>
                <div class="progress-row"><span>Разобрано</span><strong>${vehicle.stage}%</strong></div>
                <div class="progress"><span style="width:${vehicle.stage}%"></span></div>
                <div class="donor-footer"><span>Деталей: <b>${vehicle.parts}</b></span><span>Результат: <strong>${result >= 0 ? '+' : ''}${money(result)}</strong></span></div>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function getWarehouseData() {
  const definitions = {
    A: { title: 'Зона A', subtitle: 'Мелкие детали и навесное', racks: 5 },
    B: { title: 'Зона B', subtitle: 'Кузовные детали и оптика', racks: 3 },
    C: { title: 'Зона C', subtitle: 'Крупногабаритные детали', racks: 2 },
  };
  return Object.entries(definitions).map(([code, zone]) => {
    const parts = data.parts.filter((part) => part.status !== 'sold' && part.location?.zone === code);
    const rackData = Array.from({ length: zone.racks }, (_, index) => {
      const rack = String(index + 1).padStart(2, '0');
      const count = parts.filter((part) => part.location.rack === rack).length;
      return { rack, count, fill: Math.min(100, 12 + count * 21) };
    });
    return { code, ...zone, parts, rackData };
  });
}

function renderWarehouse() {
  return `
    <section class="view">
      <div class="page-tools">
        <div class="filters"><button class="filter-button active">Все зоны</button><button class="filter-button">Свободные места</button></div>
        <span class="eyebrow">Схема: зона → стеллаж → полка</span>
      </div>
      <div class="warehouse-grid">
        ${getWarehouseData().map((zone) => `
          <article class="warehouse-card">
            <div class="warehouse-head">
              <div class="warehouse-title"><span class="warehouse-icon">${icon('warehouse')}</span><span><h3>${zone.title}</h3><span>${zone.subtitle}</span></span></div>
              <span class="occupancy"><strong>${zone.parts.length}</strong> деталей</span>
            </div>
            <div class="rack-list">
              ${zone.rackData.map((rack) => `<div class="rack-row"><strong>${zone.code}-${rack.rack}</strong><span class="mini-progress"><span style="width:${rack.fill}%"></span></span><span>${rack.count}</span></div>`).join('')}
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderFinance() {
  const invested = data.vehicles.reduce((sum, vehicle) => sum + vehicle.cost, 0);
  const revenue = data.vehicles.reduce((sum, vehicle) => sum + vehicle.revenue, 0);
  const profit = revenue - invested;
  const maxRevenue = Math.max(...data.vehicles.map((vehicle) => vehicle.revenue), 1);
  return `
    <section class="view">
      <div class="finance-grid">
        <article class="metric-card finance-card"><div class="eyebrow">Вложено в автомобили</div><div class="metric-value">${money(invested)}</div><div class="metric-note">Закупочная стоимость доноров</div></article>
        <article class="metric-card finance-card"><div class="eyebrow">Выручка по базе</div><div class="metric-value">${money(revenue)}</div><div class="metric-note">Сумма учтённых продаж</div></article>
        <article class="metric-card finance-card"><div class="eyebrow">Текущий результат</div><div class="metric-value" style="color:${profit >= 0 ? 'var(--green)' : 'var(--red)'}">${profit >= 0 ? '+' : ''}${money(profit)}</div><div class="metric-note">Без учёта операционных расходов</div></article>
      </div>
      <div class="finance-layout">
        <section class="panel">
          <div class="panel-header"><div class="panel-title"><h3>Окупаемость автомобилей</h3><p>Выручка относительно закупки</p></div></div>
          <div class="bar-chart">
            ${data.vehicles.map((vehicle) => `
              <div class="bar-group">
                <div class="bar" style="height:${Math.max(8, vehicle.revenue / maxRevenue * 100)}%" title="Выручка ${money(vehicle.revenue)}"></div>
                <div class="bar bar-cost" style="height:${Math.max(8, vehicle.cost / maxRevenue * 100)}%" title="Закупка ${money(vehicle.cost)}"></div>
                <span>${escapeHtml(vehicle.model)}</span>
              </div>
            `).join('')}
          </div>
        </section>
        <section class="panel">
          <div class="panel-header"><div class="panel-title"><h3>По автомобилям</h3><p>Финансовый результат</p></div></div>
          <div class="finance-list">
            ${data.vehicles.map((vehicle) => {
              const result = vehicle.revenue - vehicle.cost;
              return `<div class="finance-row"><span><strong>${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}</strong><span>${money(vehicle.revenue)} выручки</span></span><span class="money" style="color:${result >= 0 ? 'var(--green)' : 'var(--red)'}">${result >= 0 ? '+' : ''}${money(result)}</span></div>`;
            }).join('')}
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderAddPartModal() {
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="add-part-title">
        <div class="modal-header"><h2 id="add-part-title">Новая деталь</h2><button class="icon-button" type="button" data-action="close-modal" aria-label="Закрыть">${icon('close')}</button></div>
        <form id="add-part-form">
          <div class="form-grid">
            <div class="form-field full"><label for="part-name">Название детали</label><input id="part-name" name="name" required placeholder="Например: генератор" autofocus /></div>
            <div class="form-field"><label for="part-vehicle">Автомобиль-донор</label><select id="part-vehicle" name="vehicleId" required>${data.vehicles.map((vehicle) => `<option value="${vehicle.id}">${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)} · ${vehicle.year}</option>`).join('')}</select></div>
            <div class="form-field"><label for="part-category">Категория</label><select id="part-category" name="category"><option>Двигатель</option><option>Трансмиссия</option><option>Навесное</option><option>Кузов</option><option>Оптика</option><option>Электрика</option><option>Салон</option><option>Ходовая</option><option>Прочее</option></select></div>
            <div class="form-field full"><label for="part-price">Цена продажи, ₽</label><input id="part-price" name="price" required min="0" step="100" type="number" inputmode="numeric" placeholder="15000" /></div>
            <div class="form-field full">
              <label>Место хранения</label>
              <div class="location-fields">
                <select name="zone" aria-label="Зона"><option value="A">Зона A</option><option value="B">Зона B</option><option value="C">Зона C</option></select>
                <input name="rack" required maxlength="2" placeholder="Стеллаж" value="01" aria-label="Стеллаж" />
                <input name="shelf" required maxlength="2" placeholder="Полка" value="1" aria-label="Полка" />
              </div>
            </div>
          </div>
          <div class="modal-footer"><button class="button button-secondary" type="button" data-action="close-modal">Отмена</button><button class="button button-primary" type="submit">${icon('check')} Сохранить</button></div>
        </form>
      </section>
    </div>
  `;
}

function navigate(view) {
  if (!pageCopy[view]) return;
  ui.activeView = view;
  if (view !== 'parts') ui.query = '';
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `${icon('check')}<span>${escapeHtml(message)}</span>`;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

app.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'navigate') navigate(target.dataset.view);
  if (action === 'add-part') {
    ui.modalOpen = true;
    renderApp();
    window.setTimeout(() => document.querySelector('#part-name')?.focus(), 0);
  }
  if (action === 'close-modal' && (target === event.target || target.closest('button'))) {
    ui.modalOpen = false;
    renderApp();
  }
  if (action === 'filter-parts') {
    ui.partFilter = target.dataset.filter;
    document.querySelector('#view-root').innerHTML = renderParts();
  }
  if (action === 'toast') showToast(target.dataset.message);
});

app.addEventListener('input', (event) => {
  if (event.target.id !== 'global-search') return;
  ui.query = event.target.value;
  if (ui.activeView !== 'parts') {
    ui.activeView = 'parts';
    renderApp();
    const search = document.querySelector('#global-search');
    search?.focus();
    search?.setSelectionRange(ui.query.length, ui.query.length);
    return;
  }
  document.querySelector('#view-root').innerHTML = renderParts();
});

app.addEventListener('change', (event) => {
  if (event.target.dataset.action !== 'change-status') return;
  const part = data.parts.find((item) => item.id === event.target.dataset.partId);
  if (!part) return;
  part.status = event.target.value;
  data.activities.unshift({
    type: event.target.value === 'sold' ? 'sale' : 'move',
    title: `${event.target.value === 'sold' ? 'Продана' : 'Обновлена'}: ${part.name}`,
    subtitle: `${part.id} · ${statusLabels[part.status]}`,
    time: 'сейчас',
  });
  saveData();
  document.querySelector('#view-root').innerHTML = renderParts();
  showToast(`Статус: ${statusLabels[part.status]}`);
});

app.addEventListener('submit', (event) => {
  if (event.target.id !== 'add-part-form') return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  const maxId = data.parts.reduce((max, part) => Math.max(max, Number(part.id.replace(/\D/g, '')) || 0), 0);
  const newPart = {
    id: `EP-${String(maxId + 1).padStart(6, '0')}`,
    name: values.name.trim(),
    vehicleId: values.vehicleId,
    category: values.category,
    price: Number(values.price),
    status: 'removed',
    location: {
      zone: values.zone.toUpperCase(),
      rack: values.rack.trim().padStart(2, '0'),
      shelf: values.shelf.trim(),
    },
    addedAt: new Date().toISOString(),
  };
  data.parts.unshift(newPart);
  data.activities.unshift({ type: 'part', title: `Добавлена: ${newPart.name}`, subtitle: `${vehicleName(newPart.vehicleId)} · ${newPart.id}`, time: 'сейчас' });
  saveData();
  ui.modalOpen = false;
  ui.activeView = 'parts';
  ui.partFilter = 'all';
  renderApp();
  showToast(`${newPart.id} сохранена`);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && ui.modalOpen) {
    ui.modalOpen = false;
    renderApp();
  }
});

renderApp();
