import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {FeatureFlagService} from './feature-flags.mjs';
import {ModerationService} from './moderation.mjs';
import {MarketingMemoryService} from './marketing-memory.mjs';

const ctx={companyId:'c1',userId:'admin',role:'admin'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
const flags=new FeatureFlagService({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T13:00:00Z')});await flags.put(ctx,{id:'vision-home',type:'vision',enabled:true,tenantIds:['c1'],percentage:100});assert.equal((await flags.evaluate(ctx,{flagId:'vision-home',tenantId:'c1',userId:'u1'})).enabled,true);
const moderation=new ModerationService({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T13:00:00Z')});await moderation.setCategoryPolicy(ctx,{categoryId:'electronics.phone',mandatoryFields:['batteryHealth'],restricted:false});const bad=await moderation.evaluate(ctx,{id:'p1',categoryId:'electronics.phone',attributes:{}});assert.equal(bad.allowed,false);const good=await moderation.evaluate(ctx,{id:'p2',categoryId:'electronics.phone',attributes:{batteryHealth:91}});assert.equal(good.allowed,true);
const memory=new MarketingMemoryService({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T13:00:00Z')});await memory.remember(ctx,{campaignId:'c1',testId:'t1',channel:'eineiro_market',audience:{segment:'new'},winnerCreativeId:'cr1',controlCreativeId:'cr0',learning:'короткий оффер дал выше конверсию'});const found=await memory.query(ctx,{channel:'eineiro_market'});assert.equal(found.length,1);assert.equal(found[0].winnerCreativeId,'cr1');
console.log('EINEIRO control plane governance tests: OK');
