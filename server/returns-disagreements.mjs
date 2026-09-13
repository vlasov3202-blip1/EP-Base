import crypto from 'node:crypto';

export class ReturnService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async create(ctx,{orderId,reason,type='ordinary',items=[],evidence=[]}={}){const repo=this.repoFactory(ctx);const order=await repo.get('Order',orderId);if(!order)throw new Error('order not found');const rec={id:`ret_${crypto.randomUUID()}`,orderId,type,reason,items:structuredClone(items),evidence:structuredClone(evidence),status:'requested',route:type==='mismatch'||type==='damage'?'disagreement':'return',createdAt:this.now().toISOString()};await repo.put('Return',rec);return rec;}
}

export class DisagreementService{
  constructor({repoFactory,now=()=>new Date(),analyzer=null}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;this.analyzer=analyzer;}
  async #resolveEvidence(repo,evidence=[]){
    const resolved=[];
    for(const item of evidence){
      if(typeof item==='string'){
        const stored=await repo.get('Evidence',item);
        if(!stored)throw new Error(`evidence not found: ${item}`);
        resolved.push(stored);continue;
      }
      if(item?.id){
        const stored=await repo.get('Evidence',item.id);
        if(!stored)throw new Error(`evidence not found: ${item.id}`);
        resolved.push(stored);continue;
      }
      throw new Error('ephemeral or unsaved evidence is not allowed');
    }
    return resolved;
  }
  async open(ctx,{orderId,issueType,buyerClaim,sellerResponse='',evidence=[]}={}){const repo=this.repoFactory(ctx);const order=await repo.get('Order',orderId);if(!order)throw new Error('order not found');const savedEvidence=await this.#resolveEvidence(repo,evidence);const rec={id:`dis_${crypto.randomUUID()}`,orderId,issueType,buyerClaim,sellerResponse,evidence:savedEvidence.map(x=>x.id),proposedResolution:null,aiAnalysis:null,humanReview:null,finalResolution:null,status:'fact_finding',createdAt:this.now().toISOString()};await repo.put('Disagreement',rec);return rec;}
  async analyze(ctx,id){const repo=this.repoFactory(ctx);const d=await repo.get('Disagreement',id);if(!d)throw new Error('disagreement not found');const evidence=[];for(const evidenceId of d.evidence||[]){const stored=await repo.get('Evidence',evidenceId);if(stored)evidence.push(stored);}const subject={...d,evidence};const ai=this.analyzer?await this.analyzer(subject):defaultAnalysis(subject);const next={...d,aiAnalysis:ai,proposedResolution:ai.proposedResolution||null,status:ai.confidence>=0.8?'resolution_proposed':'needs_human_review',updatedAt:this.now().toISOString()};await repo.put('Disagreement',next);return next;}
  async resolve(ctx,id,{resolution,humanReview=null}={}){const repo=this.repoFactory(ctx);const d=await repo.get('Disagreement',id);if(!d)throw new Error('disagreement not found');const next={...d,humanReview,finalResolution:resolution,status:'resolved',resolvedAt:this.now().toISOString()};await repo.put('Disagreement',next);return next;}
}
function defaultAnalysis(d){const evidenceCount=Array.isArray(d.evidence)?d.evidence.length:0;return{facts:{evidenceCount,issueType:d.issueType,spatialEvidence:d.evidence.filter?.(x=>x.type==='SPATIAL_EVIDENCE').length||0},confidence:evidenceCount>=2?0.82:0.55,proposedResolution:evidenceCount>=2?'partial_compensation_or_return':'collect_more_evidence',position:'establish_facts_not_blame'};}
