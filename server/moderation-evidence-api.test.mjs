import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Readable,Writable} from 'node:stream';

const evidenceDir=await mkdtemp(path.join(tmpdir(),'eineiro-evidence-api-'));
process.env.EINEIRO_MODERATION_EVIDENCE_KEY=Buffer.alloc(32,9).toString('base64');
process.env.EINEIRO_MODERATION_EVIDENCE_DIR=evidenceDir;
const {handlePlatformApi,getPlatformRuntimeForTests}=await import('./http-api.mjs');

function request(method,url,payload=null,token=null){
  const raw=payload?Buffer.from(JSON.stringify(payload)):Buffer.alloc(0);
  const req=Readable.from(raw.length?[raw]:[]);req.method=method;req.url=url;req.headers={...(token?{authorization:'Bearer '+token}:{})};return req;
}
function response(){
  const chunks=[];const res=new Writable({write(chunk,_encoding,callback){chunks.push(Buffer.from(chunk));callback();}});
  res.statusCode=200;res.headers={};res.writeHead=(status,headers={})=>{res.statusCode=status;res.headers=headers;};const end=res.end.bind(res);res.end=value=>{if(value)chunks.push(Buffer.from(value));return end();};res.payload=()=>{const value=Buffer.concat(chunks).toString('utf8');return value?JSON.parse(value):null;};return res;
}
async function call(method,url,payload,token){
  const req=request(method,url,payload,token),res=response();await handlePlatformApi(req,res);await new Promise(resolve=>res.on('finish',resolve));return{status:res.statusCode,body:res.payload()};
}

try{
  const suffix=crypto.randomUUID().slice(0,8),companyId='evidence-api-'+suffix;
  const rt=await getPlatformRuntimeForTests();
  await rt.auth.register({companyId,userId:'seller-a',email:'seller-a-'+suffix+'@test.local',password:'password123',role:'seller'});
  await rt.auth.register({companyId,userId:'seller-b',email:'seller-b-'+suffix+'@test.local',password:'password123',role:'seller'});
  const a=await rt.auth.login({companyId,email:'seller-a-'+suffix+'@test.local',password:'password123'});
  const b=await rt.auth.login({companyId,email:'seller-b-'+suffix+'@test.local',password:'password123'});
  const ctx={companyId,userId:'seller-a',role:'seller'},repo=rt.store.tenant(ctx);
  await repo.put('ModerationCase',{id:'mod-evidence-api',objectType:'Offer',offerId:'offer-a',productId:'product-a',sellerId:'seller-a',decision:'AUTO_REJECTED',status:'REJECTED'});
  const pdf=Buffer.from('%PDF-1.4\n%%EOF');
  let out=await call('POST','/api/v1/moderation/evidence',{
    moderationCaseId:'mod-evidence-api',
    fileName:'origin.pdf',
    mimeType:'application/pdf',
    kind:'document',
    contentBase64:pdf.toString('base64')
  },a.token);
  assert.equal(out.status,201);
  const evidence=out.body.evidence;
  assert.equal(evidence.fileName,'origin.pdf');
  assert.equal(Object.hasOwn(evidence,'contentBase64'),false);

  out=await call('GET','/api/v1/moderation/cases/mod-evidence-api/evidence',null,a.token);
  assert.equal(out.status,200);
  assert.equal(out.body.items.length,1);

  out=await call('GET','/api/v1/moderation/evidence/'+evidence.id+'?content=1',null,a.token);
  assert.equal(out.status,200);
  assert.deepEqual(Buffer.from(out.body.evidence.contentBase64,'base64'),pdf);

  out=await call('GET','/api/v1/moderation/evidence/'+evidence.id+'?content=1',null,b.token);
  assert.equal(out.status,403);
}finally{
  await rm(evidenceDir,{recursive:true,force:true});
  delete process.env.EINEIRO_MODERATION_EVIDENCE_KEY;
  delete process.env.EINEIRO_MODERATION_EVIDENCE_DIR;
}
console.log('EINEIRO moderation evidence API tests: OK');
