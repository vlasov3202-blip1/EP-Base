import crypto from 'node:crypto';

export const MODERATION_DECISIONS=Object.freeze({
  AUTO_APPROVED:'AUTO_APPROVED',
  SELLER_ACTION_REQUIRED:'SELLER_ACTION_REQUIRED',
  AUTO_REJECTED:'AUTO_REJECTED',
  QUARANTINED:'QUARANTINED',
  AI_REVIEW_REQUIRED:'AI_REVIEW_REQUIRED',
  SECOND_AI_REVIEW:'SECOND_AI_REVIEW',
  HUMAN_EXCEPTION:'HUMAN_EXCEPTION'
});

export const MODERATION_STATUSES=Object.freeze({
  RECEIVED:'RECEIVED',
  ALGORITHM_CHECK:'ALGORITHM_CHECK',
  AI_REVIEW:'AI_REVIEW',
  SECOND_AI_REVIEW:'SECOND_AI_REVIEW',
  HUMAN_EXCEPTION:'HUMAN_EXCEPTION',
  PUBLISHED:'PUBLISHED',
  ACTION_REQUIRED:'SELLER_ACTION_REQUIRED',
  REJECTED:'REJECTED',
  QUARANTINED:'QUARANTINED'
});

export const MODERATION_REASON_CODES=Object.freeze({
  CATEGORY_REQUIRED:'CATEGORY_REQUIRED',
  CATEGORY_FORBIDDEN:'CATEGORY_FORBIDDEN',
  CATEGORY_SILENT_RUN_DISABLED:'CATEGORY_SILENT_RUN_DISABLED',
  REQUIRED_FIELD_MISSING:'REQUIRED_FIELD_MISSING',
  REQUIRED_DOCUMENT_MISSING:'REQUIRED_DOCUMENT_MISSING',
  REQUIRED_CERTIFICATE_MISSING:'REQUIRED_CERTIFICATE_MISSING',
  CONDITION_NOT_ALLOWED:'CONDITION_NOT_ALLOWED',
  INVALID_PRICE:'INVALID_PRICE',
  INVALID_STOCK:'INVALID_STOCK',
  STALE_INVENTORY:'STALE_INVENTORY',
  MEDIA_INSUFFICIENT:'MEDIA_INSUFFICIENT',
  SELLER_SUSPENDED:'SELLER_SUSPENDED',
  DUPLICATE_OFFER:'DUPLICATE_OFFER',
  SEMANTIC_AMBIGUITY:'SEMANTIC_AMBIGUITY',
  PRICE_ANOMALY:'PRICE_ANOMALY'
});

const FINAL_DECISIONS=new Set([
  MODERATION_DECISIONS.AUTO_APPROVED,
  MODERATION_DECISIONS.SELLER_ACTION_REQUIRED,
  MODERATION_DECISIONS.AUTO_REJECTED,
  MODERATION_DECISIONS.QUARANTINED
]);

const AI_DECISIONS=new Set([
  MODERATION_DECISIONS.AUTO_APPROVED,
  MODERATION_DECISIONS.SELLER_ACTION_REQUIRED,
  MODERATION_DECISIONS.AUTO_REJECTED,
  MODERATION_DECISIONS.QUARANTINED
]);

const SELLER_MESSAGES=Object.freeze({
  CATEGORY_REQUIRED:'Укажите категорию товара.',
  CATEGORY_FORBIDDEN:'Товары этой категории нельзя публиковать.',
  CATEGORY_SILENT_RUN_DISABLED:'Категория пока не допущена к публикации в Silent Run.',
  REQUIRED_FIELD_MISSING:'Заполните обязательное поле.',
  REQUIRED_DOCUMENT_MISSING:'Добавьте обязательный документ.',
  REQUIRED_CERTIFICATE_MISSING:'Добавьте обязательный сертификат.',
  CONDITION_NOT_ALLOWED:'Выберите допустимое состояние товара.',
  INVALID_PRICE:'Укажите корректную цену больше нуля.',
  INVALID_STOCK:'Подтвердите доступный остаток.',
  STALE_INVENTORY:'Обновите сведения об остатке.',
  MEDIA_INSUFFICIENT:'Добавьте обязательные фотографии или медиа.',
  SELLER_SUSPENDED:'Публикация недоступна: профиль продавца приостановлен.',
  DUPLICATE_OFFER:'Такое предложение уже существует. Обновите существующее объявление.',
  SEMANTIC_AMBIGUITY:'Объявление направлено на дополнительную автоматическую проверку.',
  PRICE_ANOMALY:'Цена заметно отличается от обычного диапазона и требует дополнительной проверки.'
});

