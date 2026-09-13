import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {JsonFileStore} from './storage.mjs';
import {ApiKeyService} from './api-keys.mjs';
import {ImportService,parseCsv,parseSimpleXml} from './importer.mjs';

const dir=await mkdtemp(path.join(os.tmpdir(),'eineiro-api-'));const store=await new JsonFileStore(path.join(dir,'db.json')).init();
const owner={companyId:'c1',userId:'owner1',role:'owner'};const other={companyId:'c2',userId:'owner2',role:'owner'};
const keys=new ApiKeyService(store,{windowMs:60_000,defaultLimit:2});
const made=await keys.create(owner,{name:'crm',scopes:['products:read','products:write'],rateLimit:2});
assert.ok(made.token.startsWith('ein_'));
const apiCtx1=keys.authenticate(made.token);assert.equal(apiCtx1.companyId,'c1');assert.doesNotThrow(()=>keys.requireScope(apiCtx1,'products:read'));assert.throws(()=>keys.requireScope(apiCtx1,'orders:read'),/missing scope/);
keys.authenticate(made.token);assert.throws(()=>keys.authenticate(made.token),e=>e.code==='RATE_LIMITED');

const rows=parseCsv('id,name,price,qty,shelf\np1,Полка,1000,3,A-1');assert.equal(rows.length,1);assert.equal(rows[0].name,'Полка');
const xml=parseSimpleXml('<root><item><id>p2</id><name>Ваза</name><price>900</price><qty>2</qty></item></root>');assert.equal(xml[0].name,'Ваза');
const importer=new ImportService({repoFactory:ctx=>store.tenant(ctx)});
const result=await importer.importProducts(owner,{format:'csv',text:'id,name,price,qty,shelf\np1,Полка,1000,3,A-1',mapping:{quantity:'qty',storageAddress:'shelf'},reverseInventory:true});
assert.equal(result.imported,1);const inv=store.tenant(owner).get('InventoryUnit','inv:p1');assert.equal(inv.needsPlacement,true);assert.equal(inv.storageAddress,'');assert.equal(store.tenant(other).get('Product','p1'),null);
await keys.revoke(owner,made.id);assert.throws(()=>keys.authenticate(made.token),e=>e.code==='INVALID_API_KEY');
await rm(dir,{recursive:true,force:true});console.log('EINEIRO API key/import tests: OK');
