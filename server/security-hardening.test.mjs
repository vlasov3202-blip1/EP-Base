import assert from 'node:assert/strict';
import {CapabilityAccessService,SecurityControlService} from './security-hardening.mjs';

class Repo{constructor(){this.m=new Map()}async put(t,x){if(!this.m.has(t))this.m.set(t,new Map());this.m.get(t).set(x.id,structuredClone(x));return x}async get(t,id){return this.m.get(t)?.get(id)||null}async list(t){return [...(this.m.get(t)?.values()||[])].map(value=>structuredClone(value))}}
const repo=new Repo();const ctx={companyId:'c1',identityId:'i1',role:'seller'};
await repo.put('CompanyMembership',{id:'membership:i1:c1:seller',identityId:'i1',companyId:'c1',role:'seller',capabilities:['sales.read'],status:'active'});
const access=new CapabilityAccessService({repoFactory:()=>repo,roleCapabilities:{seller:['orders.read']}});
await access.require(ctx,'sales.read');await access.require(ctx,'orders.read');
await assert.rejects(()=>access.require(ctx,'finance.read'),e=>e.code==='FORBIDDEN_CAPABILITY');

let now=new Date('2026-09-13T10:00:00Z');const sec=new SecurityControlService({repoFactory:()=>repo,now:()=>now,stepUpTtlMs:1000,maxAttempts:2});
await sec.registerSession(ctx,{identityId:'i1',sessionId:'s1'});await sec.registerSession(ctx,{identityId:'i1',sessionId:'s2'});
await assert.rejects(()=>sec.requireStepUp(ctx,{identityId:'i1',sessionId:'s1'}),e=>e.code==='STEP_UP_REQUIRED');
await sec.issueStepUp(ctx,{identityId:'i1',sessionId:'s1'});await sec.requireStepUp(ctx,{identityId:'i1',sessionId:'s1'});
now=new Date('2026-09-13T10:00:02Z');await assert.rejects(()=>sec.requireStepUp(ctx,{identityId:'i1',sessionId:'s1'}),e=>e.code==='STEP_UP_REQUIRED');

await sec.recordAttempt(ctx,{subject:'u@example.test',success:false});await sec.recordAttempt(ctx,{subject:'u@example.test',success:false});await assert.rejects(()=>sec.recordAttempt(ctx,{subject:'u@example.test',success:false}),e=>e.code==='RATE_LIMITED');
const revoked=await sec.emergencyRevoke(ctx,{identityId:'i1'});assert.equal(revoked.length,2);assert.equal((await sec.listSessions(ctx,'i1')).length,0);
await sec.setMfaPolicy(ctx,{companyId:'c1',roles:['owner','admin'],required:true});assert.equal(await sec.requiresMfa(ctx,{companyId:'c1',role:'owner'}),true);assert.equal(await sec.requiresMfa(ctx,{companyId:'c1',role:'seller'}),false);
console.log('security-hardening.test.mjs ok');
