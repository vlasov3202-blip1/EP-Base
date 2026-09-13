import crypto from 'node:crypto';

function hashKey(raw){return crypto.createHash('sha256').update(String(raw)).digest('hex')}
function now(){return Date.now()}

export class ApiKeyService{
  constructor(store,{windowMs=60_000,defaultLimit=120}={}){this.store=store;this.windowMs=windowMs;this.defaultLimit=defaultLimit;this.buckets=new Map()}
  async create(ctx,{name='integration',scopes=[],rateLimit=this.defaultLimit}={}){
    if(!ctx?.companyId||!ctx?.userId)throw new Error('authenticated context required');
    const raw=`ein_${crypto.randomBytes(24).toString('base64url')}`;
    const id=crypto.randomUUID();
    const rec={id,companyId:ctx.companyId,name,scopes:[...new Set(scopes)],rateLimit:Number(rateLimit)||this.defaultLimit,hash:hashKey(raw),createdBy:ctx.userId,createdAt:new Date().toISOString(),revokedAt:null,lastUsedAt:null};
    await this.store.tenant(ctx).put('ApiKey',rec);
    return {id,token:raw,name:rec.name,scopes:rec.scopes,rateLimit:rec.rateLimit};
  }
  async revoke(ctx,id){const repo=this.store.tenant(ctx);const rec=repo.get('ApiKey',id);if(!rec)return false;rec.revokedAt=new Date().toISOString();await repo.put('ApiKey',rec);return true}
  authenticate(raw){const digest=hashKey(raw);for(const rec of Object.values(this.store.db.records||{})){if(rec?.companyId&&rec?.hash===digest&&String(rec.id||'')&&String(rec.updatedAt||'')&&rec.revokedAt==null){const ctx={userId:`api:${rec.id}`,companyId:rec.companyId,role:'api',apiKeyId:rec.id,scopes:rec.scopes||[]};this.consume(rec,ctx);rec.lastUsedAt=new Date().toISOString();return ctx}}throw Object.assign(new Error('invalid api key'),{status:401,code:'INVALID_API_KEY'})}
  consume(rec,ctx){const key=`${rec.companyId}:${rec.id}`;const t=now();let b=this.buckets.get(key);if(!b||t-b.startedAt>=this.windowMs)b={startedAt:t,count:0};b.count++;this.buckets.set(key,b);const limit=Number(rec.rateLimit)||this.defaultLimit;if(b.count>limit)throw Object.assign(new Error('rate limit exceeded'),{status:429,code:'RATE_LIMITED',retryAfterMs:this.windowMs-(t-b.startedAt)});ctx.rateLimit={limit,remaining:Math.max(0,limit-b.count),resetAt:b.startedAt+this.windowMs}}
  requireScope(ctx,scope){const scopes=ctx?.scopes||[];if(!scopes.includes('*')&&!scopes.includes(scope))throw Object.assign(new Error(`missing scope:${scope}`),{status:403,code:'SCOPE_FORBIDDEN'});return ctx}
}
