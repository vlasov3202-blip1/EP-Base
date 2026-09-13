import {authenticateRequest,getPlatformRuntimeForTests} from './http-api.mjs';
import {OperationsBrain} from './operations-brain.mjs';
import {FinanceLedgerService} from './finance-ledger.mjs';
import {MarketingService} from './marketing.mjs';

function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}

export async function handleBusinessApi(req,res){
  const url=new URL(req.url,'http://local');if(!url.pathname.startsWith('/api/v1/business/'))return false;
  try{
    const ctx=await authenticateRequest(req);const {store}=await getPlatformRuntimeForTests();const repo=store.tenant(ctx);
    if(req.method==='GET'&&url.pathname==='/api/v1/business/snapshot'){
      const [products,orders,tasks,exceptions,notifications,costs,channels,forecasts,reports,priceRecommendations,payments,shipments,campaigns,financeEntries,leads,marketingCreatives,marketingTests,marketplacePlacements]=await Promise.all([
        repo.list('Product'),repo.list('Order'),repo.list('Task'),repo.list('Exception'),repo.list('Notification'),repo.list('AiCost'),repo.list('ChannelConnection'),repo.list('Forecast'),repo.list('OwnerMorningReport'),repo.list('PriceRecommendation'),repo.list('Payment'),repo.list('Shipment'),repo.list('MarketingCampaign'),repo.list('FinanceEntry'),repo.list('Lead'),repo.list('MarketingCreative'),repo.list('MarketingTest'),repo.list('MarketplacePlacement')
      ]);
      const ownerDecisions=[...exceptions.filter(x=>x.requiresOwner&&x.status!=='resolved'),...notifications.filter(x=>x.kind==='owner_decision'&&x.requiresAction&&x.status!=='resolved')];
      const failedTasks=tasks.filter(x=>['failed','not_done'].includes(x.status));const autonomy=Math.max(0,Math.min(100,100-ownerDecisions.length*6-failedTasks.length*2));
      const finance=await new FinanceLedgerService({repoFactory:()=>repo}).summary(ctx);const marketing=await new MarketingService({repoFactory:()=>repo}).analyze(ctx);const brain=await new OperationsBrain({repoFactory:()=>repo}).analyze(ctx);
      const marketingAutopilot={campaigns:campaigns.length,creatives:marketingCreatives.length,activeTests:marketingTests.filter(x=>x.status==='running').length,optimizedTests:marketingTests.filter(x=>x.status==='optimized').length,activeMarketplacePlacements:marketplacePlacements.filter(x=>x.status==='active').length,pausedCreatives:marketingCreatives.filter(x=>x.status==='paused').length};
      return json(res,200,{companyId:ctx.companyId,role:ctx.role,autonomy,products,orders,tasks,exceptions,notifications,costs,channels,forecasts,reports,priceRecommendations,payments,shipments,campaigns,financeEntries,leads,marketingCreatives,marketingTests,marketplacePlacements,marketingAutopilot,finance,marketing,operations:brain,ownerDecisions,generatedAt:new Date().toISOString()});
    }
    if(req.method==='POST'&&url.pathname==='/api/v1/business/operations/plan'){
      if(!['owner','manager'].includes(ctx.role))return json(res,403,{error:'недостаточно прав',code:'FORBIDDEN'});const result=await new OperationsBrain({repoFactory:()=>repo}).plan(ctx);return json(res,200,result);
    }
    return json(res,404,{error:'not found'});
  }catch(e){return json(res,e.status||500,{error:e.message,code:e.code||'BUSINESS_API_ERROR'});}
}
