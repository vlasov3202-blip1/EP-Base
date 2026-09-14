import crypto from 'node:crypto';
import {MODERATION_DECISIONS,MODERATION_STATUSES} from './moderation.mjs';

const APPEALABLE=new Set([
  MODERATION_DECISIONS.SELLER_ACTION_REQUIRED,
  MODERATION_DECISIONS.AUTO_REJECTED,
  MODERATION_DECISIONS.QUARANTINED
]);
const SIGNAL_POLICY=Object.freeze({
  complaint_spike:{risk:45,hard:false},
  returns_spike:{risk:40,hard:false},
  counterfeit_signal:{risk:70,hard:false},
  price_manipulation:{risk:55,hard:false},
  media_changed:{risk:35,hard:false},
  document_revoked:{risk:100,hard:true},
  seller_suspended:{risk:100,hard:true},
  critical_harm:{risk:100,hard:true},
  mass_incident:{risk:100,hard:true}
});

export class ModerationAppealService{
  constructor({repoFactory,audit=null,events=null,now=()=>new Date(),enabled=true}={}){
    if(typeof repoFactory!=='function')throw new Error('repoFactory required');
    this.repoFactory=repoFactory;this.audit=audit;this.events=events;this.now=now;this.enabled=Boolean(enabled);
  }
  async submit(ctx,moderationCaseId,{sellerStatement='',evidenceRefs=[]}={}){
    if(!this.enabled)throw codedError('moderation appeals disabled','MODERATION_APPEALS_DISABLED',503);
    const repo=this.repoFactory(ctx);
    const moderationCase=await repo.get('ModerationCase',moderationCaseId);
    if(!moderationCase)throw codedError('moderation case not found','MODERATION_CASE_NOT_FOUND',404);
    assertObjectAccess(ctx,moderationCase);
    if(moderationCase.appealId){
      const linked=await repo.get('ModerationAppeal',moderationCase.appealId);
      if(linked&&['submitted','ai_review','human_review'].includes(linked.status))return{appeal:linked,moderationCase,reused:true};
    }
    if(!APPEALABLE.has(moderationCase.decision))throw codedError('decision cannot be appealed','MODERATION_DECISION_NOT_APPEALABLE',409);
    const statement=String(sellerStatement||'').trim();
    const refs=[...new Set((evidenceRefs||[]).map(String).filter(Boolean))];
    if(statement.length<20||!refs.length)throw codedError('new evidence and seller statement required','APPEAL_NEW_EVIDENCE_REQUIRED',400);
    for(const ref of refs.filter(value=>value.startsWith('evidence:'))){
      const evidence=await repo.get('ModerationEvidence',ref.slice('evidence:'.length));
      if(!evidence||evidence.status!=='active'||evidence.moderationCaseId!==moderationCase.id)throw codedError('appeal evidence is unavailable or belongs to another case','APPEAL_EVIDENCE_INVALID',400);
      assertObjectAccess(ctx,evidence);
    }
    const existing=(await repo.list('ModerationAppeal')).find(row=>row.moderationCaseId===moderationCase.id&&['submitted','ai_review','human_review'].includes(row.status));
    if(existing)return{appeal:existing,moderationCase,reused:true};
    const hardRules=(await repo.list('ModerationRuleResult')).filter(row=>
      row.moderationCaseId===moderationCase.id&&
      row.result==='fail'&&
      ['block','fatal','quarantine'].includes(row.severity)
    );
    const requiresHuman=hardRules.length>0;
    const at=this.now().toISOString();
    const appeal={
      id:'appeal_'+crypto.randomUUID(),
      moderationCaseId:moderationCase.id,
      offerId:moderationCase.offerId,
      productId:moderationCase.productId,
      sellerId:moderationCase.sellerId,
      previousDecision:moderationCase.decision,
      sellerStatement:statement,
      evidenceRefs:refs,
      status:requiresHuman?'human_review':'ai_review',
      createdBy:{id:ctx.userId,role:ctx.role},
      createdAt:at,
      resolvedAt:null
    };
    const humanExceptionId=requiresHuman?moderationCase.id+':appeal-human':null;
    const nextCase={
      ...moderationCase,
      appealId:appeal.id,
      appealPreviousDecision:moderationCase.decision,
      decision:requiresHuman?MODERATION_DECISIONS.HUMAN_EXCEPTION:MODERATION_DECISIONS.SECOND_AI_REVIEW,
      status:requiresHuman?MODERATION_STATUSES.HUMAN_EXCEPTION:MODERATION_STATUSES.SECOND_AI_REVIEW,
      humanExceptionId:humanExceptionId||moderationCase.humanExceptionId||null,
      completedAt:null
    };
    await repo.put('ModerationAppeal',{...appeal,humanExceptionId});
    if(requiresHuman)await repo.put('ModerationHumanException',{
      id:humanExceptionId,
      moderationCaseId:moderationCase.id,
      objectType:moderationCase.objectType,
      offerId:moderationCase.offerId,
      productId:moderationCase.productId,
      sellerId:moderationCase.sellerId,
      reasonCodes:['APPEAL_NEW_EVIDENCE'],
      evidence:{appealId:appeal.id,evidenceRefs:refs,hardRuleCodes:hardRules.map(row=>row.ruleCode)},
      priority:'P1',
      status:'open',
      createdAt:at,
      resolvedAt:null
    });
    await repo.put('ModerationCase',nextCase);
    await syncOffer(repo,nextCase,this.now());
    await this.events?.emit?.(ctx,'moderation.appeal.submitted',{appealId:appeal.id,moderationCaseId:nextCase.id,offerId:nextCase.offerId});
    await this.audit?.write?.(ctx,{
      actor:{type:'user',id:ctx.userId,role:ctx.role},
      action:'moderation.appeal.submit',
      object:{type:nextCase.objectType,id:nextCase.offerId||nextCase.productId,moderationCaseId:nextCase.id,appealId:appeal.id},
      reason:'new_evidence',
      before:{decision:appeal.previousDecision},
      after:{decision:nextCase.decision,status:nextCase.status},
      result:{evidenceRefs:refs}
    });
    return{appeal:{...appeal,humanExceptionId},moderationCase:nextCase,reused:false};
  }
  async get(ctx,id){
    const appeal=await this.repoFactory(ctx).get('ModerationAppeal',id);
    if(!appeal)return null;
    assertObjectAccess(ctx,appeal);
    return appeal;
  }
  async list(ctx,{status=null}={}){
    let rows=await this.repoFactory(ctx).list('ModerationAppeal');
    if(ctx.role==='seller')rows=rows.filter(row=>row.sellerId===(ctx.user?.sellerId||ctx.userId));
    if(status)rows=rows.filter(row=>row.status===status);
    return rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  }
}