export class ModerationService{
  constructor({
    repoFactory,
    now=()=>new Date(),
    policyVersion='moderation-policy-v1',
    rulesVersion='algorithm-rules-v1',
    aiPolicyVersion='ai-moderation-v1',
    aiThreshold=30,
    highRiskThreshold=70,
    inventoryFreshHours=72,
    silentRun=true,
    events=null,
    audit=null
  }={}){
    if(typeof repoFactory!=='function')throw new Error('repoFactory required');
    this.repoFactory=repoFactory;
    this.now=now;
    this.policyVersion=policyVersion;
    this.rulesVersion=rulesVersion;
    this.aiPolicyVersion=aiPolicyVersion;
    this.aiThreshold=Number(aiThreshold);
    this.highRiskThreshold=Number(highRiskThreshold);
    this.inventoryFreshHours=Number(inventoryFreshHours);
    this.silentRun=Boolean(silentRun);
    this.events=events;
    this.audit=audit;
  }

  async review(ctx,{offerId=null,productId=null,categorySchema=null,force=false,trigger='submission',source='internal'}={}){
    const repo=this.repoFactory(ctx);
    const offer=offerId?await repo.get('Offer',offerId):null;
    if(offerId&&!offer)throw codedError('offer not found','OFFER_NOT_FOUND',404);
    const resolvedProductId=offer?.productId||productId;
    if(!resolvedProductId)throw codedError('productId or offerId required','MODERATION_OBJECT_REQUIRED',400);
    const product=await repo.get('Product',resolvedProductId);
    if(!product)throw codedError('product not found','PRODUCT_NOT_FOUND',404);
    const seller=offer?.sellerId?await findSeller(repo,offer.sellerId):null;
    const schema=categorySchema||await activeSchema(repo,product.categoryId||product.category)||{};
    const normalized=normalizeInput({product,offer,seller,schema});
    const fingerprint=contentFingerprint({
      normalized,
      policyVersion:this.policyVersion,
      rulesVersion:this.rulesVersion,
      schemaVersion:schema.version||null
    });
    if(!force){
      const existing=(await repo.list('ModerationCase')).find(row=>
        row.contentFingerprint===fingerprint&&
        row.policyVersion===this.policyVersion&&
        row.rulesVersion===this.rulesVersion&&
        row.status!=='SUPERSEDED'
      );
      if(existing)return {...existing,reused:true};
    }

    const createdAt=this.now().toISOString();
    let moderationCase={
      id:'mod_'+crypto.randomUUID(),
      objectType:offer?'Offer':'Product',
      productId:product.id,
      offerId:offer?.id||null,
      sellerId:offer?.sellerId||product.sellerId||null,
      source,
      trigger,
      status:MODERATION_STATUSES.ALGORITHM_CHECK,
      decision:null,
      riskScore:0,
      reasonCodes:[],
      requiredActions:[],
      contentFingerprint:fingerprint,
      categorySchemaVersion:schema.version||null,
      policyVersion:this.policyVersion,
      rulesVersion:this.rulesVersion,
      aiPolicyVersion:this.aiPolicyVersion,
      previousCaseId:await previousCaseId(repo,offer?.id||null,product.id),
      createdAt,
      completedAt:null
    };
    await repo.put('ModerationCase',moderationCase);
    await this.emit(ctx,'moderation.received',moderationCase);

    const algorithm=await runAlgorithmicModeration({
      repo,
      product,
      offer,
      seller,
      schema,
      now:this.now(),
      silentRun:this.silentRun,
      inventoryFreshHours:this.inventoryFreshHours,
      aiThreshold:this.aiThreshold,
      highRiskThreshold:this.highRiskThreshold
    });

    for(let index=0;index<algorithm.results.length;index++){
      const result=algorithm.results[index];
      await repo.put('ModerationRuleResult',{
        id:moderationCase.id+':'+String(index+1).padStart(2,'0')+':'+result.code,
        moderationCaseId:moderationCase.id,
        ruleCode:result.code,
        ruleVersion:this.rulesVersion,
        result:result.result,
        severity:result.severity,
        riskWeight:result.riskWeight,
        safeDetails:structuredClone(result.safeDetails||{}),
        evidenceRefs:[...(result.evidenceRefs||[])],
        createdAt:this.now().toISOString()
      });
    }

    moderationCase={
      ...moderationCase,
      status:statusForDecision(algorithm.decision),
      decision:algorithm.decision,
      riskScore:algorithm.riskScore,
      riskContributions:structuredClone(algorithm.riskContributions),
      reasonCodes:[...algorithm.reasonCodes],
      requiredActions:structuredClone(algorithm.requiredActions),
      sellerMessage:algorithm.sellerMessage,
      completedAt:FINAL_DECISIONS.has(algorithm.decision)?this.now().toISOString():null
    };
    await repo.put('ModerationCase',moderationCase);
    if(offer)await applyDecisionToOffer(repo,offer,moderationCase,this.now());
    await this.emit(ctx,'moderation.algorithm.completed',moderationCase);
    await this.writeAudit(ctx,moderationCase);
    return moderationCase;
  }

