import assert from 'node:assert/strict';
import {ContextualOnboardingService} from './contextual-onboarding.mjs';

class Repo{constructor(){this.m=new Map()}async put(t,x){if(!this.m.has(t))this.m.set(t,new Map());this.m.get(t).set(x.id,structuredClone(x));return x}async list(t){return [...(this.m.get(t)?.values()||[])].map(structuredClone)}}
const repo=new Repo();const service=new ContextualOnboardingService({repoFactory:()=>repo});
const ctx={identityId:'i1',companyId:'c1'};

const a=service.buildInitialPath({businessType:'retail',categories:['furniture'],channels:['market'],hasWarehouse:true,employeeCount:4,hasImport:true});
const b=service.buildInitialPath({businessType:'service',categories:['services'],channels:[],hasWarehouse:false,employeeCount:0,hasImport:false});
assert.notDeepEqual(a.steps,b.steps);

let progress=await service.start(ctx,{businessType:'retail',categories:['furniture']});
assert.equal(progress.status,'active');
progress=await service.mark(ctx,'business_type');
assert.ok(progress.completed.includes('business_type'));

const first=await service.hintForFirstUse(ctx,'price_lab');
const second=await service.hintForFirstUse(ctx,'price_lab');
assert.equal(first.feature,'price_lab');
assert.equal(second,null);

const autopilot=service.autonomyEducation('autopilot');
assert.equal(autopilot.executes,true);
assert.ok(autopilot.concepts.includes('rollback'));

console.log('contextual-onboarding.test.mjs ok');
