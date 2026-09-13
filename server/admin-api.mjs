import path from 'node:path';
import {authenticateRequest,getPlatformRuntimeForTests} from './http-api.mjs';
import {CompanyBackupService} from './company-backup.mjs';
import {DurableJobQueue} from './durable-queue.mjs';

function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(status===204?'':JSON.stringify(payload));}
function requireAdmin(ctx){if(ctx.role!=='admin')throw Object.assign(new Error('platform admin required'),{status:403,code:'FORBIDDEN'});}

async function companySnapshot(store,companyId){
  const dump=await store.exportCompany(companyId);const records=dump.records||[];
  const byEntity=(name)=>records.filter(x=>x.__entity===name);
  const exceptions=byEntity('Exception');const notifications=byEntity('Notification');const costs=byEntity('AiCost');const jobs=byEntity('Job');const channels=byEntity('ChannelConnection');const tasks=byEntity('Task');const orders=byEntity('Order');const products=byEntity('Product');
  const failedJobs=jobs.filter(x=>x.status==='failed').length;const ownerDecisions=notifications.filter(x=>x.kind==='owner_decision'&&x.requiresAction&&x.status!=='resolved').length+exceptions.filter(x=>x.requiresOwner&&x.status!=='resolved').length;const channelErrors=channels.filter(x=>x.status==='error').length;
  const health=Math.max(0,100-Math.min(70,failedJobs*12+ownerDecisions*8+channelErrors*10));
  return {companyId,users:dump.users?.length||0,products:products.length,orders:orders.length,tasksOpen:tasks.filter(x=>!['done','resolved'].includes(x.status)).length,exceptions:exceptions.filter(x=>x.status!=='resolved').length,ownerDecisions,failedJobs,channelErrors,aiCostUnits:Number(costs.reduce((s,x)=>s+Number(x.providerCost||0),0).toFixed(4)),health,status:health<75?'attention':'active',channels:channels.map(x=>({channel:x.channel,status:x.status,enabled:x.enabled,lastSuccessAt:x.lastSuccessAt,lastError:x.lastError}))};
}

export async function handleAdminApi(req,res){
  const url=new URL(req.url,'http://local');if(!url.pathname.startsWith('/api/v1/admin/'))return false;
  try{
    const ctx=await authenticateRequest(req);requireAdmin(ctx);const rt=await getPlatformRuntimeForTests();
    if(req.method==='GET'&&url.pathname==='/api/v1/admin/overview'){
      const companyIds=await rt.store.listCompanyIds();const companies=[];for(const id of companyIds)companies.push(await companySnapshot(rt.store,id));
      const queue=new DurableJobQueue(rt.store);const queueTotals={total:0,queued:0,running:0,retry:0,done:0,failed:0};for(const id of companyIds){const s=await queue.stats({companyId:id});for(const k of Object.keys(queueTotals))queueTotals[k]+=Number(s[k]||0)}
      const backups=new CompanyBackupService({store:rt.store,backupDir:process.env.EINEIRO_COMPANY_BACKUP_DIR||path.join(process.cwd(),'backups','companies')});const backupItems=await backups.list().catch(()=>[]);const health=await rt.infra.health.check();
      const totals={companies:companies.length,users:companies.reduce((s,x)=>s+x.users,0),products:companies.reduce((s,x)=>s+x.products,0),orders:companies.reduce((s,x)=>s+x.orders,0),exceptions:companies.reduce((s,x)=>s+x.exceptions,0),ownerDecisions:companies.reduce((s,x)=>s+x.ownerDecisions,0),channelErrors:companies.reduce((s,x)=>s+x.channelErrors,0),aiCostUnits:Number(companies.reduce((s,x)=>s+x.aiCostUnits,0).toFixed(4)),companyBackups:backupItems.length};
      return json(res,200,{status:health.status,storage:rt.usesPostgres?'postgresql':'file',companies,totals,queue:queueTotals,health,checkedAt:new Date().toISOString()});
    }
    const m=url.pathname.match(/^\/api\/v1\/admin\/companies\/([^/]+)$/);if(req.method==='GET'&&m)return json(res,200,{company:await companySnapshot(rt.store,decodeURIComponent(m[1]))});
    return json(res,404,{error:'not found'});
  }catch(e){return json(res,e.status||500,{error:e.message,code:e.code||'ADMIN_OVERVIEW_ERROR'});}
}
