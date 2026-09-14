import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {ModerationService,MODERATION_DECISIONS} from './moderation.mjs';
import {ModerationAIOrchestrator,ModerationHumanExceptionService} from './moderation-ai.mjs';
import {OpenAiCompatibleModerationProvider} from './openai-moderation-provider.mjs';
import {PrivacyGateway} from './privacy-gateway.mjs';
import {AuditLogService} from './audit-log.mjs';

const ctx={companyId:'c1',userId:'owner-1',role:'owner'};
const memory=new MemoryRepository();
const repo={
  put:(entity,record)=>memory.put(ctx,entity,record),
  get:(entity,id)=>memory.get(ctx,entity,id),
  list:entity=>memory.list(ctx,entity),
  remove:(entity,id)=>memory.remove(ctx,entity,id)
};
const now=()=>new Date('2026-09-14T12:00:00Z');
const audit=new AuditLogService({repoFactory:()=>repo,now});
const moderation=new ModerationService({repoFactory:()=>repo,now,silentRun:true,audit});
const schema={id:'schema-1',categoryId:'auto.parts',version:1,status:'active',silent_run_allowed:true};
await repo.put('CategorySchema',schema);

async function createOffer(suffix,{ambiguous=true,description='Реплика. Контакт seller@example.com, +7 999 111-22-33'}={}){
  await repo.put('Product',{
    id:'p-'+suffix,
    name:'Фара '+suffix,
    description,
    categoryId:'auto.parts',
    semanticAmbiguity:ambiguous,
    images:['safe-image']
  });
  await repo.put('Offer',{
    id:'o-'+suffix,
    productId:'p-'+suffix,
    sellerId:'s-'+suffix,
    price:5000,
    stock:1,
    condition:'used',
    freshnessAt:'2026-09-14T11:00:00Z',
    moderationStatus:'PENDING'
  });
  return moderation.review(ctx,{offerId:'o-'+suffix,categorySchema:schema});
}

const deterministic=await createOffer('clean',{ambiguous:false,description:'Оригинальная фара'});
assert.equal(deterministic.decision,MODERATION_DECISIONS.AUTO_APPROVED);

const calls=[];
const responses=[
  {
    decision:MODERATION_DECISIONS.AUTO_APPROVED,
    confidence:.55,
    reasonCodes:['SEMANTIC_AMBIGUITY'],
    evidenceRefs:['product.description'],
    requiredActions:[],
    sellerMessage:'Выполняется независимая повторная проверка.',
    safeDetails:{summary:'Неоднозначно',newPattern:false,legalJudgmentRequired:false,criticalHarm:false},
    suspectedViolation:false,
    modelVersion:'model-a',
    promptPolicyVersion:'ai-moderation-v1'
  },
  {
    decision:MODERATION_DECISIONS.AUTO_REJECTED,
    confidence:.93,
    reasonCodes:['COUNTERFEIT_LANGUAGE'],
    evidenceRefs:['product.description'],
    requiredActions:[],
    sellerMessage:'Уточните происхождение товара.',
    safeDetails:{summary:'Есть признаки реплики',newPattern:false,legalJudgmentRequired:false,criticalHarm:false},
    suspectedViolation:true,
    modelVersion:'model-b',
    promptPolicyVersion:'ai-moderation-v1'
  }
];
const providerRegistry={
  execute:async(_ctx,request)=>{
    calls.push(structuredClone(request));
    return{output:responses.shift(),providerId:calls.length===1?'provider-a':'provider-b',attempts:[]};
  }
};
const orchestrator=new ModerationAIOrchestrator({
  repoFactory:()=>repo,
  moderation,
  providerRegistry,
  privacyGateway:new PrivacyGateway(),
  now,
  confidenceThreshold:.78
});

await assert.rejects(()=>orchestrator.process(ctx,deterministic.id),error=>error.code==='AI_REVIEW_NOT_REQUIRED');
assert.equal(calls.length,0);

const aiCase=await createOffer('conflict');
assert.equal(aiCase.decision,MODERATION_DECISIONS.AI_REVIEW_REQUIRED);
const first=await orchestrator.process(ctx,aiCase.id);
assert.equal(first.moderationCase.decision,MODERATION_DECISIONS.SECOND_AI_REVIEW);
assert.equal(first.review.proposedDecision,MODERATION_DECISIONS.AUTO_APPROVED);
assert.equal(calls.length,1);
assert.equal(JSON.stringify(calls[0].input).includes('seller@example.com'),false);
assert.equal(JSON.stringify(calls[0].input).includes('+7 999 111-22-33'),false);

const second=await orchestrator.process(ctx,aiCase.id);
assert.equal(second.moderationCase.decision,MODERATION_DECISIONS.HUMAN_EXCEPTION);
assert.equal(second.humanException.reasonCodes.includes('AI_REVIEW_CONFLICT'),true);
assert.equal(calls[1].input.reviewStage,'independent_second');
assert.deepEqual(calls[1].excludeProviderIds,['provider-a']);
assert.equal(JSON.stringify(calls[1].input).includes('AUTO_APPROVED'),true);
assert.equal(Object.hasOwn(calls[1].input.context,'previousAiReview'),false);
assert.equal((await repo.list('ModerationHumanException')).length,1);
assert.equal((await repo.get('Offer','o-conflict')).moderationStatus,MODERATION_DECISIONS.HUMAN_EXCEPTION);

