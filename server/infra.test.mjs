import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {JobQueue,MetricsRegistry,HealthRegistry,BackupService} from './infra.mjs';

const ctx={companyId:'c1'};
let now=1000;
const q=new JobQueue({maxAttempts:3,baseDelayMs:100,now:()=>now});
let calls=0;
q.register('demo',async()=>{calls++;if(calls<2)throw new Error('temporary');return{ok:true}});
q.enqueue(ctx,'demo',{x:1});
let r=await q.work();assert.equal(r[0].status,'retry');
now=1200;r=await q.work();assert.equal(r[0].status,'done');assert.equal(q.list(ctx).length,1);

const m=new MetricsRegistry({now:()=>now});m.inc('requests');m.inc('requests',2,{route:'/x'});m.gauge('queue.depth',3);m.observe('latency',10);m.observe('latency',30);const snap=m.snapshot();assert.equal(snap.counters.requests,1);assert.equal(snap.gauges['queue.depth'],3);assert.equal(snap.timings.latency.count,2);

const h=new HealthRegistry();h.register('ok',async()=>({status:'ok'}));h.register('bad',async()=>({status:'degraded'}));assert.equal((await h.check()).status,'degraded');

const dir=await mkdtemp(path.join(os.tmpdir(),'eineiro-backup-'));const data=path.join(dir,'data.json');const backups=path.join(dir,'backups');await writeFile(data,JSON.stringify({v:1}));const b=new BackupService({dataFile:data,backupDir:backups,retain:2,now:()=>new Date('2026-09-13T10:00:00Z')});const meta=await b.create();assert.equal((await b.list()).length,1);await writeFile(data,JSON.stringify({v:2}));await b.restore(meta.file);assert.equal(JSON.parse(await readFile(data,'utf8')).v,1);await rm(dir,{recursive:true,force:true});
console.log('EINEIRO infra tests: OK');
