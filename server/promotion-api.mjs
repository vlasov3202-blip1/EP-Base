import {authenticateRequest,getPlatformRuntimeForTests} from './http-api.mjs';
import {ProductPromotionScoreService} from './product-promotion-score.mjs';

function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}
function canManage(ctx){if(!['owner','manager','admin'].includes(ctx.role))throw Object.assign(new Error('promotion access required'),{status:403,code:'FORBIDDEN'});}
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}

export async function handlePromotionApi(req,res){
 const url=new URL(req.url,'http://local');if(!url.pathname.startsWith('/api/v1/promotion'))return false;
 try{
  const ctx=await authenticateRequest(req);const {store}=await getPlatformRuntimeForTests();const svc=new ProductPromotionScoreService({repoFactory:c=>store.tenant(c)});const repo=store.tenant(ctx);
  const score=url.pathname.match(/^\/api\/v1\/promotion\/products\/([^/]+)\/score$/);if(req.method==='GET'&&score)return json(res,200,{score:await svc.evaluate(ctx,decodeURIComponent(score[1]))});
  const metrics=url.pathname.match(/^\/api\/v1\/promotion\/products\/([^/]+)\/metrics$/);if(req.method==='POST'&&metrics){canManage(ctx);return json(res,200,{metrics:await svc.recordMetrics(ctx,decodeURIComponent(metrics[1]),await body(req))});}
  const rec=url.pathname.match(/^\/api\/v1\/promotion\/products\/([^/]+)\/recommend$/);if(req.method==='POST'&&rec){canManage(ctx);const p=await body(req).catch(()=>({}));return json(res,200,{recommendation:await svc.recommendExternalChannels(ctx,decodeURIComponent(rec[1]),{candidateChannels:p.channels||[]})});}
  if(req.method==='GET'&&url.pathname==='/api/v1/promotion/recommendations')return json(res,200,{items:await repo.list('PromotionRecommendation'),scores:await repo.list('ProductPromotionScore')});
  return json(res,404,{error:'not found'});
 }catch(e){return json(res,e.status||400,{error:e.message,code:e.code||'PROMOTION_ERROR'});}
}
