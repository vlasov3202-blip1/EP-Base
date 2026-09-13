import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {SellerWaitlistService,CategorySupplyActivationService} from './seller-waitlist.mjs';

const memory=new MemoryRepository();const ctx={companyId:'c1',userId:'owner',identityId:'owner',role:'owner'};const repoFactory=c=>({put:(e,r)=>memory.put(c,e,r),get:(e,id)=>memory.get(c,e,id),list:e=>memory.list(c,e)});const now=()=>new Date('2026-09-13T15:00:00Z');
const waitlist=new SellerWaitlistService({repoFactory,now});
for(const identityId of ['s1','s2']){const row=await waitlist.join(ctx,{identityId,companyId:'c1',categoryId:'furniture.sofa'});await waitlist.updateReadiness(ctx,row.id,{catalogImported:true,stockConfigured:true,offersPrepared:true,activeOfferCount:2});}
const repo=repoFactory(ctx);for(let i=1;i<=3;i++)await repo.put('Offer',{id:`o${i}`,categoryId:'furniture.sofa',status:'prepared',stock:1});
const activation=new CategorySupplyActivationService({repoFactory,now});
const preview=await activation.evaluate(ctx,{categoryId:'furniture.sofa',minReadySellers:2,minActiveOffers:3});assert.equal(preview.ready,true);assert.equal(preview.activated,false);
const blocked=await activation.evaluate(ctx,{categoryId:'furniture.sofa',minReadySellers:2,minActiveOffers:3,activate:true,policyAllowed:false});assert.equal(blocked.requiresPolicy,true);assert.equal(blocked.activated,false);
const opened=await activation.evaluate(ctx,{categoryId:'furniture.sofa',minReadySellers:2,minActiveOffers:3,activate:true,policyAllowed:true});assert.equal(opened.activated,true);assert.equal(opened.featureFlag.enabled,true);assert.equal(opened.featureFlag.id,'category:furniture.sofa');
console.log('EINEIRO seller waitlist/category activation tests: OK');
