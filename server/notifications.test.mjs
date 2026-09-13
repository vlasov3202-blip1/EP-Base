import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {NotificationService} from './notifications.mjs';

const ctx={companyId:'c1',userId:'owner',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
const svc=new NotificationService({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T09:00:00Z')});
const routine=await svc.create(ctx,{kind:'routine',title:'Синхронизация завершена'});
const decision=await svc.create(ctx,{kind:'owner_decision',title:'Подтвердить скидку',requiresAction:true,severity:'bad'});
await svc.create(ctx,{kind:'platform_issue',title:'Ошибка канала'});
await svc.create(ctx,{kind:'appeal',title:'Обращение продавца'});
assert.equal((await svc.list(ctx,{ownerInbox:true})).length,1);
assert.equal((await svc.list(ctx,{adminInbox:true})).length,2);
assert.equal((await svc.counters(ctx)).ownerDecisions,1);
await svc.read(ctx,routine.id);assert.equal((await svc.counters(ctx)).unread,3);
await svc.resolve(ctx,decision.id);assert.equal((await svc.counters(ctx)).ownerDecisions,0);
console.log('EINEIRO notifications tests: OK');
