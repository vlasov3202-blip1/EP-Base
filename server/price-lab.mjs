import crypto from 'node:crypto';

export class PriceLabService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async recommendation(ctx,{productId,currentPrice,cost=0,demand=50,ageDays=0,marketMedian=null,minMarginPercent=15}={}){
    if(!productId)throw new Error('productId required');
    const base=Number(marketMedian)||Number(currentPrice)||0;const demandFactor=(Number(demand)-50)/250;const agePenalty=Math.min(.18,Math.max(0,Number(ageDays)-30)/600);const optimal=Math.max(0,Math.round(base*(1+demandFactor-agePenalty)));
    const marginFloor=Number(cost)*(1+Number(minMarginPercent)/100);const minimum=Math.max(Math.round(marginFloor),Math.round(optimal*.88));
    const rec={id:`price:${productId}`,productId,currentPrice:Number(currentPrice)||0,cost:Number(cost)||0,minimumPrice:minimum,optimalPrice:Math.max(minimum,optimal),demand:Number(demand)||0,ageDays:Number(ageDays)||0,marketMedian:marketMedian==null?null:Number(marketMedian),createdAt:this.now().toISOString()};
    await this.repoFactory(ctx).put('PriceRecommendation',rec);return rec;
  }
  async validateDeal(ctx,{productId,proposedPrice,role='seller'}={}){
    const rec=await this.repoFactory(ctx).get('PriceRecommendation',`price:${productId}`);if(!rec)throw Object.assign(new Error('price recommendation missing'),{code:'PRICE_RECOMMENDATION_MISSING'});
    const price=Number(proposedPrice)||0;
    if(price<rec.minimumPrice)return {allowed:false,requiresApproval:true,reason:'below_minimum',loss:Math.max(0,rec.minimumPrice-price),minimumPrice:rec.minimumPrice,optimalPrice:rec.optimalPrice};
    if(role==='seller'&&price>rec.optimalPrice*1.35)return {allowed:false,requiresApproval:true,reason:'outside_ai_range',loss:0,minimumPrice:rec.minimumPrice,optimalPrice:rec.optimalPrice};
    return {allowed:true,requiresApproval:false,reason:'within_range',loss:0,minimumPrice:rec.minimumPrice,optimalPrice:rec.optimalPrice};
  }
  async apply(ctx,{productId,price,source='ai'}={}){
    const check=await this.validateDeal(ctx,{productId,proposedPrice:price,role:ctx.role});if(!check.allowed)throw Object.assign(new Error('price approval required'),{code:'PRICE_APPROVAL_REQUIRED',check});const repo=this.repoFactory(ctx);const product=await repo.get('Product',productId);if(!product)throw new Error('product not found');product.price=Number(price);product.priceUpdatedAt=this.now().toISOString();product.priceSource=source;await repo.put('Product',product);await repo.put('PriceChange',{id:`pc_${crypto.randomUUID()}`,productId,price:Number(price),source,at:this.now().toISOString()});return product;
  }
}
