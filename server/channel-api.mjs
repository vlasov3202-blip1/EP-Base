import {authenticateRequest,getPlatformRuntimeForTests} from './http-api.mjs';
import {ChannelConfigService} from './channel-config.mjs';
import {checkChannelConnection} from './live-channels.mjs';

function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(status===204?'':JSON.stringify(payload));}
async function body(req,{maxBytes=500_000}={}){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>maxBytes)throw Object.assign(new Error('payload too large'),{status:413});chunks.push(c)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
function ownerOnly(ctx){if(ctx.role!=='owner'&&ctx.role!=='admin')throw Object.assign(new Error('owner/admin required'),{status:403,code:'FORBIDDEN'});}

export async function handleChannelApi(req,res){
  const url=new URL(req.url,'http://local');
  if(!url.pathname.startsWith('/api/v1/channels'))return false;
  try{
    const ctx=await authenticateRequest(req);const {store}=await getPlatformRuntimeForTests();const service=new ChannelConfigService(store);
    if(req.method==='GET'&&url.pathname==='/api/v1/channels')return json(res,200,{items:await service.list(ctx)});
    const check=url.pathname.match(/^\/api\/v1\/channels\/([^/]+)\/check$/);
    if(check&&req.method==='POST'){
      ownerOnly(ctx);
      const result=await checkChannelConnection({ctx,channel:check[1],store,configService:service});
      return json(res,200,result);
    }
    const m=url.pathname.match(/^\/api\/v1\/channels\/([^/]+)$/);if(!m)return json(res,404,{error:'not found'});
    if(req.method==='GET')return json(res,200,{item:await service.get(ctx,m[1])});
    ownerOnly(ctx);
    if(req.method==='PUT'){const p=await body(req);return json(res,200,{item:await service.save(ctx,m[1],p)});}
    if(req.method==='DELETE'){const ok=await service.disable(ctx,m[1]);return json(res,ok?204:404,ok?{}:{error:'not found'});}
    return json(res,405,{error:'method not allowed'});
  }catch(e){return json(res,e.status||400,{error:e.message,code:e.code||'CHANNEL_ERROR'});}
}
