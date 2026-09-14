import crypto from 'node:crypto';

export class FeatureFlagService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async put(ctx,input={}){const rec={id:input.id||`flag_${crypto.randomUUID()}`,key:input.key||input.id,kind:input.kind||input.type||'feature',enabled:Boolean(input.enabled),tenantIds:[...new Set(input.tenantIds||[])],regions:[...new Set(input.regions||[])],categories:[...new Set(input.categories||[])],percentage:Math.max(0,Math.min(100,Number(input.percentage??100))),status:input.status||'active',createdAt:input.createdAt||this.now().toISOString(),updatedAt:this.now().toISOString()};if(!rec.key)throw new Error('flag key required');await this.repoFactory(ctx).put('FeatureFlag',rec);return rec;}
  async enabled(ctx,key,{tenantId=ctx.companyId,region=null,category=null,subjectId=''}={}){const f=(await this.repoFactory(ctx).list('FeatureFlag')).find(x=>x.key===key&&x.status==='active');if(!f||!f.enabled)return false;if(f.tenantIds.length&&!f.tenantIds.includes(tenantId))return false;if(f.regions.length&&!f.regions.includes(region))return false;if(f.categories.length&&!f.categories.includes(category))return false;if(f.percentage>=100)return true;const h=hash(`${key}:${tenantId}:${subjectId}`)%100;return h<f.percentage;}
  async evaluate(ctx,{flagId=null,key=null,tenantId=ctx.companyId,userId='',region=null,category=null}={}){const resolvedKey=key||flagId;return{flagId:resolvedKey,key:resolvedKey,enabled:await this.enabled(ctx,resolvedKey,{tenantId,subjectId:userId,region,category})};}
}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
