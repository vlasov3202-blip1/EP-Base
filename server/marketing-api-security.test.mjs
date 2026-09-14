import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {getPlatformRuntimeForTests} from './http-api.mjs';
import {handleMarketingApi} from './marketing-api.mjs';

process.env.SELLER_CAMPAIGNS_ENABLED='false';process.env.SPONSORED_SHOWCASE_ENABLED='false';delete process.env.EINEIRO_ROOT_OWNER_USER_ID;

function request(method,url,payload,token){const bytes=payload?Buffer.from(JSON.stringify(payload)):Buffer.alloc(0);const req=Readable.from(bytes.length?[bytes]:[]);req.method=method;req.url=url;req.headers={authorization:`Bearer ${token}`};return req;}
function response(){const chunks=[];const res=new Writable({write(chunk,_encoding,done){chunks.push(Buffer.from(chunk));done();}});res.writeHead=status=>{res.statusCode=status;};const end=res.end.bind(res);res.end=chunk=>{if(chunk)chunks.push(Buffer.from(chunk));return end();};res.body=()=>JSON.parse(Buffer.concat(chunks).toString()||'{}');return res;}
async function call(method,url,payload,token){const req=request(method,url,payload,token),res=response();await handleMarketingApi(req,res);await new Promise(resolve=>res.on('finish',resolve));return{status:res.statusCode,body:res.body()};}

const rt=await getPlatformRuntimeForTests();const suffix=Date.now();
await rt.auth.register({companyId:`marketing-owner-${suffix}`,userId:`owner-${suffix}`,email:`owner-${suffix}@test.local`,password:'password123',role:'owner'});
await rt.auth.register({companyId:`marketing-admin-${suffix}`,userId:`admin-${suffix}`,email:`admin-${suffix}@test.local`,password:'password123',role:'admin'});
const owner=await rt.auth.login({companyId:`marketing-owner-${suffix}`,email:`owner-${suffix}@test.local`,password:'password123'});const admin=await rt.auth.login({companyId:`marketing-admin-${suffix}`,email:`admin-${suffix}@test.local`,password:'password123'});
let out=await call('POST','/api/v1/marketing/campaigns',{name:'blocked'},owner.token);assert.equal(out.status,503);assert.equal(out.body.code,'SELLER_CAMPAIGNS_DISABLED');
out=await call('GET','/api/v1/platform-acquisition',null,owner.token);assert.equal(out.status,403);
out=await call('GET','/api/v1/platform-acquisition',null,admin.token);assert.equal(out.status,200);assert.equal(out.body.flags.sponsoredShowcaseEnabled,false);
out=await call('POST','/api/v1/platform-acquisition/campaigns',{channel:'yandex_direct',dailyBudget:10},admin.token);assert.equal(out.status,503);assert.equal(out.body.code,'ROOT_OWNER_NOT_CONFIGURED');
console.log('EINEIRO marketing API security tests: OK');
