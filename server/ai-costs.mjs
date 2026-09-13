import crypto from 'node:crypto';

export class AiCostService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async record(ctx,{feature,units=0,inputUnits=0,outputUnits=0,providerCost=0,requestId=null,meta={}}={}){
    if(!feature)throw new Error('feature required');const rec={id:`aic_${crypto.randomUUID()}`,feature,units:Number(units)||0,inputUnits:Number(inputUnits)||0,outputUnits:Number(outputUnits)||0,providerCost:Number(providerCost)||0,currencyLabel:'у.е.',requestId,meta:structuredClone(meta),createdAt:this.now().toISOString()};await this.repoFactory(ctx).put('AiCost',rec);return rec;
  }
  async summary(ctx,{from=null,to=null,feature=null}={}){
    let items=await this.repoFactory(ctx).list('AiCost');if(from)items=items.filter(x=>Date.parse(x.createdAt)>=Date.parse(from));if(to)items=items.filter(x=>Date.parse(x.createdAt)<=Date.parse(to));if(feature)items=items.filter(x=>x.feature===feature);
    const byFeature={};for(const x of items){const row=byFeature[x.feature]||(byFeature[x.feature]={requests:0,units:0,providerCost:0});row.requests++;row.units+=x.units;row.providerCost+=x.providerCost;}
    return {currencyLabel:'у.е.',requests:items.length,units:items.reduce((s,x)=>s+x.units,0),providerCost:items.reduce((s,x)=>s+x.providerCost,0),byFeature};
  }
}
