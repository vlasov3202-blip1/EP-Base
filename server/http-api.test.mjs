import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {handlePlatformApi,getPlatformRuntimeForTests} from './http-api.mjs';

function req(method,url,payload=null,token=null){const body=payload?Buffer.from(JSON.stringify(payload)):Buffer.alloc(0);const r=Readable.from(body.length?[body]:[]);r.method=method;r.url=url;r.headers={...(token?{authorization:`Bearer ${token}`}:{})};return r}
function res(){const chunks=[];const w=new Writable({write(c,_e,cb){chunks.push(Buffer.from(c));cb()}});w.statusCode=200;w.headers={};w.writeHead=(s,h={})=>{w.statusCode=s;w.headers=h};const end=w.end.bind(w);w.end=(c)=>{if(c)chunks.push(Buffer.from(c));return end()};w.payload=()=>{const t=Buffer.concat(chunks).toString('utf8');return t?JSON.parse(t):null};return w}
async function call(method,url,payload,token){const request=req(method,url,payload,token),response=res();await handlePlatformApi(request,response);await new Promise(r=>response.on('finish',r));return{status:response.statusCode,body:response.payload()}}

const rt=await getPlatformRuntimeForTests();
await rt.auth.register({companyId:'api-c1',userId:'owner1',email:'owner1@test.local',password:'password123',role:'owner'}).catch(()=>{});
await rt.auth.register({companyId:'api-c2',userId:'owner2',email:'owner2@test.local',password:'password123',role:'owner'}).catch(()=>{});
await rt.auth.register({companyId:'api-c1',userId:'seller1',email:'seller1@test.local',password:'password123',role:'seller'}).catch(()=>{});
const a=await rt.auth.login({companyId:'api-c1',email:'owner1@test.local',password:'password123'});
const b=await rt.auth.login({companyId:'api-c2',email:'owner2@test.local',password:'password123'});
const s=await rt.auth.login({companyId:'api-c1',email:'seller1@test.local',password:'password123'});

let out=await call('GET','/api/v1/products',null,null);assert.equal(out.status,401);
out=await call('POST','/api/v1/products',{id:'p1',name:'Tenant A product'},a.token);assert.equal(out.status,201);
out=await call('POST','/api/v1/products',{id:'p1',name:'Tenant B product'},b.token);assert.equal(out.status,201);
out=await call('GET','/api/v1/products',null,a.token);assert.equal(out.body.items.length,1);assert.equal(out.body.items[0].name,'Tenant A product');
out=await call('GET','/api/v1/products',null,b.token);assert.equal(out.body.items.length,1);assert.equal(out.body.items[0].name,'Tenant B product');
out=await call('POST','/api/v1/products',{id:'p2',name:'forbidden'},s.token);assert.equal(out.status,403);
out=await call('GET','/api/me',null,s.token);assert.equal(out.status,200);assert.equal(out.body.companyId,'api-c1');assert.equal(out.body.role,'seller');
console.log('EINEIRO HTTP API tests: OK');
