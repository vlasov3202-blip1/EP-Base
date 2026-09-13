import crypto from 'node:crypto';

export class BaseChannelAdapter {
  constructor({name,capabilities=[]}={}){if(!name)throw new Error('adapter name required');this.name=name;this.capabilities=new Set(capabilities)}
  supports(cap){return this.capabilities.has(cap)}
  normalizeWebhook(payload){throw new Error(`${this.name}: normalizeWebhook not implemented`)}
  async poll(){return []}
  async sendMessage(){throw new Error(`${this.name}: sendMessage not implemented`)}
  async publish(){throw new Error(`${this.name}: publish not implemented`)}
}

export class GenericChannelAdapter extends BaseChannelAdapter {
  constructor({name,capabilities=['messages.read','messages.write','publish.write']}={}){super({name,capabilities})}
  normalizeWebhook(payload={}){
    if(!payload.externalMessageId||!payload.conversationId)throw new Error(`${this.name}: invalid webhook payload`);
    return {
      channel:this.name,
      externalMessageId:String(payload.externalMessageId),
      externalConversationId:String(payload.conversationId),
      direction:payload.direction||'in',
      senderId:payload.senderId?String(payload.senderId):null,
      text:String(payload.text||''),
      attachments:Array.isArray(payload.attachments)?payload.attachments:[],
      occurredAt:payload.occurredAt||new Date().toISOString(),
      raw:payload
    };
  }
}

export class AdapterRegistry {
  #map=new Map();
  register(adapter){if(!(adapter instanceof BaseChannelAdapter))throw new Error('adapter must extend BaseChannelAdapter');this.#map.set(adapter.name,adapter);return adapter}
  get(name){const a=this.#map.get(name);if(!a)throw new Error(`connector not registered:${name}`);return a}
  list(){return [...this.#map.values()].map(a=>({name:a.name,capabilities:[...a.capabilities]}))}
}

export class ConnectorRuntime {
  constructor({registry,inbox,audit,events,clock=()=>Date.now()}={}){this.registry=registry;this.inbox=inbox;this.audit=audit;this.events=events;this.clock=clock}
  async handleWebhook(ctx,channel,payload){
    const adapter=this.registry.get(channel);
    const normalized=adapter.normalizeWebhook(payload);
    const result=await this.inbox.ingestInbound(ctx,normalized);
    this.audit?.write(ctx,{action:'connector.webhook',entity:'Message',entityId:result.message?.id||normalized.externalMessageId,result:result.duplicate?'duplicate':'accepted',meta:{channel}});
    this.events?.emit(ctx,'connector.webhook.processed',{channel,duplicate:Boolean(result.duplicate),messageId:result.message?.id||null});
    return result;
  }
  async poll(ctx,channel,cursor=null){
    const adapter=this.registry.get(channel);
    if(!adapter.supports('messages.read'))throw new Error(`${channel}: polling unsupported`);
    const batch=await adapter.poll({ctx,cursor});
    const accepted=[];
    for(const raw of batch?.items||batch||[]) accepted.push(await this.handleWebhook(ctx,channel,raw));
    return {items:accepted,cursor:batch?.cursor??null};
  }
  async dispatchOutbox(ctx,{limit=50}={}){
    const due=await this.inbox.listDueOutbound(ctx,{now:this.clock(),limit});
    const results=[];
    for(const msg of due){
      const adapter=this.registry.get(msg.channel);
      try{
        const remote=await adapter.sendMessage({ctx,message:msg});
        results.push(await this.inbox.markSent(ctx,msg.id,{externalMessageId:remote?.externalMessageId||crypto.randomUUID(),sentAt:new Date(this.clock()).toISOString()}));
      }catch(error){
        results.push(await this.inbox.markFailed(ctx,msg.id,{error:String(error?.message||error),retryable:error?.retryable!==false,now:this.clock()}));
      }
    }
    return results;
  }
}

export function createDefaultAdapterRegistry(){
  const r=new AdapterRegistry();
  for(const name of ['eineiro_market','avito','vk','youla','drom','farpost','auto_ru','zzap']) r.register(new GenericChannelAdapter({name}));
  return r;
}
