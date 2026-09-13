import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {DurableJobQueue} from './durable-queue.mjs';
import {JsonFileStore} from './storage.mjs';
import {ScheduleService} from './scheduler.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';

const dir=await mkdtemp(path.join(os.tmpdir(),'eineiro-sch-'));const store=await new JsonFileStore(path.join(dir,'db.json')).init();
const ctx={companyId:'c1',userId:'owner',role:'owner'};let now=Date.parse('2026-09-01T04:00:00Z');
const queue=new DurableJobQueue(store,{now:()=>now});const svc=new ScheduleService({repoFactory:c=>store.tenant(c),queue,now:()=>new Date(now)});
const sch=await svc.ensureDefaultBackupSchedule(ctx);assert.deepEqual(sch.daysOfMonth,[1,15]);
sch.nextRunAt='2026-09-01T03:00:00.000Z';await store.tenant(ctx).put('Schedule',sch);
const first=await svc.tick(ctx);assert.equal(first.length,1);const second=await svc.tick(ctx);assert.equal(second.length,0);
assert.equal((await queue.list(ctx)).length,1);
await rm(dir,{recursive:true,force:true});console.log('EINEIRO scheduler tests: OK');
