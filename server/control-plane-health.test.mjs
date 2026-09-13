import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {CapabilityAccessService} from './security-hardening.mjs';
import {ObservabilityService} from './observability.mjs';
import {DisasterRecoveryService} from './disaster-recovery.mjs';

const memory=new MemoryRepository();
const repoFactory=ctx=>({put:(entity,record)=>memory.put(ctx,entity,record),get:(entity,id)=>memory.get(ctx,entity,id),list:entity=>memory.list(ctx,entity)});
const now=()=>new Date('2026-09-13T14:00:00Z');
const admin={companyId:'c1',userId:'u-admin',identityId:'i-admin',role:'admin'};
const auditor={companyId:'c1',userId:'u-audit',identityId:'i-audit',role:'auditor'};

await repoFactory(admin).put('CompanyMembership',{id:'membership:i-audit:c1:auditor',identityId:'i-audit',companyId:'c1',role:'auditor',capabilities:['platform.health.read'],status:'active'});
const access=new CapabilityAccessService({repoFactory,roleCapabilities:{admin:['platform.*']}});
assert.equal((await access.require(admin,'platform.flags.write')).capability,'platform.flags.write');
assert.equal((await access.require(auditor,'platform.health.read')).capability,'platform.health.read');
await assert.rejects(()=>access.require(auditor,'platform.flags.write'),e=>e.code==='FORBIDDEN_CAPABILITY');

const repo=repoFactory(admin);
await repo.put('ConnectorHealth',{id:'health:avito',connectorId:'avito',status:'degraded',lastFailureAt:now().toISOString(),lastError:{code:'RATE_LIMITED'}});
await repo.put('Job',{id:'job1',status:'dead_letter',attempts:3});
await repo.put('Decision',{id:'dec1',status:'failed'});
await repo.put('PolicyDecision',{id:'pol1',effect:'DENY'});
await repo.put('AiProviderState',{id:'provider1',status:'degraded',latencyMs:900,cost:.12});
const obs=new ObservabilityService({repoFactory,now});
await obs.record(admin,{kind:'ai_provider',name:'provider1',status:'error',latencyMs:900,cost:.12,error:'provider timeout'});
const snapshot=await obs.snapshot(admin);
assert.equal(snapshot.connectorHealth.error,1);
assert.equal(snapshot.dlqSize,1);
assert.equal(snapshot.decisionFailures,1);
assert.equal(snapshot.policyDenials,1);
assert.equal(snapshot.aiProvider.errors,1);

const dr=new DisasterRecoveryService({repoFactory,now});
await dr.recordBackupCheck(admin,{backupId:'b1',integrityOk:true,restoreDryRunOk:true});
assert.equal((await dr.health(admin)).status,'ready');

console.log('EINEIRO Control Plane health/capability tests: OK');
