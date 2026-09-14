import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {FixedWindowRateLimiter,assertJsonComplexity,installSecurityHeaders,readJsonBody,securityHeaders} from './http-security.mjs';

let now=1000;const limiter=new FixedWindowRateLimiter({now:()=>now});
limiter.consume('login:ip',{limit:2,windowMs:1000});
limiter.consume('login:ip',{limit:2,windowMs:1000});
assert.throws(()=>limiter.consume('login:ip',{limit:2,windowMs:1000}),error=>error.code==='RATE_LIMITED'&&error.status===429);
now=2001;assert.equal(limiter.consume('login:ip',{limit:2,windowMs:1000}).remaining,1);

const req=Readable.from([Buffer.from('{"safe":[1,2,3]}')]);req.headers={'content-length':'16'};
assert.deepEqual(await readJsonBody(req,{maxBytes:100}),{safe:[1,2,3]});
const tooLarge=Readable.from([Buffer.from('{"x":"123456"}')]);tooLarge.headers={};
await assert.rejects(()=>readJsonBody(tooLarge,{maxBytes:5}),error=>error.code==='PAYLOAD_TOO_LARGE');
assert.throws(()=>assertJsonComplexity({a:{b:{c:1}}},{maxDepth:1}),error=>error.code==='JSON_TOO_DEEP');
assert.throws(()=>assertJsonComplexity(JSON.parse('{"__proto__":{"polluted":true}}')),error=>error.code==='UNSAFE_JSON_KEY');

const response=new Writable({write(_c,_e,cb){cb()}});response.headers={};response.writeHead=(status,headers)=>{response.status=status;response.headers=headers};
const fakeReq={};installSecurityHeaders(fakeReq,response);response.writeHead(200,{'Content-Type':'text/plain'});
assert.equal(response.headers['X-Frame-Options'],'DENY');
assert.equal(response.headers['X-Content-Type-Options'],'nosniff');
assert.ok(response.headers['Content-Security-Policy'].includes("frame-ancestors 'none'"));
assert.ok(fakeReq.securityRequestId);
assert.equal('Strict-Transport-Security' in securityHeaders(),process.env.NODE_ENV==='production');
console.log('EINEIRO HTTP security tests: OK');
