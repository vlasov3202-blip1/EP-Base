const STATE_KEY='eineiro-business-v2';
const HASH_KEY='eineiro-business-server-hash-v1';

function stable(v){return JSON.stringify(v,Object.keys(v||{}).sort())}
function hashText(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return String(h>>>0)}
function locationText(p){const l=p.location||p.storage||{};if(typeof l==='string')return l;return [l.zone,l.rack,l.shelf,l.cell].filter(Boolean).join('-')||p.storageAddress||'—'}

async function sync(){
 try{
  const res=await fetch('/api/v1/business/snapshot',{credentials:'include'});if(!res.ok)return;const s=await res.json();
  const current=JSON.parse(localStorage.getItem(STATE_KEY)||'{}');const price=new Map((s.priceRecommendations||[]).map(x=>[x.productId,x]));
  const products=(s.products||[]).map(p=>{const r=price.get(p.id)||{};return{id:p.id,name:p.name||p.title||p.id,category:p.category||p.categoryId||'Товар',price:Number(p.price||0),minPrice:Number(r.minimumPrice??p.minPrice??p.price??0),optimalPrice:Number(r.optimalPrice??p.optimalPrice??p.price??0),status:p.status||'ready',age:Number(p.ageDays??p.age??0),demand:Number(p.demand??0),location:locationText(p)}});
  const tasks=(s.tasks||[]).map(t=>({id:t.id,title:t.title||t.type||'Задача',owner:t.owner||t.assigneeId||'Команда',priority:t.priority||'normal',status:t.status||'todo',source:t.source||'EINEIRO'}));
  const exceptions=(s.exceptions||[]).map(x=>({id:x.id,type:x.type||'exception',title:x.title||'Исключение',detail:x.detail||'',severity:x.severity||'warn',requiresOwner:Boolean(x.requiresOwner)}));
  const integrations=(s.channels||[]).map(x=>({name:x.channel,enabled:x.enabled!==false,status:x.status||'not checked'}));
  const next={...current,meta:{...(current.meta||{}),role:s.role||current.meta?.role||'owner',autonomy:Number(s.autonomy??current.meta?.autonomy??0)},products:products.length?products:(current.products||[]),tasks:tasks.length?tasks:(current.tasks||[]),exceptions:exceptions.length?exceptions:(current.exceptions||[]),integrations:integrations.length?integrations:(current.integrations||[])};
  const payload={products:next.products,tasks:next.tasks,exceptions:next.exceptions,integrations:next.integrations,autonomy:next.meta.autonomy};const h=hashText(JSON.stringify(payload));
  if(sessionStorage.getItem(HASH_KEY)!==h){localStorage.setItem(STATE_KEY,JSON.stringify(next));sessionStorage.setItem(HASH_KEY,h);location.reload();}
 }catch{}
}
sync();
