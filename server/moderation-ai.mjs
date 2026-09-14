import crypto from 'node:crypto';
import {MODERATION_DECISIONS,MODERATION_STATUSES} from './moderation.mjs';

const HUMAN_REASONS=new Set([
  'AI_REVIEW_CONFLICT',
  'LOW_CONFIDENCE_AFTER_SECOND_REVIEW',
  'LEGAL_JUDGMENT_REQUIRED',
  'NEW_FRAUD_PATTERN',
  'APPEAL_NEW_EVIDENCE',
  'MASS_INCIDENT',
  'CRITICAL_HARM'
]);
const HUMAN_FINAL_DECISIONS=new Set([
  MODERATION_DECISIONS.AUTO_APPROVED,
  MODERATION_DECISIONS.SELLER_ACTION_REQUIRED,
  MODERATION_DECISIONS.AUTO_REJECTED,
  MODERATION_DECISIONS.QUARANTINED
]);

export class ModerationAIOrchestrator{
  constructor({
    repoFactory,
    moderation,
    providerRegistry,
    privacyGateway=null,
    aiCosts=null,
    now=()=>new Date(),
    aiEnabled=true,
    killSwitch=false,
    secondReviewEnabled=true,
    humanQueueEnabled=true,
    confidenceThreshold=.78,
    highRiskThreshold=70,
    region=null
  }={}){
    if(typeof repoFactory!=='function')throw new Error('repoFactory required');
    if(!moderation?.applyAiReview)throw new Error('moderation service required');
    if(!providerRegistry?.execute)throw new Error('AI provider registry required');
    this.repoFactory=repoFactory;
    this.moderation=moderation;
    this.providerRegistry=providerRegistry;
    this.privacyGateway=privacyGateway;
    this.aiCosts=aiCosts;
    this.now=now;
    this.aiEnabled=Boolean(aiEnabled);
    this.killSwitch=Boolean(killSwitch);
    this.secondReviewEnabled=Boolean(secondReviewEnabled);
    this.humanQueueEnabled=Boolean(humanQueueEnabled);
    this.confidenceThreshold=Number(confidenceThreshold);
    this.highRiskThreshold=Number(highRiskThreshold);
    this.region=region;
  }

