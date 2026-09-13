import crypto from 'node:crypto';

const CORRECTION_STEPS=['warning','hint','task','verification','retraining','owner_escalation'];

export class AiOperationsService{
  constructor({repoFactory,events=null,audit=null,now=()=>new Date()}={}){
    if(typeof repoFactory!=='function')throw new Error('repoFactory required');
    this.repoFactory=repoFactory;this.events=events;this.audit=audit;this.now=now;
  }
  async createException(ctx,{type,title,detail,severity='warn',estimatedLoss=0,requiresOwner=false,reason=null,evidence=[]}={}){
    const repo=this.repoFactory(ctx);const id=`exc_${crypto.randomUUID()}`;
    const rec={id,type,title,detail,severity,estimatedLoss:Number(estimatedLoss)||0,requiresOwner:Boolean(requiresOwner),reason,status:'open',evidence:structuredClone(evidence),createdAt:this.now().toISOString()};
    await repo.put('Exception',rec);await this.#event(ctx,'ai.exception.created',{id,type,severity,requiresOwner:rec.requiresOwner});return rec;
  }
  async correctionStep(ctx,{employeeId,issue,stage='warning',estimatedLoss=0,trainingTopic=null}={}){
    if(!CORRECTION_STEPS.includes(stage))throw new Error('invalid correction stage');
    const repo=this.repoFactory(ctx);const id=`corr:${employeeId}:${issue}`;
    const prev=await repo.get('EmployeeCorrection',id);
    const currentIndex=prev?CORRECTION_STEPS.indexOf(prev.stage):-1;
    const requestedIndex=CORRECTION_STEPS.indexOf(stage);
    if(prev&&requestedIndex<currentIndex)throw new Error('correction stage cannot move backwards');
    const rec={id,employeeId,issue,stage,estimatedLoss:Number(estimatedLoss)||0,trainingTopic:trainingTopic||prev?.trainingTopic||null,history:[...(prev?.history||[]),{stage,at:this.now().toISOString()}],updatedAt:this.now().toISOString()};
    await repo.put('EmployeeCorrection',rec);
    if(stage==='task')await repo.put('Task',{id:`task:${id}`,title:`Исправить: ${issue}`,owner:employeeId,priority:'high',status:'todo',source:'AI-РОП',createdAt:this.now().toISOString()});
    if(stage==='retraining')await repo.put('TrainingAssignment',{id:`train:${id}`,employeeId,topic:rec.trainingTopic||issue,status:'assigned',verifyKpi:true,createdAt:this.now().toISOString()});
    if(stage==='owner_escalation')await this.createException(ctx,{type:'employee',title:`Требуется решение по сотруднику ${employeeId}`,detail:issue,severity:'bad',estimatedLoss:rec.estimatedLoss,requiresOwner:true,reason:'repeated_violation',evidence:rec.history});
    await this.#event(ctx,'ai.employee.correction',{employeeId,issue,stage});return rec;
  }
  async warehousePlan(ctx,{inventory=[],locations=[],rules={}}={}){
    const repo=this.repoFactory(ctx);const tasks=[];
    const byLocation=new Map(locations.map(x=>[x.id,x]));
    for(const item of inventory){
      const current=byLocation.get(item.locationId);const age=Number(item.ageDays||0);const demand=Number(item.demand||0);let target=item.locationId;let reason=null;
      if(age>90&&demand<40){target=locations.find(x=>x.zone==='slow')?.id||target;reason='медленный товар'}
      if(demand>=80){target=locations.find(x=>x.zone==='fast')?.id||target;reason='высокий спрос'}
      if(item.heavy&&current?.level>1){target=locations.find(x=>x.level===1&&x.zone===current.zone)?.id||target;reason='тяжёлый товар — нижний уровень'}
      if(target!==item.locationId){const id=`move:${item.id}:${target}`;const task={id,title:`Переместить ${item.name||item.id}`,productId:item.id,from:item.locationId,to:target,reason,status:'proposed',priority:demand>=80?'high':'normal'};await repo.put('WarehouseMove',task);tasks.push(task)}
    }
    await this.#event(ctx,'ai.warehouse.plan',{moves:tasks.length});return tasks;
  }
  async forecast(ctx,{horizonDays=30,metrics={},externalSignals=[]}={}){
    const repo=this.repoFactory(ctx);const demand=Number(metrics.demandIndex||0);const sales=Number(metrics.salesTrend||0);const stock=Number(metrics.stockTurnover||0);
    const riskSignals=externalSignals.filter(x=>['high','bad','critical'].includes(x.severity));
    const score=Math.max(-100,Math.min(100,Math.round(sales*.45+demand*.35+stock*.2-riskSignals.length*8)));
    const direction=score>15?'growth':score<-15?'decline':'stable';
    const rec={id:`forecast:${this.now().toISOString().slice(0,10)}`,horizonDays,direction,score,externalSignals:structuredClone(externalSignals),metrics:structuredClone(metrics),ownerNote:riskSignals.length?`Учесть ${riskSignals.length} внешних риска`:'Существенных внешних рисков не выявлено',pinned:false,createdAt:this.now().toISOString()};
    await repo.put('Forecast',rec);await this.#event(ctx,'ai.forecast.created',{direction,score,risks:riskSignals.length});return rec;
  }
  async morningReport(ctx,{sales={},sla={},aiActions=[],exceptions=[],extraSales=0}={}){
    const material=exceptions.filter(x=>x.requiresOwner||x.severity==='bad');
    const status=material.length?'attention':'green';
    const rec={id:`morning:${this.now().toISOString().slice(0,10)}`,status,sales:structuredClone(sales),sla:structuredClone(sla),aiActions:structuredClone(aiActions),extraSales:Number(extraSales)||0,ownerDecisions:material.map(x=>x.id),interventionRequired:material.length>0,summary:material.length?`Нужно решить: ${material.length}`:'Вмешательство не требуется',createdAt:this.now().toISOString()};
    await this.repoFactory(ctx).put('OwnerMorningReport',rec);await this.#event(ctx,'ai.owner.morning_report',{status,ownerDecisions:material.length,extraSales:rec.extraSales});return rec;
  }
  async #event(ctx,type,payload){this.events?.emit?.(ctx,type,payload);this.audit?.write?.(ctx,{action:type,entity:'AIAction',entityId:payload.id||crypto.randomUUID(),meta:payload});}
}

export {CORRECTION_STEPS};
