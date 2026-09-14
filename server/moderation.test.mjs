import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {
  ModerationService,
  MODERATION_DECISIONS,
  MODERATION_REASON_CODES,
  isOfferModerationApproved
} from './moderation.mjs';
import {OfferService,offerHardEligibility} from './offers.mjs';

const ctx={companyId:'c1',userId:'owner',role:'owner'};
const memory=new MemoryRepository();
const repo={
  put:(entity,record)=>memory.put(ctx,entity,record),
  get:(entity,id)=>memory.get(ctx,entity,id),
  list:entity=>memory.list(ctx,entity),
  remove:(entity,id)=>memory.remove(ctx,entity,id)
};
const now=()=>new Date('2026-09-14T12:00:00Z');
const offers=new OfferService({repoFactory:()=>repo,now});
const moderation=new ModerationService({repoFactory:()=>repo,now,silentRun:true});
const schema={
  id:'schema-auto-parts-v1',
  categoryId:'auto.parts',
  version:1,
  status:'active',
  mandatoryFields:['manufacturer','partNumber'],
  condition_allowed:['new','used'],
  media_requirements:{min_count:1},
  silent_run_allowed:true
};

await repo.put('Product',{
  id:'p-approved',
  name:'Фара Hyundai Solaris',
  categoryId:'auto.parts',
  manufacturer:'Hyundai',
  partNumber:'92101H5000',
  images:['photo-1'],
  condition:'used'
});
const pending=await offers.create(ctx,{
  id:'o-approved',
  productId:'p-approved',
  sellerId:'s1',
  price:12000,
  stock:1,
  condition:'used',
  freshnessAt:'2026-09-14T11:00:00Z',
  visualAssetReady:true,
  visualQualityScore:90,
  deliveryOptions:[{nationwide:true}]
});
assert.equal(pending.moderationStatus,'PENDING');
assert.equal(offerHardEligibility({offer:pending,sellerScore:90}).eligible,false);

const approved=await moderation.review(ctx,{offerId:pending.id,categorySchema:schema});
assert.equal(approved.decision,MODERATION_DECISIONS.AUTO_APPROVED);
assert.equal(approved.riskScore,0);
const approvedOffer=await repo.get('Offer',pending.id);
assert.equal(isOfferModerationApproved(approvedOffer),true);
assert.equal(offerHardEligibility({offer:approvedOffer,sellerScore:90}).eligible,true);

const repeated=await moderation.review(ctx,{offerId:pending.id,categorySchema:schema});
assert.equal(repeated.id,approved.id);
assert.equal(repeated.reused,true);
assert.equal((await repo.list('ModerationCase')).filter(row=>row.offerId===pending.id).length,1);

await repo.put('Product',{
  id:'p-fix',
  name:'Капот',
  categoryId:'auto.parts',
  manufacturer:'Hyundai',
  images:['photo-2'],
  condition:'used'
});
await offers.create(ctx,{
  id:'o-fix',
  productId:'p-fix',
  sellerId:'s2',
  price:15000,
  stock:1,
  condition:'used',
  freshnessAt:'2026-09-14T11:00:00Z',
  visualAssetReady:true,
  visualQualityScore:90,
  deliveryOptions:[{nationwide:true}]
});
const fix=await moderation.review(ctx,{offerId:'o-fix',categorySchema:schema});
assert.equal(fix.decision,MODERATION_DECISIONS.SELLER_ACTION_REQUIRED);
assert.equal(fix.reasonCodes.includes(MODERATION_REASON_CODES.REQUIRED_FIELD_MISSING),true);
assert.equal(fix.requiredActions.some(row=>row.field==='partNumber'),true);
assert.match(fix.sellerMessage,/обязательное поле/i);

await repo.put('Product',{id:'p-forbidden',name:'Запрещённый товар',categoryId:'restricted',images:['photo-3']});
await offers.create(ctx,{
  id:'o-forbidden',
  productId:'p-forbidden',
  sellerId:'s3',
  price:1000,
  stock:1,
  freshnessAt:'2026-09-14T11:00:00Z',
  visualAssetReady:true,
  visualQualityScore:90,
  deliveryOptions:[{nationwide:true}]
});
const rejected=await moderation.review(ctx,{
  offerId:'o-forbidden',
  categorySchema:{categoryId:'restricted',version:1,forbidden:true,silent_run_allowed:true}
});
assert.equal(rejected.decision,MODERATION_DECISIONS.AUTO_REJECTED);
assert.equal(rejected.reasonCodes.includes(MODERATION_REASON_CODES.CATEGORY_FORBIDDEN),true);
await assert.rejects(
  ()=>moderation.applyAiReview(ctx,rejected.id,{
    decision:MODERATION_DECISIONS.AUTO_APPROVED,
    confidence:.99,
    reasonCodes:[],
    evidenceRefs:[],
    requiredActions:[],
    modelVersion:'test-model',
    promptPolicyVersion:'test-policy'
  }),
  error=>error.code==='AI_REVIEW_NOT_REQUIRED'
);

await repo.put('Product',{
  id:'p-ai',
  name:'Реплика как оригинал',
  categoryId:'auto.parts',
  manufacturer:'Unknown',
  partNumber:'TEST-1',
  images:['photo-4'],
  condition:'new'
});
await offers.create(ctx,{
  id:'o-ai',
  productId:'p-ai',
  sellerId:'s4',
  price:5000,
  stock:1,
  condition:'new',
  freshnessAt:'2026-09-14T11:00:00Z',
  visualAssetReady:true,
  visualQualityScore:90,
  deliveryOptions:[{nationwide:true}]
});
const aiCase=await moderation.review(ctx,{offerId:'o-ai',categorySchema:schema});
assert.equal(aiCase.decision,MODERATION_DECISIONS.AI_REVIEW_REQUIRED);
assert.equal(aiCase.reasonCodes.includes(MODERATION_REASON_CODES.SEMANTIC_AMBIGUITY),true);
const aiResult=await moderation.applyAiReview(ctx,aiCase.id,{
  decision:MODERATION_DECISIONS.AUTO_APPROVED,
  confidence:.55,
  confidenceThreshold:.78,
  reasonCodes:['SEMANTIC_REVIEW_INCONCLUSIVE'],
  evidenceRefs:['product.name'],
  requiredActions:[],
  sellerMessage:'Выполняется независимая повторная автоматическая проверка.',
  modelVersion:'test-model-v1',
  promptPolicyVersion:'test-prompt-v1'
});
assert.equal(aiResult.moderationCase.decision,MODERATION_DECISIONS.SECOND_AI_REVIEW);
assert.equal(aiResult.review.structurallyValid,true);
assert.equal(isOfferModerationApproved(await repo.get('Offer','o-ai')),false);

const stored=await moderation.get(ctx,approved.id);
assert.equal(stored.ruleResults.length>0,true);
assert.equal(stored.ruleResults.every(row=>row.ruleVersion==='algorithm-rules-v1'),true);
assert.equal((await moderation.historyForOffer(ctx,'o-approved')).length,1);

console.log('EINEIRO algorithm-first moderation tests: OK');
