import crypto from 'node:crypto';

export const NOTIFICATION_KINDS=Object.freeze(['routine','owner_decision','platform_issue','appeal','task','training']);

export class NotificationService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async create(ctx,{kind='routine',title,detail='',severity='info',recipientRole=null,recipientUserId=null,entity=null,entityId=null,requiresAction=false}={}){
    if(!NOTIFICATION_KINDS.includes(kind))throw new Error('invalid notification kind');if(!title)throw new Error('title required');
    const rec={id:`ntf_${crypto.randomUUID()}`,kind,title,detail,severity,recipientRole,recipientUserId,entity,entityId,requiresAction:Boolean(requiresAction),status:'unread',createdAt:this.now().toISOString(),readAt:null,resolvedAt:null};
    await this.repoFactory(ctx).put('Notification',rec);return rec;
  }
  async list(ctx,{kind=null,unreadOnly=false,ownerInbox=false,adminInbox=false}={}){
    let items=await this.repoFactory(ctx).list('Notification');
    items=items.filter(x=>!x.recipientUserId||x.recipientUserId===ctx.userId).filter(x=>!x.recipientRole||x.recipientRole===ctx.role||ctx.role==='owner'||ctx.role==='admin');
    if(kind)items=items.filter(x=>x.kind===kind);if(unreadOnly)items=items.filter(x=>x.status==='unread');
    if(ownerInbox)items=items.filter(x=>x.kind==='owner_decision'&&x.requiresAction);
    if(adminInbox)items=items.filter(x=>['platform_issue','appeal'].includes(x.kind));
    return items.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  async read(ctx,id){const repo=this.repoFactory(ctx);const rec=await repo.get('Notification',id);if(!rec)return null;if(rec.status==='unread'){rec.status='read';rec.readAt=this.now().toISOString();await repo.put('Notification',rec)}return rec;}
  async resolve(ctx,id){const repo=this.repoFactory(ctx);const rec=await repo.get('Notification',id);if(!rec)return null;rec.status='resolved';rec.resolvedAt=this.now().toISOString();await repo.put('Notification',rec);return rec;}
  async counters(ctx){const all=await this.list(ctx);return {unread:all.filter(x=>x.status==='unread').length,ownerDecisions:all.filter(x=>x.kind==='owner_decision'&&x.requiresAction&&x.status!=='resolved').length,platformIssues:all.filter(x=>x.kind==='platform_issue'&&x.status!=='resolved').length,appeals:all.filter(x=>x.kind==='appeal'&&x.status!=='resolved').length};}
}