export class ModerationMonitoringService{
  constructor({repoFactory,audit=null,events=null,now=()=>new Date(),enabled=true}={}){
    if(typeof repoFactory!=='function')throw new Error('repoFactory required');
    this.repoFactory=repoFactory;this.audit=audit;this.events=events;this.now=now;this.enabled=Boolean(enabled);
  }
  async recordSignal(ctx,{offerId,type,severity='medium',evidenceRefs=[],safeDetails={},idempotencyKey=null,source='internal'}={}){
    if(!this.enabled)return{ignored:true,reason:'POST_PUBLICATION_MONITORING_DISABLED'};
    const policy=SIGNAL_POLICY[type];
    if(!policy)throw codedError('unsupported monitoring signal','UNSUPPORTED_MODERATION_SIGNAL',400);
    const repo=this.repoFactory(ctx);
    const offer=await repo.get('Offer',offerId);
    if(!offer)throw codedError('offer not found','OFFER_NOT_FOUND',404);
    const key=idempotencyKey||fingerprint({offerId,type,evidenceRefs,safeDetails});
    const existing=(await repo.list('ModerationPostPublicationSignal')).find(row=>row.idempotencyKey===key);
    if(existing)return{signal:existing,moderationCase:existing.moderationCaseId?await repo.get('ModerationCase',existing.moderationCaseId):null,reused:true};
    const at=this.now().toISOString();
    let signal={
      id:'modsig_'+crypto.randomUUID(),
      offerId,
      productId:offer.productId,
      sellerId:offer.sellerId,
      type,
      severity,
      riskScore:policy.risk,
      evidenceRefs:[...new Set((evidenceRefs||[]).map(String))],
      safeDetails:structuredClone(safeDetails||{}),
      source,
      idempotencyKey:key,
      status:'recorded',
      createdAt:at,
      moderationCaseId:null
    };
    if(offer.moderationStatus!==MODERATION_DECISIONS.AUTO_APPROVED){
      signal={...signal,status:'observed_non_published'};
      await repo.put('ModerationPostPublicationSignal',signal);
      return{signal,moderationCase:null,reused:false};
    }
    const previousCase=offer.moderationCaseId?await repo.get('ModerationCase',offer.moderationCaseId):null;
    const decision=policy.hard||severity==='critical'?MODERATION_DECISIONS.QUARANTINED:MODERATION_DECISIONS.AI_REVIEW_REQUIRED;
    const moderationCase={
      id:'mod_'+crypto.randomUUID(),
      objectType:'Offer',
      offerId:offer.id,
      productId:offer.productId,
      sellerId:offer.sellerId,
      source,
      trigger:'post_publication',
      status:decision===MODERATION_DECISIONS.QUARANTINED?MODERATION_STATUSES.QUARANTINED:MODERATION_STATUSES.AI_REVIEW,
      decision,
      riskScore:policy.risk,
      reasonCodes:['POST_PUBLICATION_'+type.toUpperCase()],
      requiredActions:[],
      contentFingerprint:key,
      categorySchemaVersion:previousCase?.categorySchemaVersion||null,
      policyVersion:previousCase?.policyVersion||'moderation-policy-v1',
      rulesVersion:previousCase?.rulesVersion||'algorithm-rules-v1',
      aiPolicyVersion:previousCase?.aiPolicyVersion||'ai-moderation-v1',
      previousCaseId:previousCase?.id||null,
      monitoringSignalId:signal.id,
      createdAt:at,
      completedAt:decision===MODERATION_DECISIONS.QUARANTINED?at:null
    };
    signal={...signal,status:'routed',moderationCaseId:moderationCase.id};
    await repo.put('ModerationPostPublicationSignal',signal);
    await repo.put('ModerationCase',moderationCase);
    await repo.put('ModerationRuleResult',{
      id:moderationCase.id+':post-publication',
      moderationCaseId:moderationCase.id,
      ruleCode:moderationCase.reasonCodes[0],
      ruleVersion:moderationCase.rulesVersion,
      result:'fail',
      severity:policy.hard?'quarantine':'risk',
      riskWeight:policy.risk,
      safeDetails:structuredClone(safeDetails||{}),
      evidenceRefs:signal.evidenceRefs,
      createdAt:at
    });
    await syncOffer(repo,moderationCase,this.now());
    await this.events?.emit?.(ctx,'moderation.post_publication.routed',{signalId:signal.id,moderationCaseId:moderationCase.id,offerId,decision});
    await this.audit?.write?.(ctx,{
      actor:{type:'system',id:'moderation-monitor'},
      action:'moderation.post_publication.route',
      object:{type:'Offer',id:offer.id,moderationCaseId:moderationCase.id,signalId:signal.id},
      reason:type,
      decision,
      before:{moderationStatus:offer.moderationStatus},
      after:{moderationStatus:decision},
      result:{riskScore:policy.risk,evidenceRefs:signal.evidenceRefs}
    });
    return{signal,moderationCase,reused:false};
  }
  async scan(ctx){
    if(!this.enabled)return{checked:0,routed:0};
    const repo=this.repoFactory(ctx);
    const offers=(await repo.list('Offer')).filter(row=>row.moderationStatus===MODERATION_DECISIONS.AUTO_APPROVED);
    let routed=0;
    for(const offer of offers){
      const [primarySeller,product]=await Promise.all([
        repo.get('Seller',offer.sellerId),
        repo.get('Product',offer.productId)
      ]);
      const seller=primarySeller||await repo.get('SellerProfile',offer.sellerId);
      if(['suspended','disabled','blocked'].includes(String(seller?.status||'').toLowerCase())){
        const out=await this.recordSignal(ctx,{offerId:offer.id,type:'seller_suspended',severity:'critical',evidenceRefs:['seller.status'],idempotencyKey:'seller-suspended:'+offer.id+':'+seller.updatedAt});
        if(out.moderationCase)routed++;
        continue;
      }
      const revoked=(product?.documents||[]).find(row=>row.status==='revoked');
      if(revoked){
        const out=await this.recordSignal(ctx,{offerId:offer.id,type:'document_revoked',severity:'critical',evidenceRefs:['document:'+String(revoked.id||revoked.type)],idempotencyKey:'document-revoked:'+offer.id+':'+String(revoked.id||revoked.type)});
        if(out.moderationCase)routed++;
      }
    }
    return{checked:offers.length,routed};
  }
}

