import crypto from 'node:crypto';

function hashKey(raw){return crypto.createHash('sha256').update(String(raw)).digest('hex')}
function now(){return Date.now()}

export class ApiKeyService{
  constructor(store,{windowMs=60_000,defaultLimit=120,limiter=null}={}){this.store=store;this.windowMs=windowMs;this.defaultLimit=defaultLimit;this.limiter=limiter;this.buckets=new Map()}
  async create(ctx,{name='integration',scopes=[],rateLimit=this.defaultLimit}={}){
    if(!ctx?.companyId||!ctx?.userId)throw new Error('authenticated context required');
    const raw=`ein_${crypto.randomBytes(24).toString('base64url')}`;
    const id=crypto.randomUUID();
    const rec={id,companyId:ctx.companyId,name,scopes:[...new Set(scopes)],rateLimit:Number(rateLimit)||this.defaultLimit,hash:hashKey(raw),createdBy:ctx.userId,createdAt:new Date().toISOString(),revokedAt:null,lastUsedAt:null};
    await this.store.tenant(ctx).put('ApiKey',rec);
    return {id,token:raw,name:rec.name,scopes:rec.scopes,rateLimit:rec.rateLimit};
  }
  async revoke(ctx,id){const repo=this.store.tenant(ctx);const rec=await repo.get('ApiKey',id);if(!rec)return false;rec.revokedAt=new Date().toISOString();await repo.put('ApiKey',rec);return true}
  async authenticate(raw){
    const digest=hashKey(raw);
    const keys=await this.store.listAllApiKeys();
    const rec=keys.find(x=>x?.hash===digest&&x.revokedAt==null);
    if(!rec)throw Object.assign(new Error('invalid api key'),{status:401,code:'INVALID_API_KEY'});
    const ctx={userId:`api:${rec.id}`,companyId:rec.companyId,role:'api',apiKeyId:rec.id,scopes:rec.scopes||[]};
    await this.consume(rec,ctx);
    rec.lastUsedAt=new Date().toISOString();
    await this.store.tenant(ctx).put('ApiKey',rec);
    return ctx;
  }
  async consume(rec,ctx){const key=`api-key:${rec.companyId}:${rec.id}`;const limit=Number(rec.rateLimit)||this.defaultLimit;if(this.limiter){ctx.rateLimit=await this.limiter.consume(key,{limit,windowMs:this.windowMs});return ctx.rateLimit}const t=now();let b=this.buckets.get(key);if(!b||t-b.startedAt>=this.windowMs)b={startedAt:t,count:0};b.count++;this.buckets.set(key,b);if(b.count>limit)throw Object.assign(new Error('rate limit exceeded'),{status:429,code:'RATE_LIMITED',retryAfterMs:this.windowMs-(t-b.startedAt)});ctx.rateLimit={limit,remaining:Math.max(0,limit-b.count),resetAt:b.startedAt+this.windowMs};return ctx.rateLimit}
  requireScope(ctx,scope){const scopes=ctx?.scopes||[];if(!scopes.includes('*')&&!scopes.includes(scope))throw Object.assign(new Error(`missing scope:${scope}`),{status:403,code:'SCOPE_FORBIDDEN'});return ctx}
}
