import {OpenAIResponsesGateway,VisionSearchService} from './vision-ai.mjs';
import {SearchService} from './search.mjs';
import {createCatalogSource} from './catalog.mjs';
import {createServices} from './core.mjs';
import {getPlatformRuntimeForTests} from './http-api.mjs';

const PUBLIC_MARKET_CTX={userId:'public-market',companyId:'eineiro-market',role:'owner'};
const {events,audit}=createServices();
const searchService=new SearchService({source:createCatalogSource()});

function json(response,status,payload){response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify(payload));}
async function readJson(request,{maxBytes=6_000_000}={}){let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>maxBytes)throw Object.assign(new Error('payload too large'),{status:413});chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
function createVision(){const provider=new OpenAIResponsesGateway();return new VisionSearchService({provider,search:(ctx,q)=>searchService.search(ctx,q),events,audit,catalogPageSize:24,maxCatalogPageSize:100});}
async function marketplaceShowcase(){const {store}=await getPlatformRuntimeForTests();const ids=await store.listCompanyIds();const now=Date.now();const items=[];for(const companyId of ids){const repo=store.tenant({companyId});const placements=await repo.list('MarketplacePlacement');for(const p of placements){if(p.status!=='active')continue;if(p.startAt&&Date.parse(p.startAt)>now)continue;if(p.endAt&&Date.parse(p.endAt)<now)continue;items.push({...p,companyId});}}return items.sort((a,b)=>Number(b.priority||0)-Number(a.priority||0)||String(b.startedAt||b.startAt||'').localeCompare(String(a.startedAt||a.startAt||''))).slice(0,12);}

export async function handleMarketApi(request,response){
  const url=new URL(request.url,'http://local');
  if(request.method==='GET'&&url.pathname==='/api/market/showcase'){
    try{return json(response,200,{items:await marketplaceShowcase()});}catch(error){return json(response,500,{error:error.message,code:'SHOWCASE_ERROR'});}
  }
  if(request.method==='POST'&&url.pathname==='/api/vision/resolve'){
    try{const body=await readJson(request);const result=await createVision().resolve(PUBLIC_MARKET_CTX,{frames:body.frames||[],voiceText:body.voiceText||'',locale:body.locale||'ru-RU',catalogLimit:body.catalogLimit||24,cursors:body.cursors||{}});return json(response,200,result);}catch(error){return json(response,error.status||500,{error:error.message,code:error.code||'VISION_ERROR'});}
  }
  if(request.method==='POST'&&url.pathname==='/api/search/slots'){
    try{const body=await readJson(request,{maxBytes:200_000});const slots=await searchService.searchSlots(PUBLIC_MARKET_CTX,body.slots||[]);return json(response,200,{slots});}catch(error){return json(response,error.status||500,{error:error.message,code:error.code||'SEARCH_ERROR'});}
  }
  return false;
}
