import assert from 'node:assert/strict';
import {effectiveCapabilities,assertCapability,publicationAllowed,calculateOrderEconomics} from './entitlements.mjs';

assert.equal(effectiveCapabilities({plan:'Start'}).ai,false);
assert.equal(effectiveCapabilities({plan:'Pilot'}).automation,'recommend');
assert.equal(effectiveCapabilities({plan:'Autopilot'}).automation,'execute_with_policy');
assert.equal(effectiveCapabilities({plan:'Autopilot',graceActive:true}).publishing,false);
assert.throws(()=>assertCapability({plan:'Start'},'ai'),e=>e.code==='PLAN_AI_DISABLED');
assert.throws(()=>assertCapability({plan:'Autopilot',graceActive:true},'publishing'),e=>e.code==='PLAN_PUBLISHING_DISABLED');
assert.doesNotThrow(()=>assertCapability({plan:'Autopilot'},'ai'));
assert.equal(publicationAllowed({channel:'ozon',product:{categoryId:'auto.headlight',condition:'used'}}).allowed,false);
assert.equal(publicationAllowed({channel:'ozon',product:{categoryId:'auto.headlight',condition:'new'}}).allowed,true);
const e=calculateOrderEconomics({items:[{price:10000,quantity:2}],acquiring:400,logistics:800,promotion:300});
assert.equal(e.saleCommission,0);assert.equal(e.merchandise,20000);assert.equal(e.sellerReceives,18500);
console.log('EINEIRO tariff and economics tests: OK');
