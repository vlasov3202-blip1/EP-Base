import {authenticateRequest,getPlatformRuntimeForTests} from './http-api.mjs';
import {readJsonBody} from './http-security.mjs';
import {MarketingAutopilotService} from './marketing-autopilot.mjs';
import {MarketingPublisherRegistry,EineiroMarketMarketingPublisher} from './marketing-publishers.mjs';
import {CreativeFactory,createRuleBasedCopyGenerator} from './creative-factory.mjs';
import {PolicyEngine} from './policy-engine.mjs';
import {FinanceGuardService} from './finance-guard.mjs';
import {createSilentRunConnectorRegistry} from './marketing-connector-sdk.mjs';
import {PlatformAcquisitionService,silentRunMarketingFlags} from './platform-acquisition.mjs';

function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}
const body=req=>readJsonBody(req,{maxBytes:500_000});
function canManage(ctx){if(!['owner','manager','admin'].includes(ctx.role))throw Object.assign(new Error('marketing access required'),{status:403,code:'FORBIDDEN'});}
function platformAdmin(ctx){if(ctx.role!=='admin')throw Object.assign(new Error('platform admin required'),{status:403,code:'FORBIDDEN'});}
function rootOwner(ctx){platformAdmin(ctx);const id=String(process.env.EINEIRO_ROOT_OWNER_USER_ID||'');if(!id)throw Object.assign(new Error('root owner is not configured'),{status:503,code:'ROOT_OWNER_NOT_CONFIGURED'});if(ctx.userId!==id)throw Object.assign(new Error('root owner required'),{status:403,code:'ROOT_OWNER_REQUIRED'});const at=Date.parse(ctx.reauthenticatedAt||'');const ttl=Number(process.env.EINEIRO_REAUTH_TTL_MS||600_000);if(!Number.isFinite(at)||Date.now()-at>ttl)throw Object.assign(new Error('recent re-authentication required'),{status:428,code:'REAUTH_REQUIRED'});}
function enabled(name,fallback=false){const value=process.env[name];if(value==null||value==='')return fallback;return ['1','true','yes','on'].includes(String(value).toLowerCase());}
function sellerWritesEnabled(){if(!enabled('SELLER_CAMPAIGNS_ENABLED',false))throw Object.assign(new Error('seller marketing disabled for Silent Run'),{status:503,code:'SELLER_CAMPAIGNS_DISABLED'});}
async function service(ctx){
  const {store}=await getPlatformRuntimeForTests();
  const registry=new MarketingPublisherRegistry().register('eineiro_market',new EineiroMarketMarketingPublisher({repoFactory:c=>store.tenant(c)}));
  const factory=new CreativeFactory({copyGenerator:createRuleBasedCopyGenerator()});
  const creativeGenerator=async({campaign,brief,index})=>{const productId=campaign.products?.[0];const product=productId?await store.tenant(ctx).get('Product',productId):null;const made=await factory.create({campaign,product,audience:campaign.audience,angle:brief?.angle||null,format:brief?.format||'image',channel:brief?.channel||campaign.channels?.[0]||'eineiro_market',constraints:{index,...brief}});return{headline:made.headline,text:made.text,visualPrompt:made.visualPrompt,assetUrl:made.assetUrl,format:made.format,renderStatus:made.renderStatus,cta:made.cta};};
  return new MarketingAutopilotService({repoFactory:c=>store.tenant(c),publisherRegistry:registry,creativeGenerator,sponsoredShowcaseEnabled:enabled('SPONSORED_SHOWCASE_ENABLED',false)});
}
async function acquisitionService(){const {store}=await getPlatformRuntimeForTests();const repoFactory=c=>store.tenant(c);const registry=createSilentRunConnectorRegistry({yandexCredentialRef:process.env.YANDEX_DIRECT_CREDENTIAL_REF||null,vkCredentialRef:process.env.VK_ADS_CREDENTIAL_REF||null});return new PlatformAcquisitionService({repoFactory,connectorRegistry:registry,policyEngine:new PolicyEngine({repoFactory}),financeGuard:new FinanceGuardService({repoFactory}),flags:silentRunMarketingFlags()});}

