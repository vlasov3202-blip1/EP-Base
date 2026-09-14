import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable,Writable} from 'node:stream';
import {handlePlatformApi,getPlatformRuntimeForTests} from './http-api.mjs';
import {OfferService} from './offers.mjs';

function request(method,url,payload=null,token=null){
  const raw=payload?Buffer.from(JSON.stringify(payload)):Buffer.alloc(0);
  const req=Readable.from(raw.length?[raw]:[]);
  req.method=method;
  req.url=url;
  req.headers={...(token?{authorization:'Bearer '+token}:{})};
  return req;
}

function response(){
  const chunks=[];
  const res=new Writable({write(chunk,_encoding,callback){chunks.push(Buffer.from(chunk));callback();}});
  res.statusCode=200;
  res.headers={};
  res.writeHead=(status,headers={})=>{res.statusCode=status;res.headers=headers;};
  const end=res.end.bind(res);
  res.end=value=>{if(value)chunks.push(Buffer.from(value));return end();};
  res.payload=()=>{const text=Buffer.concat(chunks).toString('utf8');return text?JSON.parse(text):null;};
  return res;
}

async function call(method,url,payload,token){
  const req=request(method,url,payload,token);
  const res=response();
  await handlePlatformApi(req,res);
  await new Promise(resolve=>res.on('finish',resolve));
  return{status:res.statusCode,body:res.payload()};
}

const suffix=crypto.randomUUID().slice(0,8);
const companyId='mod-api-'+suffix;
const otherCompanyId='mod-other-'+suffix;
const rt=await getPlatformRuntimeForTests();
await rt.auth.register({companyId,userId:'owner1',email:'owner-'+suffix+'@test.local',password:'password123',role:'owner'});
await rt.auth.register({companyId,userId:'seller1',email:'seller-'+suffix+'@test.local',password:'password123',role:'seller'});
await rt.auth.register({companyId:otherCompanyId,userId:'owner2',email:'other-'+suffix+'@test.local',password:'password123',role:'owner'});
const ownerLogin=await rt.auth.login({companyId,email:'owner-'+suffix+'@test.local',password:'password123'});
const sellerLogin=await rt.auth.login({companyId,email:'seller-'+suffix+'@test.local',password:'password123'});
const otherLogin=await rt.auth.login({companyId:otherCompanyId,email:'other-'+suffix+'@test.local',password:'password123'});
const ctx={companyId,userId:'seller1',role:'seller'};
const repo=rt.store.tenant(ctx);

await repo.put('Product',{
  id:'product-1',
  name:'Фара Hyundai Solaris',
  categoryId:'auto.parts',
  manufacturer:'Hyundai',
  partNumber:'92101H5000',
  images:['photo-1'],
  condition:'used'
});
await rt.categorySchemas.put(ctx,{
  categoryId:'auto.parts',
  mandatoryFields:['manufacturer','partNumber'],
  moderation:{
    condition_allowed:['new','used'],
    media_requirements:{min_count:1},
    silent_run_allowed:true
  }
});
const offerService=new OfferService({repoFactory:()=>repo});
await offerService.create(ctx,{
  id:'offer-1',
  productId:'product-1',
  sellerId:'seller1',
  price:12000,
  stock:1,
  condition:'used',
  visualAssetReady:true,
  visualQualityScore:90,
  deliveryOptions:[{nationwide:true}]
});

let out=await call('POST','/api/v1/moderation/cases',{offerId:'offer-1'},sellerLogin.token);
assert.equal(out.status,201);
assert.equal(out.body.moderationCase.decision,'AUTO_APPROVED');
const caseId=out.body.moderationCase.id;

out=await call('GET','/api/v1/moderation/cases/'+caseId,null,sellerLogin.token);
assert.equal(out.status,200);
assert.equal(out.body.moderationCase.offerId,'offer-1');
assert.equal(out.body.moderationCase.ruleResults.length>0,true);

out=await call('GET','/api/v1/offers/offer-1/moderation',null,sellerLogin.token);
assert.equal(out.status,200);
assert.equal(out.body.items.length,1);
assert.equal(out.body.offer.moderationStatus,'AUTO_APPROVED');

