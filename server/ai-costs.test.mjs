import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {AiCostService} from './ai-costs.mjs';
const ctx={companyId:'c1',userId:'u1',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
const svc=new AiCostService({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T10:00:00Z')});
await svc.record(ctx,{feature:'vision',units:1.4,inputUnits:100,outputUnits:20,providerCost:.03});
await svc.record(ctx,{feature:'seller',units:.5,inputUnits:50,outputUnits:10,providerCost:.01});
const s=await svc.summary(ctx);assert.equal(s.currencyLabel,'у.е.');assert.equal(s.requests,2);assert.equal(s.byFeature.vision.requests,1);
console.log('EINEIRO AI cost tests: OK');
