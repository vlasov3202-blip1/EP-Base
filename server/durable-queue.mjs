import crypto from 'node:crypto';

export class DurableJobQueue{
  constructor(store,{maxAttempts=5,baseDelayMs=1000,now=()=>Date.now()}={}){this.store=store;this.maxAttempts=maxAttempts;this.baseDelayMs=baseDelayMs;this.now=now;this.handlers=new Map();}
  register(type,handler){if(typeof handler!=='function')throw new Error('handler required');this.handlers.set(type,handler);return this;}
  async enqueue(ctx,type,payload={},opts={}){
    const repo=this.store.tenant(ctx);
    if(opts.idempotencyKey){const existing=(await repo.list('Job')).find(j=>j.idempotencyKey===opts.idempotencyKey&&j.type===type&&!['failed'].includes(j.status));if(existing)return structuredClone(existing);}
    const job={id:crypto.randomUUID(),companyId:ctx.companyId,type,payload:structuredClone(payload),idempotencyKey:opts.idempotencyKey||null,status:'queued',attempts:0,maxAttempts:opts.maxAttempts||this.maxAttempts,runAt:this.now()+Number(opts.delayMs||0),createdAt:new Date(this.now()).toISOString(),lastError:null};await repo.put('Job',job);return structuredClone(job);
  }
  async list(ctx,{status=null}={}){const jobs=await this.store.tenant(ctx).list('Job');return jobs.filter(j=>!status||j.status===status).sort((a,b)=>Number(a.runAt)-Number(b.runAt));}
  async work(ctx,{limit=10}={}){const repo=this.store.tenant(ctx);const jobs=(await repo.list('Job')).filter(j=>['queued','retry'].includes(j.status)&&Number(j.runAt)<=this.now()).sort((a,b)=>Number(a.runAt)-Number(b.runAt)).slice(0,limit);const out=[];for(const job of jobs){const handler=this.handlers.get(job.type);job.status='running';job.attempts=Number(job.attempts||0)+1;await repo.put('Job',job);if(!handler){job.status='failed';job.lastError='handler not registered';job.finishedAt=new Date(this.now()).toISOString();await repo.put('Job',job);out.push(job);continue;}try{job.result=await handler(structuredClone(job));job.status='done';job.finishedAt=new Date(this.now()).toISOString();}catch(error){job.lastError=error?.message||String(error);if(job.attempts>=job.maxAttempts){job.status='failed';job.finishedAt=new Date(this.now()).toISOString();}else{job.status='retry';job.runAt=this.now()+this.baseDelayMs*(2**(job.attempts-1));}}await repo.put('Job',job);out.push(structuredClone(job));}return out;}
  async stats(ctx){const jobs=await this.store.tenant(ctx).list('Job');const s={total:jobs.length,queued:0,running:0,retry:0,done:0,failed:0};for(const j of jobs)if(s[j.status]!=null)s[j.status]++;return s;}
}
