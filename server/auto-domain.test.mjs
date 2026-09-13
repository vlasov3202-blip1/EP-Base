import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {AutoDomainService,warrantyForPart,normalizeAutoPart} from './auto-domain.mjs';

const ctx={companyId:'c1',userId:'u1',role:'owner'};const repo=new MemoryRepository();
const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
assert.equal(warrantyForPart({category:'Кузов'}).days,14);
assert.equal(warrantyForPart({category:'Электрика'}).days,0);
assert.equal(warrantyForPart({category:'Блок управления'}).days,0);
assert.equal(warrantyForPart({category:'Кузов',customDays:7,locked:true}).days,7);
const p=normalizeAutoPart({name:'Фара',category:'Оптика',oeNumbers:['1','1','2'],crossNumbers:['x'],photos:['a','b']});assert.deepEqual(p.oeNumbers,['1','2']);assert.equal(p.warrantySuggestion.days,14);
const svc=new AutoDomainService({repoFactory:()=>wrap,photoRecognizer:async({photos})=>({confidence:.91,product:{name:'Фара правая Focus III',category:'Оптика',manufacturer:'Ford',oeNumbers:['OE1']},photosSeen:photos.length})});
await svc.createDonor(ctx,{id:'d1',make:'Ford',model:'Focus III',year:2014});
const accepted=await svc.acceptByPhoto(ctx,{photos:['1','2','3','4','5'],donorId:'d1'});assert.equal(accepted.mode,'new');assert.equal(accepted.product.images.length,4);assert.equal(accepted.product.autoPart.applicability[0].model,'Focus III');
const stored=repo.get(ctx,'Product',accepted.product.id);assert.equal(stored.oeNumbers,undefined);assert.equal(stored.warranty,undefined);assert.equal(repo.get(ctx,'AutoPartProfile',`auto-profile:${stored.id}`).oeNumbers[0],'OE1');
console.log('EINEIRO auto domain tests: OK');
