import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {PolicyEngine} from './policy-engine.mjs';
import {DecisionEngine} from './decision-engine.mjs';

const ctx={companyId:'c1',userId:'owner',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
const policy=new PolicyEngine({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T12:00:00Z')});
await policy.put(ctx,{id:'mkt-budget',scope:'marketing',subject_type:'ai',action:'increase_budget',resource:'MarketingCampaign',effect:'ALLOW',condition:{maxAmount:50000},reason:'в пределах месячного бюджета'});
await policy.put(ctx,{id:'purchase-owner',scope:'procurement',subject_type:'ai',action:'purchase',resource:'PurchaseOrder',effect:'REQUIRE_APPROVAL',condition:{maxAmount:300000},reason:'закупка требует решения владельца'});
const d=new DecisionEngine({repoFactory:()=>wrap,policyEngine:policy,now:()=>new Date('2026-09-13T12:00:00Z')});
const ok=await d.decide(ctx,{capability:'marketing',action:'increase_budget',resource:'MarketingCampaign',proposal:{campaignId:'c1'},amount:20000,confidence:.92});assert.equal(ok.status,'approved');const ex=await d.execute(ctx,ok.id,async()=>({changed:true}));assert.equal(ex.status,'executed');
const need=await d.decide(ctx,{capability:'procurement',action:'purchase',resource:'PurchaseOrder',proposal:{productId:'p1'},amount:100000,confidence:.9,reason:'пополнение запаса'});assert.equal(need.status,'requires_approval');assert.equal(repo.list(ctx,'Exception').length,1);
console.log('EINEIRO policy/decision tests: OK');