out=await call('POST','/api/v1/moderation/cases',{offerId:'offer-1'},sellerLogin.token);
assert.equal(out.status,200);
assert.equal(out.body.moderationCase.id,caseId);
assert.equal(out.body.moderationCase.reused,true);

out=await call('GET','/api/v1/moderation/cases/'+caseId,null,otherLogin.token);
assert.equal(out.status,404);

await rt.categorySchemas.put(ctx,{categoryId:'restricted',moderation:{forbidden:true,silent_run_allowed:true}});
await repo.put('Product',{id:'product-appeal',name:'Товар с документом',categoryId:'restricted',images:['photo']});
await offerService.create(ctx,{id:'offer-appeal',productId:'product-appeal',sellerId:'seller1',price:1000,stock:1,condition:'used',visualAssetReady:true,visualQualityScore:90,deliveryOptions:[{nationwide:true}]});
out=await call('POST','/api/v1/moderation/cases',{offerId:'offer-appeal'},sellerLogin.token);
assert.equal(out.status,201);
assert.equal(out.body.moderationCase.decision,'AUTO_REJECTED');
const rejectedCaseId=out.body.moderationCase.id;

out=await call('POST','/api/v1/moderation/cases/'+rejectedCaseId+'/appeals',{
  sellerStatement:'Предоставляю новое подтверждение законности происхождения товара.',
  evidenceRefs:['document:origin-api']
},sellerLogin.token);
assert.equal(out.status,201);
assert.equal(out.body.moderationCase.decision,'HUMAN_EXCEPTION');
const humanExceptionId=out.body.appeal.humanExceptionId;

out=await call('GET','/api/v1/moderation/appeals',null,sellerLogin.token);
assert.equal(out.status,200);
assert.equal(out.body.items.some(x=>x.moderationCaseId===rejectedCaseId),true);

out=await call('POST','/api/v1/moderation/human-exceptions/'+humanExceptionId+'/resolve',{
  decision:'QUARANTINED',
  reason:'Документ передан на дополнительную юридическую проверку.',
  evidenceRefs:['document:origin-api']
},ownerLogin.token);
assert.equal(out.status,200);
assert.equal(out.body.humanException.status,'resolved');

out=await call('POST','/api/v1/moderation/post-publication-signals',{
  offerId:'offer-1',
  type:'complaint_spike',
  evidenceRefs:['metric:complaints'],
  idempotencyKey:'api-signal-'+suffix
},sellerLogin.token);
assert.equal(out.status,403);

out=await call('POST','/api/v1/moderation/post-publication-signals',{
  offerId:'offer-1',
  type:'complaint_spike',
  evidenceRefs:['metric:complaints'],
  idempotencyKey:'api-signal-'+suffix
},ownerLogin.token);
assert.equal(out.status,201);
assert.equal(out.body.moderationCase.decision,'AI_REVIEW_REQUIRED');

await repo.put('Product',{id:'product-incident',name:'Партия детали',categoryId:'auto.parts',manufacturer:'Hyundai',partNumber:'INC-1',images:['photo'],condition:'used'});
await offerService.create(ctx,{id:'offer-incident',productId:'product-incident',sellerId:'seller1',price:9000,stock:1,condition:'used',visualAssetReady:true,visualQualityScore:90,deliveryOptions:[{nationwide:true}]});
out=await call('POST','/api/v1/moderation/cases',{offerId:'offer-incident'},sellerLogin.token);
assert.equal(out.body.moderationCase.decision,'AUTO_APPROVED');
out=await call('POST','/api/v1/moderation/incidents',{
  title:'Отзыв тестовой партии',
  reason:'Подтверждён дефект партии поставщиком.',
  selector:{offerIds:['offer-incident']},
  evidenceRefs:['notice:test']
},ownerLogin.token);
assert.equal(out.status,201);
assert.equal(out.body.incident.quarantinedCount,1);
assert.equal((await repo.get('Offer','offer-incident')).moderationStatus,'QUARANTINED');

console.log('EINEIRO moderation API tests: OK');
