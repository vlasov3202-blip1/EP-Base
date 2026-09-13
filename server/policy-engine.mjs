import crypto from 'node:crypto';

export const POLICY_EFFECTS=Object.freeze(['ALLOW','DENY','REQUIRE_APPROVAL','ALLOW_WITH_LIMIT']);
export const RISK_LEVELS=Object.freeze(['LOW','MEDIUM','HIGH','CRITICAL']);

export class PolicyEngine{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async put(ctx,policy={}){if(!policy.id)policy.id=`policy_${crypto.randomUUID()}`;if(!POLICY_EFFECTS.includes(policy.effect))throw new Error('invalid policy effect');const rec={priority:100,status:'active',version:1,...structuredClone(policy),updatedAt:this.now().toISOString()};await this.repoFactory(ctx).put('Policy',rec);return rec;}
  async evaluate(ctx,{subjectType='user',subjectId=null,role=ctx.role,action,resource,amount=null,confidence=null,customerImpact=null,affectedCount=null,externalDependency=false,meta={}}={}){
    const policies=(await this.repoFactory(ctx).list('Policy')).filter(x=>x.status==='active').sort((a,b)=>Number(a.priority||100)-Number(b.priority||100));const applicable=policies.filter(p=>match(p,{subjectType,subjectId,role,action,resource,amount,confidence,customerImpact,affectedCount,externalDependency,meta}));
    const denied=applicable.find(p=>p.effect==='DENY');if(denied)return decision('DENY',denied,{amount,confidence,customerImpact,affectedCount,externalDependency});
    const approval=applicable.find(p=>p.effect==='REQUIRE_APPROVAL');if(approval)return decision('REQUIRE_APPROVAL',approval,{amount,confidence,customerImpact,affectedCount,externalDependency});
    const limited=applicable.find(p=>p.effect==='ALLOW_WITH_LIMIT');if(limited)return decision('ALLOW_WITH_LIMIT',limited,{amount,confidence,customerImpact,affectedCount,externalDependency});
    const allow=applicable.find(p=>p.effect==='ALLOW');return decision(allow?'ALLOW':'REQUIRE_APPROVAL',allow||{id:'default-safe',reason:'no matching allow policy'},{amount,confidence,customerImpact,affectedCount,externalDependency});
  }
}
function match(p,c){if(p.scope&&p.scope!=='*'&&p.scope!==c.meta?.scope)return false;if(p.subject_type&&p.subject_type!==c.subjectType)return false;if(p.subject_id&&p.subject_id!==c.subjectId)return false;if(p.role&&p.role!==c.role)return false;if(p.action&&p.action!==c.action)return false;if(p.resource&&p.resource!==c.resource)return false;const cond=p.condition||{};if(cond.maxAmount!=null&&Number(c.amount||0)>Number(cond.maxAmount))return false;if(cond.minConfidence!=null&&Number(c.confidence??1)<Number(cond.minConfidence))return false;if(cond.maxAffectedCount!=null&&Number(c.affectedCount||0)>Number(cond.maxAffectedCount))return false;if(cond.externalDependency===false&&c.externalDependency)return false;return true}
function decision(effect,policy,riskInput){return{effect,policyId:policy.id||null,limit:policy.limit??null,reason:policy.reason||null,risk:riskLevel(riskInput)}}
function riskLevel({amount,confidence,customerImpact,affectedCount,externalDependency}){let n=0;if(Number(amount||0)>300000)n+=2;else if(Number(amount||0)>50000)n++;if(confidence!=null&&confidence<.65)n+=2;else if(confidence!=null&&confidence<.8)n++;if(customerImpact==='high')n+=2;if(Number(affectedCount||0)>100)n+=2;if(externalDependency)n++;return n>=5?'CRITICAL':n>=3?'HIGH':n>=1?'MEDIUM':'LOW'}
