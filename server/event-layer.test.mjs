import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {EventLayer,EVENTS} from './event-layer.mjs';
import {registerCoreContours} from './contour-runtime.mjs';

const ctx={companyId:'c1',userId:'owner',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
const calls=[];const mock=name=>new Proxy({}, {get:(_,prop)=>async()=>calls.push(`${name}.${String(prop)}`)});
const layer=new EventLayer({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T12:00:00Z')});
registerCoreContours({eventLayer:layer,financeGuard:mock('finance'),warehouse:mock('warehouse'),procurement:mock('procurement'),marketing:mock('marketing'),channelAllocator:mock('channels'),director:mock('director')});
await layer.emit(ctx,EVENTS.INVENTORY_LOW,{productId:'p1',quantity:1});assert.ok(calls.includes('warehouse.onInventoryLow'));assert.ok(calls.includes('procurement.onInventoryLow'));assert.ok(calls.includes('marketing.onInventoryLow'));assert.equal(repo.list(ctx,'ContourSignal').length,1);
await layer.emit(ctx,EVENTS.ORDER_RETURNED,{orderId:'o1'});assert.ok(calls.includes('finance.onReturn'));assert.ok(calls.includes('marketing.onReturn'));assert.ok(calls.includes('director.onReturn'));
await layer.emit(ctx,EVENTS.PRICE_CHANGED,{productId:'p1'});assert.ok(calls.includes('marketing.onPriceChanged'));assert.ok(calls.includes('channels.onPriceChanged'));assert.ok(calls.includes('director.onPriceChanged'));

let once=0;layer.on('test.idempotent',async()=>{once++;},{id:'idempotent-subscriber'});
const one=await layer.emit(ctx,'test.idempotent',{x:1},{idempotencyKey:'same-event'});const duplicate=await layer.emit(ctx,'test.idempotent',{x:1},{idempotencyKey:'same-event'});
assert.equal(one.id,duplicate.id);assert.equal(once,1);assert.equal(one.version,1);assert.equal(one.companyId,'c1');assert.ok(one.correlationId);

let failures=0;const failing=new EventLayer({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T12:00:00Z'),maxAttempts:2,baseDelayMs:0});failing.on('test.fail',async()=>{failures++;throw new Error('boom')},{id:'failing-subscriber'});
let failed=await failing.emit(ctx,'test.fail',{});assert.equal(failed.status,'partial');assert.equal(repo.list(ctx,'EventDelivery').find(x=>x.eventId===failed.id)?.status,'retry');
const retried=await failing.processPending(ctx);assert.equal(retried[0].status,'dead_letter');assert.equal(failures,2);assert.equal(repo.list(ctx,'EventDelivery').find(x=>x.eventId===failed.id)?.status,'dead_letter');
assert.ok(repo.list(ctx,'EventAudit').some(x=>x.eventId===failed.id&&x.action==='subscriber_dead_letter'));

assert.ok(repo.list(ctx,'PlatformEvent').length>=5);
console.log('EINEIRO event layer tests: OK');
