import crypto from 'node:crypto';

export class OfferService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async create(ctx,input={}){
    const repo=this.repoFactory(ctx);if(!input.productId)throw new Error('productId required');if(!input.sellerId)throw new Error('sellerId required');
    const product=await repo.get('Product',input.productId);if(!product)throw new Error('product not found');
    const rec={id:input.id||`offer_${crypto.randomUUID()}`,productId:input.productId,sellerId:input.sellerId,skuId:input.skuId||null,price:Number(input.price??product.price??0),currency:input.currency||'RUB',condition:input.condition||product.condition||'new',stock:Number(input.stock??0),region:input.region||null,deliveryOptions:Array.isArray(input.deliveryOptions)?structuredClone(input.deliveryOptions):[],status:input.status||'active',visualAssetReady:Boolean(input.visualAssetReady??product.visualReady??product.isolatedAssetUrl??product.model3dUrl),visualQualityScore:Number(input.visualQualityScore??product.visualQualityScore??0),freshnessAt:input.freshnessAt||this.now().toISOString(),attributes:structuredClone(input.attributes||{}),createdAt:this.now().toISOString(),updatedAt:this.now().toISOString()};
    await repo.put('Offer',rec);return rec;
  }
  async update(ctx,id,patch={}){const repo=this.repoFactory(ctx);const prev=await repo.get('Offer',id);if(!prev)throw new Error('offer not found');const next={...prev,...structuredClone(patch),id:prev.id,productId:prev.productId,sellerId:prev.sellerId,updatedAt:this.now().toISOString()};await repo.put('Offer',next);return next;}
  async activeForProduct(ctx,productId){return (await this.repoFactory(ctx).list('Offer')).filter(x=>x.productId===productId&&x.status==='active');}
}

export function offerHardEligibility({offer,sellerScore=0,visualThreshold=60,deliveryPossible=true,allowedRegion=true}={}){
  const reasons=[];if(!offer)reasons.push('offer_missing');else{if(offer.status!=='active')reasons.push('offer_inactive');if(Number(offer.stock||0)<=0)reasons.push('out_of_stock');if(Number(offer.price||0)<=0)reasons.push('invalid_price');if(!offer.visualAssetReady)reasons.push('visual_not_ready');if(Number(offer.visualQualityScore||0)<visualThreshold)reasons.push('visual_quality_low');if(!deliveryPossible)reasons.push('delivery_unavailable');if(!allowedRegion)reasons.push('region_unavailable');}if(Number(sellerScore||0)<=0)reasons.push('seller_inactive');return{eligible:reasons.length===0,reasons};}
