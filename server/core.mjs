import crypto from 'node:crypto';

export const PERMISSIONS = {
  owner:['*'],
  manager:['sales.read','sales.write','tasks.read','tasks.write','inventory.read','analytics.read','finance.read'],
  seller:['sales.read','sales.write','inbox.read','inbox.write','price.range.read','orders.read'],
  warehouse:['inventory.read','inventory.write','tasks.read','tasks.write','barcode.scan','orders.pack'],
  admin:['platform.*']
};

export function can(role, permission){
  const grants=PERMISSIONS[role]||[];
  return grants.includes('*')||grants.includes(permission)||grants.some(g=>g.endsWith('*')&&permission.startsWith(g.slice(0,-1)));
}

export function assertCan(ctx, permission){
  if(!ctx?.userId||!ctx?.companyId) throw Object.assign(new Error('unauthenticated'),{code:'AUTH_REQUIRED'});
  if(!can(ctx.role,permission)) throw Object.assign(new Error(`forbidden:${permission}`),{code:'FORBIDDEN'});
}

export function tenantKey(companyId, entity, id){
  if(!companyId) throw new Error('companyId required');
  return `${companyId}:${entity}:${id}`;
}

export class MemoryRepository {
  #store=new Map();
  put(ctx, entity, record){
    if(!record?.id) throw new Error('record.id required');
    const value={...structuredClone(record),companyId:ctx.companyId,updatedAt:new Date().toISOString()};
    this.#store.set(tenantKey(ctx.companyId,entity,record.id),value);
    return structuredClone(value);
  }
  get(ctx, entity, id){
    const value=this.#store.get(tenantKey(ctx.companyId,entity,id));
    return value?structuredClone(value):null;
  }
  list(ctx, entity){
    const prefix=`${ctx.companyId}:${entity}:`;
    return [...this.#store.entries()].filter(([k])=>k.startsWith(prefix)).map(([,v])=>structuredClone(v));
  }
  remove(ctx, entity, id){return this.#store.delete(tenantKey(ctx.companyId,entity,id));}
}

export class AuditLog {
  #events=[];
  write(ctx,{action,entity,entityId,result='ok',meta={}}){
    const evt={id:crypto.randomUUID(),at:new Date().toISOString(),companyId:ctx.companyId,userId:ctx.userId,role:ctx.role,action,entity,entityId,result,meta:structuredClone(meta)};
    this.#events.push(evt);return structuredClone(evt);
  }
  list(ctx){return this.#events.filter(e=>e.companyId===ctx.companyId).map(value=>structuredClone(value));}
}

export class EventBus {
  #events=[];
  emit(ctx,type,payload={}){
    const evt={id:crypto.randomUUID(),type,companyId:ctx.companyId,at:new Date().toISOString(),payload:structuredClone(payload)};
    this.#events.push(evt);return structuredClone(evt);
  }
  list(ctx){return this.#events.filter(e=>e.companyId===ctx.companyId).map(value=>structuredClone(value));}
}

export const OWNER_DECISION_REASONS=new Set(['limit_exceeded','low_confidence','legal_confirmation','financial_confirmation','serious_anomaly']);

export function evaluateDecision({confidence=1,limitExceeded=false,legal=false,financial=false,seriousAnomaly=false}){
  if(limitExceeded)return {mode:'owner',reason:'limit_exceeded'};
  if(confidence<0.72)return {mode:'owner',reason:'low_confidence'};
  if(legal)return {mode:'owner',reason:'legal_confirmation'};
  if(financial)return {mode:'owner',reason:'financial_confirmation'};
  if(seriousAnomaly)return {mode:'owner',reason:'serious_anomaly'};
  return {mode:'auto',reason:'within_policy'};
}

export function createServices(){return {repo:new MemoryRepository(),audit:new AuditLog(),events:new EventBus()};}
