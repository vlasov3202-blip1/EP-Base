import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {handleBusinessApi} from './business-api.mjs';
import {getPlatformRuntimeForTests} from './http-api.mjs';

function request(token){const req=Readable.from([]);req.method='GET';req.url='/api/v1/business/snapshot';req.headers={authorization:`Bearer ${token}`};return req}
function response(){const chunks=[];const res=new Writable({write(chunk,_encoding,callback){chunks.push(Buffer.from(chunk));callback()}});res.statusCode=200;res.writeHead=(status)=>{res.statusCode=status};const end=res.end.bind(res);res.end=(chunk)=>{if(chunk)chunks.push(Buffer.from(chunk));return end()};res.payload=()=>JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');return res}
async function call(token){const req=request(token),res=response();await handleBusinessApi(req,res);await new Promise(resolve=>res.on('finish',resolve));return{status:res.statusCode,body:res.payload()}}

const rt=await getPlatformRuntimeForTests();const suffix=Date.now().toString(36);const companyId='security-business-'+suffix;
await rt.auth.register({companyId,userId:'owner-'+suffix,email:'owner-'+suffix+'@test.local',password:'owner-password',role:'owner'});
await rt.auth.register({companyId,userId:'manager-'+suffix,email:'manager-'+suffix+'@test.local',password:'manager-password',role:'manager'});
await rt.auth.register({companyId,userId:'seller-'+suffix,email:'seller-'+suffix+'@test.local',password:'seller-password',role:'seller'});
await rt.auth.register({companyId,userId:'warehouse-'+suffix,email:'warehouse-'+suffix+'@test.local',password:'warehouse-password',role:'warehouse'});
await rt.store.tenant({companyId}).put('FinanceEntry',{id:'finance-secret',amount:999999,description:'owner only'});
const owner=await rt.auth.login({companyId,email:'owner-'+suffix+'@test.local',password:'owner-password'});
const manager=await rt.auth.login({companyId,email:'manager-'+suffix+'@test.local',password:'manager-password'});
const seller=await rt.auth.login({companyId,email:'seller-'+suffix+'@test.local',password:'seller-password'});
const warehouse=await rt.auth.login({companyId,email:'warehouse-'+suffix+'@test.local',password:'warehouse-password'});
const ownerOut=await call(owner.token);assert.equal(ownerOut.status,200);assert.equal(ownerOut.body.financeEntries[0].amount,999999);
assert.equal((await call(manager.token)).status,200);
const sellerOut=await call(seller.token);assert.equal(sellerOut.status,403);assert.equal(sellerOut.body.code,'FORBIDDEN');
const warehouseOut=await call(warehouse.token);assert.equal(warehouseOut.status,403);assert.equal(warehouseOut.body.code,'FORBIDDEN');
console.log('EINEIRO Business API authorization tests: OK');