  async applyAiReview(ctx,moderationCaseId,input={}){
    const repo=this.repoFactory(ctx);
    const moderationCase=await repo.get('ModerationCase',moderationCaseId);
    if(!moderationCase)throw codedError('moderation case not found','MODERATION_CASE_NOT_FOUND',404);
    if(moderationCase.decision!==MODERATION_DECISIONS.AI_REVIEW_REQUIRED&&moderationCase.decision!==MODERATION_DECISIONS.SECOND_AI_REVIEW)throw codedError('AI review is not required','AI_REVIEW_NOT_REQUIRED',409);
    const review=validateAiReview(input);
    const blocking=(await repo.list('ModerationRuleResult')).filter(row=>row.moderationCaseId===moderationCase.id&&row.result==='fail'&&row.severity==='block');
    if(blocking.length&&review.decision===MODERATION_DECISIONS.AUTO_APPROVED)throw codedError('AI cannot override a hard rule','HARD_RULE_OVERRIDE_FORBIDDEN',409);
    const reviewNumber=(await repo.list('ModerationAiReview')).filter(row=>row.moderationCaseId===moderationCase.id).length+1;
    const needsSecond=review.confidence<Number(input.confidenceThreshold??0.78);
    const decision=needsSecond?MODERATION_DECISIONS.SECOND_AI_REVIEW:review.decision;
    const record={
      id:moderationCase.id+':ai:'+reviewNumber,
      moderationCaseId:moderationCase.id,
      reviewNumber,
      decision,
      proposedDecision:review.decision,
      reasonCodes:[...review.reasonCodes],
      evidenceRefs:[...review.evidenceRefs],
      confidence:review.confidence,
      sellerMessage:review.sellerMessage,
      requiredActions:structuredClone(review.requiredActions),
      suspectedViolation:Boolean(review.suspectedViolation),
      safeDetails:structuredClone(review.safeDetails),
      modelVersion:review.modelVersion,
      promptPolicyVersion:review.promptPolicyVersion,
      providerId:input.providerId?String(input.providerId):null,
      structurallyValid:true,
      costUnits:Number(input.costUnits||0),
      durationMs:Number(input.durationMs||0),
      createdAt:this.now().toISOString()
    };
    await repo.put('ModerationAiReview',record);
    const next={
      ...moderationCase,
      decision,
      status:statusForDecision(decision),
      reasonCodes:[...new Set([...moderationCase.reasonCodes,...review.reasonCodes])],
      requiredActions:structuredClone(review.requiredActions),
      sellerMessage:review.sellerMessage||moderationCase.sellerMessage,
      completedAt:FINAL_DECISIONS.has(decision)?this.now().toISOString():null
    };
    await repo.put('ModerationCase',next);
    if(next.offerId){
      const offer=await repo.get('Offer',next.offerId);
      if(offer)await applyDecisionToOffer(repo,offer,next,this.now());
    }
    await this.emit(ctx,'moderation.ai.completed',{...next,aiReviewId:record.id,confidence:record.confidence});
    await this.writeAudit(ctx,next);
    return {moderationCase:next,review:record};
  }

