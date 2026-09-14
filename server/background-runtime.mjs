import path from 'node:path';
import {getPlatformRuntimeForTests} from './http-api.mjs';
import {DurableJobQueue} from './durable-queue.mjs';
import {ScheduleService} from './scheduler.mjs';
import {CompanyBackupService} from './company-backup.mjs';
import {PostgresBackupService} from './postgres-backup.mjs';

let started=false;let timer=null;
export async function runBackgroundCycle(){
  const rt=await getPlatformRuntimeForTests();const queue=new DurableJobQueue(rt.store);const companyBackups=new CompanyBackupService({store:rt.store,backupDir:process.env.EINEIRO_COMPANY_BACKUP_DIR||path.join(process.cwd(),'backups','companies'),evidenceDir:process.env.EINEIRO_MODERATION_EVIDENCE_DIR||path.join(process.cwd(),'data','moderation-evidence')});const pgBackup=process.env.DATABASE_URL?new PostgresBackupService({connectionString:process.env.DATABASE_URL,backupDir:process.env.EINEIRO_BACKUP_DIR||path.join(process.cwd(),'backups','postgres')}):null;
  queue.register('backup.company',async job=>companyBackups.create(job.companyId||job.payload.companyId));if(pgBackup)queue.register('backup.platform',async()=>pgBackup.create());
  const companyIds=await rt.store.listCompanyIds();let scheduled=0,worked=0;
  let moderationChecked=0,moderationRouted=0,evidencePurged=0;for(const companyId of companyIds){const ctx={companyId,userId:'system:scheduler',role:'owner'};const scheduler=new ScheduleService({repoFactory:c=>rt.store.tenant(c),queue});await scheduler.ensureDefaultBackupSchedule(ctx);scheduled+=(await scheduler.tick(ctx)).length;worked+=(await queue.work(ctx,{limit:20})).length;const moderation=await rt.moderationMonitoring.scan(ctx);moderationChecked+=moderation.checked;moderationRouted+=moderation.routed;const evidence=await rt.moderationEvidence.purgeExpired(ctx);evidencePurged+=evidence.purged;}
  return{companies:companyIds.length,scheduled,worked,moderationChecked,moderationRouted,evidencePurged};
}
export async function startBackgroundRuntime({intervalMs=60*60*1000}={}){if(started)return{started:true};started=true;await runBackgroundCycle().catch(e=>console.error('Фоновый цикл EINEIRO:',e.message));timer=setInterval(()=>runBackgroundCycle().catch(e=>console.error('Фоновый цикл EINEIRO:',e.message)),intervalMs);timer.unref?.();return{started:true,intervalMs};}
export function stopBackgroundRuntime(){if(timer)clearInterval(timer);timer=null;started=false;}