export class ModerationRepublicationService{
  constructor({repoFactory,moderation,audit=null,events=null,now=()=>new Date()}={}){
    if(typeof repoFactory!=='function')throw new Error('repoFactory required');
    if(!moderation?.review)throw new Error('moderation service required');
    this.repoFactory=repoFactory;this.moderation=moderation;this.audit=audit;this.events=events;this.now=now;
  }
  async request(ctx,moderationCaseId,{reason=''}={}){
    const statement=String(reason||'').trim();
    if(statement.length<20)throw codedError('republication reason required','REPUBLICATION_REASON_REQUIRED',400);
    const repo=this.repoFactory(ctx);
    const sourceCase=await repo.get('ModerationCase',moderationCaseId);
    if(!sourceCase)throw codedError('moderation case not found','MODERATION_CASE_NOT_FOUND',404);
    assertObjectAccess(ctx,sourceCase);
    if(sourceCase.decision!==MODERATION_DECISIONS.QUARANTINED)throw codedError('only quarantined offer can be rechecked','REPUBLICATION_NOT_ALLOWED',409);
    if(!sourceCase.offerId)throw codedError('offer required for republication','OFFER_ID_REQUIRED',400);
    const idempotencyKey='republication:'+sourceCase.id+':'+fingerprint({statement});
    const existing=(await repo.list('ModerationRepublication')).find(row=>row.idempotencyKey===idempotencyKey);
    if(existing)return{request:existing,moderationCase:await repo.get('ModerationCase',existing.resultCaseId),reused:true};
    const currentOffer=await repo.get('Offer',sourceCase.offerId);
    if(!currentOffer||currentOffer.moderationCaseId!==sourceCase.id)throw codedError('moderation state changed; refresh required','REPUBLICATION_STATE_CHANGED',409);
    const at=this.now().toISOString();
    let request={
      id:'modrep_'+crypto.randomUUID(),
      sourceCaseId:sourceCase.id,
      offerId:sourceCase.offerId,
      productId:sourceCase.productId,
      sellerId:sourceCase.sellerId,
      reason:statement,
      status:'running',
      idempotencyKey,
      createdBy:{id:ctx.userId,role:ctx.role},
      createdAt:at
    };
    await repo.put('ModerationRepublication',request);
    const resultCase=await this.moderation.review(ctx,{offerId:sourceCase.offerId,force:true,trigger:'republication',source:'republication'});
    request={...request,status:'completed',resultCaseId:resultCase.id,resultDecision:resultCase.decision,completedAt:this.now().toISOString()};
    await repo.put('ModerationRepublication',request);
    await this.events?.emit?.(ctx,'moderation.republication.completed',{requestId:request.id,sourceCaseId:sourceCase.id,resultCaseId:resultCase.id,decision:resultCase.decision});
    await this.audit?.write?.(ctx,{
      actor:{type:'user',id:ctx.userId,role:ctx.role},
      action:'moderation.republication.request',
      object:{type:'Offer',id:sourceCase.offerId,sourceCaseId:sourceCase.id,resultCaseId:resultCase.id},
      reason:statement,
      decision:resultCase.decision,
      before:{moderationStatus:sourceCase.decision},
      after:{moderationStatus:resultCase.decision}
    });
    return{request,moderationCase:resultCase,reused:false};
  }
}

