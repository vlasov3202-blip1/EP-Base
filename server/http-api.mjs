import {JsonFileStore} from './storage.mjs';
import {AuthService} from './auth.mjs';
import {assertCan} from './core.mjs';
import {ApiKeyService} from './api-keys.mjs';
import {ImportService} from './importer.mjs';
import path from 'node:path';

const DATA_FILE=process.env.EINEIRO_DATA_FILE||path.join(process.cwd(),'data','eineiro.json');
let runtimePromise;
async function runtime(){
  if(!runtimePromise)runtimePromise=(async()=>{const store=await new JsonFileStore(DATA_FILE).init();const auth=new AuthService(store);const apiKeys=new ApiKeyService(store);const importer=new ImportService({repoFactory:ctx=>store.tenant(ctx)});return{store,auth,apiKeys,importer}})();
  return runtimePromise;
}
function json(res,status,payload,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(status===204?'':JSON.stringify(payload));}
async function body(req,{maxBytes=1_000_000}={}){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>maxBytes)throw Object.assign(new Error('payload too large'),{status:413});chunks.push(c)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
function bearer(req){const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')?h.slice(7).trim():null}
function apiKey(req){return String(req.headers['x-api-key']||'').trim()||null}
export async function authenticateRequest(req){const {auth,apiKeys}=await runtime();const key=apiKey(req);if(key)return apiKeys.authenticate(key);const token=bearer(req);if(!token)throw Object.assign(new Error('authorization required'),{status:401,code:'AUTH_REQUIRED'});return auth.authenticate(token)}
function scopeFor(resource,method){const base={products:'products',orders:'orders',tasks:'tasks',messages:'messages',events:'events',audit:'audit'}[resource];return `${base}:${method==='GET'?'read':'write'}`}
async function authorize(req,{permission=null,scope=null}={}){const ctx=await authenticateRequest(req);if(ctx.role==='api'){const {apiKeys}=await runtime();apiKeys.requireScope(ctx,scope);return ctx}if(permission)assertCan(ctx,permission);return ctx}

export async function handlePlatformApi(req,res){
  const url=new URL(req.url,'http://local');
  if(req.method==='POST'&&url.pathname==='/api/auth/register'){
    try{const {auth}=await runtime();const p=await body(req);const user=await auth.register(p);return json(res,201,{user});}catch(e){return json(res,e.status||400,{error:e.message,code:e.code||'REGISTER_ERROR'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/login'){
    try{const {auth}=await runtime();const p=await body(req);const out=await auth.login(p);return json(res,200,out);}catch(e){return json(res,e.status||401,{error:e.message,code:e.code||'LOGIN_ERROR'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/auth/logout'){
    try{const {auth}=await runtime();const token=bearer(req);if(token)await auth.logout(token);return json(res,204,{});}catch(e){return json(res,500,{error:e.message})}
  }
  if(req.method==='GET'&&url.pathname==='/api/me'){
    try{const ctx=await authenticateRequest(req);return json(res,200,{companyId:ctx.companyId,role:ctx.role,user:ctx.user||null,apiKeyId:ctx.apiKeyId||null,scopes:ctx.scopes||null,rateLimit:ctx.rateLimit||null});}catch(e){return json(res,e.status||401,{error:e.message,code:e.code||'AUTH_REQUIRED'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/v1/api-keys'){
    try{const ctx=await authorize(req,{permission:'*'});if(ctx.role!=='owner'&&ctx.role!=='admin')throw Object.assign(new Error('owner/admin required'),{status:403,code:'FORBIDDEN'});const p=await body(req);const {apiKeys}=await runtime();return json(res,201,{apiKey:await apiKeys.create(ctx,p)});}catch(e){return json(res,e.status||403,{error:e.message,code:e.code||'API_KEY_ERROR'})}
  }
  const keyRevoke=url.pathname.match(/^\/api\/v1\/api-keys\/([^/]+)$/);
  if(req.method==='DELETE'&&keyRevoke){
    try{const ctx=await authorize(req,{permission:'*'});if(ctx.role!=='owner'&&ctx.role!=='admin')throw Object.assign(new Error('owner/admin required'),{status:403,code:'FORBIDDEN'});const {apiKeys}=await runtime();const ok=await apiKeys.revoke(ctx,keyRevoke[1]);return json(res,ok?204:404,ok?{}:{error:'not found'});}catch(e){return json(res,e.status||403,{error:e.message,code:e.code||'API_KEY_ERROR'})}
  }
  if(req.method==='POST'&&url.pathname==='/api/v1/import/products'){
    try{const ctx=await authorize(req,{permission:'inventory.write',scope:'products:write'});const p=await body(req,{maxBytes:8_000_000});const {importer}=await runtime();const result=await importer.importProducts(ctx,p);return json(res,200,result);}catch(e){return json(res,e.status||400,{error:e.message,code:e.code||'IMPORT_ERROR'})}
  }
  const m=url.pathname.match(/^\/api\/v1\/(products|orders|tasks|messages|events|audit)$/);
  if(m){
    const entityMap={products:'Product',orders:'Order',tasks:'Task',messages:'Message',events:'Event',audit:'AuditEntry'};
    const permissionMap={products:'inventory.read',orders:'orders.read',tasks:'tasks.read',messages:'inbox.read',events:'analytics.read',audit:'analytics.read'};
    try{
      const writePerm={products:'inventory.write',orders:'orders.pack',tasks:'tasks.write',messages:'inbox.write'}[m[1]];
      const ctx=await authorize(req,{permission:req.method==='GET'?permissionMap[m[1]]:writePerm,scope:scopeFor(m[1],req.method)});const {store}=await runtime();
      if(m[1]==='events')return json(res,200,{items:store.listEvents(ctx.companyId)});
      if(m[1]==='audit')return json(res,200,{items:store.listAudit(ctx.companyId)});
      const repo=store.tenant(ctx);if(req.method==='GET')return json(res,200,{items:repo.list(entityMap[m[1]])});
      if(req.method==='POST'){
        if(!writePerm)return json(res,405,{error:'method not allowed'});const p=await body(req);if(!p.id)throw Object.assign(new Error('id required'),{status:400});const item=await repo.put(entityMap[m[1]],p);return json(res,201,{item});
      }
    }catch(e){const status=e.code==='FORBIDDEN'||e.code==='SCOPE_FORBIDDEN'?403:e.status||401;return json(res,status,{error:e.message,code:e.code||'API_ERROR',retryAfterMs:e.retryAfterMs||undefined})}
  }
  return false;
}

export async function getPlatformRuntimeForTests(){return runtime();}
