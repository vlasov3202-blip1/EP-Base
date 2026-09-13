import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {OfferService} from './offers.mjs';
import {OfferRankingService} from './offer-ranking.mjs';
import {RecommendationEngine} from './recommendation-engine.mjs';
import {DemandLoopService} from './demand-loop.mjs';

const ctx={companyId:'c1',userId:'u1',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
repo.put(ctx,'Product',{id:'p1',name:'Кресло A',categoryId:'home.chair',attributes:{style:'compact'},visualReady:true});repo.put(ctx,'Product',{id:'p2',name:'Стол B',categoryId:'home.table',attributes:{style:'oak'},visualReady:true});repo.put(ctx,'SellerScore',{id:'seller-score:s1',sellerId:'s1',score:95});
const os=new OfferService({repoFactory:()=>wrap});await os.create(ctx,{id:'o1',productId:'p1',sellerId:'s1',price:30000,stock:4,deliveryOptions:[{nationwide:true}],visualAssetReady:true,visualQualityScore:90});await os.create(ctx,{id:'o2',productId:'p2',sellerId:'s1',price:20000,stock:4,deliveryOptions:[{nationwide:true}],visualAssetReady:true,visualQualityScore:90});
const ranking=new OfferRankingService({repoFactory:()=>wrap});const recs=new RecommendationEngine({repoFactory:()=>wrap,offerRanking:ranking});const list=await recs.recommend(ctx,{identityId:'i1',sessionIntent:{category:'home.chair'},limit:2});assert.equal(list[0].offerId,'o1');
const demand=new DemandLoopService({repoFactory:()=>wrap});const pf=await demand.perceptualFeedback(ctx,{identityId:'i1',sessionId:'s1',productId:'p1',signal:'TOO_BULKY',rawText:'слишком громоздкий'});assert.equal(pf.preferenceDelta.scope,'session');repo.put(ctx,'DemandCluster',{id:'dc1',count:20,averageStrength:82});const opp=await demand.createProductionOpportunity(ctx,{clusterId:'dc1',category:'home.chair',evidence:{preorders:4,savedIntents:10}});assert.equal(opp.status,'open');const fb=await demand.feedbackAfterProduct(ctx,{productionOpportunityId:opp.id,notified:100,purchases:1});assert.equal(fb.falseDemand,true);assert.equal((await repo.get(ctx,'ProductionOpportunity',opp.id)).status,'invalidated');
console.log('EINEIRO recommendation/demand loop tests: OK');
