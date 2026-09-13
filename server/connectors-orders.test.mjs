import assert from 'node:assert/strict';
import {createServices} from './core.mjs';
import {DurableStore,DurableRepository} from './storage.mjs';
import {InboxService} from './inbox.mjs';
import {AdapterRegistry,GenericChannelAdapter,ConnectorRuntime} from './connectors.mjs';
import {OrderService,InMemoryShipmentProvider} from './orders.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const ctx={userId:'u1',companyId:'c1',role:'owner'};
const other={userId:'u2',companyId:'c2',role:'owner'};
const dir=await mkdtemp(join(tmpdir(),'eineiro-connectors-orders-'));
try{
  const store=new DurableStore(join(dir,'db.json'));await store.init();
  const repo=new DurableRepository(store);const {audit,events}=createServices();
  const inbox=new InboxService({repo,audit,events,clock:()=>1_000_000});
  class FakeAdapter extends GenericChannelAdapter{
    constructor(){super({name:'avito'});this.sent=[];this.pollItems=[]}
    async sendMessage({message}){this.sent.push(message.id);return {externalMessageId:`remote-${message.id}`}}
    async poll(){return {items:this.pollItems,cursor:'next'}}
  }
  const adapter=new FakeAdapter();const registry=new AdapterRegistry();registry.register(adapter);
  const runtime=new ConnectorRuntime({registry,inbox,audit,events,clock:()=>1_000_000});

  const webhook={externalMessageId:'m-1',conversationId:'c-1',senderId:'buyer-1',text:'Есть доставка?'};
  const first=await runtime.handleWebhook(ctx,'avito',webhook);const second=await runtime.handleWebhook(ctx,'avito',webhook);
  assert.equal(first.duplicate,false);assert.equal(second.duplicate,true);
  assert.equal((await inbox.listMessages(ctx)).length,1);assert.equal((await inbox.listMessages(other)).length,0);

  const out=await inbox.queueOutbound(ctx,{channel:'avito',conversationId:'c-1',text:'Да',clientRequestId:'req-1'});
  const dispatched=await runtime.dispatchOutbox(ctx);assert.equal(dispatched[0].status,'sent');assert.equal(adapter.sent.length,1);
  await runtime.dispatchOutbox(ctx);assert.equal(adapter.sent.length,1);

  adapter.pollItems=[{externalMessageId:'m-2',conversationId:'c-1',senderId:'buyer-1',text:'Когда отправите?'}];
  const polled=await runtime.poll(ctx,'avito');assert.equal(polled.cursor,'next');assert.equal((await inbox.listMessages(ctx)).length,2);

  const shipmentProvider=new InMemoryShipmentProvider();const orders=new OrderService({repo,audit,events,shipmentProvider});
  const order=await orders.create(ctx,{buyerId:'buyer-1',items:[{productId:'p1',name:'Фара',qty:1,unitPrice:25000}]});
  assert.equal(order.total,25000);assert.equal(order.status,'created');assert.equal((await orders.list(other)).length,0);
  await orders.accept(ctx,order.id);await orders.startPacking(ctx,order.id);
  const shipment=await orders.createShipment(ctx,order.id,{provider:'cdek'});assert.ok(shipment.tracking);
  const shipped=await orders.markShipped(ctx,order.id,{tracking:shipment.tracking});assert.equal(shipped.status,'shipped');
  shipmentProvider.setStatus(shipment.tracking,'delivered');await orders.syncTracking(ctx,order.id);assert.equal((await orders.get(ctx,order.id)).status,'delivered');
  await assert.rejects(()=>orders.transition(ctx,order.id,'packing'),/invalid order transition/);

  console.log('EINEIRO connector/order tests: OK');
}finally{await rm(dir,{recursive:true,force:true})}
