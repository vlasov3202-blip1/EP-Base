import assert from 'node:assert/strict';
import {normalizeMarketMoreEvent,recordMarketMoreEvent} from './market-more.mjs';

const normalized=normalizeMarketMoreEvent({name:'scene_resumed',refs:{scene_id:'scene-1',context_id:'ctx-1',ignored:'drop-me'}});
assert.equal(normalized.name,'scene_resumed');
assert.deepEqual(normalized.refs,{scene_id:'scene-1',context_id:'ctx-1'});
assert.throws(()=>normalizeMarketMoreEvent({name:'showcase_opened'}),error=>error.code==='MARKET_EVENT_UNSUPPORTED');
assert.throws(()=>normalizeMarketMoreEvent({name:'more_opened',refs:{section:{unsafe:true}}}),error=>error.code==='MARKET_EVENT_INVALID');
assert.throws(()=>normalizeMarketMoreEvent({name:'more_opened',refs:{context_id:'email@example.com'}}),error=>error.code==='MARKET_EVENT_INVALID');

const saved=[];
const store={tenant:ctx=>({async put(entity,record){saved.push({ctx,entity,record});return record;}})};
await recordMarketMoreEvent({store,ctx:{companyId:'eineiro-market'},input:{name:'more_opened',refs:{release_id:'web-v1'}}});
assert.equal(saved.length,1);
assert.equal(saved[0].entity,'MarketFlightEvent');
assert.equal(saved[0].record.refs.release_id,'web-v1');
console.log('EINEIRO Market More Flight Recorder tests: OK');
