import crypto from 'node:crypto';

export class AiSellerService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async setDuty(ctx,{sellerId,from,to,aiFallback=true}={}){
    if(!sellerId)throw new Error('sellerId required');const rec={id:`duty:${sellerId}:${from}`,sellerId,from,to,aiFallback:Boolean(aiFallback)};await this.repoFactory(ctx).put('SellerDuty',rec);return rec;
  }
  async suggestReply(ctx,{conversationId,customerQuestion,productId=null,orderId=null}={}){
    const repo=this.repoFactory(ctx);const facts={};if(productId)facts.product=await repo.get('Product',productId);if(orderId)facts.order=await repo.get('Order',orderId);
    const q=String(customerQuestion||'').toLowerCase();const parts=[];
    if(facts.product){parts.push(`${facts.product.name||'Товар'} ${facts.product.status==='sold'?'уже продан':'в наличии'}`);if(facts.product.warranty?.days!=null)parts.push(`гарантия ${facts.product.warranty.days} дн.`);if(facts.product.price!=null)parts.push(`цена ${facts.product.price} ₽`)}
    if(facts.order?.shipment?.trackingNumber)parts.push(`отправление ${facts.order.shipment.trackingNumber}`);
    if(q.includes('достав'))parts.push('доставка оформляется через доступный способ в заказе');
    if(q.includes('скид'))parts.push('скидка возможна только в разрешённом диапазоне цены');
    if(!parts.length)parts.push('Нужна проверка данных в системе перед ответом');
    const rec={id:`suggest:${crypto.randomUUID()}`,conversationId,customerQuestion:String(customerQuestion||''),reply:parts.join('. ')+'.',groundedFacts:facts,createdAt:this.now().toISOString()};await repo.put('AiReplySuggestion',rec);return rec;
  }
  async followUp(ctx,{conversationId,leadId=null,delayMinutes=30,reason='no_response'}={}){
    const rec={id:`follow:${conversationId}:${crypto.randomUUID()}`,conversationId,leadId,delayMinutes:Number(delayMinutes)||30,reason,status:'scheduled',createdAt:this.now().toISOString()};await this.repoFactory(ctx).put('FollowUp',rec);return rec;
  }
  async improveListing(ctx,{productId,title='',description='',facts={}}={}){
    const cleanFacts=Object.entries(facts).filter(([,v])=>v!=null&&v!=='').map(([k,v])=>`${k}: ${v}`);
    const rec={id:`listing:${productId}`,productId,title:String(title||facts.name||''),description:[String(description||'').trim(),...cleanFacts].filter(Boolean).join('\n'),rule:'facts_only',updatedAt:this.now().toISOString()};await this.repoFactory(ctx).put('ListingSuggestion',rec);return rec;
  }
}
