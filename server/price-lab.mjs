import crypto from 'node:crypto';

export class PriceLabService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async #resolveOffer(ctx,{offerId=null,productId=null}={}){const repo=this.repoFactory(ctx);if(offerId){const offer=await repo.get('Offer',offerId);if(!offer)throw new Error('offer not found');return offer;}if(!productId)throw new Error('offerId required');const offers=(await repo.list('Offer')).filter(x=>x.productId===productId&&x.status==='active');if(offers.length!==1)throw Object.assign(new Error('offerId required when product has zero or multiple active offers'),{code:'OFFER_ID_REQUIRED'});return offers[0];}
  async recommendation(ctx,{offerId=null,productId=null,currentPrice=null,cost=0,demand=50,ageDays=0,marketMedian=null,minMarginPercent=15}={}){
    const offer=await this.#resolveOffer(ctx,{offerId,productId});const priceNow=Number(currentPrice??offer.price??0);
    const base=Number(marketMedian)||priceNow;const demandFactor=(Number(demand)-50)/250;const agePenalty=Math.min(.18,Math.max(0,Number(ageDays)-30)/600);const optimal=Math.max(0,Math.round(base*(1+demandFactor-agePenalty)));
    const marginFloor=Number(cost)*(1+Number(minMarginPercent)/100);const minimum=Math.max(Math.round(marginFloor),Math.round(optimal*.88));
    const rec={id:`price:${offer.id}`,offerId:offer.id,productId:offer.productId,currentPrice:priceNow,cost:Number(cost)||0,minimumPrice:minimum,optimalPrice:Math.max(minimum,optimal),demand:Number(demand)||0,ageDays:Number(ageDays)||0,marketMedian:marketMedian==null?null:Number(marketMedian),createdAt:this.now().toISOString()};
    await this.repoFactory(ctx).put('PriceRecommendation',rec);return rec;
  }
  async validateDeal(ctx,{offerId=null,productId=null,proposedPrice,role='seller'}={}){
    const offer=await this.#resolveOffer(ctx,{offerId,productId});const rec=await this.repoFactory(ctx).get('PriceRecommendation',`price:${offer.id}`);if(!rec)throw Object.assign(new Error('price recommendation missing'),{code:'PRICE_RECOMMENDATION_MISSING'});
    const price=Number(proposedPrice)||0;if(price<rec.minimumPrice)return {allowed:false,requiresApproval:true,reason:'below_minimum',loss:Math.max(0,rec.minimumPrice-price),minimumPrice:rec.minimumPrice,optimalPrice:rec.optimalPrice,offerId:offer.id};
    if(role==='seller'&&price>rec.optimalPrice*1.35)return {allowed:false,requiresApproval:true,reason:'outside_ai_range',loss:0,minimumPrice:rec.minimumPrice,optimalPrice:rec.optimalPrice,offerId:offer.id};
    return {allowed:true,requiresApproval:false,reason:'within_range',loss:0,minimumPrice:rec.minimumPrice,optimalPrice:rec.optimalPrice,offerId:offer.id};
  }
  async apply(ctx,{offerId=null,productId=null,price,source='ai'}={}){
    const offer=await this.#resolveOffer(ctx,{offerId,productId});const check=await this.validateDeal(ctx,{offerId:offer.id,proposedPrice:price,role:ctx.role});if(!check.allowed)throw Object.assign(new Error('price approval required'),{code:'PRICE_APPROVAL_REQUIRED',check});const repo=this.repoFactory(ctx);const next={...offer,price:Number(price),priceUpdatedAt:this.now().toISOString(),priceSource:source};await repo.put('Offer',next);await repo.put('PriceChange',{id:`pc_${crypto.randomUUID()}`,offerId:offer.id,productId:offer.productId,price:Number(price),source,at:this.now().toISOString()});return next;
  }
}
