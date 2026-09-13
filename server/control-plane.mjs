import {authenticateRequest,getPlatformRuntimeForTests} from './http-api.mjs';
import {ChannelConfigService} from './channel-config.mjs';
import {DurableJobQueue} from './durable-queue.mjs';
import {NotificationService} from './notifications.mjs';

function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(status===204?'':JSON.stringify(payload));}
function platformAdmin(ctx){if(ctx.role!=='admin')throw Object.assign(new Error('platform admin required'),{status:403,code:'FORBIDDEN'});}
async function companySnapshot(store,companyId){
  const ctx={companyId,userId:'system:control-plane',role:'owner'};const repo=store.tenant(ctx);
  const [users,products,orders,tasks,notifications,channels,jobs]=await Promise.all([
    Promise.resolve(store.exportCompany?.(companyId)).then(x=>x?.users||[]).catch(()=>[]),repo.list('Product'),repo.list('Order'),repo.list('Task'),repo.list('Notification'),repo.list('ChannelConnection'),repo.list('Job')
  ]);
  const failedJobs=jobs.filter(x=>x.status==='failed').length;const openOwner=notifications.filter(x=>x.kind==='owner_decision'&&x.requiresAction&&x.status!=='resolved').length;const channelErrors=channels.filter(x=>x.status==='error').length;
  const penalties=Math.min(60,failedJobs*15+openOwner*8+channelErrors*10);return {companyId,users:users.length,products:products.length,orders:orders.length,tasksOpen:tasks.filter(x=>!['done','resolved'].includes(x.status)).length,ownerDecisions:openOwner,channelErrors,failedJobs,health:Math.max(0,100-penalties),status:penalties>=30?'attention':'active'};
}

export async function handleControlPlaneApi(req,res){
  const url=new URL(req.url,'http://local');if(!url.pathname.startsWith('/api/v1/control-plane'))return false;
  try{
    const ctx=await authenticateRequest(req);platformAdmin(ctx);const {store,infra}=await getPlatformRuntimeForTests();
    if(req.method==='GET'&&url.pathname==='/api/v1/control-plane/summary'){
      const companyIds=await store.listCompanyIds();const companies=[];for(const id of companyIds)companies.push(await companySnapshot(store,id));
      const queue=new DurableJobQueue(store);let queueTotals={total:0,queued:0,running:0,retry:0,done:0,failed:0};for(const id of companyIds){const s=await queue.stats({companyId:id});for(const k of Object.keys(queueTotals))queueTotals[k]+=Number(s[k]||0)}
      const health=await infra.health.check();return json(res,200,{companies,queue:queueTotals,health,generatedAt:new Date().toISOString()});
    }
    const m=url.pathname.match(/^\/api\/v1\/control-plane\/companies\/([^/]+)$/);if(req.method==='GET'&&m)return json(res,200,{company:await companySnapshot(store,decodeURIComponent(m[1]))});
    return json(res,404,{error:'not found'});
  }catch(e){return json(res,e.status||500,{error:e.message,code:e.code||'CONTROL_PLANE_ERROR'});}
}
