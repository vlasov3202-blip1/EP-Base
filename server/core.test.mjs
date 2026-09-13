import assert from 'node:assert/strict';
import {createServices,assertCan,can,evaluateDecision} from './core.mjs';

const a={userId:'u1',companyId:'c1',role:'owner'};
const b={userId:'u2',companyId:'c2',role:'owner'};
const seller={userId:'u3',companyId:'c1',role:'seller'};
const {repo,audit,events}=createServices();

repo.put(a,'Product',{id:'p1',name:'A'});
repo.put(b,'Product',{id:'p1',name:'B'});
assert.equal(repo.get(a,'Product','p1').name,'A');
assert.equal(repo.get(b,'Product','p1').name,'B');
assert.equal(repo.list(a,'Product').length,1);
assert.equal(repo.list(b,'Product').length,1);

assert.equal(can('seller','sales.read'),true);
assert.equal(can('seller','finance.read'),false);
assert.doesNotThrow(()=>assertCan(seller,'sales.read'));
assert.throws(()=>assertCan(seller,'finance.read'),/forbidden/);

const ev=events.emit(a,'product.updated',{id:'p1'});
assert.equal(events.list(a).length,1);
assert.equal(events.list(b).length,0);
assert.equal(ev.companyId,'c1');

audit.write(a,{action:'product.update',entity:'Product',entityId:'p1'});
assert.equal(audit.list(a).length,1);
assert.equal(audit.list(b).length,0);

assert.deepEqual(evaluateDecision({confidence:.91}),{mode:'auto',reason:'within_policy'});
assert.deepEqual(evaluateDecision({confidence:.4}),{mode:'owner',reason:'low_confidence'});
assert.deepEqual(evaluateDecision({confidence:.9,financial:true}),{mode:'owner',reason:'financial_confirmation'});

console.log('EINEIRO server core tests: OK');