  async get(ctx,moderationCaseId){
    const repo=this.repoFactory(ctx);
    const moderationCase=await repo.get('ModerationCase',moderationCaseId);
    if(!moderationCase)return null;
    const [ruleResults,aiReviews,humanExceptions]=await Promise.all([
      repo.list('ModerationRuleResult'),
      repo.list('ModerationAiReview'),
      repo.list('ModerationHumanException')
    ]);
    return {
      ...moderationCase,
      ruleResults:ruleResults.filter(row=>row.moderationCaseId===moderationCase.id),
      aiReviews:aiReviews.filter(row=>row.moderationCaseId===moderationCase.id),
      humanExceptions:humanExceptions.filter(row=>row.moderationCaseId===moderationCase.id)
    };
  }

  async historyForOffer(ctx,offerId){
    return (await this.repoFactory(ctx).list('ModerationCase'))
      .filter(row=>row.offerId===offerId)
      .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async setCategoryPolicy(ctx,input={}){
    if(!input.categoryId)throw codedError('categoryId required','CATEGORY_ID_REQUIRED',400);
    const repo=this.repoFactory(ctx);
    const current=await activeSchema(repo,input.categoryId);
    const record={
      id:input.id||'moderation-policy:'+input.categoryId,
      categoryId:input.categoryId,
      version:Number(input.version||Number(current?.version||0)+1),
      status:input.status||'active',
      mandatoryFields:[...new Set(input.mandatoryFields||input.requiredFields||[])],
      moderation:{
        forbidden:Boolean(input.forbidden),
        restricted:Boolean(input.restricted),
        required_documents:[...new Set(input.documents||input.requiredDocuments||[])],
        required_certificates:[...new Set(input.certificates||input.requiredCertificates||[])],
        silent_run_allowed:input.silentRunAllowed!==false
      },
      createdAt:this.now().toISOString()
    };
    await repo.put('CategorySchema',record);
    return record;
  }

  async evaluate(ctx,product={}){
    const repo=this.repoFactory(ctx);
    const schema=await activeSchema(repo,product.categoryId||product.category)||{};
    const result=await runAlgorithmicModeration({
      repo,
      product,
      schema,
      now:this.now(),
      silentRun:this.silentRun,
      inventoryFreshHours:this.inventoryFreshHours,
      aiThreshold:this.aiThreshold,
      highRiskThreshold:this.highRiskThreshold
    });
    return{allowed:result.decision===MODERATION_DECISIONS.AUTO_APPROVED,decision:result.decision,riskScore:result.riskScore,issues:result.results.filter(row=>row.result==='fail'),requiredActions:result.requiredActions};
  }

  async emit(ctx,type,moderationCase){
    if(!this.events?.emit)return null;
    return this.events.emit(ctx,type,{
      moderationCaseId:moderationCase.id,
      productId:moderationCase.productId,
      offerId:moderationCase.offerId,
      sellerId:moderationCase.sellerId,
      status:moderationCase.status,
      decision:moderationCase.decision,
      riskScore:moderationCase.riskScore,
      reasonCodes:moderationCase.reasonCodes
    },{
      policyVersion:this.policyVersion,
      rulesVersion:this.rulesVersion
    });
  }

  async writeAudit(ctx,moderationCase){
    if(!this.audit?.write)return null;
    return this.audit.write(ctx,{
      actor:{type:'system',id:'moderation'},
      action:'moderation.decision',
      object:{type:moderationCase.objectType,id:moderationCase.offerId||moderationCase.productId,moderationCaseId:moderationCase.id},
      reason:moderationCase.reasonCodes.join(',')||'within_policy',
      decision:moderationCase.decision,
      policy:{policyVersion:this.policyVersion,rulesVersion:this.rulesVersion,categorySchemaVersion:moderationCase.categorySchemaVersion},
      result:{riskScore:moderationCase.riskScore,status:moderationCase.status}
    });
  }
}

export async function runAlgorithmicModeration({
  repo,
  product={},
  offer=null,
  seller=null,
  schema={},
  now=new Date(),
  silentRun=true,
  inventoryFreshHours=72,
  aiThreshold=30,
  highRiskThreshold=70
}={}){
  const results=[];
  const add=(code,ok,{severity='block',riskWeight=0,safeDetails={},evidenceRefs=[],requiredAction=null}={})=>{
    results.push({code,result:ok?'pass':'fail',severity,riskWeight:ok?0:riskWeight,safeDetails,evidenceRefs});
    if(!ok&&requiredAction)requiredActions.push(requiredAction);
  };
  const requiredActions=[];
  const category=product.categoryId||product.category||null;
  const moderation=schema.moderation||{};
  const requiredFields=unique(schema.required_fields,schema.requiredFields,schema.mandatoryFields,moderation.required_fields,moderation.requiredFields);
  const requiredDocuments=unique(schema.required_documents,schema.requiredDocuments,schema.documents,moderation.required_documents,moderation.documents);
  const requiredCertificates=unique(schema.required_certificates,schema.requiredCertificates,schema.certificates,moderation.required_certificates,moderation.certificates);
  const allowedConditions=unique(schema.condition_allowed,schema.conditionAllowed,moderation.condition_allowed,moderation.conditionAllowed);
  const mediaRequirements=schema.media_requirements||schema.mediaRequirements||moderation.media_requirements||moderation.mediaRequirements||{};
  const forbidden=Boolean(schema.forbidden||moderation.forbidden);
  const silentRunAllowed=firstDefined(schema.silent_run_allowed,schema.silentRunAllowed,moderation.silent_run_allowed,moderation.silentRunAllowed,true);

  add(MODERATION_REASON_CODES.CATEGORY_REQUIRED,Boolean(category),{riskWeight:70,evidenceRefs:['product.categoryId'],requiredAction:{field:'categoryId',action:'set_category'}});
  add(MODERATION_REASON_CODES.CATEGORY_FORBIDDEN,!forbidden,{severity:'fatal',riskWeight:100,evidenceRefs:['category_schema.forbidden']});
  if(silentRun)add(MODERATION_REASON_CODES.CATEGORY_SILENT_RUN_DISABLED,Boolean(silentRunAllowed),{severity:'quarantine',riskWeight:80,evidenceRefs:['category_schema.silent_run_allowed']});

  for(const field of requiredFields){
    const value=readField(product,offer,field);
    add(MODERATION_REASON_CODES.REQUIRED_FIELD_MISSING,hasValue(value),{
      riskWeight:18,
      safeDetails:{field},
      evidenceRefs:['field:'+field],
      requiredAction:{field,action:'provide_value'}
    });
  }

  const documents=[...(product.documents||[]),...(offer?.documents||[])];
  for(const documentType of requiredDocuments)add(MODERATION_REASON_CODES.REQUIRED_DOCUMENT_MISSING,documents.some(row=>(row.type||row.documentType)===documentType&&row.status!=='rejected'),{
    riskWeight:35,
    safeDetails:{documentType},
    evidenceRefs:['documents:'+documentType],
    requiredAction:{documentType,action:'upload_document'}
  });

  const certificates=[...(product.certificates||[]),...(offer?.certificates||[])];
  for(const certificateType of requiredCertificates)add(MODERATION_REASON_CODES.REQUIRED_CERTIFICATE_MISSING,certificates.some(row=>(row.type||row.certificateType)===certificateType&&row.status!=='rejected'),{
    riskWeight:35,
    safeDetails:{certificateType},
    evidenceRefs:['certificates:'+certificateType],
    requiredAction:{certificateType,action:'upload_certificate'}
  });

  if(offer){
    add(MODERATION_REASON_CODES.INVALID_PRICE,Number.isFinite(Number(offer.price))&&Number(offer.price)>0,{riskWeight:45,evidenceRefs:['offer.price'],requiredAction:{field:'price',action:'set_valid_price'}});
    add(MODERATION_REASON_CODES.INVALID_STOCK,Number.isFinite(Number(offer.stock))&&Number(offer.stock)>0,{riskWeight:40,evidenceRefs:['offer.stock'],requiredAction:{field:'stock',action:'confirm_stock'}});
    if(allowedConditions.length)add(MODERATION_REASON_CODES.CONDITION_NOT_ALLOWED,allowedConditions.includes(offer.condition),{riskWeight:35,safeDetails:{allowedConditions},evidenceRefs:['offer.condition'],requiredAction:{field:'condition',action:'select_allowed_condition'}});
    const freshnessAt=Date.parse(offer.freshnessAt||offer.updatedAt||offer.createdAt||0);
    const freshnessLimit=Number(firstDefined(schema.max_inventory_age_hours,moderation.max_inventory_age_hours,inventoryFreshHours));
    const fresh=Number.isFinite(freshnessAt)&&(now.getTime()-freshnessAt)<=freshnessLimit*3600000;
    add(MODERATION_REASON_CODES.STALE_INVENTORY,fresh,{riskWeight:24,safeDetails:{maxAgeHours:freshnessLimit},evidenceRefs:['offer.freshnessAt'],requiredAction:{field:'stock',action:'refresh_inventory'}});
    const sellerBlocked=['suspended','disabled','blocked'].includes(String(seller?.status||'').toLowerCase());
    add(MODERATION_REASON_CODES.SELLER_SUSPENDED,!sellerBlocked,{severity:'fatal',riskWeight:100,evidenceRefs:['seller.status']});
    const duplicate=(await repo.list('Offer')).some(row=>row.id!==offer.id&&row.sellerId===offer.sellerId&&row.productId===offer.productId&&row.status==='active'&&Number(row.price)===Number(offer.price)&&String(row.condition)===String(offer.condition));
    add(MODERATION_REASON_CODES.DUPLICATE_OFFER,!duplicate,{riskWeight:45,evidenceRefs:['offer.sellerId','offer.productId'],requiredAction:{action:'update_existing_offer'}});
  }

  const media=[...(product.images||[]),...(product.media||[]),...(offer?.media||[])];
  const minimumMedia=Number(firstDefined(mediaRequirements.min_count,mediaRequirements.minCount,0));
  if(minimumMedia>0)add(MODERATION_REASON_CODES.MEDIA_INSUFFICIENT,media.length>=minimumMedia,{riskWeight:28,safeDetails:{minimum:minimumMedia,actual:media.length},evidenceRefs:['product.media'],requiredAction:{field:'media',action:'add_media'}});

  const ambiguity=Boolean(product.semanticAmbiguity||offer?.semanticAmbiguity||containsAmbiguousLanguage(product,offer));
  if(ambiguity)add(MODERATION_REASON_CODES.SEMANTIC_AMBIGUITY,false,{severity:'risk',riskWeight:35,evidenceRefs:['content.semantic']});
  const priceAnomaly=Boolean(offer&&isPriceAnomaly(offer,schema));
  if(priceAnomaly)add(MODERATION_REASON_CODES.PRICE_ANOMALY,false,{severity:'risk',riskWeight:30,evidenceRefs:['offer.price','category_schema.price_range']});

  const failed=results.filter(row=>row.result==='fail');
  const riskContributions=failed.map(row=>({code:row.code,score:row.riskWeight}));
  const riskScore=Math.min(100,riskContributions.reduce((sum,row)=>sum+Number(row.score||0),0));
  const hasFatal=failed.some(row=>row.severity==='fatal');
  const hasQuarantine=failed.some(row=>row.severity==='quarantine');
  const hasCorrectableBlock=failed.some(row=>row.severity==='block');
  const hasRiskOnly=failed.some(row=>row.severity==='risk');
  let decision;
  if(hasFatal)decision=MODERATION_DECISIONS.AUTO_REJECTED;
  else if(hasQuarantine)decision=MODERATION_DECISIONS.QUARANTINED;
  else if(hasCorrectableBlock)decision=MODERATION_DECISIONS.SELLER_ACTION_REQUIRED;
  else if(hasRiskOnly||riskScore>=Number(aiThreshold))decision=MODERATION_DECISIONS.AI_REVIEW_REQUIRED;
  else decision=MODERATION_DECISIONS.AUTO_APPROVED;
  if(riskScore>=Number(highRiskThreshold)&&hasRiskOnly&&!hasFatal&&!hasCorrectableBlock)decision=MODERATION_DECISIONS.AI_REVIEW_REQUIRED;
  const reasonCodes=[...new Set(failed.map(row=>row.code))];
  return {
    decision,
    riskScore,
    riskContributions,
    results,
    reasonCodes,
    requiredActions,
    sellerMessage:reasonCodes.map(code=>SELLER_MESSAGES[code]).filter(Boolean).join(' ')
  };
}

export function isOfferModerationApproved(offer){
  return Boolean(offer&&offer.moderationStatus===MODERATION_DECISIONS.AUTO_APPROVED&&offer.moderationCaseId);
}

function validateAiReview(input){
  if(!AI_DECISIONS.has(input.decision))throw codedError('invalid AI decision','INVALID_AI_DECISION',400);
  const confidence=Number(input.confidence);
  if(!Number.isFinite(confidence)||confidence<0||confidence>1)throw codedError('invalid AI confidence','INVALID_AI_CONFIDENCE',400);
  if(!Array.isArray(input.reasonCodes)||!Array.isArray(input.evidenceRefs)||!Array.isArray(input.requiredActions))throw codedError('invalid AI structured response','INVALID_AI_RESPONSE',400);
  if(!input.modelVersion||!input.promptPolicyVersion)throw codedError('AI version metadata required','INVALID_AI_RESPONSE',400);
  return {
    decision:input.decision,
    reasonCodes:[...new Set(input.reasonCodes.map(String))],
    evidenceRefs:[...new Set(input.evidenceRefs.map(String))],
    confidence,
    sellerMessage:String(input.sellerMessage||''),
    requiredActions:structuredClone(input.requiredActions),
    suspectedViolation:Boolean(input.suspectedViolation),
    safeDetails:structuredClone(input.safeDetails||{}),
    modelVersion:String(input.modelVersion),
    promptPolicyVersion:String(input.promptPolicyVersion)
  };
}

async function applyDecisionToOffer(repo,offer,moderationCase,now){
  const next={
    ...offer,
    moderationStatus:moderationCase.decision,
    moderationCaseId:moderationCase.id,
    moderationRiskScore:moderationCase.riskScore,
    moderationReasonCodes:[...moderationCase.reasonCodes],
    moderationUpdatedAt:now.toISOString()
  };
  await repo.put('Offer',next);
  return next;
}

async function activeSchema(repo,categoryId){
  if(!categoryId)return null;
  const rows=(await repo.list('CategorySchema')).filter(row=>row.categoryId===categoryId&&row.status==='active');
  return rows.sort((a,b)=>Number(b.version||0)-Number(a.version||0))[0]||null;
}

async function findSeller(repo,sellerId){
  return await repo.get('Seller',sellerId)||await repo.get('SellerProfile',sellerId)||null;
}

async function previousCaseId(repo,offerId,productId){
  const rows=(await repo.list('ModerationCase')).filter(row=>offerId?row.offerId===offerId:row.productId===productId);
  return rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0]?.id||null;
}

