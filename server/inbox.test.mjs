import assert from 'node:assert/strict';
import {createServices} from './core.mjs';
import {UnifiedInboxService,ConnectorRegistry} from './inbox.mjs';

const a={userId:'u1',companyId:'c1',role:'owner'};
const b={userId:'u2',companyId:'c2',role:'owner'};
const {repo,audit,events}=createServices();
let calls=0;
const registry=new ConnectorRegistry().register('avito',{async sendMessage(_ctx,payload){calls++; if(calls===1) throw new Error('temporary'); return {externalMessageId:'ext-'+payload.idempotencyKey.slice(0,8)};}});
const inbox=new UnifiedInboxService({repo,audit,events,connectorRegistry:registry,maxAttempts:3,baseBackoffMs:10});

const first=inbox.ingest(a,'avito',{id:'m1',chatId:'c1',senderId:'buyer',text:'Есть доставка?'});
assert.equal(first.duplicate,false);
const duplicate=inbox.ingest(a,'avito',{id:'m1',chatId:'c1',senderId:'buyer',text:'Есть доставка?'});
assert.equal(duplicate.duplicate,true);
assert.equal(repo.list(a,'InboxMessage').length,1);
assert.equal(repo.list(b,'InboxMessage').length,0);

const queued=inbox.queueOutbound(a,{channel:'avito',conversationExternalId:'c1',text:'Да',clientRequestId:'req-1'});
assert.equal(queued.duplicate,false);
const queued2=inbox.queueOutbound(a,{channel:'avito',conversationExternalId:'c1',text:'Да ещё раз',clientRequestId:'req-1'});
assert.equal(queued2.duplicate,true);
assert.equal(repo.list(a,'OutboundMessage').length,1);

const t0=Date.now();
const retry=await inbox.deliverOne(a,queued.message.id,t0);
assert.equal(retry.status,'retry');
assert.equal(retry.attempts,1);
const tooEarly=await inbox.deliverOne(a,queued.message.id,t0+1);
assert.equal(tooEarly.status,'retry');
assert.equal(calls,1);
const sent=await inbox.deliverOne(a,queued.message.id,t0+20);
assert.equal(sent.status,'sent');
assert.equal(sent.attempts,2);
assert.equal(calls,2);
assert.ok(sent.externalMessageId);

const alreadySent=await inbox.deliverOne(a,queued.message.id,t0+30);
assert.equal(alreadySent.status,'sent');
assert.equal(calls,2);
assert.equal(events.list(a).some(e=>e.type==='inbox.outbound.sent'),true);
assert.equal(audit.list(a).some(e=>e.action==='inbox.send'),true);

console.log('EINEIRO Unified Inbox tests: OK');
