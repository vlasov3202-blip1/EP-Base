import crypto from 'node:crypto';

export const AI_CAPABILITIES=Object.freeze(['reasoning','vision','transcription','embedding','generation','classification','moderation','video_understanding']);

export class AiProviderRegistry{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;this.providers=new Map();}
  register(provider){if(!provider?.id)throw new Error('provider id required');if(typeof provider.execute!=='function')throw new Error('provider execute required');this.providers.set(provider.id,provider);return this;}
  async setHealth(ctx,providerId,{status='healthy',latencyMs=null,costScore=null,qualityScore=null,allowedRegions=null,error=null}={}){const rec={id:`ai-health:${providerId}`,providerId,status,latencyMs,costScore,qualityScore,allowedRegions,error,updatedAt:this.now().toISOString()};await this.repoFactory(ctx).put('AiProviderHealth',rec);return rec;}
  async candidates(ctx,{capability,region=null,maxCostScore=null,minQualityScore=0,maxLatencyMs=null}={}){if(!AI_CAPABILITIES.includes(capability))throw new Error('unsupported capability');const repo=this.repoFactory(ctx);const health=new Map((await repo.list('AiProviderHealth')).map(x=>[x.providerId,x]));return [...this.providers.values()].filter(p=>p.capabilities?.includes?.(capability)).map(p=>({provider:p,health:health.get(p.id)||{status:'healthy',qualityScore:p.qualityScore??50,costScore:p.costScore??50,latencyMs:p.latencyMs??null,allowedRegions:p.allowedRegions??null}})).filter(x=>x.health.status!=='down').filter(x=>!region||!Array.isArray(x.health.allowedRegions)||x.health.allowedRegions.includes(region)).filter(x=>maxCostScore==null||Number(x.health.costScore??0)<=maxCostScore).filter(x=>Number(x.health.qualityScore??0)>=minQualityScore).filter(x=>maxLatencyMs==null||x.health.latencyMs==null||Number(x.health.latencyMs)<=maxLatencyMs).sort((a,b)=>score(b.health)-score(a.health));}
  async execute(ctx,{capability,input,region=null,maxCostScore=null,minQualityScore=0,maxLatencyMs=null,privacyGateway=null,metadata={}}={}){const repo=this.repoFactory(ctx);const candidates=await this.candidates(ctx,{capability,region,maxCostScore,minQualityScore,maxLatencyMs});const attempts=[];for(const item of candidates){try{const sanitized=privacyGateway?await preparePrivateInput(privacyGateway,{ctx,capability,input,providerId:item.provider.id,metadata}):input;const started=Date.now();const output=await item.provider.execute({capability,input:sanitized,ctx,metadata});const result={id:`ai-run:${crypto.randomUUID()}`,capability,providerId:item.provider.id,status:'success',latencyMs:Date.now()-started,metadata:structuredClone(metadata),createdAt:this.now().toISOString()};await repo.put('AiProviderRun',result);return{output,providerId:item.provider.id,attempts:[...attempts,result]};}catch(error){const fail={providerId:item.provider.id,status:'failed',error:String(error?.message||error)};attempts.push(fail);await this.setHealth(ctx,item.provider.id,{...(item.health||{}),status:'degraded',error:fail.error});}}
    const e=Object.assign(new Error('AI providers unavailable'),{code:'AI_PROVIDERS_UNAVAILABLE',attempts});throw e;
  }
}

function score(h={}){return Number(h.qualityScore??50)*2-Number(h.costScore??50)-Math.min(100,Number(h.latencyMs??0)/20);}


async function preparePrivateInput(gateway,args){
  if(typeof gateway.prepare==='function')return gateway.prepare(args);
  if(typeof gateway.sanitizeContext==='function')return gateway.sanitizeContext(args.input);
  if(typeof gateway.prepareExternal==='function')return gateway.prepareExternal({context:args.input});
  throw Object.assign(new Error('unsupported privacy gateway interface'),{code:'PRIVACY_GATEWAY_INTERFACE_INVALID'});
}