function normalizeInput({product,offer,seller,schema}){
  return canonical({
    product:pick(product,['id','name','title','description','categoryId','category','attributes','condition','documents','certificates','images','media','semanticAmbiguity']),
    offer:offer?pick(offer,['id','productId','sellerId','price','currency','condition','stock','region','deliveryOptions','freshnessAt','attributes','documents','certificates','media','semanticAmbiguity']):null,
    seller:seller?pick(seller,['id','status','consentVersion']):null,
    schema:canonical(schema)
  });
}

function pick(object,keys){
  const out={};
  for(const key of keys)if(object&&object[key]!==undefined)out[key]=object[key];
  return out;
}

function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=canonical(value[key]);
    return out;
  }
  if(typeof value==='string')return value.trim().replace(/\s+/g,' ');
  return value;
}

function contentFingerprint(value){
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function readField(product,offer,field){
  if(offer&&offer[field]!==undefined)return offer[field];
  if(offer?.attributes&&offer.attributes[field]!==undefined)return offer.attributes[field];
  if(product&&product[field]!==undefined)return product[field];
  return product?.attributes?.[field];
}

function hasValue(value){
  return value!==null&&value!==undefined&&String(value).trim()!=='';
}

function unique(...values){
  return [...new Set(values.flatMap(value=>Array.isArray(value)?value:[]).filter(Boolean).map(String))];
}

function firstDefined(...values){
  return values.find(value=>value!==undefined&&value!==null);
}

function containsAmbiguousLanguage(product,offer){
  const text=[product.title,product.name,product.description,offer?.description].filter(Boolean).join(' ').toLowerCase();
  return /(реплика|аналог оригинала|как оригинал|без документов|уточняйте цену|цена в личку|не знаю что это)/u.test(text);
}

function isPriceAnomaly(offer,schema){
  const range=schema.safe_price_range||schema.safePriceRange||schema.moderation?.safe_price_range||schema.moderation?.safePriceRange;
  if(!range)return false;
  const price=Number(offer.price);
  const min=Number(range.min);
  const max=Number(range.max);
  return (Number.isFinite(min)&&price<min)||(Number.isFinite(max)&&price>max);
}

function statusForDecision(decision){
  if(decision===MODERATION_DECISIONS.AUTO_APPROVED)return MODERATION_STATUSES.PUBLISHED;
  if(decision===MODERATION_DECISIONS.SELLER_ACTION_REQUIRED)return MODERATION_STATUSES.ACTION_REQUIRED;
  if(decision===MODERATION_DECISIONS.AUTO_REJECTED)return MODERATION_STATUSES.REJECTED;
  if(decision===MODERATION_DECISIONS.QUARANTINED)return MODERATION_STATUSES.QUARANTINED;
  if(decision===MODERATION_DECISIONS.AI_REVIEW_REQUIRED)return MODERATION_STATUSES.AI_REVIEW;
  if(decision===MODERATION_DECISIONS.SECOND_AI_REVIEW)return MODERATION_STATUSES.SECOND_AI_REVIEW;
  if(decision===MODERATION_DECISIONS.HUMAN_EXCEPTION)return MODERATION_STATUSES.HUMAN_EXCEPTION;
  return MODERATION_STATUSES.RECEIVED;
}

function codedError(message,code,status){
  return Object.assign(new Error(message),{code,status});
}
