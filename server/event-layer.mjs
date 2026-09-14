import crypto from 'node:crypto';

export class EventLayer{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;this.handlers=new Map();}
  on(type,handler){if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push(handler);return this;}
  async emit(ctx,type,payload={},meta={}){const repo=this.repoFactory(ctx);const event={id:`evt_${crypto.randomUUID()}`,type,payload:structuredClone(payload),meta:structuredClone(meta),status:'created',createdAt:this.now().toISOString()};await repo.put('PlatformEvent',event);const handlers=[...(this.handlers.get(type)||[]),...(this.handlers.get('*')||[])];const results=[];for(const h of handlers){try{const out=await h({ctx,event,repo});results.push({ok:true,result:out??null})}catch(error){results.push({ok:false,error:String(error?.message||error)})}}const next={...event,status:results.some(x=>!x.ok)?'partial':'processed',results,processedAt:this.now().toISOString()};await repo.put('PlatformEvent',next);return next;}
}

export const EVENTS=Object.freeze({
  ORDER_CREATED:'order.created',ORDER_PAID:'order.paid',ORDER_CANCELLED:'order.cancelled',ORDER_RETURNED:'order.returned',
  INVENTORY_LOW:'inventory.low',INVENTORY_CHANGED:'inventory.changed',PRICE_CHANGED:'price.changed',
  SLA_BREACH:'sla.breach',DEMAND_UNSERVED:'demand.unserved',OFFER_PUBLISHED:'offer.published',OFFER_SOLD:'offer.sold',
  SHIPMENT_DELAYED:'shipment.delayed',DISAGREEMENT_OPENED:'disagreement.opened',MARKETING_RESULT:'marketing.result',\n  MODERATION_RECEIVED:'moderation.received',MODERATION_ALGORITHM_COMPLETED:'moderation.algorithm.completed',\n  MODERATION_AI_COMPLETED:'moderation.ai.completed',MODERATION_HUMAN_EXCEPTION:'moderation.human.exception'
});
