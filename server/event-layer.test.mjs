import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {EventLayer,EVENTS} from './event-layer.mjs';
import {registerCoreContours} from './contour-runtime.mjs';

const ctx={companyId:'c1',userId:'owner',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
const calls=[];const mock=name=>new Proxy({}, {get:(_,prop)=>async(c,p)=>calls.push(`${name}.${String(prop)}`)});
const layer=new EventLayer({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T12:00:00Z')});
registerCoreContours({eventLayer:layer,financeGuard:mock('finance'),warehouse:mock('warehouse'),procurement:mock('procurement'),marketing:mock('marketing'),channelAllocator:mock('channels'),director:mock('director')});
await layer.emit(ctx,EVENTS.INVENTORY_LOW,{productId:'p1',quantity:1});assert.ok(calls.includes('warehouse.onInventoryLow'));assert.ok(calls.includes('procurement.onInventoryLow'));assert.ok(calls.includes('marketing.onInventoryLow'));assert.equal(repo.list(ctx,'ContourSignal').length,1);
await layer.emit(ctx,EVENTS.ORDER_RETURNED,{orderId:'o1'});assert.ok(calls.includes('finance.onReturn'));assert.ok(calls.includes('marketing.onReturn'));assert.ok(calls.includes('director.onReturn'));
await layer.emit(ctx,EVENTS.PRICE_CHANGED,{productId:'p1'});assert.ok(calls.includes('marketing.onPriceChanged'));assert.ok(calls.includes('channels.onPriceChanged'));assert.ok(calls.includes('director.onPriceChanged'));
assert.equal(repo.list(ctx,'PlatformEvent').length,3);
console.log('EINEIRO event layer tests: OK');