const human=new ModerationHumanExceptionService({repoFactory:()=>repo,audit,now});
const resolved=await human.resolve(ctx,second.humanException.id,{
  decision:MODERATION_DECISIONS.AUTO_REJECTED,
  reason:'Две независимые модели разошлись; проверены доказательства происхождения.',
  evidenceRefs:['document:origin-check']
});
assert.equal(resolved.humanException.status,'resolved');
assert.equal(resolved.humanException.resolution.actor.id,ctx.userId);
assert.equal((await repo.get('Offer','o-conflict')).moderationStatus,MODERATION_DECISIONS.AUTO_REJECTED);
assert.equal((await repo.list('UnifiedAudit')).some(row=>row.action==='moderation.human.resolve'),true);

const degradedCase=await createOffer('degraded');
const degradedOrchestrator=new ModerationAIOrchestrator({
  repoFactory:()=>repo,
  moderation,
  providerRegistry:{execute:async()=>{throw Object.assign(new Error('offline'),{code:'AI_PROVIDERS_UNAVAILABLE'});}},
  privacyGateway:new PrivacyGateway(),
  now
});
const degraded=await degradedOrchestrator.process(ctx,degradedCase.id);
assert.equal(degraded.degraded,true);
assert.equal(degraded.errorCode,'AI_PROVIDERS_UNAVAILABLE');
assert.equal(degraded.moderationCase.decision,MODERATION_DECISIONS.AI_REVIEW_REQUIRED);
assert.equal(degraded.moderationCase.completedAt,null);
assert.equal((await repo.get('Offer','o-degraded')).moderationStatus,MODERATION_DECISIONS.AI_REVIEW_REQUIRED);
assert.equal((await repo.list('ModerationHumanException')).length,1);

const noQueueCase=await createOffer('noqueue');
const noQueueResponses=[
  {
    decision:MODERATION_DECISIONS.AUTO_APPROVED,
    confidence:.5,
    reasonCodes:['AMBIGUOUS'],
    evidenceRefs:['product.description'],
    requiredActions:[],
    sellerMessage:'Повторная проверка.',
    safeDetails:{summary:'Неоднозначно',newPattern:false,legalJudgmentRequired:false,criticalHarm:false},
    suspectedViolation:false,
    modelVersion:'model-a',
    promptPolicyVersion:'ai-moderation-v1'
  },
  {
    decision:MODERATION_DECISIONS.AUTO_REJECTED,
    confidence:.95,
    reasonCodes:['COUNTERFEIT_LANGUAGE'],
    evidenceRefs:['product.description'],
    requiredActions:[],
    sellerMessage:'Нужна проверка.',
    safeDetails:{summary:'Конфликт',newPattern:false,legalJudgmentRequired:false,criticalHarm:false},
    suspectedViolation:true,
    modelVersion:'model-b',
    promptPolicyVersion:'ai-moderation-v1'
  }
];
const noQueueOrchestrator=new ModerationAIOrchestrator({
  repoFactory:()=>repo,
  moderation,
  providerRegistry:{execute:async()=>({output:noQueueResponses.shift(),providerId:'provider-only',attempts:[]})},
  privacyGateway:new PrivacyGateway(),
  humanQueueEnabled:false,
  now
});
const noQueueFirst=await noQueueOrchestrator.process(ctx,noQueueCase.id);
assert.equal(noQueueFirst.moderationCase.decision,MODERATION_DECISIONS.SECOND_AI_REVIEW);
const noQueueSecond=await noQueueOrchestrator.process(ctx,noQueueCase.id);
assert.equal(noQueueSecond.degraded,true);
assert.equal(noQueueSecond.errorCode,'HUMAN_EXCEPTION_QUEUE_DISABLED');
assert.equal(noQueueSecond.moderationCase.decision,MODERATION_DECISIONS.SECOND_AI_REVIEW);
assert.equal((await repo.get('Offer','o-noqueue')).moderationStatus,MODERATION_DECISIONS.SECOND_AI_REVIEW);
assert.equal((await repo.list('ModerationHumanException')).length,1);

let requestBody;
const provider=new OpenAiCompatibleModerationProvider({
  apiKey:'test-key',
  model:'test-model',
  fetchImpl:async(_url,options)=>{
    requestBody=JSON.parse(options.body);
    assert.equal(options.headers.Authorization,'Bearer test-key');
    return{
      ok:true,
      json:async()=>({
        id:'provider-request-1',
        model:'test-model-2026',
        choices:[{message:{content:JSON.stringify({
          decision:'AUTO_APPROVED',
          reasonCodes:[],
          evidenceRefs:['product.name'],
          confidence:.98,
          sellerMessage:'',
          requiredActions:[],
          safeDetails:{summary:'Без нарушений',newPattern:false,legalJudgmentRequired:false,criticalHarm:false},
          suspectedViolation:false
        })}}],
        usage:{prompt_tokens:50,completion_tokens:20,total_tokens:70}
      })
    };
  }
});
const providerOutput=await provider.execute({
  capability:'moderation',
  input:{promptPolicyVersion:'policy-v2',context:{product:{name:'Фара'}}}
});
assert.equal(providerOutput.decision,'AUTO_APPROVED');
assert.equal(providerOutput.modelVersion,'test-model-2026');
assert.equal(providerOutput.promptPolicyVersion,'policy-v2');
assert.equal(providerOutput.usage.total_tokens,70);
assert.equal(requestBody.response_format.json_schema.strict,true);
assert.equal(requestBody.temperature,0);

console.log('EINEIRO moderated AI orchestration tests: OK');
