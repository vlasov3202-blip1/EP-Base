import {authenticateRequest,getPlatformRuntimeForTests} from './http-api.mjs';
import {MarketingAutopilotService} from './marketing-autopilot.mjs';
import {MarketingPublisherRegistry,EineiroMarketMarketingPublisher} from './marketing-publishers.mjs';

function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
function canManage(ctx){if(!['owner','manager','admin'].includes(ctx.role))throw Object.assign(new Error('marketing access required'),{status:403,code:'FORBIDDEN'});}
async function service(ctx){const {store}=await getPlatformRuntimeForTests();const registry=new MarketingPublisherRegistry().register('eineiro_market',new EineiroMarketMarketingPublisher({repoFactory:c=>store.tenant(c)}));return new MarketingAutopilotService({repoFactory:c=>store.tenant(c),publisherRegistry:registry});}

export async function handleMarketingApi(req,res){
 const url=new URL(req.url,'http://local');if(!url.pathname.startsWith('/api/v1/marketing'))return false;
 try{
  const ctx=await authenticateRequest(req);canManage(ctx);const svc=await service(ctx);const {store}=await getPlatformRuntimeForTests();const repo=store.tenant(ctx);
  if(req.method==='GET'&&url.pathname==='/api/v1/marketing'){const [campaigns,creatives,tests,placements]=await Promise.all([repo.list('MarketingCampaign'),repo.list('MarketingCreative'),repo.list('MarketingTest'),repo.list('MarketplacePlacement')]);return json(res,200,{campaigns,creatives,tests,placements});}
  if(req.method==='POST'&&url.pathname==='/api/v1/marketing/campaigns')return json(res,201,{campaign:await svc.createCampaign(ctx,await body(req))});
  const gen=url.pathname.match(/^\/api\/v1\/marketing\/campaigns\/([^/]+)\/creatives$/);if(req.method==='POST'&&gen){const p=await body(req);return json(res,201,{creatives:await svc.generateCreatives(ctx,{campaignId:gen[1],count:p.count,brief:p.brief||{}})});}
  if(req.method==='POST'&&url.pathname==='/api/v1/marketing/tests')return json(res,201,{test:await svc.launchTest(ctx,await body(req))});
  const metrics=url.pathname.match(/^\/api\/v1\/marketing\/tests\/([^/]+)\/metrics$/);if(req.method==='POST'&&metrics){const p=await body(req);return json(res,200,{metrics:await svc.recordMetrics(ctx,{testId:metrics[1],...p})});}
  const optimize=url.pathname.match(/^\/api\/v1\/marketing\/tests\/([^/]+)\/optimize$/);if(req.method==='POST'&&optimize){const p=await body(req).catch(()=>({}));return json(res,200,await svc.optimize(ctx,{testId:optimize[1],autoApply:p.autoApply!==false}));}
  return json(res,404,{error:'not found'});
 }catch(e){return json(res,e.status||400,{error:e.message,code:e.code||'MARKETING_ERROR'});}
}
