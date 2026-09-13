import assert from 'node:assert/strict';
import {MemoryRepository,createServices} from './core.mjs';
import {AiOperationsService} from './ai-operations.mjs';

const ctx={companyId:'c1',userId:'owner',role:'owner'};
const repo=new MemoryRepository();const {events,audit}=createServices();
const svc=new AiOperationsService({repoFactory:()=>({put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)}),events,audit,now:()=>new Date('2026-09-13T08:00:00Z')});

await svc.correctionStep(ctx,{employeeId:'seller-1',issue:'повторная скидка ниже минимума',stage:'warning',estimatedLoss:12000});
await svc.correctionStep(ctx,{employeeId:'seller-1',issue:'повторная скидка ниже минимума',stage:'task',estimatedLoss:12000});
assert.equal(repo.list(ctx,'Task').length,1);
await svc.correctionStep(ctx,{employeeId:'seller-1',issue:'повторная скидка ниже минимума',stage:'retraining',trainingTopic:'скидки и маржа'});
assert.equal(repo.list(ctx,'TrainingAssignment').length,1);
await svc.correctionStep(ctx,{employeeId:'seller-1',issue:'повторная скидка ниже минимума',stage:'owner_escalation',estimatedLoss:12000});
assert.equal(repo.list(ctx,'Exception').filter(x=>x.requiresOwner).length,1);

const moves=await svc.warehousePlan(ctx,{inventory:[{id:'p1',name:'Двигатель',locationId:'L2',heavy:true,demand:90,ageDays:12},{id:'p2',name:'Дверь',locationId:'L1',demand:20,ageDays:130}],locations:[{id:'L1',zone:'fast',level:1},{id:'L2',zone:'fast',level:2},{id:'L3',zone:'slow',level:1}]});
assert.ok(moves.some(x=>x.productId==='p1'&&x.to==='L1'));
assert.ok(moves.some(x=>x.productId==='p2'&&x.to==='L3'));

const forecast=await svc.forecast(ctx,{metrics:{salesTrend:30,demandIndex:40,stockTurnover:10},externalSignals:[{severity:'high',title:'топливный риск'}]});
assert.equal(forecast.horizonDays,30);assert.equal(forecast.externalSignals.length,1);
const report=await svc.morningReport(ctx,{sales:{orders:12},sla:{firstResponse:4},aiActions:[{type:'followup'}],exceptions:repo.list(ctx,'Exception'),extraSales:46000});
assert.equal(report.interventionRequired,true);assert.equal(report.extraSales,46000);
console.log('EINEIRO AI operations tests: OK');
