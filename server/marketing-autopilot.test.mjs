import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {MarketingAutopilotService} from './marketing-autopilot.mjs';

const ctx={companyId:'c1',userId:'owner',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
let n=0;const creativeGenerator=async()=>({headline:`Вариант ${++n}`,text:'Тестовая подача',cta:'Открыть',visualPrompt:'визуал',assetUrl:`https://assets.test/${n}.jpg`,format:'image',renderStatus:'ready'});
const svc=new MarketingAutopilotService({repoFactory:()=>wrap,creativeGenerator,now:()=>new Date('2026-09-13T12:00:00Z')});
const campaign=await svc.createCampaign(ctx,{name:'Осень',channels:['eineiro_market','avito'],products:['P1'],dailyBudget:3000});
const creatives=await svc.generateCreatives(ctx,{campaignId:campaign.id,count:3});assert.equal(creatives.length,3);assert.ok(creatives.every(x=>x.renderStatus==='ready'));
const test=await svc.launchTest(ctx,{campaignId:campaign.id,creativeIds:creatives.map(x=>x.id),channel:'eineiro_market',budget:900});assert.equal(test.status,'running');
await svc.recordMetrics(ctx,{testId:test.id,creativeId:creatives[0].id,impressions:1000,clicks:80,orders:8,revenue:16000,spend:600});
await svc.recordMetrics(ctx,{testId:test.id,creativeId:creatives[1].id,impressions:1000,clicks:20,orders:1,revenue:1800,spend:600});
await svc.recordMetrics(ctx,{testId:test.id,creativeId:creatives[2].id,impressions:1000,clicks:35,orders:2,revenue:3200,spend:600});
const result=await svc.optimize(ctx,{testId:test.id});assert.equal(result.status,'optimized');assert.equal(result.winner.creativeId,creatives[0].id);assert.ok(result.actions.some(x=>x.type==='pause_creative'));assert.ok(result.actions.some(x=>x.type==='new_variant'));
const placement=await svc.createMarketplacePlacement(ctx,{campaignId:campaign.id,creativeId:creatives[0].id});assert.equal(placement.channel,'eineiro_market');assert.equal(placement.status,'active');
console.log('EINEIRO marketing autopilot tests: OK');