  async process(ctx,moderationCaseId){
    const repo=this.repoFactory(ctx);
    let moderationCase=await repo.get('ModerationCase',moderationCaseId);
    if(!moderationCase)throw codedError('moderation case not found','MODERATION_CASE_NOT_FOUND',404);
    if(![MODERATION_DECISIONS.AI_REVIEW_REQUIRED,MODERATION_DECISIONS.SECOND_AI_REVIEW].includes(moderationCase.decision)){
      throw codedError('AI review is not required','AI_REVIEW_NOT_REQUIRED',409);
    }
    if(this.killSwitch)return this.#degrade(ctx,moderationCase,'MODERATION_KILL_SWITCH_ACTIVE');
    if(!this.aiEnabled)return this.#degrade(ctx,moderationCase,'AI_MODERATION_DISABLED');

    const previousReviews=(await repo.list('ModerationAiReview'))
      .filter(row=>row.moderationCaseId===moderationCase.id)
      .sort((a,b)=>Number(a.reviewNumber||0)-Number(b.reviewNumber||0));
    const second=moderationCase.decision===MODERATION_DECISIONS.SECOND_AI_REVIEW||previousReviews.length>0;
    if(second&&!this.secondReviewEnabled){
      return this.humanQueueEnabled
        ? this.#toHuman(ctx,moderationCase,['LOW_CONFIDENCE_AFTER_SECOND_REVIEW'],{source:'second_review_disabled'})
        : this.#degrade(ctx,moderationCase,'SECOND_AI_REVIEW_DISABLED');
    }

    const input=await this.#buildInput(repo,moderationCase,second);
    const started=Date.now();
    try{
      const providerResult=await this.providerRegistry.execute(ctx,{
        capability:'moderation',
        input,
        region:this.region,
        metadata:{
          feature:'algorithm_first_moderation',
          moderationCaseId:moderationCase.id,
          reviewStage:second?'independent_second':'first',
          promptPolicyVersion:moderationCase.aiPolicyVersion
        }
      });
      const review=parseReview(providerResult.output);
      const durationMs=Date.now()-started;
      const forceSecond=!second&&(
        Number(moderationCase.riskScore||0)>=this.highRiskThreshold||
        Boolean(review.suspectedViolation)||
        Boolean(review.safeDetails?.newPattern)
      );
      const applied=await this.moderation.applyAiReview(ctx,moderationCase.id,{
        ...review,
        modelVersion:review.modelVersion||providerResult.providerId,
        promptPolicyVersion:review.promptPolicyVersion||moderationCase.aiPolicyVersion,
        confidenceThreshold:second?0:(forceSecond?1.01:this.confidenceThreshold),
        durationMs,
        costUnits:Number(review.costUnits||review.usage?.total_tokens||0)
      });
      await this.#recordCost(ctx,applied.review,providerResult.providerId,review.usage);
      moderationCase=applied.moderationCase;

      if(!second)return {...applied,degraded:false,providerId:providerResult.providerId};

      const first=previousReviews[0];
      const firstDecision=first?.proposedDecision||first?.decision;
      const secondDecision=applied.review.proposedDecision||review.decision;
      const reasons=[];
      if(firstDecision&&firstDecision!==secondDecision)reasons.push('AI_REVIEW_CONFLICT');
      if(Number(applied.review.confidence)<this.confidenceThreshold)reasons.push('LOW_CONFIDENCE_AFTER_SECOND_REVIEW');
      if(review.safeDetails?.legalJudgmentRequired)reasons.push('LEGAL_JUDGMENT_REQUIRED');
      if(review.safeDetails?.newPattern)reasons.push('NEW_FRAUD_PATTERN');
      if(review.safeDetails?.criticalHarm)reasons.push('CRITICAL_HARM');
      if(reasons.length){
        if(this.humanQueueEnabled)return this.#toHuman(ctx,moderationCase,reasons,{
          firstReviewId:first?.id||null,
          secondReviewId:applied.review.id,
          firstDecision:firstDecision||null,
          secondDecision
        });
        return this.#degrade(ctx,moderationCase,'HUMAN_EXCEPTION_QUEUE_DISABLED');
      }
      return {...applied,degraded:false,providerId:providerResult.providerId};
    }catch(error){
      return this.#degrade(ctx,moderationCase,error?.code||'AI_PROVIDER_OR_RESPONSE_ERROR',error);
    }
  }

  async #buildInput(repo,moderationCase,second){
    const [product,offer,ruleResults,schemas]=await Promise.all([
      repo.get('Product',moderationCase.productId),
      moderationCase.offerId?repo.get('Offer',moderationCase.offerId):null,
      repo.list('ModerationRuleResult'),
      repo.list('CategorySchema')
    ]);
    const schema=schemas
      .filter(row=>row.status==='active'&&row.categoryId===(product?.categoryId||product?.category))
      .sort((a,b)=>Number(b.version||0)-Number(a.version||0))[0]||null;
    const context={
      product:pick(product,['id','name','title','description','categoryId','category','attributes','condition']),
      offer:pick(offer,['id','productId','price','currency','condition','stock','region','deliveryOptions','attributes']),
      categoryPolicy:pick(schema,['categoryId','version','moderation','required_fields','mandatoryFields','condition_allowed','safe_price_range']),
      algorithm:{
        riskScore:moderationCase.riskScore,
        reasonCodes:moderationCase.reasonCodes,
        failedRules:ruleResults
          .filter(row=>row.moderationCaseId===moderationCase.id&&row.result==='fail')
          .map(row=>pick(row,['ruleCode','severity','safeDetails','evidenceRefs']))
      }
    };
    const sanitized=this.privacyGateway?.sanitizeContext
      ? this.privacyGateway.sanitizeContext(context)
      : context;
    return {
      task:'Return one structured moderation decision. Never override deterministic hard rules.',
      reviewStage:second?'independent_second':'first',
      independence:second?'Evaluate the original evidence independently; no earlier AI conclusion is provided.':null,
      promptPolicyVersion:moderationCase.aiPolicyVersion,
      allowedDecisions:[
        MODERATION_DECISIONS.AUTO_APPROVED,
        MODERATION_DECISIONS.SELLER_ACTION_REQUIRED,
        MODERATION_DECISIONS.AUTO_REJECTED
      ],
      responseContract:{
        required:['decision','reasonCodes','evidenceRefs','confidence','sellerMessage','requiredActions','safeDetails','suspectedViolation'],
        confidenceRange:[0,1]
      },
      context:sanitized
    };
  }

  async #degrade(ctx,moderationCase,code,error=null){
    const repo=this.repoFactory(ctx);
    const next={
      ...moderationCase,
      degraded:{
        code,
        retryable:true,
        message:'Автоматическая AI-проверка временно недоступна. Объект не опубликован и ожидает безопасного повтора.',
        at:this.now().toISOString()
      },
      lastErrorCode:code,
      completedAt:null
    };
    await repo.put('ModerationCase',next);
    await this.moderation.emit?.(ctx,'moderation.ai.degraded',next);
    await this.moderation.writeAudit?.(ctx,next);
    return{moderationCase:next,degraded:true,errorCode:code,error:error?String(error.message||error):null};
  }

  async #toHuman(ctx,moderationCase,reasons,evidence={}){
    const repo=this.repoFactory(ctx);
    const reasonCodes=[...new Set(reasons)].filter(reason=>HUMAN_REASONS.has(reason));
    if(!reasonCodes.length)throw codedError('human exception reason required','HUMAN_REASON_REQUIRED',400);
    const id=moderationCase.id+':human';
    const existing=await repo.get('ModerationHumanException',id);
    const exception=existing||{
      id,
      moderationCaseId:moderationCase.id,
      objectType:moderationCase.objectType,
      offerId:moderationCase.offerId,
      productId:moderationCase.productId,
      sellerId:moderationCase.sellerId,
      reasonCodes,
      evidence:structuredClone(evidence),
      priority:reasonCodes.some(x=>x==='CRITICAL_HARM'||x==='MASS_INCIDENT')?'P0':'P1',
      status:'open',
      createdAt:this.now().toISOString(),
      resolvedAt:null
    };
    await repo.put('ModerationHumanException',exception);
    const next={
      ...moderationCase,
      decision:MODERATION_DECISIONS.HUMAN_EXCEPTION,
      status:MODERATION_STATUSES.HUMAN_EXCEPTION,
      humanExceptionId:id,
      completedAt:null
    };
    await repo.put('ModerationCase',next);
    if(next.offerId){
      const offer=await repo.get('Offer',next.offerId);
      if(offer)await repo.put('Offer',{...offer,moderationStatus:next.decision,moderationCaseId:next.id,moderationUpdatedAt:this.now().toISOString()});
    }
    await this.moderation.emit?.(ctx,'moderation.human.exception',next);
    await this.moderation.writeAudit?.(ctx,next);
    return{moderationCase:next,humanException:exception,degraded:false};
  }

  async #recordCost(ctx,review,providerId,usage={}){
    if(!this.aiCosts?.record)return null;
    return this.aiCosts.record(ctx,{
      feature:'moderation',
      units:Number(review.costUnits||usage?.total_tokens||0),
      inputUnits:Number(usage?.prompt_tokens||usage?.input_tokens||0),
      outputUnits:Number(usage?.completion_tokens||usage?.output_tokens||0),
      requestId:review.id,
      meta:{moderationCaseId:review.moderationCaseId,providerId,reviewNumber:review.reviewNumber}
    });
  }
}

