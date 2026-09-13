export class MarketingPublisherRegistry{
  #map=new Map();
  register(name,publisher){if(!name||!publisher)throw new Error('publisher required');this.#map.set(name,publisher);return this;}
  get(name){return this.#map.get(name)||null;}
  list(){return [...this.#map.keys()]}
}

export class EineiroMarketMarketingPublisher{
  constructor({repoFactory}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;}
  async publishCreative({ctx,campaign,creative,test}){
    const repo=this.repoFactory(ctx);const id=`market-ad:${test.id}:${creative.id}`;const rec={id,campaignId:campaign.id,creativeId:creative.id,testId:test.id,channel:'eineiro_market',slot:test.placement==='auto'?'showcase':test.placement,status:'active',headline:creative.headline,text:creative.text,assetUrl:creative.assetUrl||null,priority:50,startedAt:new Date().toISOString()};await repo.put('MarketplacePlacement',rec);return rec;
  }
  async pauseCreative({ctx,creativeId,testId=null}){const repo=this.repoFactory(ctx);const placements=await repo.list('MarketplacePlacement');const changed=[];for(const p of placements.filter(x=>x.creativeId===creativeId&&(!testId||x.testId===testId))){p.status='paused';p.pausedAt=new Date().toISOString();await repo.put('MarketplacePlacement',p);changed.push(p)}return changed;}
}

export class ChannelMarketingPublisher{
  constructor({channel,adapterFactory}={}){if(!channel||typeof adapterFactory!=='function')throw new Error('channel/adapterFactory required');this.channel=channel;this.adapterFactory=adapterFactory;}
  async publishCreative({ctx,campaign,creative,test}){const adapter=await this.adapterFactory(ctx,this.channel);if(!adapter?.supports?.('marketing.write')||typeof adapter.publishCreative!=='function')throw Object.assign(new Error(`${this.channel}: маркетинговая публикация пока не поддерживается`),{code:'MARKETING_PUBLISH_UNSUPPORTED'});return adapter.publishCreative({ctx,campaign,creative,test});}
  async pauseCreative({ctx,creativeId,testId}){const adapter=await this.adapterFactory(ctx,this.channel);if(typeof adapter.pauseCreative!=='function')throw Object.assign(new Error(`${this.channel}: остановка креатива пока не поддерживается`),{code:'MARKETING_PAUSE_UNSUPPORTED'});return adapter.pauseCreative({ctx,creativeId,testId});}
}
