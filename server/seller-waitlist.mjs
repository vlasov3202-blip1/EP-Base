import crypto from 'node:crypto';

export class SellerWaitlistService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async join(ctx,{identityId=ctx.identityId,companyId=ctx.companyId,categoryId}={}){
    if(!identityId||!companyId||!categoryId)throw new Error('identityId/companyId/categoryId required');
    const repo=this.repoFactory(ctx);const id=`wait:${companyId}:${categoryId}:${identityId}`;const existing=await repo.get('SellerWaitlist',id);if(existing)return existing;
    const rec={id,identityId,companyId,categoryId,status:'preparing',catalogImported:false,stockConfigured:false,offersPrepared:false,activeOfferCount:0,joinedAt:this.now().toISOString(),updatedAt:this.now().toISOString()};await repo.put('SellerWaitlist',rec);return rec;
  }
  async updateReadiness(ctx,id,patch={}){
    const repo=this.repoFactory(ctx);const rec=await repo.get('SellerWaitlist',id);if(!rec)throw new Error('waitlist seller not found');
    const next={...rec,catalogImported:patch.catalogImported==null?rec.catalogImported:Boolean(patch.catalogImported),stockConfigured:patch.stockConfigured==null?rec.stockConfigured:Boolean(patch.stockConfigured),offersPrepared:patch.offersPrepared==null?rec.offersPrepared:Boolean(patch.offersPrepared),activeOfferCount:patch.activeOfferCount==null?Number(rec.activeOfferCount||0):Math.max(0,Number(patch.activeOfferCount)||0),updatedAt:this.now().toISOString()};
    next.status=next.catalogImported&&next.stockConfigured&&next.offersPrepared&&next.activeOfferCount>0?'ready':'preparing';await repo.put('SellerWaitlist',next);return next;
  }
  async listByCategory(ctx,categoryId){return (await this.repoFactory(ctx).list('SellerWaitlist')).filter(x=>x.categoryId===categoryId);}
}

export class CategorySupplyActivationService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async evaluate(ctx,{categoryId,minReadySellers=3,minActiveOffers=30,activate=false,policyAllowed=false}={}){
    if(!categoryId)throw new Error('categoryId required');const repo=this.repoFactory(ctx);const [waitlist,offers]=await Promise.all([repo.list('SellerWaitlist'),repo.list('Offer')]);
    const sellers=waitlist.filter(x=>x.categoryId===categoryId);const readySellers=sellers.filter(x=>x.status==='ready');
    const supplyOffers=offers.filter(x=>x.categoryId===categoryId&&['active','published','ready','draft','prepared'].includes(String(x.status||'').toLowerCase())&&Number(x.stock??x.quantity??1)>0);
    const ready=readySellers.length>=Math.max(1,Number(minReadySellers)||1)&&supplyOffers.length>=Math.max(1,Number(minActiveOffers)||1);
    const snapshot={id:`supply:${categoryId}:${this.now().getTime()}`,categoryId,readySellers:readySellers.length,totalSellers:sellers.length,activeOffers:supplyOffers.length,minReadySellers:Number(minReadySellers),minActiveOffers:Number(minActiveOffers),ready,activationRequested:Boolean(activate),policyAllowed:Boolean(policyAllowed),status:ready?'supply_ready':'insufficient_supply',evaluatedAt:this.now().toISOString()};
    await repo.put('CategorySupplySnapshot',snapshot);
    if(!activate||!ready)return{...snapshot,activated:false,featureFlag:null};
    if(!policyAllowed)return{...snapshot,activated:false,requiresPolicy:true,featureFlag:null};
    const featureFlag={id:`category:${categoryId}`,type:'category',categoryId,enabled:true,rollout:'category',reason:'supply_ready',activatedAt:this.now().toISOString(),updatedAt:this.now().toISOString()};await repo.put('FeatureFlag',featureFlag);const activation={id:`catact_${crypto.randomUUID()}`,categoryId,featureFlagId:featureFlag.id,readySellers:readySellers.length,activeOffers:supplyOffers.length,status:'activated',createdAt:this.now().toISOString()};await repo.put('CategoryActivation',activation);return{...snapshot,activated:true,featureFlag,activation};
  }
}
