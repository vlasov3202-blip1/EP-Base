import path from 'node:path';
import {authenticateRequest,getPlatformRuntimeForTests} from './http-api.mjs';
import {DurableJobQueue} from './durable-queue.mjs';
import {PostgresBackupService} from './postgres-backup.mjs';

let servicesPromise;
async function services(){
  if(!servicesPromise)servicesPromise=(async()=>{
    const rt=await getPlatformRuntimeForTests();
    const queue=new DurableJobQueue(rt.store);
    const pgBackup=process.env.DATABASE_URL?new PostgresBackupService({connectionString:process.env.DATABASE_URL,backupDir:process.env.EINEIRO_BACKUP_DIR||path.join(process.cwd(),'backups','postgres')}):null;
    if(pgBackup){queue.register('backup.postgres',async()=>pgBackup.create());}
    return{rt,queue,pgBackup};
  })();
  return servicesPromise;
}
function json(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(status===204?'':JSON.stringify(payload));}
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
function adminOnly(ctx){if(ctx.role!=='owner'&&ctx.role!=='admin')throw Object.assign(new Error('owner/admin required'),{status:403,code:'FORBIDDEN'});}

export async function handleReliabilityApi(req,res){
  const url=new URL(req.url,'http://local');
  if(!url.pathname.startsWith('/api/v1/reliability/'))return false;
  try{
    const ctx=await authenticateRequest(req);adminOnly(ctx);const {queue,pgBackup}=await services();
    if(req.method==='GET'&&url.pathname==='/api/v1/reliability/jobs')return json(res,200,{stats:await queue.stats(ctx),items:await queue.list(ctx)});
    if(req.method==='POST'&&url.pathname==='/api/v1/reliability/jobs/run'){const p=await body(req).catch(()=>({}));return json(res,200,{items:await queue.work(ctx,{limit:Math.max(1,Math.min(Number(p.limit)||10,100))}),stats:await queue.stats(ctx)});}
    if(req.method==='POST'&&url.pathname==='/api/v1/reliability/backups'){
      if(!pgBackup)return json(res,409,{error:'PostgreSQL не включён',code:'POSTGRES_NOT_ENABLED'});
      const job=await queue.enqueue(ctx,'backup.postgres',{});return json(res,202,{job});
    }
    if(req.method==='GET'&&url.pathname==='/api/v1/reliability/backups'){
      if(!pgBackup)return json(res,200,{items:[]});return json(res,200,{items:await pgBackup.list()});
    }
    if(req.method==='POST'&&url.pathname==='/api/v1/reliability/backups/verify'){
      if(!pgBackup)return json(res,409,{error:'PostgreSQL не включён',code:'POSTGRES_NOT_ENABLED'});const p=await body(req);return json(res,200,await pgBackup.verify(p.file));
    }
    if(req.method==='POST'&&url.pathname==='/api/v1/reliability/backups/restore'){
      if(!pgBackup)return json(res,409,{error:'PostgreSQL не включён',code:'POSTGRES_NOT_ENABLED'});const p=await body(req);return json(res,200,await pgBackup.restore(p.file,{clean:Boolean(p.clean)}));
    }
    return json(res,404,{error:'not found'});
  }catch(e){return json(res,e.status||500,{error:e.message,code:e.code||'RELIABILITY_ERROR'});}
}
