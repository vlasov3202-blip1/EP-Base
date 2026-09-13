import path from 'node:path';
import {authenticateRequest,getPlatformRuntimeForTests} from './http-api.mjs';
import {CompanyBackupService} from './company-backup.mjs';

function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));}
function requireAdmin(ctx){if(ctx.role!=='admin'&&ctx.role!=='owner')throw Object.assign(new Error('admin access required'),{status:403,code:'FORBIDDEN'});}

export async function handleAdminApi(req,res){
  const url=new URL(req.url,'http://local');
  if(req.method!=='GET'||url.pathname!=='/api/v1/admin/overview')return false;
  try{
    const ctx=await authenticateRequest(req);requireAdmin(ctx);const rt=await getPlatformRuntimeForTests();const companyIds=await rt.store.listCompanyIds();
    const companies=[];let usersTotal=0,recordsTotal=0,openExceptions=0,unreadNotifications=0,aiCost=0;
    for(const companyId of companyIds){
      const dump=await rt.store.exportCompany(companyId);const records=dump.records||[];const exceptions=records.filter(x=>x.__entity==='Exception'||x.type&&x.status==='open');const notifications=records.filter(x=>x.__entity==='Notification'||String(x.id||'').startsWith('ntf_'));const costs=records.filter(x=>x.__entity==='AiCost'||String(x.id||'').startsWith('aic_'));
      const jobs=records.filter(x=>x.__entity==='Job'||x.type&&['queued','retry','running','failed','done'].includes(x.status));const failedJobs=jobs.filter(x=>x.status==='failed').length;
      const health=Math.max(0,100-Math.min(40,exceptions.filter(x=>x.severity==='bad'||x.requiresOwner).length*8+failedJobs*6));
      usersTotal+=dump.users?.length||0;recordsTotal+=records.length;openExceptions+=exceptions.filter(x=>x.status!=='resolved').length;unreadNotifications+=notifications.filter(x=>x.status==='unread').length;aiCost+=costs.reduce((s,x)=>s+Number(x.providerCost||0),0);
      companies.push({companyId,users:dump.users?.length||0,records:records.length,exceptions:exceptions.filter(x=>x.status!=='resolved').length,failedJobs,health});
    }
    const backups=new CompanyBackupService({store:rt.store,backupDir:process.env.EINEIRO_COMPANY_BACKUP_DIR||path.join(process.cwd(),'backups','companies')});const backupItems=await backups.list().catch(()=>[]);
    return json(res,200,{status:'ok',storage:rt.usesPostgres?'postgresql':'file',companies,totals:{companies:companies.length,users:usersTotal,records:recordsTotal,exceptions:openExceptions,unreadNotifications,aiCostUnits:Number(aiCost.toFixed(4)),companyBackups:backupItems.length},checkedAt:new Date().toISOString()});
  }catch(e){return json(res,e.status||500,{error:e.message,code:e.code||'ADMIN_OVERVIEW_ERROR'});}
}
