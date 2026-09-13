import {JsonFileStore} from './storage.mjs';
import {AuthService} from './auth.mjs';
import {assertCan} from './core.mjs';
import path from 'node:path';

const DATA_FILE=process.env.EINEIRO_DATA_FILE||path.join(process.cwd(),'data','eineiro.json');
let runtimePromise;
async function runtime(){
  if(!runtimePromise)runtimePromise=(async()=>{const store=await new JsonFileStore(DATA_FILE).init();return{store,auth:new AuthService(store)}})();
  return runtimePromise;
}
function json(res,status,payload,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(payload));}
async function body(req,{maxBytes=1_000_000}={}){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>maxBytes)throw Object.assign(new Error('payload too large'),{status:413});chunks.push(c)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
function bearer(req){const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')?h.slice(7).trim():null}
export async function authenticateRequest(req){const {auth}=await runtime();const token=bearer(req);if(!token)throw Object.assign(new Error('authorization required'),{status:401,code:'AUTH_REQUIRED'});return auth.authenticate(token)}
async function requirePermission(req,permission){const ctx=await authenticateRequest(req);assertCan(ctx,permission);return ctx}

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
    try{const ctx=await authenticateRequest(req);return json(res,200,{user:ctx.user,companyId:ctx.companyId,role:ctx.role});}catch(e){return json(res,e.status||401,{error:e.message,code:e.code||'AUTH_REQUIRED'})}
  }
  const m=url.pathname.match(/^\/api\/v1\/(products|orders|tasks|messages|events|audit)$/);
  if(m){
    const entityMap={products:'Product',orders:'Order',tasks:'Task',messages:'Message',events:'Event',audit:'AuditEntry'};
    const permissionMap={products:'inventory.read',orders:'orders.read',tasks:'tasks.read',messages:'inbox.read',events:'analytics.read',audit:'analytics.read'};
    try{
      const ctx=await requirePermission(req,permissionMap[m[1]]);const {store}=await runtime();
      if(m[1]==='events')return json(res,200,{items:store.listEvents(ctx.companyId)});
      if(m[1]==='audit')return json(res,200,{items:store.listAudit(ctx.companyId)});
      const repo=store.tenant(ctx);if(req.method==='GET')return json(res,200,{items:repo.list(entityMap[m[1]])});
      if(req.method==='POST'){
        const writePerm={products:'inventory.write',orders:'orders.pack',tasks:'tasks.write',messages:'inbox.write'}[m[1]];
        if(!writePerm)return json(res,405,{error:'method not allowed'});assertCan(ctx,writePerm);const p=await body(req);if(!p.id)throw Object.assign(new Error('id required'),{status:400});const item=await repo.put(entityMap[m[1]],p);return json(res,201,{item});
      }
    }catch(e){const status=e.code==='FORBIDDEN'?403:e.status||401;return json(res,status,{error:e.message,code:e.code||'API_ERROR'})}
  }
  return false;
}

export async function getPlatformRuntimeForTests(){return runtime();}
