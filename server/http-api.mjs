import {AuthService} from './auth.mjs';
import {assertCan} from './core.mjs';
import {ApiKeyService} from './api-keys.mjs';
import {ImportService} from './importer.mjs';
import {createInfrastructure} from './infra.mjs';
import {CompanyBackupService} from './company-backup.mjs';
import {createDataStore} from './database.mjs';
import path from 'node:path';

const DATA_FILE=process.env.EINEIRO_DATA_FILE||path.join(process.cwd(),'data','eineiro.json');
const BACKUP_DIR=process.env.EINEIRO_BACKUP_DIR||path.join(process.cwd(),'backups');
let runtimePromise;
async function runtime(){
  if(!runtimePromise)runtimePromise=(async()=>{
    const store=await createDataStore();
    const auth=new AuthService(store);
    const apiKeys=new ApiKeyService(store);
    const importer=new ImportService({repoFactory:ctx=>store.tenant(ctx)});
    const usesPostgres=Boolean(process.env.DATABASE_URL);
    const infra=createInfrastructure({dataFile:usesPostgres?null:DATA_FILE,backupDir:BACKUP_DIR});
    const companyBackups=new CompanyBackupService({store,backupDir:path.join(BACKUP_DIR,'companies')});
    infra.health.register('storage',async()=>{
      if(usesPostgres){await store.pool.query('SELECT 1');return{status:'ok',type:'postgresql'};}
      return{status:store.db?'ok':'down',type:'file',schemaVersion:store.db?.meta?.schemaVersion||null};
    });
    if(infra.backups)infra.queue.register('backup.platform',async()=>infra.backups.create({scope:'platform'}));
    infra.queue.register('backup.company',async job=>companyBackups.create(job.payload.companyId));
    return{store,auth,apiKeys,importer,infra,companyBackups,usesPostgres};
  })();
  return runtimePromise;
}
function json(res,status,payload,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(status===204?'':JSON.stringify(payload));}
async function body(req,{maxBytes=1_000_000}={}){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>maxBytes)throw Object.assign(new Error('payload too large'),{status:413});chunks.push(c)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
function bearer(req){const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')?h.slice(7).trim():null}
function apiKey(req){return String(req.headers['x-api-key']||'').trim()||null}
export async function authenticateRequest(req){const {auth,apiKeys}=await runtime();const key=apiKey(req);if(key)return apiKeys.authenticate(key);const token=bearer(req);if(!token)throw Object.assign(new Error('authorization required'),{status:401,code:'AUTH_REQUIRED'});return auth.authenticate(token)}
function scopeFor(resource,method){const base={products:'products',orders:'orders',tasks:'tasks',messages:'messages',events:'events',audit:'audit'}[resource];return `${base}:${method==='GET'?'read':'write'}`}
async function authorize(req,{permission=null,scope=null}={}){const ctx=await authenticateRequest(req);if(ctx.role==='api'){const {apiKeys}=await runtime();apiKeys.requireScope(ctx,scope);return ctx}if(permission)assertCan(ctx,permission);return ctx}
function adminOnly(ctx){if(ctx.role!=='owner'&&ctx.role!=='admin')throw Object.assign(new Error('owner/admin required'),{status:403,code:'FORBIDDEN'});}
function platformAdminOnly(ctx){if(ctx.role!=='admin')throw Object.assign(new Error('platform admin required'),{status:403,code:'FORBIDDEN'});}

export async function handlePlatformApi(req,res){
  const url=new URL(req.url,'http://local');
  const rt=await runtime();
  const started=Date.now();
  rt.infra.metrics.inc('http.requests',1,{method:req.method||'GET',route:url.pathname});
  const finish=(status,payload,headers={})=>{rt.infra.metrics.observe('http.latency_ms',Date.now()-started,{route:url.pathname});if(status>=500)rt.infra.metrics.inc('http.errors',1,{route:url.pathname});return json(res,status,payload,headers)};

  if(req.method==='GET'&&url.pathname==='/health')return finish(200,await rt.infra.health.check());
  if(req.method==='GET'&&url.pathname==='/metrics'){
    try{const ctx=await authorize(req,{permission:'platform.*',scope:'platform:read'});platformAdminOnly(ctx);return finish(200,{metrics:rt.infra.metrics.snapshot(),queue:rt.infra.queue.stats()});}catch(e){return finish(e.status||403,{error:e.message,code:e.code||'METRICS_FORBIDDEN'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/register'){
    try{const p=await body(req);const user=await rt.auth.registerPublic(p);return finish(201,{user});}catch(e){return finish(e.status||400,{error:e.message,code:e.code||'REGISTER_ERROR'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/v1/auth/invitations'){
    try{const ctx=await authenticateRequest(req);adminOnly(ctx);const p=await body(req);const invite=await rt.auth.createInvite(ctx,p);return finish(201,invite);}catch(e){return finish(e.status||403,{error:e.message,code:e.code||'INVITE_ERROR'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/login'){
    try{const p=await body(req);const out=await rt.auth.login(p);return finish(200,out);}catch(e){return finish(e.status||401,{error:e.message,code:e.code||'LOGIN_ERROR'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/logout'){
    try{const token=bearer(req);if(token)await rt.auth.logout(token);return finish(204,{});}catch(e){return finish(500,{error:e.message})}
  }
  if(req.method==='GET'&&url.pathname==='/api/me'){
    try{const ctx=await authenticateRequest(req);return finish(200,{companyId:ctx.companyId,role:ctx.role,user:ctx.user||null,apiKeyId:ctx.apiKeyId||null,scopes:ctx.scopes||null,rateLimit:ctx.rateLimit||null});}catch(e){return finish(e.status||401,{error:e.message,code:e.code||'AUTH_REQUIRED'})}
  }
  if(req.method==='GET'&&url.pathname==='/api/v1/platform/queue'){
    try{const ctx=await authorize(req,{permission:'platform.*',scope:'platform:read'});platformAdminOnly(ctx);return finish(200,{stats:rt.infra.queue.stats(),items:rt.infra.queue.list(ctx)});}catch(e){return finish(e.status||403,{error:e.message,code:e.code||'QUEUE_FORBIDDEN'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/v1/platform/queue/run'){
    try{const ctx=await authorize(req,{permission:'platform.*',scope:'platform:write'});platformAdminOnly(ctx);const p=await body(req).catch(()=>({}));const items=await rt.infra.queue.work({limit:Math.max(1,Math.min(Number(p.limit)||10,100))});return finish(200,{items,stats:rt.infra.queue.stats()});}catch(e){return finish(e.status||403,{error:e.message,code:e.code||'QUEUE_FORBIDDEN'})}
  }
  if(req.method==='GET'&&url.pathname==='/api/v1/platform/backups'){
    try{const ctx=await authorize(req,{permission:'platform.*',scope:'platform:read'});platformAdminOnly(ctx);if(!rt.infra.backups)return finish(501,{error:'Для PostgreSQL platform backup выполняется на уровне инфраструктуры',code:'POSTGRES_BACKUP_EXTERNAL'});return finish(200,{items:await rt.infra.backups.list()});}catch(e){return finish(e.status||403,{error:e.message,code:e.code||'BACKUP_FORBIDDEN'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/v1/platform/backups'){
    try{const ctx=await authorize(req,{permission:'platform.*',scope:'platform:write'});platformAdminOnly(ctx);const p=await body(req).catch(()=>({}));if(p.scope==='company'){if(!p.companyId)throw Object.assign(new Error('companyId required'),{status:400});const job=rt.infra.queue.enqueue(ctx,'backup.company',{companyId:p.companyId});return finish(202,{job});}if(!rt.infra.backups)return finish(501,{error:'Для PostgreSQL platform backup выполняется на уровне инфраструктуры',code:'POSTGRES_BACKUP_EXTERNAL'});const job=rt.infra.queue.enqueue(ctx,'backup.platform',{});return finish(202,{job});}catch(e){return finish(e.status||403,{error:e.message,code:e.code||'BACKUP_FORBIDDEN'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/v1/platform/backups/restore'){
    try{const ctx=await authorize(req,{permission:'platform.*',scope:'platform:write'});platformAdminOnly(ctx);if(!rt.infra.backups)return finish(501,{error:'Для PostgreSQL platform restore выполняется на уровне инфраструктуры',code:'POSTGRES_BACKUP_EXTERNAL'});const p=await body(req);if(!p.file)throw Object.assign(new Error('file required'),{status:400});const result=await rt.infra.backups.restore(p.file);return finish(200,result);}catch(e){return finish(e.status||403,{error:e.message,code:e.code||'RESTORE_ERROR'})}
  }
  if(req.method==='GET'&&url.pathname==='/api/v1/company/backups'){
    try{const ctx=await authenticateRequest(req);adminOnly(ctx);return finish(200,{items:await rt.companyBackups.list(ctx.companyId)});}catch(e){return finish(e.status||403,{error:e.message,code:e.code||'COMPANY_BACKUP_FORBIDDEN'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/v1/company/backups'){
    try{const ctx=await authenticateRequest(req);adminOnly(ctx);return finish(201,{backup:await rt.companyBackups.create(ctx.companyId)});}catch(e){return finish(e.status||403,{error:e.message,code:e.code||'COMPANY_BACKUP_ERROR'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/v1/api-keys'){
    try{const ctx=await authorize(req,{permission:'*'});adminOnly(ctx);const p=await body(req);return finish(201,{apiKey:await rt.apiKeys.create(ctx,p)});}catch(e){return finish(e.status||403,{error:e.message,code:e.code||'API_KEY_ERROR'})}
  }
  const keyRevoke=url.pathname.match(/^\/api\/v1\/api-keys\/([^/]+)$/);
  if(req.method==='DELETE'&&keyRevoke){
    try{const ctx=await authorize(req,{permission:'*'});adminOnly(ctx);const ok=await rt.apiKeys.revoke(ctx,keyRevoke[1]);return finish(ok?204:404,ok?{}:{error:'not found'});}catch(e){return finish(e.status||403,{error:e.message,code:e.code||'API_KEY_ERROR'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/v1/import/products'){
    try{const ctx=await authorize(req,{permission:'inventory.write',scope:'products:write'});const p=await body(req,{maxBytes:8_000_000});const result=await rt.importer.importProducts(ctx,p);return finish(200,result);}catch(e){return finish(e.status||400,{error:e.message,code:e.code||'IMPORT_ERROR'})}
  }
  const m=url.pathname.match(/^\/api\/v1\/(products|orders|tasks|messages|events|audit)$/);
  if(m){
    const entityMap={products:'Product',orders:'Order',tasks:'Task',messages:'Message',events:'Event',audit:'AuditEntry'};
    const permissionMap={products:'inventory.read',orders:'orders.read',tasks:'tasks.read',messages:'inbox.read',events:'analytics.read',audit:'analytics.read'};
    try{
      const writePerm={products:'inventory.write',orders:'orders.pack',tasks:'tasks.write',messages:'inbox.write'}[m[1]];
      const ctx=await authorize(req,{permission:req.method==='GET'?permissionMap[m[1]]:writePerm,scope:scopeFor(m[1],req.method)});
      if(m[1]==='events')return finish(200,{items:await rt.store.listEvents(ctx.companyId)});
      if(m[1]==='audit')return finish(200,{items:await rt.store.listAudit(ctx.companyId)});
      const repo=rt.store.tenant(ctx);if(req.method==='GET')return finish(200,{items:await repo.list(entityMap[m[1]])});
      if(req.method==='POST'){
        if(!writePerm)return finish(405,{error:'method not allowed'});const p=await body(req);if(!p.id)throw Object.assign(new Error('id required'),{status:400});const item=await repo.put(entityMap[m[1]],p);return finish(201,{item});
      }
    }catch(e){const status=e.code==='FORBIDDEN'||e.code==='SCOPE_FORBIDDEN'?403:e.status||401;return finish(status,{error:e.message,code:e.code||'API_ERROR',retryAfterMs:e.retryAfterMs||undefined})}
  }
  return false;
}

export async function getPlatformRuntimeForTests(){return runtime();}
