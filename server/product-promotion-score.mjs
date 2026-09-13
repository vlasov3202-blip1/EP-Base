import crypto from 'node:crypto';

const DEFAULT_RULES=Object.freeze({
  minOverallScore:78,
  minContentScore:72,
  minSellerScore:70,
  minFulfillmentScore:75,
  maxReturnRate:0.12,
  maxComplaintRate:0.04,
  minStockCoverageDays:5,
  minMarginPercent:12,
  minConversionRate:0.01,
  minImpressionsForBehaviorScore:150,
  paidBoostCanOverride:false
});

export class ProductPromotionScoreService{
  constructor({repoFactory,now=()=>new Date(),rules={}}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;this.rules={...DEFAULT_RULES,...rules};}
  async evaluate(ctx,productId){
    const repo=this.repoFactory(ctx);const product=await repo.get('Product',productId);if(!product)throw new Error('product not found');
    const [metrics,quality,seller,inventory,shipments,orders]=await Promise.all([
      repo.get('ProductMetrics',productId),repo.get('ProductQuality',productId),repo.get('SellerQuality',product.sellerId||'default'),repo.list('InventoryUnit'),repo.list('Shipment'),repo.list('Order')
    ]);
    const card=quality||deriveCardQuality(product);const sellerQuality=seller||{score:80,complaintRate:0,returnRate:0,lateDispatchRate:0};const stock=inventory.filter(x=>x.productId===productId).reduce((s,x)=>s+Number(x.quantity||0),0);const productOrders=orders.filter(o=>(o.items||[]).some?.(i=>i.productId===productId)||o.productId===productId);const fulfilled=productOrders.filter(o=>['shipped','delivered'].includes(o.status)).length;const delayed=shipments.filter(s=>productOrders.some(o=>o.id===s.orderId)&&['delayed','failed','error'].includes(s.status)).length;
    const behavior=deriveBehavior(metrics||{});const economics=deriveEconomics(product,metrics||{});const fulfillment=deriveFulfillment({stock,fulfilled,delayed,metrics:metrics||{}});const dimensions={content:card.score,seller:normalizeScore(sellerQuality.score),behavior:behavior.score,economics:economics.score,fulfillment:fulfillment.score};
    const weighted=Math.round(dimensions.content*.24+dimensions.seller*.18+dimensions.behavior*.22+dimensions.economics*.18+dimensions.fulfillment*.18);
    const blockers=[];if(dimensions.content<this.rules.minContentScore)blockers.push('content_quality');if(dimensions.seller<this.rules.minSellerScore)blockers.push('seller_quality');if(dimensions.fulfillment<this.rules.minFulfillmentScore)blockers.push('fulfillment_risk');if(Number(sellerQuality.returnRate||metrics?.returnRate||0)>this.rules.maxReturnRate)blockers.push('high_return_rate');if(Number(sellerQuality.complaintRate||metrics?.complaintRate||0)>this.rules.maxComplaintRate)blockers.push('high_complaint_rate');if(economics.marginPercent<this.rules.minMarginPercent)blockers.push('low_margin');if(behavior.hasEnoughData&&behavior.conversionRate<this.rules.minConversionRate)blockers.push('low_conversion');if(fulfillment.stockCoverageDays<this.rules.minStockCoverageDays)blockers.push('low_stock_coverage');
    const eligible=weighted>=this.rules.minOverallScore&&blockers.length===0;const recommendation=eligible?'promote':weighted>=65?'improve_then_recheck':'do_not_promote';
    const rec={id:`promo-score:${productId}`,productId,score:weighted,dimensions,blockers,recommendation,eligible,paidBoostCanOverride:false,reason:explain({eligible,weighted,blockers,dimensions}),metricsSnapshot:structuredClone(metrics||{}),evaluatedAt:this.now().toISOString()};await repo.put('ProductPromotionScore',rec);return rec;
  }
  async recordMetrics(ctx,productId,input={}){
    const repo=this.repoFactory(ctx);const prev=await repo.get('ProductMetrics',productId)||{id:productId,productId,impressions:0,clicks:0,views:0,favorites:0,leads:0,orders:0,revenue:0,returns:0,complaints:0};const next={...prev};for(const key of ['impressions','clicks','views','favorites','leads','orders','revenue','returns','complaints'])next[key]=Number(prev[key]||0)+Number(input[key]||0);next.conversionRate=next.views?next.orders/next.views:next.clicks?next.orders/next.clicks:0;next.returnRate=next.orders?next.returns/next.orders:0;next.complaintRate=next.orders?next.complaints/next.orders:0;next.updatedAt=this.now().toISOString();await repo.put('ProductMetrics',next);return next;
  }
  async recommendExternalChannels(ctx,productId,{candidateChannels=[]}={}){
    const score=await this.evaluate(ctx,productId);const repo=this.repoFactory(ctx);const channels=(await repo.list('ChannelConnection')).filter(x=>x.enabled&&['connected','online'].includes(x.status)).map(x=>x.channel);const allowed=[...new Set((candidateChannels.length?candidateChannels:channels).filter(x=>x&&x!=='eineiro_market'))];const rec={id:`promo-rec:${crypto.randomUUID()}`,productId,score:score.score,eligible:score.eligible,channels:score.eligible?allowed:[],decision:score.eligible&&allowed.length?'offer_external_promotion':score.eligible?'wait_for_channel':'do_not_promote',reason:score.reason,createdAt:this.now().toISOString()};await repo.put('PromotionRecommendation',rec);return rec;
  }
}

