import assert from 'node:assert/strict';
import {ConnectorRegistry,ConnectorRuntime,ConnectorError} from './connector-framework.mjs';
import {bridgeChannelAdapter} from './connector-bridges.mjs';

class Repo{constructor(){this.m=new Map()}async put(t,x){if(!this.m.has(t))this.m.set(t,new Map());this.m.get(t).set(x.id,structuredClone(x));return x}async list(t){return [...(this.m.get(t)?.values()||[])].map(structuredClone)}}
const repo=new Repo();const ctx={companyId:'c1'};

{
  let calls=0;
  const registry=new ConnectorRegistry();
  registry.register({connectorId:'demo',type:'marketplace',capabilities:['publish'],handlers:{publish:async()=>{calls++;return{id:'x'}}}});
  assert.equal(registry.supports('demo','publish'),true);
  assert.equal(registry.discover('publish').length,1);
  const runtime=new ConnectorRuntime({registry,repoFactory:()=>repo,sleep:async()=>{}});
  const first=await runtime.execute(ctx,{connectorId:'demo',capability:'publish',input:{id:1},idempotencyKey:'same'});
  const second=await runtime.execute(ctx,{connectorId:'demo',capability:'publish',input:{id:1},idempotencyKey:'same'});
  assert.equal(first.status,'succeeded');assert.equal(second.status,'succeeded');assert.equal(calls,1);
}

{
  let calls=0;
  const registry=new ConnectorRegistry();
  registry.register({connectorId:'retry',type:'messaging',capabilities:['send_message'],handlers:{send_message:async()=>{calls++;if(calls<3)throw Object.assign(new Error('rate limited'),{status:429});return{ok:true}}}});
  const runtime=new ConnectorRuntime({registry,repoFactory:()=>repo,sleep:async()=>{}});
  const out=await runtime.execute(ctx,{connectorId:'retry',capability:'send_message',input:{text:'hi'},idempotencyKey:'retry-key'});
  assert.equal(out.status,'succeeded');assert.equal(calls,3);
}

{
  const adapter={name:'legacy',poll:async()=>({items:[]}),sendMessage:async()=>({externalMessageId:'1'}),checkConnection:async()=>({ok:true})};
  const bridged=bridgeChannelAdapter(adapter);
  assert.ok(bridged.capabilities.includes('receive_messages'));
  assert.ok(bridged.capabilities.includes('send_message'));
  assert.equal(typeof bridged.healthCheck,'function');
}

{
  const registry=new ConnectorRegistry();registry.register({connectorId:'x',type:'x',capabilities:[],handlers:{}});const runtime=new ConnectorRuntime({registry,repoFactory:()=>repo});
  await assert.rejects(()=>runtime.execute(ctx,{connectorId:'x',capability:'publish'}),e=>e instanceof ConnectorError&&e.code==='CAPABILITY_NOT_SUPPORTED');
}

console.log('connector-framework.test.mjs ok');
