import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [js,css,html]=await Promise.all([
  readFile('market.js','utf8'),
  readFile('market-more.css','utf8'),
  readFile('index.html','utf8')
]);

const sectionOrder=['title:\'ПРОФИЛЬ\'','title:\'МОЁ\'','title:\'СИСТЕМА\''].map(token=>js.indexOf(token));
assert.ok(sectionOrder.every(index=>index>=0));
assert.ok(sectionOrder[0]<sectionOrder[1]&&sectionOrder[1]<sectionOrder[2]);

for(const title of ['Профиль','Адреса','Платежи и документы','Приватность и безопасность','Сэйвы','Мои сцены','История заказов','Доставка','Возвраты','Центр урегулирования разногласий','Сообщить, когда появится','Уведомления','Настройки','О приложении / Правовая информация'])assert.ok(js.includes(`title:'${title}'`),`missing More item: ${title}`);

const sectionSource=js.slice(js.indexOf('const MORE_SECTIONS='),js.indexOf('const MORE_ITEMS='));
for(const forbidden of ["title:'Поддержка'","title:'Камера'","title:'Поиск'","title:'Каталог'","title:'Корзина'"])assert.equal(sectionSource.includes(forbidden),false,`forbidden More item: ${forbidden}`);

assert.ok(js.includes('<b>Написать в поддержку</b>'));
assert.ok(js.includes("['home','more','detail','chats']"));
assert.ok(js.includes("detail?url.searchParams.set('item',detail)"));
assert.ok(js.includes("'Покажи, что хочешь.'"));
assert.ok(css.includes('.market-page'));
assert.ok(css.includes('.market-bottom-nav'));
assert.ok(html.includes('market-more.css'));
console.log('EINEIRO Market More UI contract tests: OK');
