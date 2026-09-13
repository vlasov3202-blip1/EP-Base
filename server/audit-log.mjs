import crypto from 'node:crypto';
export class AuditLogService{
 constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
 async write(ctx,{actor,action,object,reason=null,decision=null,policy=null,before=null,after=null,result=null,rollback=null}={}){const rec={id:`audit_${crypto.randomUUID()}`,actor:structuredClone(actor||{type:'system'}),action,object:structuredClone(object||{}),reason,decision:structuredClone(decision),policy:structuredClone(policy),before:structuredClone(before),after:structuredClone(after),result:structuredClone(result),rollback:structuredClone(rollback),createdAt:this.now().toISOString()};await this.repoFactory(ctx).put('UnifiedAudit',rec);return rec;}
 async list(ctx,{limit=200}={}){const rows=await this.repoFactory(ctx).list('UnifiedAudit');return rows.slice(-Math.max(1,Math.min(1000,limit))).reverse();}
}
