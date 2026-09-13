import crypto from 'node:crypto';
import {mkdir,copyFile,readdir,stat,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';

export class JobQueue{
  constructor({maxAttempts=5,baseDelayMs=1000,now=()=>Date.now()}={}){this.maxAttempts=maxAttempts;this.baseDelayMs=baseDelayMs;this.now=now;this.jobs=[];this.handlers=new Map();}
  register(type,handler){if(typeof handler!=='function')throw new Error('handler required');this.handlers.set(type,handler);return this;}
  enqueue(ctx,type,payload={},opts={}){const job={id:crypto.randomUUID(),companyId:ctx.companyId,type,payload:structuredClone(payload),status:'queued',attempts:0,maxAttempts:opts.maxAttempts||this.maxAttempts,runAt:this.now()+Number(opts.delayMs||0),createdAt:new Date(this.now()).toISOString(),lastError:null};this.jobs.push(job);return structuredClone(job);}
  list(ctx,{status=null}={}){return this.jobs.filter(j=>j.companyId===ctx.companyId&&(!status||j.status===status)).map(value=>structuredClone(value));}
  async work({limit=10}={}){const ready=this.jobs.filter(j=>['queued','retry'].includes(j.status)&&j.runAt<=this.now()).slice(0,limit);const out=[];for(const job of ready){const handler=this.handlers.get(job.type);if(!handler){job.status='failed';job.lastError='handler not registered';out.push(structuredClone(job));continue;}job.status='running';job.attempts++;try{job.result=await handler(structuredClone(job));job.status='done';job.finishedAt=new Date(this.now()).toISOString();}catch(error){job.lastError=error?.message||String(error);if(job.attempts>=job.maxAttempts){job.status='failed';job.finishedAt=new Date(this.now()).toISOString();}else{job.status='retry';job.runAt=this.now()+this.baseDelayMs*(2**(job.attempts-1));}}out.push(structuredClone(job));}return out;}
  stats(){const stats={total:this.jobs.length,queued:0,running:0,retry:0,done:0,failed:0};for(const j of this.jobs)if(stats[j.status]!=null)stats[j.status]++;return stats;}
}

export class MetricsRegistry{
  constructor({now=()=>Date.now()}={}){this.now=now;this.counters=new Map();this.gauges=new Map();this.timings=new Map();this.startedAt=this.now();}
  inc(name,value=1,labels={}){const key=this.#key(name,labels);this.counters.set(key,(this.counters.get(key)||0)+value);return this.counters.get(key);}
  gauge(name,value,labels={}){this.gauges.set(this.#key(name,labels),Number(value));}
  observe(name,value,labels={}){const key=this.#key(name,labels);const a=this.timings.get(key)||[];a.push(Number(value));if(a.length>500)a.shift();this.timings.set(key,a);}
  snapshot(){const timings={};for(const [k,a] of this.timings){const s=[...a].sort((x,y)=>x-y);timings[k]={count:a.length,avg:a.length?a.reduce((x,y)=>x+y,0)/a.length:0,p95:s.length?s[Math.min(s.length-1,Math.floor(s.length*.95))]:0};}return{uptimeMs:this.now()-this.startedAt,counters:Object.fromEntries(this.counters),gauges:Object.fromEntries(this.gauges),timings};}
  #key(name,labels){const suffix=Object.entries(labels).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join(',');return suffix?`${name}{${suffix}}`:name;}
}

export class HealthRegistry{
  constructor(){this.checks=new Map();}
  register(name,fn){this.checks.set(name,fn);return this;}
  async check(){const components={};let status='ok';for(const [name,fn] of this.checks){try{const r=await fn();components[name]={status:r?.status||'ok',...r};if(components[name].status!=='ok')status='degraded';}catch(error){components[name]={status:'down',error:error.message};status='down';}}return{status,checkedAt:new Date().toISOString(),components};}
}

export class BackupService{
  constructor({dataFile,backupDir=path.join(process.cwd(),'backups'),retain=12,now=()=>new Date()}={}){if(!dataFile)throw new Error('dataFile required');this.dataFile=dataFile;this.backupDir=backupDir;this.retain=retain;this.now=now;}
  async create({scope='platform'}={}){if(scope!=='platform')throw new Error('BackupService only supports platform scope');await mkdir(this.backupDir,{recursive:true});const stamp=this.now().toISOString().replace(/[:.]/g,'-');const file=path.join(this.backupDir,`${stamp}-platform.json`);await copyFile(this.dataFile,file);const meta={file,path:file,scope:'platform',createdAt:this.now().toISOString()};await writeFile(`${file}.meta.json`,JSON.stringify(meta,null,2));await this.prune();return meta;}
  async list(){try{const names=(await readdir(this.backupDir)).filter(n=>n.endsWith('.json')&&!n.endsWith('.meta.json')).sort().reverse();return Promise.all(names.map(async name=>{const full=path.join(this.backupDir,name);const s=await stat(full);return{name,path:full,size:s.size,mtime:s.mtime.toISOString()};}));}catch(e){if(e.code==='ENOENT')return[];throw e;}}
  async restore(file){const name=path.basename(String(file||''));if(!name.endsWith('.json'))throw new Error('invalid backup file');const root=path.resolve(this.backupDir);const full=path.resolve(root,name);if(path.dirname(full)!==root)throw new Error('invalid backup file');await copyFile(full,this.dataFile);return{restoredFrom:full,restoredAt:this.now().toISOString()};}
  async prune(){const list=await this.list();for(const item of list.slice(this.retain)){await unlink(item.path).catch(()=>{});await unlink(`${item.path}.meta.json`).catch(()=>{});}return list.slice(0,this.retain);}
}

export function createInfrastructure({dataFile,backupDir}={}){const metrics=new MetricsRegistry();const health=new HealthRegistry();const queue=new JobQueue();const backups=dataFile?new BackupService({dataFile,backupDir}):null;health.register('process',async()=>({status:'ok',memoryRss:process.memoryUsage().rss}));health.register('queue',async()=>{const s=queue.stats();return{status:s.failed?'degraded':'ok',...s}});return{metrics,health,queue,backups};}