export function deriveCardQuality(product={}){let points=0,max=0;const add=(ok,w)=>{max+=w;if(ok)points+=w};add(Boolean(product.name||product.title),12);add(Boolean(product.description&&String(product.description).length>=80),14);add(Array.isArray(product.images)&&product.images.length>=3,16);add(Boolean(product.price&&Number(product.price)>0),10);add(Boolean(product.categoryId||product.category),10);add(Boolean(product.attributes&&Object.keys(product.attributes).length>=3),10);add(Boolean(product.condition),8);add(Boolean(product.shipping||product.deliveryOptions||product.weight),6);add(Boolean(product.warranty||product.returnPolicy),6);add(Boolean(product.isolatedAssetUrl||product.model3dUrl||product.visualReady),8);return{score:Math.round(points/max*100),points,max};}
function deriveBehavior(m){const impressions=Number(m.impressions||0),clicks=Number(m.clicks||m.views||0),orders=Number(m.orders||0),favorites=Number(m.favorites||0),leads=Number(m.leads||0);const ctr=impressions?clicks/impressions:0,conversion=clicks?orders/clicks:0,favoriteRate=clicks?favorites/clicks:0,leadRate=clicks?leads/clicks:0;const enough=impressions>=150;const score=enough?clamp(ctr*900+conversion*2200+favoriteRate*500+leadRate*500):70;return{score:Math.round(score),ctr,conversionRate:conversion,favoriteRate,leadRate,hasEnoughData:enough};}
function deriveEconomics(p,m){const price=Number(p.price||0),cost=Number(p.cost||p.costPrice||0),marginPercent=price?Math.max(0,(price-cost)/price*100):0;const returnRate=Number(m.returnRate||0);return{marginPercent,score:Math.round(clamp(marginPercent*2.2-returnRate*120))};}
function deriveFulfillment({stock,fulfilled,delayed,metrics}){const dailyDemand=Math.max(.1,Number(metrics.orders||0)/Math.max(1,Number(metrics.periodDays||30)));const coverage=stock/dailyDemand;const delayRate=fulfilled+delayed?delayed/(fulfilled+delayed):0;return{stockCoverageDays:coverage,delayRate,score:Math.round(clamp(70+Math.min(25,coverage)-delayRate*120))};}
function normalizeScore(v){return Math.round(clamp(Number(v||0)))}function clamp(v){return Math.max(0,Math.min(100,v))}
function explain({eligible,weighted,blockers,dimensions}){if(eligible)return`Товар прошёл жёсткие правила качества: итог ${weighted}/100. Продвижение основано на качестве предложения и фактических результатах, а не на размере бюджета продавца.`;return`Товар не проходит автоматическое продвижение: итог ${weighted}/100; блокирующие причины: ${blockers.join(', ')||'недостаточный итоговый балл'}. Баллы: карточка ${dimensions.content}, продавец ${dimensions.seller}, поведение ${dimensions.behavior}, экономика ${dimensions.economics}, исполнение ${dimensions.fulfillment}.`;}

export {DEFAULT_RULES};
