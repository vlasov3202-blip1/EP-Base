import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {PriceLabService} from './price-lab.mjs';

const ctx={companyId:'c1',userId:'u1',role:'seller'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
repo.put(ctx,'Product',{id:'p1',name:'Фара'});repo.put(ctx,'Offer',{id:'o1',productId:'p1',sellerId:'s1',price:25000,status:'active'});
const svc=new PriceLabService({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T10:00:00Z')});
const rec=await svc.recommendation(ctx,{offerId:'o1',currentPrice:25000,cost:16000,demand:90,ageDays:20,marketMedian:26000,minMarginPercent:20});
assert.ok(rec.optimalPrice>=rec.minimumPrice);assert.ok(rec.minimumPrice>=19200);assert.equal(rec.offerId,'o1');
const low=await svc.validateDeal(ctx,{offerId:'o1',proposedPrice:rec.minimumPrice-1000,role:'seller'});assert.equal(low.requiresApproval,true);assert.equal(low.reason,'below_minimum');
const ok=await svc.validateDeal(ctx,{offerId:'o1',proposedPrice:rec.optimalPrice,role:'seller'});assert.equal(ok.allowed,true);
await svc.apply(ctx,{offerId:'o1',price:rec.optimalPrice});assert.equal(repo.get(ctx,'Offer','o1').price,rec.optimalPrice);assert.equal(repo.get(ctx,'Product','p1').price,undefined);
console.log('EINEIRO Price Lab tests: OK');
