import crypto from 'node:crypto';
export class AuditLogService{
 constructor({repoFactory,now=()=>new Date(),integrityKey=process.env.EINEIRO_AUDIT_INTEGRITY_KEY||'',integrityRequired=process.env.EINEIRO_AUDIT_INTEGRITY_REQUIRED==='true',alertSink=null}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');if(integrityRequired&&Buffer.byteLength(String(integrityKey||''))<32)throw Object.assign(new Error('audit integrity key must contain at least 32 bytes'),{code:'AUDIT_INTEGRITY_KEY_REQUIRED'});this.repoFactory=repoFactory;this.now=now;this.integrityKey=String(integrityKey||'');this.alertSink=alertSink;}
 async write(ctx,{actor,action,object,reason=null,decision=null,policy=null,before=null,after=null,result=null,rollback=null}={}){
  if(!action)throw new Error('audit action required');const repo=this.repoFactory(ctx);const rows=await repo.list('UnifiedAudit');const previous=rows.sort((a,b)=>Number(a.sequence||0)-Number(b.sequence||0)).at(-1)||null;
  const rec={id:`audit_${crypto.randomUUID()}`,sequence:Number(previous?.sequence||0)+1,previousHash:previous?.eventHash||null,integrityMode:this.integrityKey?'hmac-sha256':'sha256',actor:structuredClone(actor||{type:'system'}),action:String(action),object:structuredClone(object||{}),reason,decision:clone(decision),policy:clone(policy),before:clone(before),after:clone(after),result:clone(result),rollback:clone(rollback),createdAt:this.now().toISOString()};
  rec.eventHash=sign(rec,this.integrityKey);await repo.put('UnifiedAudit',rec);await this.#raiseAlert(ctx,repo,rec);return rec;
 }
 async list(ctx,{limit=200}={}){const rows=await this.repoFactory(ctx).list('UnifiedAudit');return rows.slice(-Math.max(1,Math.min(1000,limit))).reverse();}
 async verify(ctx){
  const rows=(await this.repoFactory(ctx).list('UnifiedAudit')).sort((a,b)=>Number(a.sequence||0)-Number(b.sequence||0));let previousHash=null;const failures=[];
  for(let i=0;i<rows.length;i++){const row=rows[i];if(Number(row.sequence)!==i+1)failures.push({id:row.id,code:'SEQUENCE_GAP'});if((row.previousHash||null)!==previousHash)failures.push({id:row.id,code:'PREVIOUS_HASH_MISMATCH'});if(row.eventHash!==sign(row,this.integrityKey))failures.push({id:row.id,code:'EVENT_HASH_MISMATCH'});previousHash=row.eventHash||null;}
  return{ok:failures.length===0,events:rows.length,headHash:previousHash,integrityMode:this.integrityKey?'hmac-sha256':'sha256',failures,verifiedAt:this.now().toISOString()};
 }
 async #raiseAlert(ctx,repo,event){
  const severity=alertSeverity(event.action);if(!severity)return;
  const alert={id:`secalert_${crypto.randomUUID()}`,severity,status:'open',action:event.action,auditEventId:event.id,actor:clone(event.actor),object:clone(event.object),createdAt:event.createdAt};await repo.put('SecurityAlert',alert);await this.alertSink?.(ctx,structuredClone(alert));
 }
}

function clone(value){return value==null?null:structuredClone(value)}
function alertSeverity(action){const value=String(action||'');if(/^(security\.break_glass|backup\.restore|deployment\.)/.test(value))return'critical';if(/^(security\.|api_key\.|role\.|payment\.refund|moderation\.incident\.resolve)/.test(value))return'high';return null}
function sign(record,key){const unsigned={...record};delete unsigned.eventHash;const data=stableStringify(unsigned);return key?crypto.createHmac('sha256',key).update(data).digest('hex'):crypto.createHash('sha256').update(data).digest('hex')}
function stableStringify(value){return JSON.stringify(normalize(value))}
function normalize(value){if(Array.isArray(value))return value.map(normalize);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalize(value[key])]));return value}
