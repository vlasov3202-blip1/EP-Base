import {MarketReadRepository} from './market-repository.mjs';
import {CategorySchemaService} from './category-schema.mjs';
import {CompatibilityGate} from './compatibility-gate.mjs';
import {OfferRankingService} from './offer-ranking.mjs';
import {SearchEngineV2} from './search-engine-v2.mjs';
import {RecommendationEngine} from './recommendation-engine.mjs';

export function createMarketRuntime(store,{visualThreshold=60}={}){
  const repo=new MarketReadRepository(store),repoFactory=()=>repo;
  const categorySchema=new CategorySchemaService({repoFactory});const compatibilityGate=new CompatibilityGate({repoFactory,schemaService:categorySchema});const offerRanking=new OfferRankingService({repoFactory,visualThreshold});const searchEngine=new SearchEngineV2({repoFactory,categorySchema,compatibilityGate,offerRanking});const recommendationEngine=new RecommendationEngine({repoFactory,offerRanking});
  return{repo,categorySchema,compatibilityGate,offerRanking,searchEngine,recommendationEngine,searchCatalog:(ctx,q)=>searchCatalog({ctx,q,repo,searchEngine,recommendationEngine})};
}

async function searchCatalog({ctx,q={},repo,searchEngine,recommendationEngine}){
  const limit=Math.max(1,Math.min(100,Number(q.limit)||24));const offset=Math.max(0,Number(q.cursor)||0);const requested=Math.min(100,limit+offset);
  const intent={...(q.intent||{}),category:q.category||q.intent?.category||null,attributes:{...(q.intent?.attributes||{}),...(q.attributes||{})}};
  const search=await searchEngine.search(ctx,{query:q.query||'',intent,context:q.context||{},region:q.region||null,limit:requested});
  const recommended=await recommendationEngine.recommend(ctx,{identityId:ctx?.identityId||null,sessionIntent:intent,limit:requested,region:q.region||null});const recRank=new Map(recommended.map((x,i)=>[x.offerId,i]));
  const ordered=[...search.items].sort((a,b)=>{const ar=recRank.has(a.offerId)?recRank.get(a.offerId):9999,br=recRank.has(b.offerId)?recRank.get(b.offerId):9999;const as=a.searchScore-(ar<9999?Math.min(12,ar):12),bs=b.searchScore-(br<9999?Math.min(12,br):12);return bs-as});
  const page=ordered.slice(offset,offset+limit),items=[];
  for(const row of page){const [product,offer]=await Promise.all([repo.get('Product',row.productId),repo.get('Offer',row.offerId)]);if(!product||!offer)continue;items.push({id:offer.id,offerId:offer.id,productId:product.id,sellerId:offer.sellerId,name:product.name||product.title||'',description:product.description||'',category:product.categoryId||product.category||null,attributes:structuredClone(product.attributes||{}),price:Number(offer.price||0),currency:offer.currency||'RUB',condition:offer.condition,stock:Number(offer.stock||0),images:structuredClone(product.images||[]),deliveryOptions:structuredClone(offer.deliveryOptions||[]),relevance:Math.max(0,Math.min(1,Number(row.searchScore||0)/100)),searchScore:row.searchScore,organicScore:row.organicScore,sourceCompanyId:offer.sourceCompanyId||product.sourceCompanyId||null});}
  return{items,total:ordered.length,nextCursor:offset+limit<ordered.length?String(offset+limit):null,source:'market_product_offer_search_v2'};
}
