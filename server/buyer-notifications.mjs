import crypto from 'node:crypto';

export const BUYER_NOTIFICATION_PRIORITY=Object.freeze(['CRITICAL','ACTION_REQUIRED','MATCH_FOUND','HIGH_VALUE_RECOMMENDATION','IN_APP_ONLY']);

export class BuyerNotificationEngine{
  constructor({repoFactory,now=()=>new Date(),cooldownMinutes=60}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;this.cooldownMinutes=cooldownMinutes;}
  async preferences(ctx,identityId){const repo=this.repoFactory(ctx);return await repo.get('NotificationPreferences',`notify-pref:${identityId}`)||{id:`notify-pref:${identityId}`,identityId,orders:true,sellerMessages:true,savedDemand:true,priceAvailability:true,recommendations:true,security:true,quietHours:null};}
  async setPreferences(ctx,identityId,patch={}){const repo=this.repoFactory(ctx);const prev=await this.preferences(ctx,identityId);const next={...prev,...structuredClone(patch),id:prev.id,identityId,updatedAt:this.now().toISOString()};await repo.put('NotificationPreferences',next);return next;}
  async classify(ctx,input={}){
    const {identityId,type,paidPromotion=false,confidence=0,exactSavedDemand=false,requiresAction=false,securityCritical=false,recommendation=false,seen=false}=input;
    const prefs=await this.preferences(ctx,identityId);
    let priority='IN_APP_ONLY';
    if(securityCritical)priority='CRITICAL';
    else if(requiresAction)priority='ACTION_REQUIRED';
    else if(exactSavedDemand&&prefs.savedDemand)priority='MATCH_FOUND';
    else if(recommendation&&confidence>=.9&&prefs.recommendations)priority='HIGH_VALUE_RECOMMENDATION';
    if(paidPromotion&&!['CRITICAL','ACTION_REQUIRED','MATCH_FOUND'].includes(priority))priority='IN_APP_ONLY';
    if(seen)priority='IN_APP_ONLY';
    return{priority,push:priority!=='IN_APP_ONLY',preferences:prefs,type};
  }
  async enqueue(ctx,input={}){const repo=this.repoFactory(ctx);const decision=await this.classify(ctx,input);const dedupKey=input.dedupKey||`${input.identityId}:${input.type}:${input.objectId||''}`;const all=await repo.list('BuyerNotification');const duplicate=all.find(x=>x.dedupKey===dedupKey&&x.status!=='dismissed');if(duplicate)return{duplicate:true,notification:duplicate};const cutoff=this.now().getTime()-this.cooldownMinutes*60000;const recent=all.find(x=>x.identityId===input.identityId&&x.type===input.type&&Date.parse(x.createdAt||0)>=cutoff&&x.priority===decision.priority);if(recent&&!['CRITICAL','ACTION_REQUIRED'].includes(decision.priority))return{duplicate:true,notification:recent};const rec={id:`bn_${crypto.randomUUID()}`,identityId:input.identityId,type:input.type,objectId:input.objectId||null,title:input.title||'',body:input.body||'',priority:decision.priority,push:decision.push,dedupKey,status:'queued',meta:structuredClone(input.meta||{}),createdAt:this.now().toISOString()};await repo.put('BuyerNotification',rec);return{duplicate:false,notification:rec};}
}
