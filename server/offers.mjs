import crypto from 'node:crypto';
import {normalizeCondition} from './condition-engine.mjs';

export class OfferService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async create(ctx,input={}){
    const repo=this.repoFactory(ctx);if(!input.productId)throw new Error('productId required');if(!input.sellerId)throw new Error('sellerId required');
    const product=await repo.get('Product',input.productId);if(!product)throw new Error('product not found');
    const price=Number(input.price);if(!Number.isFinite(price)||price<0)throw Object.assign(new Error('valid offer price required'),{code:'OFFER_PRICE_REQUIRED'});
    const rec={id:input.id||`offer_${crypto.randomUUID()}`,productId:input.productId,sellerId:input.sellerId,skuId:input.skuId||null,price,currency:input.currency||'RUB',condition:normalizeCondition(input.condition,{fallback:'USED'}),warranty:structuredClone(input.warranty||null),warrantyDays:input.warrantyDays==null?null:Math.max(0,Number(input.warrantyDays)||0),negotiationAllowed:input.negotiationAllowed!==false,stock:Number(input.stock??0),region:input.region||null,deliveryOptions:Array.isArray(input.deliveryOptions)?structuredClone(input.deliveryOptions):[],status:input.status||'active',visualAssetReady:Boolean(input.visualAssetReady??product.visualReady??product.isolatedAssetUrl??product.model3dUrl),visualQualityScore:Number(input.visualQualityScore??product.visualQualityScore??0),freshnessAt:input.freshnessAt||this.now().toISOString(),attributes:structuredClone(input.attributes||{}),createdAt:this.now().toISOString(),updatedAt:this.now().toISOString()};
    await repo.put('Offer',rec);return rec;
  }
  async update(ctx,id,patch={}){const repo=this.repoFactory(ctx);const prev=await repo.get('Offer',id);if(!prev)throw new Error('offer not found');const next={...prev,...structuredClone(patch),id:prev.id,productId:prev.productId,sellerId:prev.sellerId,updatedAt:this.now().toISOString()};if(patch.condition!=null)next.condition=normalizeCondition(patch.condition,{fallback:prev.condition});if(patch.price!=null&&(!Number.isFinite(Number(patch.price))||Number(patch.price)<0))throw new Error('invalid offer price');await repo.put('Offer',next);return next;}
  async activeForProduct(ctx,productId){return (await this.repoFactory(ctx).list('Offer')).filter(x=>x.productId===productId&&x.status==='active');}
}

export function offerHardEligibility({offer,sellerScore=0,visualThreshold=60,deliveryPossible=true,allowedRegion=true}={}){
  const reasons=[];if(!offer)reasons.push('offer_missing');else{if(offer.status!=='active')reasons.push('offer_inactive');if(Number(offer.stock||0)<=0)reasons.push('out_of_stock');if(!Number.isFinite(Number(offer.price))||Number(offer.price)<0)reasons.push('invalid_price');if(!offer.visualAssetReady)reasons.push('visual_not_ready');if(Number(offer.visualQualityScore||0)<visualThreshold)reasons.push('visual_quality_low');if(!deliveryPossible)reasons.push('delivery_unavailable');if(!allowedRegion)reasons.push('region_unavailable');try{normalizeCondition(offer.condition,{fallback:null})}catch{reasons.push('invalid_condition')}}if(Number(sellerScore||0)<=0)reasons.push('seller_inactive');return{eligible:reasons.length===0,reasons};}
