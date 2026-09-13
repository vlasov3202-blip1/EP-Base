import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {FinanceLedgerService} from './finance-ledger.mjs';
import {MarketingService} from './marketing.mjs';
const ctx={companyId:'c1',userId:'owner',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
const finance=new FinanceLedgerService({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T12:00:00Z')});
await finance.closeOrder(ctx,{order:{id:'o1',amount:100000,source:'market'},acquiring:2000,logistics:3000,promotion:5000});const fs=await finance.summary(ctx);assert.equal(fs.income,100000);assert.equal(fs.expenses,10000);assert.equal(fs.cashflow,90000);assert.equal(fs.bySource.market,100000);
const marketing=new MarketingService({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T12:00:00Z')});const c=await marketing.campaign(ctx,{name:'Осень',channel:'market',budget:20000,status:'active'});await marketing.recordPerformance(ctx,c.id,{spent:10000,impressions:10000,clicks:500,leads:50,orders:10,revenue:40000});const rows=await marketing.analyze(ctx);assert.equal(rows[0].roas,4);assert.equal(rows[0].conversion,.2);assert.equal((await marketing.recommendations(ctx))[0].action,'consider_scale');
console.log('EINEIRO finance/marketing tests: OK');
