import crypto from 'node:crypto';

export class WarehouseIntelligenceService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async prioritize(ctx,{items=[],staff=[]}={}){
    const tasks=[];const loads=new Map(staff.map(s=>[s.id,Number(s.openTasks||0)]));
    const sorted=[...items].sort((a,b)=>score(b)-score(a));
    for(const item of sorted){const candidates=staff.filter(s=>!item.heavy||s.canHeavy!==false);const assignee=candidates.sort((a,b)=>(loads.get(a.id)||0)-(loads.get(b.id)||0))[0];if(!assignee)continue;const task={id:`wt_${crypto.randomUUID()}`,type:item.type||'warehouse',productId:item.productId||item.id,title:item.title||`Обработать ${item.name||item.id}`,priority:priority(score(item)),assigneeId:assignee.id,status:'todo',requiresPhoto:Boolean(item.requiresPhoto),requiresScan:Boolean(item.requiresScan),dependsOn:item.dependsOn||null,safety:item.heavy?'heavy_item':null,createdAt:this.now().toISOString()};loads.set(assignee.id,(loads.get(assignee.id)||0)+1);await this.repoFactory(ctx).put('Task',task);tasks.push(task)}return tasks;
  }
  async placementGuide(ctx,{product,locations=[]}={}){
    if(!product?.id)throw new Error('product required');const candidates=locations.filter(x=>!x.full).filter(x=>!product.heavy||Number(x.level||1)===1).sort((a,b)=>placementScore(b,product)-placementScore(a,product));const best=candidates[0]||null;const steps=best?[`Отнесите ${product.name||product.id} в зону ${best.zone||best.id}`,`Стеллаж ${best.rack||'—'}, полка ${best.shelf||'—'}, ячейка ${best.cell||best.id}`,product.barcode?'Сканируйте штрихкод товара и ячейки':'Подтвердите размещение фотографией','Проверьте, что адрес хранения сохранился']:['Свободное подходящее место не найдено','Создайте исключение владельцу склада'];const rec={id:`guide:${product.id}:${crypto.randomUUID()}`,productId:product.id,targetLocationId:best?.id||null,steps,status:best?'ready':'blocked',createdAt:this.now().toISOString()};await this.repoFactory(ctx).put('WarehouseGuide',rec);return rec;
  }
  async inventoryException(ctx,{productId,type,detail,severity='warn'}={}){const rec={id:`whx_${crypto.randomUUID()}`,productId,type,detail,severity,status:'open',createdAt:this.now().toISOString()};await this.repoFactory(ctx).put('WarehouseException',rec);return rec;}
}
function score(x){return Number(x.urgency||0)*3+Number(x.demand||0)*2+Number(x.ageDays||0)/10+(x.blocking?40:0)+(x.customerWaiting?30:0)}
function priority(s){return s>=180?'critical':s>=110?'high':s>=60?'normal':'low'}
function placementScore(loc,p){let s=Number(loc.freeCapacity||0);if(Number(p.demand||0)>=80&&loc.zone==='fast')s+=50;if(Number(p.ageDays||0)>90&&loc.zone==='slow')s+=30;if(p.heavy&&Number(loc.level||1)===1)s+=40;return s}
