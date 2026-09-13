import crypto from 'node:crypto';

export class UnservedDemandService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async record(ctx,{intent,reason='no_offer',region=null,budget=null,waitWillingness=false,preorderWillingness=false,source='market'}={}){
    if(!intent)throw new Error('intent required');const strength=scoreStrength({intent,budget,waitWillingness,preorderWillingness});const rec={id:`demand_${crypto.randomUUID()}`,intent:structuredClone(intent),reason,region,budget:budget==null?null:Number(budget),waitWillingness:Boolean(waitWillingness),preorderWillingness:Boolean(preorderWillingness),strength,source,status:'open',createdAt:this.now().toISOString(),updatedAt:this.now().toISOString()};await this.repoFactory(ctx).put('UnservedDemand',rec);return rec;
  }
  async cluster(ctx){const rows=(await this.repoFactory(ctx).list('UnservedDemand')).filter(x=>x.status==='open');const map=new Map();for(const d of rows){const key=clusterKey(d.intent,d.region);const c=map.get(key)||{id:`cluster:${key}`,key,count:0,strength:0,intents:[],region:d.region||null};c.count++;c.strength+=Number(d.strength||0);c.intents.push(d.id);map.set(key,c)}return[...map.values()].map(x=>({...x,averageStrength:x.count?Math.round(x.strength/x.count):0})).sort((a,b)=>(b.count*b.averageStrength)-(a.count*a.averageStrength));}
}
function scoreStrength({intent,budget,waitWillingness,preorderWillingness}){let s=20;if(intent?.saved)s+=15;if(intent?.notifyWhenAvailable)s+=20;if(waitWillingness)s+=15;if(budget!=null)s+=10;if(preorderWillingness)s+=20;if(intent?.checkoutAttempt)s+=25;return Math.min(100,s)}
function clusterKey(intent={},region){const category=intent.category||'unknown';const attrs=Object.entries(intent.attributes||{}).sort(([a],[b])=>a.localeCompare(b)).slice(0,4).map(([k,v])=>`${k}:${v}`).join('|');return `${category}:${region||'*'}:${attrs}`.replace(/[^a-zA-Zа-яА-Я0-9:_|.*-]/g,'_')}