export class ModerationHumanExceptionService{
  constructor({repoFactory,audit=null,events=null,now=()=>new Date()}={}){
    if(typeof repoFactory!=='function')throw new Error('repoFactory required');
    this.repoFactory=repoFactory;
    this.audit=audit;
    this.events=events;
    this.now=now;
  }
  async list(ctx,{status='open'}={}){
    let rows=await this.repoFactory(ctx).list('ModerationHumanException');
    if(status)rows=rows.filter(row=>row.status===status);
    return rows.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
  }
  async resolve(ctx,id,{decision,reason,evidenceRefs=[]}={}){
    if(!['owner','admin'].includes(ctx.role))throw codedError('owner/admin required','FORBIDDEN',403);
    if(!HUMAN_FINAL_DECISIONS.has(decision))throw codedError('invalid human decision','INVALID_HUMAN_DECISION',400);
    if(!String(reason||'').trim())throw codedError('resolution reason required','HUMAN_RESOLUTION_REASON_REQUIRED',400);
    const repo=this.repoFactory(ctx);
    const exception=await repo.get('ModerationHumanException',id);
    if(!exception)throw codedError('human exception not found','HUMAN_EXCEPTION_NOT_FOUND',404);
    if(exception.status!=='open')throw codedError('human exception already resolved','HUMAN_EXCEPTION_ALREADY_RESOLVED',409);
    const moderationCase=await repo.get('ModerationCase',exception.moderationCaseId);
    if(!moderationCase)throw codedError('moderation case not found','MODERATION_CASE_NOT_FOUND',404);
    const at=this.now().toISOString();
    const nextException={
      ...exception,
      status:'resolved',
      resolution:{
        decision,
        reason:String(reason),
        evidenceRefs:[...new Set((evidenceRefs||[]).map(String))],
        actor:{id:ctx.userId,role:ctx.role},
        at
      },
      resolvedAt:at
    };
    const nextCase={
      ...moderationCase,
      decision,
      status:statusForDecision(decision),
      completedAt:at,
      humanResolutionId:id
    };
    await repo.put('ModerationHumanException',nextException);
    await repo.put('ModerationCase',nextCase);
    if(nextCase.offerId){
      const offer=await repo.get('Offer',nextCase.offerId);
      if(offer)await repo.put('Offer',{
        ...offer,
        moderationStatus:decision,
        moderationCaseId:nextCase.id,
        moderationReasonCodes:[...nextCase.reasonCodes],
        moderationUpdatedAt:at
      });
    }
    await this.events?.emit?.(ctx,'moderation.human.resolved',{moderationCaseId:nextCase.id,humanExceptionId:id,decision});
    await this.audit?.write?.(ctx,{
      actor:{type:'user',id:ctx.userId,role:ctx.role},
      action:'moderation.human.resolve',
      object:{type:nextCase.objectType,id:nextCase.offerId||nextCase.productId,moderationCaseId:nextCase.id,humanExceptionId:id},
      reason:String(reason),
      decision,
      before:{decision:moderationCase.decision,status:moderationCase.status},
      after:{decision,status:nextCase.status},
      result:{evidenceRefs:nextException.resolution.evidenceRefs}
    });
    return{moderationCase:nextCase,humanException:nextException};
  }
}