export class ModerationIncidentService{
  constructor({repoFactory,monitoring,republication=null,audit=null,events=null,now=()=>new Date()}={}){
    if(typeof repoFactory!=='function')throw new Error('repoFactory required');
    if(!monitoring?.recordSignal)throw new Error('monitoring service required');
    this.repoFactory=repoFactory;this.monitoring=monitoring;this.republication=republication;this.audit=audit;this.events=events;this.now=now;
  }
  async open(ctx,{title,reason,selector={},evidenceRefs=[],severity='critical'}={}){
    if(!['owner','admin'].includes(ctx.role))throw codedError('owner/admin required','FORBIDDEN',403);
    if(!String(title||'').trim()||!String(reason||'').trim())throw codedError('incident title and reason required','INCIDENT_DETAILS_REQUIRED',400);
    if(!selector.sellerId&&!selector.categoryId&&!(selector.offerIds||[]).length)throw codedError('incident selector required','INCIDENT_SELECTOR_REQUIRED',400);
    const repo=this.repoFactory(ctx);
    const [offers,products]=await Promise.all([repo.list('Offer'),repo.list('Product')]);
    const productById=new Map(products.map(row=>[row.id,row]));
    const offerIds=new Set((selector.offerIds||[]).map(String));
    const targets=offers.filter(offer=>{
      if(offerIds.size&&!offerIds.has(offer.id))return false;
      if(selector.sellerId&&offer.sellerId!==selector.sellerId)return false;
      const product=productById.get(offer.productId);
      if(selector.categoryId&&(product?.categoryId||product?.category)!==selector.categoryId)return false;
      return true;
    }).slice(0,1000);
    const at=this.now().toISOString();
    const incident={
      id:'modinc_'+crypto.randomUUID(),
      title:String(title).trim(),
      reason:String(reason).trim(),
      selector:structuredClone(selector),
      evidenceRefs:[...new Set((evidenceRefs||[]).map(String))],
      severity,
      status:'open',
      affectedOfferIds:targets.map(row=>row.id),
      affectedCount:targets.length,
      createdBy:{id:ctx.userId,role:ctx.role},
      createdAt:at
    };
    await repo.put('ModerationIncident',incident);
    let quarantined=0;const effects=[];
    for(const offer of targets){
      const before={moderationStatus:offer.moderationStatus,moderationCaseId:offer.moderationCaseId||null};
      const out=await this.monitoring.recordSignal(ctx,{
        offerId:offer.id,
        type:'mass_incident',
        severity:'critical',
        evidenceRefs:incident.evidenceRefs,
        safeDetails:{incidentId:incident.id,title:incident.title},
        idempotencyKey:'incident:'+incident.id+':'+offer.id,
        source:'incident'
      });
      if(out.moderationCase){quarantined++;effects.push({offerId:offer.id,before,moderationCaseId:out.moderationCase.id});}
    }
    const next={...incident,quarantinedCount:quarantined,effects};
    await repo.put('ModerationIncident',next);
    await this.events?.emit?.(ctx,'moderation.incident.opened',{incidentId:next.id,affectedCount:next.affectedCount,quarantinedCount:quarantined});
    await this.audit?.write?.(ctx,{
      actor:{type:'user',id:ctx.userId,role:ctx.role},
      action:'moderation.incident.open',
      object:{type:'ModerationIncident',id:next.id},
      reason:next.reason,
      decision:'QUARANTINE_MATCHING_OFFERS',
      result:{affectedCount:next.affectedCount,quarantinedCount:quarantined,selector:next.selector}
    });
    return next;
  }
  async resolve(ctx,id,{action='keep_quarantined',reason=''}={}){
    if(!['owner','admin'].includes(ctx.role))throw codedError('owner/admin required','FORBIDDEN',403);
    if(!['keep_quarantined','recheck'].includes(action))throw codedError('invalid incident resolution','INVALID_INCIDENT_RESOLUTION',400);
    const statement=String(reason||'').trim();
    if(statement.length<20)throw codedError('incident resolution reason required','INCIDENT_RESOLUTION_REASON_REQUIRED',400);
    const repo=this.repoFactory(ctx);
    const incident=await repo.get('ModerationIncident',id);
    if(!incident)throw codedError('moderation incident not found','MODERATION_INCIDENT_NOT_FOUND',404);
    if(incident.status!=='open')throw codedError('moderation incident already resolved','MODERATION_INCIDENT_ALREADY_RESOLVED',409);
    if(action==='recheck'&&!this.republication?.request)throw codedError('republication service unavailable','REPUBLICATION_SERVICE_UNAVAILABLE',503);
    const outcomes={checked:0,published:0,waiting:0,blocked:0,skipped:0};
    if(action==='recheck'){
      for(const effect of incident.effects||[]){
        const offer=await repo.get('Offer',effect.offerId);
        if(!offer||offer.moderationCaseId!==effect.moderationCaseId||offer.moderationStatus!==MODERATION_DECISIONS.QUARANTINED){outcomes.skipped++;continue;}
        outcomes.checked++;
        const result=await this.republication.request(ctx,effect.moderationCaseId,{reason:statement});
        const decision=result.moderationCase.decision;
        if(decision===MODERATION_DECISIONS.AUTO_APPROVED)outcomes.published++;
        else if([MODERATION_DECISIONS.AI_REVIEW_REQUIRED,MODERATION_DECISIONS.SECOND_AI_REVIEW].includes(decision))outcomes.waiting++;
        else outcomes.blocked++;
      }
    }
    const next={...incident,status:'resolved',resolution:{action,reason:statement,actor:{id:ctx.userId,role:ctx.role},outcomes,at:this.now().toISOString()},resolvedAt:this.now().toISOString()};
    await repo.put('ModerationIncident',next);
    await this.events?.emit?.(ctx,'moderation.incident.resolved',{incidentId:id,action,outcomes});
    await this.audit?.write?.(ctx,{
      actor:{type:'user',id:ctx.userId,role:ctx.role},
      action:'moderation.incident.resolve',
      object:{type:'ModerationIncident',id},
      reason:statement,
      decision:action,
      result:outcomes
    });
    return next;
  }
  async list(ctx,{status=null}={}){
    let rows=await this.repoFactory(ctx).list('ModerationIncident');
    if(status)rows=rows.filter(row=>row.status===status);
    return rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  }
}

async function syncOffer(repo,moderationCase,now){
  if(!moderationCase.offerId)return null;
  const offer=await repo.get('Offer',moderationCase.offerId);
  if(!offer)return null;
  return repo.put('Offer',{
    ...offer,
    moderationStatus:moderationCase.decision,
    moderationCaseId:moderationCase.id,
    moderationRiskScore:moderationCase.riskScore,
    moderationReasonCodes:[...moderationCase.reasonCodes],
    moderationUpdatedAt:now.toISOString()
  });
}
function assertObjectAccess(ctx,row){
  if(ctx.role!=='seller')return;
  if(row.sellerId!==(ctx.user?.sellerId||ctx.userId))throw codedError('moderation object access denied','FORBIDDEN',403);
}
function fingerprint(value){
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function codedError(message,code,status){
  return Object.assign(new Error(message),{code,status});
}
export {APPEALABLE,SIGNAL_POLICY};
