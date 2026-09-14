import assert from 'node:assert/strict';
import {PostgresFixedWindowRateLimiter} from './distributed-rate-limit.mjs';

class FakePool{
  constructor(){this.counts=new Map();this.calls=[];this.fail=false;}
  async query(sql,params=[]){
    this.calls.push({sql:String(sql),params});if(this.fail)throw new Error('database down');
    if(String(sql).startsWith('DELETE'))return{rows:[]};
    const count=(this.counts.get(params[0])||0)+1;this.counts.set(params[0],count);return{rows:[{count,reset_at:params[1]}]};
  }
}

let now=61_000;const pool=new FakePool();const limiter=new PostgresFixedWindowRateLimiter(pool,{now:()=>now,cleanupEvery:2,hashKey:'12345678901234567890123456789012'});
assert.equal((await limiter.consume('login:203.0.113.9',{limit:2,windowMs:60_000})).remaining,1);
assert.equal((await limiter.consume('login:203.0.113.9',{limit:2,windowMs:60_000})).remaining,0);
await assert.rejects(()=>limiter.consume('login:203.0.113.9',{limit:2,windowMs:60_000}),e=>e.code==='RATE_LIMITED'&&e.status===429);
assert.equal(pool.calls[0].params[0].length,64);
assert.equal(pool.calls[0].params[0].includes('203.0.113.9'),false);
assert.ok(pool.calls.some(x=>x.sql.startsWith('DELETE')));
now=121_000;assert.equal((await limiter.consume('login:203.0.113.9',{limit:2,windowMs:60_000})).remaining,1);
pool.fail=true;await assert.rejects(()=>limiter.consume('login:x',{limit:2,windowMs:60_000}),e=>e.code==='RATE_LIMIT_BACKEND_UNAVAILABLE'&&e.status===503);
assert.throws(()=>new PostgresFixedWindowRateLimiter(new FakePool(),{hashKeyRequired:true,hashKey:'short'}),e=>e.code==='RATE_LIMIT_HASH_KEY_REQUIRED');
console.log('EINEIRO distributed rate limit tests: OK');
