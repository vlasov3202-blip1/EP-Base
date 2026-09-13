export class AutonomyEngine{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async measure(ctx){
    const repo=this.repoFactory(ctx);const [decisions,tasks,exceptions,events]=await Promise.all([repo.list('Decision'),repo.list('Task'),repo.list('Exception'),repo.list('PlatformEvent')]);
    const eligible=decisions.filter(x=>x.capability&&x.action);const executed=eligible.filter(x=>x.status==='executed');const humanRequired=eligible.filter(x=>x.status==='requires_approval').length+exceptions.filter(x=>x.requiresOwner&&x.status!=='resolved').length;
    const autonomousActions=executed.filter(x=>!x.humanApproved).length;const denominator=Math.max(1,autonomousActions+humanRequired);const score=Math.round(autonomousActions/denominator*100);
    const savedTasks=tasks.filter(x=>x.source&&String(x.source).toLowerCase().includes('eineiro')).length+autonomousActions;const rec={id:'autonomy:current',score,autonomousActions,humanRequired,savedHumanActions:savedTasks,totalDecisions:eligible.length,eventsProcessed:events.filter(x=>x.status==='processed').length,measuredAt:this.now().toISOString()};await repo.put('AutonomySnapshot',rec);return rec;
  }
}
