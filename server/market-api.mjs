import {OpenAIResponsesGateway,VisionSearchService} from './vision-ai.mjs';
import {SearchService} from './search.mjs';
import {createCatalogSource} from './catalog.mjs';
import {createServices} from './core.mjs';
import {getPlatformRuntimeForTests} from './http-api.mjs';
import {clientAddress,enforceRateLimit,readJsonBody} from './http-security.mjs';
import {recordMarketMoreEvent} from './market-more.mjs';

const PUBLIC_MARKET_CTX={userId:'public-market',companyId:'eineiro-market',role:'owner'};
const {events,audit}=createServices();
const searchService=new SearchService({source:createCatalogSource()});

function json(response,status,payload){response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify(payload));}
const readJson=readJsonBody;
function createVision(){const provider=new OpenAIResponsesGateway();return new VisionSearchService({provider,search:(ctx,q)=>searchService.search(ctx,q),events,audit,catalogPageSize:24,maxCatalogPageSize:100});}
async function marketplaceShowcase(){const {store}=await getPlatformRuntimeForTests();const ids=await store.listCompanyIds();const now=Date.now();const items=[];for(const companyId of ids){const repo=store.tenant({companyId});const placements=await repo.list('MarketplacePlacement');for(const p of placements){if(p.status!=='active')continue;if(p.startAt&&Date.parse(p.startAt)>now)continue;if(p.endAt&&Date.parse(p.endAt)<now)continue;items.push({...p,companyId});}}return items.sort((a,b)=>Number(b.priority||0)-Number(a.priority||0)||String(b.startedAt||b.startAt||'').localeCompare(String(a.startedAt||a.startAt||''))).slice(0,12);}

export async function handleMarketApi(request,response){
  const url=new URL(request.url,'http://local');
  if(request.method==='GET'&&url.pathname==='/api/market/showcase'){
    try{return json(response,200,{items:await marketplaceShowcase()});}catch(error){return json(response,500,{error:error.message,code:'SHOWCASE_ERROR'});}
  }
  if(request.method==='POST'&&url.pathname==='/api/market/events'){
    try{
      if(request.headers['x-eineiro-market-event']!=='1')throw Object.assign(new Error('market event origin proof required'),{status:403,code:'MARKET_EVENT_ORIGIN_REQUIRED'});
      const {store,rateLimiter}=await getPlatformRuntimeForTests();
      await enforceRateLimit(request,{scope:'market-flight-recorder',key:clientAddress(request),limit:Number(process.env.MARKET_EVENT_RATE_LIMIT_PER_MINUTE||90),windowMs:60_000,limiter:rateLimiter});
      await enforceRateLimit(request,{scope:'market-flight-recorder-day',key:clientAddress(request),limit:Number(process.env.MARKET_EVENT_RATE_LIMIT_PER_DAY||2000),windowMs:86_400_000,limiter:rateLimiter});
      await enforceRateLimit(request,{scope:'market-flight-recorder-global',key:'global',limit:Number(process.env.MARKET_EVENT_GLOBAL_RATE_LIMIT_PER_MINUTE||3000),windowMs:60_000,limiter:rateLimiter});
      const input=await readJson(request,{maxBytes:20_000,maxDepth:4,maxNodes:80});
      const event=await recordMarketMoreEvent({store,ctx:PUBLIC_MARKET_CTX,input});
      return json(response,202,{accepted:true,eventId:event.id});
    }catch(error){return json(response,error.status||400,{error:error.message,code:error.code||'MARKET_EVENT_ERROR',retryAfterMs:error.retryAfterMs||undefined});}
  }
  if(request.method==='POST'&&url.pathname==='/api/vision/resolve'){
    try{
      if(process.env.VISION_KILL_SWITCH==='true')throw Object.assign(new Error('vision is temporarily disabled'),{status:503,code:'VISION_DISABLED'});
      const {rateLimiter}=await getPlatformRuntimeForTests();
      const client=clientAddress(request);
      await enforceRateLimit(request,{scope:'vision-minute',key:client,limit:Number(process.env.VISION_RATE_LIMIT_PER_MINUTE||6),windowMs:60_000,limiter:rateLimiter});
      await enforceRateLimit(request,{scope:'vision-day',key:client,limit:Number(process.env.VISION_RATE_LIMIT_PER_DAY||100),windowMs:86_400_000,limiter:rateLimiter});
      await enforceRateLimit(request,{scope:'vision-global-minute',key:'global',limit:Number(process.env.VISION_GLOBAL_RATE_LIMIT_PER_MINUTE||120),windowMs:60_000,limiter:rateLimiter});
      const body=await readJson(request,{maxBytes:Number(process.env.VISION_MAX_BODY_BYTES||6_000_000),maxDepth:12,maxNodes:5000});
      if(!Array.isArray(body.frames)||body.frames.length>8)throw Object.assign(new Error('invalid frame count'),{status:400,code:'VISION_FRAME_LIMIT'});
      const result=await createVision().resolve(PUBLIC_MARKET_CTX,{frames:body.frames,voiceText:body.voiceText||'',locale:body.locale||'ru-RU',catalogLimit:body.catalogLimit||24,cursors:body.cursors||{}});
      return json(response,200,result);
    }catch(error){return json(response,error.status||500,{error:error.message,code:error.code||'VISION_ERROR',retryAfterMs:error.retryAfterMs||undefined});}
  }
  if(request.method==='POST'&&url.pathname==='/api/search/slots'){
    try{const body=await readJson(request,{maxBytes:200_000});const slots=await searchService.searchSlots(PUBLIC_MARKET_CTX,body.slots||[]);return json(response,200,{slots});}catch(error){return json(response,error.status||500,{error:error.message,code:error.code||'SEARCH_ERROR'});}
  }
  return false;
}
