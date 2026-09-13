const demoProducts=[
 {id:'HOME-SHELF-01',name:'Полка Oak 90',category:'shelf',description:'настенная дуб светлый',attributes:{material:'wood',color:'oak'},price:12900},
 {id:'HOME-SHELF-02',name:'Полка Line 100',category:'shelf',description:'настенная минималистичная белая',attributes:{material:'mdf',color:'white'},price:9900},
 {id:'HOME-VASE-01',name:'Ваза Form Sand',category:'vase',description:'керамика бежевая',attributes:{material:'ceramic',color:'sand'},price:3900},
 {id:'HOME-VASE-02',name:'Ваза Tall White',category:'vase',description:'керамика белая высокая',attributes:{material:'ceramic',color:'white'},price:4500},
 {id:'HOME-BOOK-01',name:'Книга Architecture Now',category:'book',description:'книга интерьер архитектура',attributes:{format:'hardcover'},price:3200},
 {id:'AUTO-LIGHT-01',name:'Фара правая Focus III OEM',category:'headlight',description:'Ford Focus III правая OEM',attributes:{side:'right',car:'focus iii'},price:25900},
 {id:'AUTO-LIGHT-02',name:'Фара правая Focus III аналог',category:'headlight',description:'Ford Focus III правая аналог',attributes:{side:'right',car:'focus iii'},price:21900},
 {id:'TECH-MON-01',name:'Монитор 32 4K Pro',category:'monitor',description:'32 дюйма 4K монитор',attributes:{size:'32',resolution:'4k'},price:54900}
];
function norm(v){return String(v??'').toLocaleLowerCase('ru').trim()}
function relevance(p,{query='',category='',attributes={}}={}){
  let s=0;const hay=norm([p.name,p.category,p.description,...Object.values(p.attributes||{})].join(' '));
  if(category&&norm(p.category)===norm(category))s+=.45;
  const words=norm(query).split(/\s+/).filter(Boolean);if(words.length)s+=Math.min(.4,words.filter(w=>hay.includes(w)).length/words.length*.4);
  const attrs=Object.entries(attributes||{});if(attrs.length)s+=Math.min(.15,attrs.filter(([k,v])=>norm(p.attributes?.[k])===norm(v)).length/attrs.length*.15);
  return Math.min(1,s);
}
export function createCatalogSource(products=demoProducts){
  return async(_ctx,{query='',category=null,attributes={},limit=24,cursor=null}={})=>{
    const offset=Math.max(0,Number(cursor)||0);
    const ranked=products.map(p=>({...p,relevance:relevance(p,{query,category,attributes})})).filter(p=>p.relevance>=.3).sort((a,b)=>b.relevance-a.relevance||String(a.id).localeCompare(String(b.id)));
    const items=ranked.slice(offset,offset+limit);return{items,total:ranked.length,nextCursor:offset+limit<ranked.length?String(offset+limit):null};
  };
}
export {demoProducts};
