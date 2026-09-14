import assert from 'node:assert/strict';
import {AuditLogService} from './audit-log.mjs';

class Repo{constructor(){this.m=new Map()}async put(t,x){if(!this.m.has(t))this.m.set(t,new Map());this.m.get(t).set(x.id,structuredClone(x));return x}async list(t){return [...(this.m.get(t)?.values()||[])].map(x=>structuredClone(x))}}
const repo=new Repo();const ctx={companyId:'c1',userId:'owner-1',role:'owner'};let tick=0;
const audit=new AuditLogService({repoFactory:()=>repo,integrityKey:'12345678901234567890123456789012',now:()=>new Date(1_700_000_000_000+tick++)});
const first=await audit.write(ctx,{actor:{id:'owner-1'},action:'api_key.create',object:{id:'key-1'}});
const second=await audit.write(ctx,{actor:{id:'owner-1'},action:'product.update',object:{id:'p1'}});
assert.equal(first.sequence,1);assert.equal(second.sequence,2);assert.equal(second.previousHash,first.eventHash);assert.equal(first.eventHash.length,64);
assert.deepEqual(await audit.verify(ctx),{ok:true,events:2,headHash:second.eventHash,integrityMode:'hmac-sha256',failures:[],verifiedAt:new Date(1_700_000_000_002).toISOString()});
const alerts=await repo.list('SecurityAlert');assert.equal(alerts.length,1);assert.equal(alerts[0].severity,'high');
repo.m.get('UnifiedAudit').get(first.id).object.id='tampered';const verification=await audit.verify(ctx);assert.equal(verification.ok,false);assert.ok(verification.failures.some(x=>x.id===first.id&&x.code==='EVENT_HASH_MISMATCH'));
assert.throws(()=>new AuditLogService({repoFactory:()=>repo,integrityRequired:true,integrityKey:''}),e=>e.code==='AUDIT_INTEGRITY_KEY_REQUIRED');
console.log('EINEIRO audit integrity tests: OK');
