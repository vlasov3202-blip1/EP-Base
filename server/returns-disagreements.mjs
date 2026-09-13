import crypto from 'node:crypto';

export class ReturnService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async create(ctx,{orderId,reason,type='ordinary',items=[],evidence=[]}={}){const repo=this.repoFactory(ctx);const order=await repo.get('Order',orderId);if(!order)throw new Error('order not found');const rec={id:`ret_${crypto.randomUUID()}`,orderId,type,reason,items:structuredClone(items),evidence:structuredClone(evidence),status:'requested',route:type==='mismatch'||type==='damage'?'disagreement':'return',createdAt:this.now().toISOString()};await repo.put('Return',rec);return rec;}
}

export class DisagreementService{
  constructor({repoFactory,now=()=>new Date(),analyzer=null}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;this.analyzer=analyzer;}
  async open(ctx,{orderId,issueType,buyerClaim,sellerResponse='',evidence=[]}={}){const repo=this.repoFactory(ctx);const order=await repo.get('Order',orderId);if(!order)throw new Error('order not found');const rec={id:`dis_${crypto.randomUUID()}`,orderId,issueType,buyerClaim,sellerResponse,evidence:structuredClone(evidence),proposedResolution:null,aiAnalysis:null,humanReview:null,finalResolution:null,status:'fact_finding',createdAt:this.now().toISOString()};await repo.put('Disagreement',rec);return rec;}
  async analyze(ctx,id){const repo=this.repoFactory(ctx);const d=await repo.get('Disagreement',id);if(!d)throw new Error('disagreement not found');const ai=this.analyzer?await this.analyzer(d):defaultAnalysis(d);const next={...d,aiAnalysis:ai,proposedResolution:ai.proposedResolution||null,status:ai.confidence>=0.8?'resolution_proposed':'needs_human_review',updatedAt:this.now().toISOString()};await repo.put('Disagreement',next);return next;}
  async resolve(ctx,id,{resolution,humanReview=null}={}){const repo=this.repoFactory(ctx);const d=await repo.get('Disagreement',id);if(!d)throw new Error('disagreement not found');const next={...d,humanReview,finalResolution:resolution,status:'resolved',resolvedAt:this.now().toISOString()};await repo.put('Disagreement',next);return next;}
}
function defaultAnalysis(d){const evidenceCount=Array.isArray(d.evidence)?d.evidence.length:0;return{facts:{evidenceCount,issueType:d.issueType},confidence:evidenceCount>=2?0.82:0.55,proposedResolution:evidenceCount>=2?'partial_compensation_or_return':'collect_more_evidence',position:'establish_facts_not_blame'};}
