import crypto from 'node:crypto';

const SUPPORTED_CHANNELS=new Set(['avito','vk','youla','drom','farpost','auto_ru','zzap','eineiro_market']);

function deriveKey(secret){
  if(!secret)throw new Error('EINEIRO_SECRET_KEY required');
  return crypto.createHash('sha256').update(String(secret)).digest();
}
function encryptJson(value,secret){
  const iv=crypto.randomBytes(12);const key=deriveKey(secret);const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);const tag=cipher.getAuthTag();
  return {alg:'aes-256-gcm',iv:iv.toString('base64'),tag:tag.toString('base64'),data:encrypted.toString('base64')};
}
function decryptJson(record,secret){
  const key=deriveKey(secret);const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(record.iv,'base64'));decipher.setAuthTag(Buffer.from(record.tag,'base64'));
  const plain=Buffer.concat([decipher.update(Buffer.from(record.data,'base64')),decipher.final()]).toString('utf8');return JSON.parse(plain);
}

export class ChannelConfigService{
  constructor(store,{secret=process.env.EINEIRO_SECRET_KEY}={}){this.store=store;this.secret=secret;}
  assertChannel(channel){if(!SUPPORTED_CHANNELS.has(channel))throw Object.assign(new Error('unsupported channel'),{status:400,code:'UNSUPPORTED_CHANNEL'});}
  async save(ctx,channel,{credentials={},settings={}}={}){
    this.assertChannel(channel);const repo=this.store.tenant(ctx);const existing=await repo.get('ChannelConnection',channel);
    const encrypted=channel==='eineiro_market'?null:encryptJson(credentials,this.secret);
    const rec={id:channel,channel,enabled:true,configured:true,credentials:encrypted,settings:structuredClone(settings),status:existing?.status||'not_checked',lastCheckedAt:existing?.lastCheckedAt||null,lastSuccessAt:existing?.lastSuccessAt||null,lastError:null,updatedBy:ctx.userId,updatedAt:new Date().toISOString()};
    await repo.put('ChannelConnection',rec);return this.publicState(rec);
  }
  async disable(ctx,channel){this.assertChannel(channel);const repo=this.store.tenant(ctx);const rec=await repo.get('ChannelConnection',channel);if(!rec)return false;rec.enabled=false;rec.status='disabled';rec.updatedBy=ctx.userId;await repo.put('ChannelConnection',rec);return true;}
  async credentials(ctx,channel){this.assertChannel(channel);if(channel==='eineiro_market')return{};const rec=await this.store.tenant(ctx).get('ChannelConnection',channel);if(!rec?.credentials)throw Object.assign(new Error('channel not configured'),{code:'CHANNEL_NOT_CONFIGURED',status:409});return decryptJson(rec.credentials,this.secret);}
  async markCheck(ctx,channel,{ok,error=null}={}){this.assertChannel(channel);const repo=this.store.tenant(ctx);const rec=await repo.get('ChannelConnection',channel);if(!rec)throw Object.assign(new Error('channel not configured'),{status:409,code:'CHANNEL_NOT_CONFIGURED'});const now=new Date().toISOString();rec.lastCheckedAt=now;rec.status=ok?'connected':'error';rec.lastError=ok?null:String(error||'connection failed');if(ok)rec.lastSuccessAt=now;await repo.put('ChannelConnection',rec);return this.publicState(rec);}
  async list(ctx){const items=await this.store.tenant(ctx).list('ChannelConnection');const by=new Map(items.map(x=>[x.channel,x]));return [...SUPPORTED_CHANNELS].map(channel=>this.publicState(by.get(channel)||{id:channel,channel,enabled:channel==='eineiro_market',configured:channel==='eineiro_market',status:channel==='eineiro_market'?'connected':'not_configured',lastCheckedAt:null,lastSuccessAt:null,lastError:null}));}
  async get(ctx,channel){this.assertChannel(channel);const rec=await this.store.tenant(ctx).get('ChannelConnection',channel);return this.publicState(rec||{id:channel,channel,enabled:false,configured:false,status:'not_configured'});}
  publicState(rec){const {credentials,...safe}=rec;return structuredClone(safe);}
}

export {encryptJson,decryptJson,SUPPORTED_CHANNELS};
