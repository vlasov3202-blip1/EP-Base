import crypto from 'node:crypto';

export class EventLayer{
  constructor({repoFactory,now=()=>new Date(),maxAttempts=5,baseDelayMs=1000}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;this.maxAttempts=maxAttempts;this.baseDelayMs=baseDelayMs;this.handlers=new Map();}
  on(type,handler,{id=null}={}){if(typeof handler!=='function')throw new Error('event handler required');if(!this.handlers.has(type))this.handlers.set(type,[]);const list=this.handlers.get(type);const subscriberId=id||handler.subscriberId||`${type}:${list.length+1}`;list.push({id:subscriberId,handler});return this;}
  async emit(ctx,type,payload={},meta={}){
    const repo=this.repoFactory(ctx);const idempotencyKey=meta.idempotencyKey||null;
    if(idempotencyKey){const existing=(await repo.list('PlatformEvent')).find(x=>x.idempotencyKey===idempotencyKey&&x.type===type);if(existing)return existing;}
    const eventId=`evt_${crypto.randomUUID()}`;const createdAt=this.now().toISOString();
    const event={id:eventId,eventId,type,version:Number(meta.version||1),payload:structuredClone(payload),status:'pending',createdAt,occurredAt:meta.occurredAt||createdAt,actor:structuredClone(meta.actor||{type:ctx?.userId?'user':'system',id:ctx?.userId||null,role:ctx?.role||null}),source:meta.source||'eineiro',companyId:ctx?.companyId||meta.companyId||null,correlationId:meta.correlationId||eventId,causationId:meta.causationId||null,idempotencyKey,meta:structuredClone(meta),results:[],replayCount:0};
    await repo.put('PlatformEvent',event);await this.#audit(repo,event,'created',{});return this.dispatch(ctx,eventId);
  }
  async dispatch(ctx,eventId){
    const repo=this.repoFactory(ctx);const event=await repo.get('PlatformEvent',eventId);if(!event)throw new Error('event not found');
    const subscribers=[...(this.handlers.get(event.type)||[]),...(this.handlers.get('*')||[])];const results=[];let anyRetry=false,anyDlq=false;
    for(const subscriber of subscribers){
      const deliveryId=`delivery:${event.id}:${subscriber.id}`;const prev=await repo.get('EventDelivery',deliveryId);if(prev?.status==='succeeded'){results.push({subscriberId:subscriber.id,ok:true,deduplicated:true});continue;}
      if(prev?.nextAttemptAt&&Date.parse(prev.nextAttemptAt)>this.now().getTime()){anyRetry=true;results.push({subscriberId:subscriber.id,ok:false,status:'retry_wait'});continue;}
      const attempts=Number(prev?.attempts||0)+1;const startedAt=this.now().toISOString();
      try{
        const out=await subscriber.handler({ctx,event:structuredClone(event),repo});
        const delivery={id:deliveryId,eventId:event.id,subscriberId:subscriber.id,status:'succeeded',attempts,result:structuredClone(out??null),startedAt,finishedAt:this.now().toISOString(),nextAttemptAt:null,lastError:null};await repo.put('EventDelivery',delivery);results.push({subscriberId:subscriber.id,ok:true,result:out??null});await this.#audit(repo,event,'subscriber_succeeded',{subscriberId:subscriber.id,attempts});
      }catch(error){
        const terminal=attempts>=this.maxAttempts;const nextAttemptAt=terminal?null:new Date(this.now().getTime()+this.baseDelayMs*(2**Math.max(0,attempts-1))).toISOString();const delivery={id:deliveryId,eventId:event.id,subscriberId:subscriber.id,status:terminal?'dead_letter':'retry',attempts,result:null,startedAt,finishedAt:this.now().toISOString(),nextAttemptAt,lastError:String(error?.message||error)};await repo.put('EventDelivery',delivery);results.push({subscriberId:subscriber.id,ok:false,status:delivery.status,error:delivery.lastError});if(terminal)anyDlq=true;else anyRetry=true;await this.#audit(repo,event,terminal?'subscriber_dead_letter':'subscriber_retry',{subscriberId:subscriber.id,attempts,error:delivery.lastError,nextAttemptAt});
      }
    }
    const status=anyDlq?'dead_letter':anyRetry?'partial':'processed';const next={...event,status,results,processedAt:status==='processed'?this.now().toISOString():event.processedAt||null,updatedAt:this.now().toISOString()};await repo.put('PlatformEvent',next);await this.#audit(repo,next,status,{subscriberCount:subscribers.length});return next;
  }
  async processPending(ctx,{limit=100}={}){const repo=this.repoFactory(ctx);const rows=(await repo.list('PlatformEvent')).filter(x=>['pending','partial'].includes(x.status)).slice(0,Math.max(1,limit));const out=[];for(const event of rows)out.push(await this.dispatch(ctx,event.id));return out;}
  async replay(ctx,eventId,{resetDeadLetter=true}={}){const repo=this.repoFactory(ctx);const event=await repo.get('PlatformEvent',eventId);if(!event)throw new Error('event not found');if(resetDeadLetter){const deliveries=(await repo.list('EventDelivery')).filter(x=>x.eventId===eventId&&x.status!=='succeeded');for(const d of deliveries)await repo.put('EventDelivery',{...d,status:'retry',attempts:0,nextAttemptAt:this.now().toISOString(),lastError:null});}const next={...event,status:'pending',replayCount:Number(event.replayCount||0)+1,replayedAt:this.now().toISOString()};await repo.put('PlatformEvent',next);await this.#audit(repo,next,'replay_requested',{replayCount:next.replayCount});return this.dispatch(ctx,eventId);}
  async #audit(repo,event,action,details){const rec={id:`event-audit:${crypto.randomUUID()}`,eventId:event.id,correlationId:event.correlationId,causationId:event.causationId,companyId:event.companyId,action,details:structuredClone(details||{}),at:this.now().toISOString()};await repo.put('EventAudit',rec);return rec;}
}

export const EVENTS=Object.freeze({
  ORDER_CREATED:'order.created',ORDER_PAID:'order.paid',ORDER_COMPLETED:'order.completed',ORDER_CANCELLED:'order.cancelled',ORDER_RETURNED:'order.returned',
  INVENTORY_LOW:'inventory.low',INVENTORY_CHANGED:'inventory.changed',PRICE_CHANGED:'price.changed',
  SLA_BREACH:'sla.breach',DEMAND_UNSERVED:'demand.unserved',OFFER_PUBLISHED:'offer.published',OFFER_SOLD:'offer.sold',
  SHIPMENT_DELAYED:'shipment.delayed',DISAGREEMENT_OPENED:'disagreement.opened',MARKETING_RESULT:'marketing.result'
});
