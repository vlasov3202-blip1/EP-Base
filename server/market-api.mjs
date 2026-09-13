import {OpenAIResponsesGateway,VisionSearchService} from './vision-ai.mjs';
import {createMarketRuntime} from './market-runtime.mjs';
import {AiProviderRegistry} from './ai-provider-layer.mjs';
import {PrivacyGateway} from './privacy-gateway.mjs';
import {EventLayer} from './event-layer.mjs';
import {AuditLogService} from './audit-log.mjs';
import {getPlatformRuntimeForTests} from './http-api.mjs';

const PUBLIC_MARKET_CTX={userId:'public-market',identityId:null,companyId:'eineiro-market',role:'system'};
let marketPromise;

function json(response,status,payload){response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify(payload));}
async function readJson(request,{maxBytes=6_000_000}={}){let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>maxBytes)throw Object.assign(new Error('payload too large'),{status:413});chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}

async function runtime(){
  if(!marketPromise)marketPromise=(async()=>{
    const {store}=await getPlatformRuntimeForTests();const market=createMarketRuntime(store);const repoFactory=ctx=>store.tenant(ctx);const ai=new AiProviderRegistry({repoFactory});const privacy=new PrivacyGateway();
    if(process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL){const gateway=new OpenAIResponsesGateway();ai.register({id:'openai',capabilities:['vision','video_understanding'],execute:async({capability,input})=>gateway.understand(input)});}
    const provider={understand:async safe=>{const input={...safe,frames:(safe.frames||[]).map(x=>({...x,sanitized:true}))};const routed=await ai.execute(PUBLIC_MARKET_CTX,{capability:'vision',input,region:'RU',privacyGateway:privacy,metadata:{feature:'vision_search'}});return{...routed.output,provider:routed.providerId};}};
    const eventLayer=new EventLayer({repoFactory}),auditService=new AuditLogService({repoFactory});
    const events={emit:(ctx,type,payload)=>eventLayer.emit(ctx,type,payload,{source:'market.vision'})};
    const audit={write:(ctx,{action,entity,entityId,meta={}}={})=>auditService.write(ctx,{actor:{type:'system',id:'market.vision'},action,object:{type:entity,id:entityId},result:meta})};
    const vision=new VisionSearchService({provider,search:(ctx,q)=>market.searchCatalog(ctx,q),events,audit,catalogPageSize:24,maxCatalogPageSize:100});return{store,market,vision,ai,privacy};
  })();return marketPromise;
}

async function marketplaceShowcase(){const {store}=await runtime();const ids=await store.listCompanyIds();const now=Date.now();const items=[];for(const companyId of ids){const repo=store.tenant({companyId});const placements=await repo.list('MarketplacePlacement');for(const p of placements){if(p.status!=='active')continue;if(p.startAt&&Date.parse(p.startAt)>now)continue;if(p.endAt&&Date.parse(p.endAt)<now)continue;items.push({...p,companyId});}}return items.sort((a,b)=>Number(b.priority||0)-Number(a.priority||0)||String(b.startedAt||b.startAt||'').localeCompare(String(a.startedAt||a.startAt||''))).slice(0,12);}

export async function handleMarketApi(request,response){
  const url=new URL(request.url,'http://local');
  if(request.method==='GET'&&url.pathname==='/api/market/showcase'){
    try{return json(response,200,{items:await marketplaceShowcase()});}catch(error){return json(response,500,{error:error.message,code:'SHOWCASE_ERROR'});}
  }
  if(request.method==='POST'&&url.pathname==='/api/vision/resolve'){
    try{const body=await readJson(request);const {vision}=await runtime();const result=await vision.resolve(PUBLIC_MARKET_CTX,{frames:body.frames||[],voiceText:body.voiceText||'',locale:body.locale||'ru-RU',catalogLimit:body.catalogLimit||24,cursors:body.cursors||{}});return json(response,200,result);}catch(error){return json(response,error.status||503,{error:error.message,code:error.code||'VISION_ERROR'});}
  }
  if(request.method==='POST'&&url.pathname==='/api/search/slots'){
    try{const body=await readJson(request,{maxBytes:200_000});const {market}=await runtime();const slots=[];for(const [index,slot] of (body.slots||[]).entries()){const catalog=await market.searchCatalog(PUBLIC_MARKET_CTX,{query:slot.searchQuery||slot.query||'',category:slot.category||null,attributes:slot.attributes||{},limit:slot.limit||24,cursor:slot.cursor||null,context:slot.context||{}});slots.push({slotId:slot.slotId||`slot-${index+1}`,label:slot.label||slot.object||`Объект ${index+1}`,anchor:slot.anchor||null,current:catalog.items[0]||null,catalog});}return json(response,200,{slots});}catch(error){return json(response,error.status||500,{error:error.message,code:error.code||'SEARCH_ERROR'});}
  }
  return false;
}
