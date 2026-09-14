import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tenantKey} from './core.mjs';

export const CURRENT_SCHEMA_VERSION=2;
export const migrations=[{version:1,up(db){db.meta={...(db.meta||{}),schemaVersion:1,createdAt:db.meta?.createdAt||new Date().toISOString()};db.records=db.records||{};return db;}},{version:2,up(db){db.meta.schemaVersion=2;db.sessions=db.sessions||{};db.users=db.users||{};db.audit=db.audit||[];db.events=db.events||[];return db;}}];
export function migrateDatabase(input={}){let db=structuredClone(input||{});const from=Number(db.meta?.schemaVersion||0);for(const migration of migrations.filter(m=>m.version>from).sort((a,b)=>a.version-b.version))db=migration.up(db);return db;}

export class JsonFileStore{
  constructor(filePath){this.filePath=filePath;this.db=null;this.writeQueue=Promise.resolve();}
  async init(){await mkdir(path.dirname(this.filePath),{recursive:true});try{this.db=migrateDatabase(JSON.parse(await readFile(this.filePath,'utf8')));}catch(err){if(err.code!=='ENOENT')throw err;this.db=migrateDatabase({});}await this.flush();return this;}
  async flush(){const snapshot=JSON.stringify(this.db,null,2);const tmp=`${this.filePath}.tmp`;this.writeQueue=this.writeQueue.then(async()=>{await writeFile(tmp,snapshot,{mode:0o600});await rename(tmp,this.filePath);});await this.writeQueue;}
  tenant(ctx){if(!ctx?.companyId)throw new Error('companyId required');return new DurableTenantRepository(this,ctx.companyId);}
  async putUser(user){if(!user?.id||!user?.companyId)throw new Error('user id/companyId required');this.db.users[`${user.companyId}:${user.id}`]=structuredClone(user);await this.flush();return structuredClone(user);}
  getUser(companyId,userId){const user=this.db.users[`${companyId}:${userId}`];return user?structuredClone(user):null;}
  findUserByEmail(companyId,email){const normalized=String(email).trim().toLowerCase();const user=Object.values(this.db.users).find(u=>u.companyId===companyId&&u.email===normalized);return user?structuredClone(user):null;}
  async putSession(session){this.db.sessions[session.id]=structuredClone(session);await this.flush();return structuredClone(session);}
  getSession(id){const s=this.db.sessions[id];return s?structuredClone(s):null;}
  async removeSession(id){delete this.db.sessions[id];await this.flush();}
  async appendAudit(event){this.db.audit.push(structuredClone(event));await this.flush();}
  listAudit(companyId){return this.db.audit.filter(x=>x.companyId===companyId).map(value=>structuredClone(value));}
  async appendEvent(event){this.db.events.push(structuredClone(event));await this.flush();}
  listEvents(companyId){return this.db.events.filter(x=>x.companyId===companyId).map(value=>structuredClone(value));}
  listAllApiKeys(){return Object.values(this.db.records||{}).filter(x=>x&&x.hash&&x.companyId&&x.id).map(value=>structuredClone(value));}
  listCompanyIds(){const ids=new Set();for(const u of Object.values(this.db.users||{}))if(u?.companyId)ids.add(u.companyId);for(const r of Object.values(this.db.records||{}))if(r?.companyId)ids.add(r.companyId);return [...ids].sort();}
  exportCompany(companyId){const prefix=companyId+':';const records=Object.entries(this.db.records||{}).filter(([key,value])=>key.startsWith(prefix)&&value?.companyId===companyId).map(([key,value])=>{const suffix=key.slice(prefix.length);const split=suffix.indexOf(':');return{...structuredClone(value),__entity:split>=0?suffix.slice(0,split):null,__recordId:split>=0?suffix.slice(split+1):value.id}});const users=Object.values(this.db.users||{}).filter(x=>x?.companyId===companyId).map(value=>structuredClone(value));return {companyId,users,records,audit:this.listAudit(companyId),events:this.listEvents(companyId),exportedAt:new Date().toISOString()};}
}

export class DurableTenantRepository{
  constructor(store,companyId){this.store=store;this.companyId=companyId;}
  async put(entity,record){if(!record?.id)throw new Error('record.id required');const key=tenantKey(this.companyId,entity,record.id);const value={...structuredClone(record),companyId:this.companyId,updatedAt:new Date().toISOString()};this.store.db.records[key]=value;await this.store.flush();return structuredClone(value);}
  get(entity,id){const value=this.store.db.records[tenantKey(this.companyId,entity,id)];return value?structuredClone(value):null;}
  list(entity){const prefix=`${this.companyId}:${entity}:`;return Object.entries(this.store.db.records).filter(([k])=>k.startsWith(prefix)).map(([,v])=>structuredClone(v));}
  async remove(entity,id){delete this.store.db.records[tenantKey(this.companyId,entity,id)];await this.store.flush();}
}


// Compatibility facade for services that still receive a context-aware repository.
// New code should prefer store.tenant(ctx) and DurableTenantRepository directly.
export class DurableStore extends JsonFileStore{}

export class DurableRepository{
  constructor(store){if(!store)throw new Error('store required');this.store=store;}
  put(ctx,entity,record){return this.store.tenant(ctx).put(entity,record);}
  get(ctx,entity,id){return this.store.tenant(ctx).get(entity,id);}
  list(ctx,entity){return this.store.tenant(ctx).list(entity);}
  remove(ctx,entity,id){return this.store.tenant(ctx).remove(entity,id);}
}
