import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {PolicyEngine} from './policy-engine.mjs';
import {DecisionEngine} from './decision-engine.mjs';
import {NegotiationService} from './negotiation.mjs';
import {PostSaleFeedbackService} from './post-sale-feedback.mjs';

const ctx={companyId:'c1',userId:'owner',role:'owner'};const repo=new MemoryRepository();const wrap={put:(e,r)=>repo.put(ctx,e,r),get:(e,id)=>repo.get(ctx,e,id),list:e=>repo.list(ctx,e)};
repo.put(ctx,'Product',{id:'p1',name:'Кресло'});repo.put(ctx,'Offer',{id:'o1',productId:'p1',sellerId:'s1',price:10000,status:'active'});repo.put(ctx,'Order',{id:'ord1',sellerId:'s1',status:'delivered'});
const policy=new PolicyEngine({repoFactory:()=>wrap});await policy.put(ctx,{id:'sales-policy',scope:'sales',subject_type:'ai',action:'negotiate_price',resource:'Offer',effect:'ALLOW',condition:{maxAmount:10000}});const decisions=new DecisionEngine({repoFactory:()=>wrap,policyEngine:policy});
const negotiations=new NegotiationService({repoFactory:()=>wrap,decisionEngine:decisions});const n=await negotiations.open(ctx,{offerId:'o1',buyerId:'b1',proposedPrice:9500});const ai=await negotiations.aiCounter(ctx,n.id,{targetPrice:9400,minPrice:9300,maxDiscountPercent:7,confidence:.95});assert.equal(ai.negotiation.proposedPrice>=9300,true);const accepted=await negotiations.accept(ctx,n.id);assert.equal(accepted.status,'accepted');
const feedback=new PostSaleFeedbackService({repoFactory:()=>wrap});await feedback.addReview(ctx,{orderId:'ord1',sellerId:'s1',rating:5,descriptionAccurate:true});assert.equal(repo.list(ctx,'Review').length,1);assert.equal(repo.list(ctx,'SellerScore').length,1);
console.log('EINEIRO negotiation/feedback tests: OK');
