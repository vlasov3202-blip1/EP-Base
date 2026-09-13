import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {AdapterRegistry} from './connectors.mjs';
import {EineiroMarketAdapter,UnconfiguredExternalAdapter} from './channel-adapters.mjs';

const ctx={companyId:'c1',userId:'u1',role:'owner'};
const repo=new MemoryRepository();
const native=new EineiroMarketAdapter({repoFactory:()=>repo});
const sent=await native.sendMessage({ctx,message:{conversationId:'conv-1',text:'Здравствуйте'}});
assert.ok(sent.externalMessageId.startsWith('em_'));
assert.equal(repo.list(ctx,'MarketMessage').length,1);
const publication=await native.publish({ctx,item:{id:'p1',name:'Товар'}});
assert.equal(publication.status,'published');
assert.equal(repo.get(ctx,'Publication','market:p1').productId,'p1');

const registry=new AdapterRegistry();registry.register(native);registry.register(new UnconfiguredExternalAdapter('avito'));
assert.equal(registry.get('eineiro_market').supports('messages.write'),true);
await assert.rejects(()=>registry.get('avito').sendMessage({ctx,message:{}}),e=>e.code==='CHANNEL_NOT_CONFIGURED'&&e.retryable===false);

console.log('EINEIRO channel adapter tests: OK');
