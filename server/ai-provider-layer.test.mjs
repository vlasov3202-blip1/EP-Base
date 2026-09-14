import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {AiProviderRegistry} from './ai-provider-layer.mjs';
import {degradedMode} from './ai-degraded-mode.mjs';
import {PrivacyGateway} from './privacy-gateway.mjs';

const ctx={companyId:'c1',userId:'owner',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
const reg=new AiProviderRegistry({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T12:00:00Z')});
reg.register({id:'fast-cheap',capabilities:['reasoning'],execute:async()=>{throw new Error('down')}});reg.register({id:'backup',capabilities:['reasoning'],execute:async({input})=>({ok:true,input})});
await reg.setHealth(ctx,'fast-cheap',{status:'healthy',qualityScore:90,costScore:10,latencyMs:100,allowedRegions:['RU']});await reg.setHealth(ctx,'backup',{status:'healthy',qualityScore:80,costScore:20,latencyMs:200,allowedRegions:['RU']});
const out=await reg.execute(ctx,{capability:'reasoning',input:{x:1},region:'RU'});assert.equal(out.providerId,'backup');assert.equal(out.output.ok,true);const runs=repo.list(ctx,'AiProviderRun');assert.equal(runs.length,1);
const privateOut=await reg.execute(ctx,{capability:'reasoning',input:{email:'seller@example.com'},region:'RU',privacyGateway:new PrivacyGateway()});assert.equal(privateOut.output.input.email.includes('seller@example.com'),false);
assert.equal(degradedMode('embedding').status,'lexical_only');assert.equal(degradedMode('vision').status,'manual_fallback');assert.equal(degradedMode('generation').status,'hold');
console.log('EINEIRO AI provider layer tests: OK');
