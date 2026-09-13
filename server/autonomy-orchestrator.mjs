export class AutonomyOrchestrator{
  constructor({repoFactory,decisionEngine,financeGuard,featureFlags,moderation=null,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');if(!decisionEngine)throw new Error('decisionEngine required');if(!financeGuard)throw new Error('financeGuard required');if(!featureFlags)throw new Error('featureFlags required');this.repoFactory=repoFactory;this.decisionEngine=decisionEngine;this.financeGuard=financeGuard;this.featureFlags=featureFlags;this.moderation=moderation;this.now=now;}
  async propose(ctx,{capability,flagKey,action,resource,proposal,amount=0,marginPercent=null,confidence=.9,category=null,region=null,subjectId='',customerImpact='low',affectedCount=1,externalDependency=false}={}){
    const enabled=await this.featureFlags.enabled(ctx,flagKey||capability,{tenantId:ctx.companyId,region,category,subjectId});if(!enabled)return{status:'disabled',reason:'feature_flag'};
    const finance=await this.financeGuard.authorize(ctx,{domain:capability,amount,marginPercent,monthlyBudget:proposal?.monthlyBudget});if(finance.decision==='DENY')return{status:'blocked',reason:finance.reason,finance};
    const decision=await this.decisionEngine.decide(ctx,{capability,action,resource,proposal,amount,confidence,customerImpact,affectedCount,externalDependency,reason:finance.reason});
    return{status:decision.status,finance,decision};
  }
}
