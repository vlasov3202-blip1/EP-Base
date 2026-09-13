export class RecommendationEngine{
  constructor({repoFactory,offerRanking,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');if(!offerRanking)throw new Error('offerRanking required');this.repoFactory=repoFactory;this.offerRanking=offerRanking;this.now=now;}
  async recommend(ctx,{identityId=null,sessionIntent=null,limit=24,region=null}={}){
    const repo=this.repoFactory(ctx);const [products,offers,saved,preferences,recent]=await Promise.all([repo.list('Product'),repo.list('Offer'),repo.list('SavedData'),repo.list('PreferenceProfile'),repo.list('RecommendationEvent')]);
    const profile=preferences.find(x=>x.identityId===identityId)||{};const savedItems=saved.filter(x=>x.identityId===identityId);const session=sessionIntent||{};
    const ranked=await this.offerRanking.rank(ctx,{intent:session,userContext:{preferredCategories:profile.categories||[],savedProductIds:savedItems.filter(x=>x.kind==='product').map(x=>x.refId),recentOfferIds:recent.filter(x=>x.identityId===identityId).slice(-50).map(x=>x.offerId)},region,limit:Math.max(limit*3,limit)});
    return ranked.slice(0,limit).map((r,i)=>({...r,rank:i+1,reason:reason(r,session,profile)}));
  }
  async record(ctx,{identityId,offerId,action,sessionIntent=null}={}){const repo=this.repoFactory(ctx);const rec={id:`rec:${identityId||'anon'}:${Date.now()}:${Math.random().toString(36).slice(2)}`,identityId,offerId,action,sessionIntent:structuredClone(sessionIntent||null),createdAt:this.now().toISOString()};await repo.put('RecommendationEvent',rec);return rec;}
}
function reason(r,session,profile){if(session?.category&&r.factors?.intentRelevance>=80)return'совпадает с текущей задачей';if((profile.categories||[]).length&&r.factors?.userRelevance>=70)return'соответствует недавним интересам';return'сильное актуальное предложение';}
