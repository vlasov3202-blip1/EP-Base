import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {AutonomyEngine} from './autonomy-engine.mjs';
import {AIDirectorV2} from './ai-director-v2.mjs';

const ctx={companyId:'c1',userId:'owner',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
repo.put(ctx,'Decision',{id:'d1',capability:'marketing',action:'pause_creative',resource:'MarketingCreative',status:'executed',reason:'низкая окупаемость',executionResult:{paused:true},executedAt:'2026-09-13T10:00:00Z'});
repo.put(ctx,'Decision',{id:'d2',capability:'procurement',action:'purchase',resource:'PurchaseOrder',status:'requires_approval',reason:'крупная закупка'});
repo.put(ctx,'PlatformEvent',{id:'e1',type:'inventory.low',payload:{productId:'p1'},status:'processed'});
repo.put(ctx,'ProcurementProposal',{id:'p1-proc',productId:'p1',status:'ready'});
repo.put(ctx,'Exception',{id:'x1',requiresOwner:true,status:'open',title:'Крупная закупка'});
const autonomy=new AutonomyEngine({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T12:00:00Z')});const a=await autonomy.measure(ctx);assert.equal(a.autonomousActions,1);assert.equal(a.humanRequired>=1,true);
const director=new AIDirectorV2({repoFactory:()=>wrap,autonomyEngine:autonomy,now:()=>new Date('2026-09-13T12:00:00Z')});const r=await director.analyze(ctx);assert.equal(r.state,'needs_owner');assert.equal(r.chains.some(x=>x.root==='inventory.low'),true);assert.equal(r.recentAutonomousActions.some(x=>x.action==='pause_creative'),true);
console.log('EINEIRO director/autonomy tests: OK');
