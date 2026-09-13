import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {ProductPromotionScoreService} from './product-promotion-score.mjs';

const ctx={companyId:'c1',userId:'owner',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
repo.put(ctx,'Product',{id:'good',sellerId:'s1',name:'Кресло Oslo',description:'Очень подробное описание товара с материалами, размерами, состоянием, особенностями использования и комплектностью.',images:['1','2','3','4'],price:20000,cost:11000,categoryId:'home.chair',attributes:{material:'wood',width:80,height:95},condition:'new',shipping:{weight:12},warranty:{days:14},visualReady:true});
repo.put(ctx,'Product',{id:'bad',sellerId:'s2',name:'Товар',description:'Коротко',images:['1'],price:20000,cost:19000,categoryId:'home.chair',attributes:{},condition:'used'});
repo.put(ctx,'SellerQuality',{id:'s1',score:92,returnRate:.03,complaintRate:.01});repo.put(ctx,'SellerQuality',{id:'s2',score:40,returnRate:.25,complaintRate:.08});
repo.put(ctx,'InventoryUnit',{id:'i1',productId:'good',quantity:20});repo.put(ctx,'InventoryUnit',{id:'i2',productId:'bad',quantity:1});
repo.put(ctx,'ChannelConnection',{id:'avito',channel:'avito',enabled:true,status:'connected'});repo.put(ctx,'ChannelConnection',{id:'vk',channel:'vk',enabled:true,status:'connected'});
const svc=new ProductPromotionScoreService({repoFactory:()=>wrap,now:()=>new Date('2026-09-13T12:00:00Z')});
await svc.recordMetrics(ctx,'good',{impressions:3000,clicks:300,views:300,leads:45,orders:30,revenue:600000,returns:1,complaints:0});
await svc.recordMetrics(ctx,'bad',{impressions:3000,clicks:90,views:90,leads:5,orders:1,revenue:20000,returns:1,complaints:1});
const good=await svc.evaluate(ctx,'good');const bad=await svc.evaluate(ctx,'bad');assert.equal(good.eligible,true);assert.equal(good.paidBoostCanOverride,false);assert.equal(bad.eligible,false);assert.ok(bad.blockers.length>0);
const recommendation=await svc.recommendExternalChannels(ctx,'good');assert.equal(recommendation.decision,'offer_external_promotion');assert.deepEqual(new Set(recommendation.channels),new Set(['avito','vk']));
const rejected=await svc.recommendExternalChannels(ctx,'bad');assert.equal(rejected.decision,'do_not_promote');assert.equal(rejected.channels.length,0);
console.log('EINEIRO product promotion score tests: OK');
