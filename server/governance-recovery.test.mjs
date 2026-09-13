import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {FinanceGuardService} from './finance-guard.mjs';
import {FeatureFlagService} from './feature-flags.mjs';
import {ModerationService} from './moderation.mjs';
import {MarketingMemoryService} from './marketing-memory.mjs';

const ctx={companyId:'c1',userId:'owner',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
repo.put(ctx,'FinanceEntry',{id:'i1',type:'income',amount:500000});repo.put(ctx,'FinanceEntry',{id:'e1',type:'expense',amount:100000});
const finance=new FinanceGuardService({repoFactory:()=>wrap,rules:{minCashReserve:100000}});assert.equal((await finance.authorize(ctx,{domain:'marketing',amount:50000,marginPercent:30})).decision,'ALLOW');assert.equal((await finance.authorize(ctx,{domain:'procurement',amount:350000,marginPercent:30})).decision!=='ALLOW',true);
const flags=new FeatureFlagService({repoFactory:()=>wrap});await flags.put(ctx,{key:'vision-v2',enabled:true,tenantIds:['c1'],percentage:100});assert.equal(await flags.enabled(ctx,'vision-v2'),true);assert.equal(await flags.enabled({...ctx,companyId:'c2'},'vision-v2'),false);
repo.put(ctx,'Product',{id:'p1',name:'Товар',description:'Описание',attributes:{brand:'A'},documents:[]});const moderation=new ModerationService({repoFactory:()=>wrap});const mod=await moderation.review(ctx,{productId:'p1',categorySchema:{mandatoryFields:['brand'],documents:['certificate']}});assert.equal(mod.status,'blocked');
const memory=new MarketingMemoryService({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T12:00:00Z')});await memory.remember(ctx,{campaignId:'c1',channel:'eineiro_market',audience:{region:'Москва'},variables:{headline:'A'},result:'winner'});const sim=await memory.similar(ctx,{channel:'eineiro_market',audience:{region:'Москва'}});assert.equal(sim.length,1);const exp=await memory.nextExperiment(ctx,{campaignId:'c1',channel:'eineiro_market',baselineCreativeId:'a',candidateCreativeId:'b',variable:'headline'});assert.deepEqual(exp.changedVariables,['headline']);
console.log('EINEIRO governance recovery tests: OK');
