import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {ObservabilityService} from './observability.mjs';
import {AuditLogService} from './audit-log.mjs';
import {DisasterRecoveryService} from './disaster-recovery.mjs';

const ctx={companyId:'c1',userId:'admin',role:'admin'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
const obs=new ObservabilityService({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T12:00:00Z')});await obs.record(ctx,{kind:'service',name:'market',status:'ok',latencyMs:20});await obs.record(ctx,{kind:'ai_provider',name:'vision-a',status:'error',latencyMs:900,cost:.2,error:'timeout'});repo.put(ctx,'Job',{id:'j1',status:'failed',attempts:3});repo.put(ctx,'ChannelConnection',{id:'ch1',status:'error'});repo.put(ctx,'Decision',{id:'d1',status:'failed'});repo.put(ctx,'PolicyDecision',{id:'p1',effect:'DENY'});const snap=await obs.snapshot(ctx);assert.equal(snap.dlqSize,1);assert.equal(snap.decisionFailures,1);assert.equal(snap.policyDenials,1);assert.equal(snap.aiProvider.errors,1);
const audit=new AuditLogService({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T12:00:00Z')});await audit.write(ctx,{actor:{type:'ai',id:'director'},action:'pause_campaign',object:{id:'c1'},reason:'low stock',decision:{id:'d1'},policy:{id:'pol1'},before:{status:'active'},after:{status:'paused'},result:{ok:true}});assert.equal((await audit.list(ctx)).length,1);
const dr=new DisasterRecoveryService({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T12:00:00Z')});await dr.recordBackupCheck(ctx,{backupId:'b1',integrityOk:true,restoreDryRunOk:true});assert.equal((await dr.health(ctx)).status,'ready');
console.log('EINEIRO observability/DR tests: OK');