function parseReview(output){
  let value=output?.review??output;
  if(typeof value==='string'){
    try{value=JSON.parse(stripFence(value));}
    catch{throw codedError('AI returned invalid JSON','INVALID_AI_RESPONSE',502);}
  }
  if(value?.choices?.[0]?.message?.content){
    try{value=JSON.parse(stripFence(value.choices[0].message.content));}
    catch{throw codedError('AI returned invalid JSON','INVALID_AI_RESPONSE',502);}
  }
  if(!value||typeof value!=='object')throw codedError('AI returned empty response','INVALID_AI_RESPONSE',502);
  return value;
}

function stripFence(value){
  return String(value).trim().replace(/^\x60\x60\x60(?:json)?\s*/i,'').replace(/\s*\x60\x60\x60$/,'');
}

function pick(object,keys){
  if(!object)return null;
  const out={};
  for(const key of keys)if(object[key]!==undefined)out[key]=structuredClone(object[key]);
  return out;
}

function statusForDecision(decision){
  if(decision===MODERATION_DECISIONS.AUTO_APPROVED)return MODERATION_STATUSES.PUBLISHED;
  if(decision===MODERATION_DECISIONS.SELLER_ACTION_REQUIRED)return MODERATION_STATUSES.ACTION_REQUIRED;
  if(decision===MODERATION_DECISIONS.AUTO_REJECTED)return MODERATION_STATUSES.REJECTED;
  if(decision===MODERATION_DECISIONS.QUARANTINED)return MODERATION_STATUSES.QUARANTINED;
  return MODERATION_STATUSES.HUMAN_EXCEPTION;
}

function codedError(message,code,status){
  return Object.assign(new Error(message),{code,status});
}

export {HUMAN_REASONS,HUMAN_FINAL_DECISIONS};
