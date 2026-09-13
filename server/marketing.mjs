import crypto from 'node:crypto';

export class MarketingService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async campaign(ctx,{name,channel,budget=0,goal='sales',audience={},productIds=[],status='draft'}={}){
    if(!name||!channel)throw new Error('name/channel required');const rec={id:`mkt_${crypto.randomUUID()}`,name,channel,budget:Number(budget)||0,goal,audience:structuredClone(audience),productIds:[...productIds],status,spent:0,impressions:0,clicks:0,leads:0,orders:0,revenue:0,createdAt:this.now().toISOString()};await this.repoFactory(ctx).put('MarketingCampaign',rec);return rec;
  }
  async recordPerformance(ctx,id,{spent=0,impressions=0,clicks=0,leads=0,orders=0,revenue=0}={}){
    const repo=this.repoFactory(ctx);const c=await repo.get('MarketingCampaign',id);if(!c)throw new Error('campaign not found');for(const [k,v] of Object.entries({spent,impressions,clicks,leads,orders,revenue}))c[k]=Number(c[k]||0)+Number(v||0);c.updatedAt=this.now().toISOString();await repo.put('MarketingCampaign',c);return c;
  }
  async analyze(ctx){const items=await this.repoFactory(ctx).list('MarketingCampaign');return items.map(c=>{const ctr=c.impressions?c.clicks/c.impressions:0;const conversion=c.leads?c.orders/c.leads:0;const cac=c.orders?c.spent/c.orders:null;const roas=c.spent?c.revenue/c.spent:null;return{...c,ctr,conversion,cac,roas,statusSignal:roas==null?'unknown':roas>=3?'good':roas>=1.5?'watch':'bad'}}).sort((a,b)=>(b.roas||0)-(a.roas||0));}
  async recommendations(ctx){const rows=await this.analyze(ctx);const out=[];for(const c of rows){if(c.statusSignal==='bad'&&c.spent>0)out.push({campaignId:c.id,action:'reduce_or_pause',reason:'низкая окупаемость',requiresOwner:false});if(c.statusSignal==='good'&&c.budget>0&&c.spent>=c.budget*.8)out.push({campaignId:c.id,action:'consider_scale',reason:'высокая окупаемость и бюджет почти исчерпан',requiresOwner:true});if(c.clicks>50&&c.leads===0)out.push({campaignId:c.id,action:'check_offer',reason:'есть клики, но нет обращений',requiresOwner:false});}return out;}
}
