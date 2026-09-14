import crypto from 'node:crypto';
import {createHash} from 'node:crypto';
import {authenticateRequest,getPlatformRuntimeForTests} from './http-api.mjs';
import {readJsonBody} from './http-security.mjs';
import {ChannelConfigService} from './channel-config.mjs';
import {createLiveChannelAdapter} from './live-channels.mjs';

const hash=v=>createHash('sha256').update(String(v)).digest('hex');
function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}
const body=readJsonBody;
function assertInboxRole(ctx){if(!['owner','manager','seller','admin'].includes(ctx.role))throw Object.assign(new Error('inbox access forbidden'),{status:403,code:'FORBIDDEN'});}

function groupConversations(inbound,outbound){
  const map=new Map();const add=(m,direction)=>{const id=String(m.conversationExternalId||m.externalConversationId||m.conversationId||'unknown');const key=`${m.channel}:${id}`;const c=map.get(key)||{id:key,channel:m.channel,conversationExternalId:id,messages:[],unread:0,lastAt:null};const at=m.receivedAt||m.sentAt||m.createdAt||m.updatedAt||new Date().toISOString();c.messages.push({...m,direction});if(direction==='inbound'&&m.status!=='read')c.unread++;if(!c.lastAt||Date.parse(at)>Date.parse(c.lastAt))c.lastAt=at;map.set(key,c)};for(const m of inbound)add(m,'inbound');for(const m of outbound)add(m,'outbound');return [...map.values()].map(c=>({...c,messages:c.messages.sort((a,b)=>Date.parse(a.receivedAt||a.sentAt||a.createdAt||0)-Date.parse(b.receivedAt||b.sentAt||b.createdAt||0))})).sort((a,b)=>Date.parse(b.lastAt||0)-Date.parse(a.lastAt||0));
}

export async function handleInboxApi(req,res){
  const url=new URL(req.url,'http://local');if(!url.pathname.startsWith('/api/v1/inbox'))return false;
  try{
    const ctx=await authenticateRequest(req);assertInboxRole(ctx);const {store}=await getPlatformRuntimeForTests();const repo=store.tenant(ctx);const config=new ChannelConfigService(store);
    if(req.method==='GET'&&url.pathname==='/api/v1/inbox/conversations'){
      const [inbound,outbound]=await Promise.all([repo.list('InboxMessage'),repo.list('OutboundMessage')]);return json(res,200,{items:groupConversations(inbound,outbound)});
    }
    const sync=url.pathname.match(/^\/api\/v1\/inbox\/sync\/([^/]+)$/);if(req.method==='POST'&&sync){
      const channel=decodeURIComponent(sync[1]);const adapter=await createLiveChannelAdapter({ctx,channel,store,configService:config});if(typeof adapter.poll!=='function')throw Object.assign(new Error('channel sync unsupported'),{status:409,code:'SYNC_UNSUPPORTED'});const batch=await adapter.poll({ctx,cursor:null});let imported=0,duplicates=0;const existing=await repo.list('InboxMessage');const keys=new Set(existing.map(x=>x.dedupKey));for(const raw of batch.items||[]){const externalMessageId=raw.externalMessageId||raw.id;const conversationExternalId=raw.externalConversationId||raw.conversationId;if(!externalMessageId||!conversationExternalId)continue;const dedupKey=hash(`${channel}:${externalMessageId}`);if(keys.has(dedupKey)){duplicates++;continue}const rec={id:crypto.randomUUID(),channel,direction:'inbound',externalMessageId:String(externalMessageId),conversationExternalId:String(conversationExternalId),customerExternalId:String(raw.senderId||'unknown'),text:String(raw.text||''),attachments:raw.attachments||[],receivedAt:raw.occurredAt||new Date().toISOString(),dedupKey,status:'received'};await repo.put('InboxMessage',rec);keys.add(dedupKey);imported++}return json(res,200,{channel,imported,duplicates,cursor:batch.cursor??null});
    }
    if(req.method==='POST'&&url.pathname==='/api/v1/inbox/send'){
      const p=await body(req);if(!p.channel||!p.conversationExternalId||!p.text||!p.clientRequestId)throw Object.assign(new Error('channel, conversationExternalId, text and clientRequestId required'),{status:400});const idempotencyKey=hash(`${ctx.companyId}:${p.channel}:${p.clientRequestId}`);const existing=(await repo.list('OutboundMessage')).find(x=>x.idempotencyKey===idempotencyKey);if(existing)return json(res,200,{duplicate:true,message:existing});const adapter=await createLiveChannelAdapter({ctx,channel:p.channel,store,configService:config});const remote=await adapter.sendMessage({ctx,message:{externalConversationId:p.conversationExternalId,text:p.text,attachments:p.attachments||[]}});const rec={id:crypto.randomUUID(),channel:p.channel,conversationExternalId:String(p.conversationExternalId),text:String(p.text),attachments:p.attachments||[],clientRequestId:String(p.clientRequestId),idempotencyKey,status:'sent',attempts:1,sentAt:new Date().toISOString(),externalMessageId:remote.externalMessageId||null};await repo.put('OutboundMessage',rec);return json(res,201,{duplicate:false,message:rec});
    }
    return json(res,404,{error:'not found'});
  }catch(e){return json(res,e.status||500,{error:e.message,code:e.code||'INBOX_API_ERROR'});}
}
