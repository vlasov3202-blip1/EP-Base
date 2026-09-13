import {BaseChannelAdapter} from './connectors.mjs';

function form(data){const p=new URLSearchParams();for(const [k,v] of Object.entries(data))if(v!=null)p.set(k,String(v));return p.toString();}

export class AvitoAdapter extends BaseChannelAdapter{
  constructor({clientId,clientSecret,userId,fetchImpl=globalThis.fetch,baseUrl='https://api.avito.ru'}={}){
    super({name:'avito',capabilities:['messages.read','messages.write']});
    if(!clientId||!clientSecret||!userId)throw new Error('Avito: clientId/clientSecret/userId required');
    this.clientId=clientId;this.clientSecret=clientSecret;this.userId=String(userId);this.fetch=fetchImpl;this.baseUrl=baseUrl.replace(/\/$/,'');this.token=null;this.tokenExpiresAt=0;
  }
  async #token(){
    if(this.token&&Date.now()<this.tokenExpiresAt-60_000)return this.token;
    const r=await this.fetch(`${this.baseUrl}/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form({grant_type:'client_credentials',client_id:this.clientId,client_secret:this.clientSecret})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.access_token)throw Object.assign(new Error(j.error_description||j.error||`Avito token error ${r.status}`),{status:r.status,retryable:r.status>=500});
    this.token=j.access_token;this.tokenExpiresAt=Date.now()+Number(j.expires_in||86400)*1000;return this.token;
  }
  async #request(path,{method='GET',body=null,retry401=true}={}){
    const token=await this.#token();
    const r=await this.fetch(`${this.baseUrl}${path}`,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    if(r.status===401&&retry401){this.token=null;this.tokenExpiresAt=0;return this.#request(path,{method,body,retry401:false});}
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Object.assign(new Error(j?.error?.message||j?.message||`Avito API error ${r.status}`),{status:r.status,retryable:r.status>=500||r.status===429,body:j});
    return j;
  }
  normalizeWebhook(payload={}){
    const value=payload.payload?.value||payload.value||payload;
    const message=value.message||value;
    const chatId=value.chat_id||value.chatId||message.chat_id||message.chatId;
    const id=message.id||message.message_id||payload.id;
    if(!id||!chatId)throw new Error('Avito: invalid webhook payload');
    return{channel:'avito',externalMessageId:String(id),externalConversationId:String(chatId),direction:message.direction||'in',senderId:message.author_id?String(message.author_id):null,text:String(message.content?.text||message.text||''),attachments:[],occurredAt:message.created?new Date(Number(message.created)*1000).toISOString():new Date().toISOString(),raw:payload};
  }
  async listChats({unreadOnly=false,limit=100,offset=0}={}){
    const q=new URLSearchParams({limit:String(Math.min(100,Math.max(1,limit))),offset:String(Math.max(0,offset)),unread_only:String(Boolean(unreadOnly))});
    return this.#request(`/messenger/v2/accounts/${encodeURIComponent(this.userId)}/chats?${q}`);
  }
  async listMessages(chatId,{limit=100,offset=0}={}){
    const q=new URLSearchParams({limit:String(Math.min(100,Math.max(1,limit))),offset:String(Math.max(0,offset))});
    return this.#request(`/messenger/v3/accounts/${encodeURIComponent(this.userId)}/chats/${encodeURIComponent(chatId)}/messages/?${q}`);
  }
  async poll({cursor=null}={}){
    const offset=Math.max(0,Number(cursor)||0);const chats=await this.listChats({unreadOnly:true,limit:100,offset});const list=chats.chats||chats.items||[];const items=[];
    for(const chat of list){const chatId=chat.id||chat.chat_id;if(!chatId)continue;const batch=await this.listMessages(chatId,{limit:100,offset:0});for(const m of batch.messages||batch.items||[])items.push(this.normalizeWebhook({chat_id:chatId,...m}));}
    return{items,cursor:list.length===100?String(offset+100):null};
  }
  async sendMessage({message}){
    const chatId=message.externalConversationId||message.conversationId;if(!chatId)throw Object.assign(new Error('Avito: conversation id required'),{retryable:false});
    const j=await this.#request(`/messenger/v1/accounts/${encodeURIComponent(this.userId)}/chats/${encodeURIComponent(chatId)}/messages`,{method:'POST',body:{type:'text',message:{text:String(message.text||'')}}});
    return{externalMessageId:String(j.id||j.message?.id||j.message_id||'')};
  }
  async checkConnection(){const j=await this.listChats({limit:1,offset:0});return{ok:true,chatCount:Array.isArray(j.chats)?j.chats.length:undefined};}
}
