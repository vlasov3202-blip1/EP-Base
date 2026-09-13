import {authenticateRequest,getPlatformRuntimeForTests} from './http-api.mjs';

function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}

export async function handleBusinessApi(req,res){
  const url=new URL(req.url,'http://local');if(req.method!=='GET'||url.pathname!=='/api/v1/business/snapshot')return false;
  try{
    const ctx=await authenticateRequest(req);const {store}=await getPlatformRuntimeForTests();const repo=store.tenant(ctx);
    const [products,orders,tasks,exceptions,notifications,costs,channels,forecasts,reports,priceRecommendations]=await Promise.all([
      repo.list('Product'),repo.list('Order'),repo.list('Task'),repo.list('Exception'),repo.list('Notification'),repo.list('AiCost'),repo.list('ChannelConnection'),repo.list('Forecast'),repo.list('OwnerMorningReport'),repo.list('PriceRecommendation')
    ]);
    const ownerDecisions=[...exceptions.filter(x=>x.requiresOwner&&x.status!=='resolved'),...notifications.filter(x=>x.kind==='owner_decision'&&x.requiresAction&&x.status!=='resolved')];
    const failedTasks=tasks.filter(x=>['failed','not_done'].includes(x.status));const autonomy=Math.max(0,Math.min(100,100-ownerDecisions.length*6-failedTasks.length*2));
    return json(res,200,{companyId:ctx.companyId,role:ctx.role,autonomy,products,orders,tasks,exceptions,notifications,costs,channels,forecasts,reports,priceRecommendations,ownerDecisions,generatedAt:new Date().toISOString()});
  }catch(e){return json(res,e.status||500,{error:e.message,code:e.code||'BUSINESS_SNAPSHOT_ERROR'});}
}