export async function handleMarketingApi(req,res){
 const url=new URL(req.url,'http://local');if(!url.pathname.startsWith('/api/v1/marketing')&&!url.pathname.startsWith('/api/v1/platform-acquisition'))return false;
 try{
  const ctx=await authenticateRequest(req);
  if(url.pathname.startsWith('/api/v1/platform-acquisition')){
    platformAdmin(ctx);const svc=await acquisitionService();
    if(req.method==='GET'&&url.pathname==='/api/v1/platform-acquisition')return json(res,200,await svc.status(ctx));
    if(req.method==='GET'&&url.pathname==='/api/v1/platform-acquisition/report/daily')return json(res,200,await svc.dailyReport(ctx));
    rootOwner(ctx);
    if(req.method==='POST'&&url.pathname==='/api/v1/platform-acquisition/campaigns')return json(res,201,{campaign:await svc.createCampaign(ctx,await body(req))});
    const launch=url.pathname.match(/^\/api\/v1\/platform-acquisition\/campaigns\/([^/]+)\/launch$/);if(req.method==='POST'&&launch)return json(res,200,{campaign:await svc.launch(ctx,{campaignId:launch[1],...(await body(req).catch(()=>({})))})});
    if(req.method==='POST'&&url.pathname==='/api/v1/platform-acquisition/exceptions')return json(res,201,{exception:await svc.approveException(ctx,await body(req))});
    if(req.method==='POST'&&url.pathname==='/api/v1/platform-acquisition/kill-switch')return json(res,200,{control:await svc.setKillSwitch(ctx,await body(req))});
    if(req.method==='POST'&&url.pathname==='/api/v1/platform-acquisition/attribution')return json(res,202,{event:await svc.recordAttribution(ctx,await body(req))});
    if(req.method==='POST'&&url.pathname==='/api/v1/platform-acquisition/experiments')return json(res,200,{experiment:await svc.recordExperiment(ctx,await body(req))});
    return json(res,404,{error:'not found'});
  }
  canManage(ctx);const svc=await service(ctx);const {store}=await getPlatformRuntimeForTests();const repo=store.tenant(ctx);
  if(req.method==='GET'&&url.pathname==='/api/v1/marketing'){const [campaigns,creatives,tests,placements]=await Promise.all([repo.list('MarketingCampaign'),repo.list('MarketingCreative'),repo.list('MarketingTest'),repo.list('MarketplacePlacement')]);return json(res,200,{campaigns,creatives,tests,placements});}
  if(req.method==='POST'&&url.pathname==='/api/v1/marketing/campaigns'){sellerWritesEnabled();return json(res,201,{campaign:await svc.createCampaign(ctx,await body(req))});}
  const gen=url.pathname.match(/^\/api\/v1\/marketing\/campaigns\/([^/]+)\/creatives$/);if(req.method==='POST'&&gen){sellerWritesEnabled();const p=await body(req);return json(res,201,{creatives:await svc.generateCreatives(ctx,{campaignId:gen[1],count:p.count,brief:p.brief||{}})});}
  if(req.method==='POST'&&url.pathname==='/api/v1/marketing/tests'){sellerWritesEnabled();return json(res,201,{test:await svc.launchTest(ctx,await body(req))});}
  const metrics=url.pathname.match(/^\/api\/v1\/marketing\/tests\/([^/]+)\/metrics$/);if(req.method==='POST'&&metrics){sellerWritesEnabled();const p=await body(req);return json(res,200,{metrics:await svc.recordMetrics(ctx,{testId:metrics[1],...p})});}
  const optimize=url.pathname.match(/^\/api\/v1\/marketing\/tests\/([^/]+)\/optimize$/);if(req.method==='POST'&&optimize){sellerWritesEnabled();const p=await body(req).catch(()=>({}));return json(res,200,await svc.optimize(ctx,{testId:optimize[1],autoApply:p.autoApply!==false}));}
  return json(res,404,{error:'not found'});
 }catch(e){return json(res,e.status||400,{error:e.message,code:e.code||'MARKETING_ERROR'});}
}
