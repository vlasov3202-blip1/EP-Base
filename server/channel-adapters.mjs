import crypto from 'node:crypto';
import {BaseChannelAdapter} from './connectors.mjs';

export class EineiroMarketAdapter extends BaseChannelAdapter{
  constructor({repoFactory}={}){super({name:'eineiro_market',capabilities:['messages.read','messages.write','publish.write']});if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;}
  normalizeWebhook(payload={}){
    if(!payload.externalMessageId||!payload.conversationId)throw new Error('eineiro_market: invalid webhook payload');
    return{channel:this.name,externalMessageId:String(payload.externalMessageId),externalConversationId:String(payload.conversationId),direction:payload.direction||'in',senderId:payload.senderId?String(payload.senderId):null,text:String(payload.text||''),attachments:Array.isArray(payload.attachments)?payload.attachments:[],occurredAt:payload.occurredAt||new Date().toISOString(),raw:payload};
  }
  async sendMessage({ctx,message}){
    const repo=this.repoFactory(ctx);const externalMessageId=`em_${crypto.randomUUID()}`;
    await repo.put('MarketMessage',{id:externalMessageId,conversationId:message.externalConversationId||message.conversationId||null,direction:'out',text:message.text||'',attachments:message.attachments||[],sentAt:new Date().toISOString()});
    return{externalMessageId};
  }
  async poll({ctx,cursor=null}){
    const repo=this.repoFactory(ctx);const all=await repo.list('MarketMessage');const offset=Math.max(0,Number(cursor)||0);const items=all.slice(offset,offset+100).map(x=>({externalMessageId:x.id,conversationId:x.conversationId||'market',direction:x.direction||'in',senderId:x.senderId||null,text:x.text||'',attachments:x.attachments||[],occurredAt:x.sentAt||x.createdAt||new Date().toISOString()}));return{items,cursor:offset+items.length<all.length?String(offset+items.length):null};
  }
  async publish({ctx,item}){
    if(!item?.id)throw new Error('publication item id required');const repo=this.repoFactory(ctx);const publication={id:`market:${item.id}`,productId:item.id,status:'published',channel:'eineiro_market',publishedAt:new Date().toISOString(),snapshot:structuredClone(item)};await repo.put('Publication',publication);return publication;
  }
}

export class UnconfiguredExternalAdapter extends BaseChannelAdapter{
  constructor(name,{capabilities=['messages.read','messages.write','publish.write']}={}){super({name,capabilities});}
  #error(){return Object.assign(new Error(`${this.name}: provider credentials/endpoints not configured`),{code:'CHANNEL_NOT_CONFIGURED',retryable:false});}
  normalizeWebhook(payload={}){if(!payload.externalMessageId||!payload.conversationId)throw this.#error();return{channel:this.name,...payload};}
  async poll(){throw this.#error();}
  async sendMessage(){throw this.#error();}
  async publish(){throw this.#error();}
}

export function createProductionAdapterRegistry({AdapterRegistryClass,repoFactory}){
  const registry=new AdapterRegistryClass();
  registry.register(new EineiroMarketAdapter({repoFactory}));
  for(const name of ['avito','vk','youla','drom','farpost','auto_ru','zzap'])registry.register(new UnconfiguredExternalAdapter(name));
  return registry;
}
