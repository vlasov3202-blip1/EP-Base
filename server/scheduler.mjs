import crypto from 'node:crypto';

export class ScheduleService{
  constructor({repoFactory,queue,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');if(!queue)throw new Error('queue required');this.repoFactory=repoFactory;this.queue=queue;this.now=now;}
  async ensureDefaultBackupSchedule(ctx){
    const repo=this.repoFactory(ctx);const id='schedule:backup:twice-monthly';const existing=await repo.get('Schedule',id);if(existing)return existing;
    const rec={id,type:'backup',enabled:true,daysOfMonth:[1,15],hour:3,minute:0,scope:'company',lastRunAt:null,nextRunAt:this.nextRun([1,15],3,0).toISOString(),createdAt:this.now().toISOString()};await repo.put('Schedule',rec);return rec;
  }
  nextRun(daysOfMonth=[1,15],hour=3,minute=0,from=this.now()){
    const base=new Date(from);for(let addMonth=0;addMonth<14;addMonth++){const y=base.getUTCFullYear(),m=base.getUTCMonth()+addMonth;for(const day of [...daysOfMonth].sort((a,b)=>a-b)){const d=new Date(Date.UTC(y,m,day,hour,minute,0));if(d>base)return d}}throw new Error('next schedule not found');
  }
  async tick(ctx){
    const repo=this.repoFactory(ctx);const schedules=(await repo.list('Schedule')).filter(x=>x.enabled);const now=this.now();const queued=[];
    for(const s of schedules){if(!s.nextRunAt||Date.parse(s.nextRunAt)>now.getTime())continue;const job=await this.queue.enqueue(ctx,s.scope==='platform'?'backup.platform':'backup.company',{companyId:ctx.companyId,scheduleId:s.id},{idempotencyKey:`${s.id}:${s.nextRunAt}`});queued.push(job);s.lastRunAt=now.toISOString();s.nextRunAt=this.nextRun(s.daysOfMonth,s.hour,s.minute,now).toISOString();await repo.put('Schedule',s)}
    return queued;
  }
}
