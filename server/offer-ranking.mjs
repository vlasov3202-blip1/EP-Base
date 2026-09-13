import {offerHardEligibility} from './offers.mjs';

export class OfferRankingService{
  constructor({repoFactory,now=()=>new Date(),visualThreshold=60,newSellerBaseline=60}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;this.visualThreshold=visualThreshold;this.newSellerBaseline=newSellerBaseline;}
  async rank(ctx,{offerIds=null,intent={},userContext={},region=null,limit=100}={}){
    const repo=this.repoFactory(ctx);let offers=await repo.list('Offer');if(Array.isArray(offerIds))offers=offers.filter(x=>offerIds.includes(x.id));const sellerScores=new Map((await repo.list('SellerScore')).map(x=>[x.sellerId,x]));const rows=[];
    for(const offer of offers){const seller=sellerScores.get(offer.sellerId)||{score:this.newSellerBaseline,provisional:true};const deliveryPossible=offer.pickupAllowed!==false||!Array.isArray(offer.deliveryOptions)||offer.deliveryOptions.length>0;const allowedRegion=!region||!offer.region||offer.region===region||offer.deliveryOptions?.some?.(x=>x.region===region||x.nationwide);const hard=offerHardEligibility({offer,sellerScore:seller.score,visualThreshold:this.visualThreshold,deliveryPossible,allowedRegion});if(!hard.eligible)continue;
      const product=await repo.get('Product',offer.productId);if(!product)continue;const metrics=await repo.get('ProductMetrics',offer.productId)||{};const intentRel=relevance(intent,product,offer);const userRel=userRelevance(userContext,product,offer);const visual=norm(offer.visualQualityScore);const price=priceRelevance(intent,offer);const delivery=deliveryRelevance(region,offer);const sellerQ=norm(seller.score);const freshness=freshnessScore(offer.freshnessAt,this.now());const behaviour=behaviourPrediction(metrics);const repetitionPenalty=Math.max(0,Math.min(30,Number(userContext?.recentOfferIds?.filter?.(id=>id===offer.id)?.length||0)*10));const organicScore=Math.round(intentRel*.28+userRel*.12+visual*.12+price*.10+delivery*.10+sellerQ*.12+freshness*.08+behaviour*.08-repetitionPenalty);
      rows.push({offerId:offer.id,productId:offer.productId,sellerId:offer.sellerId,organicScore:Math.max(0,organicScore),factors:{intentRelevance:intentRel,userRelevance:userRel,visualQuality:visual,priceRelevance:price,deliveryRelevance:delivery,sellerQuality:sellerQ,freshness,behaviourPrediction:behaviour,repetitionPenalty},sellerScoreProvisional:Boolean(seller.provisional),paidPromotionWeight:0});
    }
    return rows.sort((a,b)=>b.organicScore-a.organicScore).slice(0,Math.min(100,Math.max(1,limit)));
  }
}
function norm(v){return Math.max(0,Math.min(100,Number(v)||0))}
function relevance(intent,p={},o={}){let s=50;if(intent.category&&(p.categoryId===intent.category||p.category===intent.category))s+=25;const attrs=intent.attributes||{};for(const [k,v] of Object.entries(attrs))if(v!=null&&(p.attributes?.[k]===v||o.attributes?.[k]===v))s+=5;if(intent.productId===p.id)s=100;return norm(s)}
function userRelevance(u,p={},o={}){let s=50;if(u.preferredCategories?.includes?.(p.categoryId||p.category))s+=20;if(u.savedProductIds?.includes?.(p.id))s+=25;return norm(s)}
function priceRelevance(intent,o){if(!intent?.priceRange)return 70;const [min,max]=intent.priceRange;const p=Number(o.price||0);if((min==null||p>=min)&&(max==null||p<=max))return 100;return 40}
function deliveryRelevance(region,o){if(!region)return 80;if(o.region===region)return 100;if(o.deliveryOptions?.some?.(x=>x.region===region||x.nationwide))return 90;if(o.pickupAllowed!==false)return 75;return 50}
function freshnessScore(at,now){const age=Math.max(0,(now.getTime()-Date.parse(at||0))/86400000);return norm(100-Math.min(70,age*2))}
function behaviourPrediction(m){const views=Number(m.views||m.clicks||0),orders=Number(m.orders||0),favorites=Number(m.favorites||0);if(!views)return 65;return norm((orders/views)*2200+(favorites/views)*500+40)}
