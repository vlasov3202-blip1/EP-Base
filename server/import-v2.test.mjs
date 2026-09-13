import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {ImportMappingService,UniversalImportEngineV2} from './import-engine-v2.mjs';
import {parseCsv,parseXmlItems,parseApiFeed} from './import-formats.mjs';

const ctx={companyId:'c1',userId:'owner',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
const mappingSvc=new ImportMappingService({repoFactory:()=>wrap});const suggested=await mappingSvc.suggest(ctx,{headers:['Название','Цена','Остаток','Артикул']});assert.equal(suggested.mapping.name,'Название');const saved=await mappingSvc.save(ctx,{name:'Тест',sourceType:'csv',mapping:suggested.mapping});assert.equal((await wrap.get('ImportMapping',saved.id)).name,'Тест');
const rows=parseCsv('Название,Цена,Остаток,Артикул\nСтул,1000,2,A1\n,500,1,A2');assert.equal(rows.length,2);
const engine=new UniversalImportEngineV2({repoFactory:()=>wrap,categorySchema:{validateProduct:async(_c,p)=>({valid:p.name!=='Запрещено',errors:p.name==='Запрещено'?['bad']:[]})},moderation:{checkProduct:async()=>({allowed:true})}});const result=await engine.importRows(ctx,{rows,mapping:suggested.mapping,reverseInventory:true,defaultSellerId:'s1'});assert.equal(result.imported,1);assert.equal(result.errors.length,1);const inv=(await wrap.list('InventoryUnit'))[0];assert.equal(inv.placementStatus,'unassigned');
assert.equal(parseXmlItems('<offers><offer><name>Лампа</name><price>900</price></offer></offers>')[0].name,'Лампа');assert.equal(parseApiFeed({items:[{name:'A'}]}).length,1);
console.log('EINEIRO import v2 tests: OK');
