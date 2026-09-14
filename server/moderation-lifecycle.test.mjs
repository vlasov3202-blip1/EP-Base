import assert from 'node:assert/strict';
import {MemoryRepository} from './core.mjs';
import {AuditLogService} from './audit-log.mjs';
import {ModerationService,MODERATION_DECISIONS} from './moderation.mjs';
import {ModerationHumanExceptionService} from './moderation-ai.mjs';
import {
  ModerationAppealService,
  ModerationMonitoringService,
  ModerationIncidentService,
  ModerationRepublicationService
} from './moderation-lifecycle.mjs';

const owner={companyId:'c-life',userId:'owner-1',role:'owner'};
const seller={companyId:'c-life',userId:'seller-1',role:'seller'};
const memory=new MemoryRepository();
const repo={
  put:(entity,record)=>memory.put(owner,entity,record),
  get:(entity,id)=>memory.get(owner,entity,id),
  list:entity=>memory.list(owner,entity),
  remove:(entity,id)=>memory.remove(owner,entity,id)
};
const now=()=>new Date('2026-09-14T12:00:00Z');
const audit=new AuditLogService({repoFactory:()=>repo,now});
const moderation=new ModerationService({repoFactory:()=>repo,now,silentRun:true,audit});
const appeals=new ModerationAppealService({repoFactory:()=>repo,audit,now});
const monitoring=new ModerationMonitoringService({repoFactory:()=>repo,audit,now});
const republication=new ModerationRepublicationService({repoFactory:()=>repo,moderation,audit,now});
const incidents=new ModerationIncidentService({repoFactory:()=>repo,monitoring,republication,audit,now});
const human=new ModerationHumanExceptionService({repoFactory:()=>repo,audit,now});
const schema={categoryId:'auto.parts',version:1,status:'active',silent_run_allowed:true};
await repo.put('CategorySchema',{id:'schema-life',...schema});

async function approved(suffix,{sellerId='seller-1',documents=[]}={}){
  await repo.put('Product',{id:'p-'+suffix,name:'Деталь '+suffix,description:'Оригинальная деталь',categoryId:'auto.parts',images:['photo'],documents});
  await repo.put('Seller',{id:sellerId,status:'active'});
  await repo.put('Offer',{id:'o-'+suffix,productId:'p-'+suffix,sellerId,price:5000,stock:1,condition:'used',freshnessAt:'2026-09-14T11:00:00Z',moderationStatus:'PENDING'});
  const result=await moderation.review(owner,{offerId:'o-'+suffix,categorySchema:schema});
  assert.equal(result.decision,MODERATION_DECISIONS.AUTO_APPROVED);
  return result;
}

await repo.put('Product',{id:'p-appeal',name:'Ограниченный товар',categoryId:'restricted',images:['photo']});
await repo.put('Offer',{id:'o-appeal',productId:'p-appeal',sellerId:'seller-1',price:5000,stock:1,freshnessAt:'2026-09-14T11:00:00Z',moderationStatus:'PENDING'});
const rejected=await moderation.review(owner,{offerId:'o-appeal',categorySchema:{categoryId:'restricted',version:1,status:'active',forbidden:true,silent_run_allowed:true}});
assert.equal(rejected.decision,MODERATION_DECISIONS.AUTO_REJECTED);

let appealResult=await appeals.submit(seller,rejected.id,{
  sellerStatement:'Предоставляю новый официальный документ о происхождении товара.',
  evidenceRefs:['document:origin-2026']
});
assert.equal(appealResult.moderationCase.decision,MODERATION_DECISIONS.HUMAN_EXCEPTION);
assert.equal(appealResult.appeal.status,'human_review');
assert.ok(appealResult.appeal.humanExceptionId);
assert.equal((await repo.get('Offer','o-appeal')).moderationStatus,MODERATION_DECISIONS.HUMAN_EXCEPTION);
const appealException=await repo.get('ModerationHumanException',appealResult.appeal.humanExceptionId);
assert.deepEqual(appealException.reasonCodes,['APPEAL_NEW_EVIDENCE']);

const reusedAppeal=await appeals.submit(seller,rejected.id,{
  sellerStatement:'Повторно предоставляю новый официальный документ о происхождении.',
  evidenceRefs:['document:other']
});
assert.equal(reusedAppeal.reused,true);
assert.equal(reusedAppeal.appeal.id,appealResult.appeal.id);

const humanResult=await human.resolve(owner,appealException.id,{
  decision:MODERATION_DECISIONS.QUARANTINED,
  reason:'Документ принят для юридической проверки; публикация пока запрещена.',
  evidenceRefs:['document:origin-2026']
});
assert.equal(humanResult.moderationCase.decision,MODERATION_DECISIONS.QUARANTINED);
const resolvedAppeal=await appeals.get(seller,appealResult.appeal.id);
assert.equal(resolvedAppeal.status,'resolved');
assert.equal(resolvedAppeal.finalDecision,MODERATION_DECISIONS.QUARANTINED);

await repo.put('ModerationCase',{id:'mod-ai-appeal',objectType:'Offer',offerId:'o-ai-appeal',productId:'p-ai-appeal',sellerId:'seller-1',decision:MODERATION_DECISIONS.AUTO_REJECTED,status:'REJECTED',reasonCodes:['AI_POLICY_VIOLATION']});
await repo.put('Offer',{id:'o-ai-appeal',productId:'p-ai-appeal',sellerId:'seller-1',moderationStatus:MODERATION_DECISIONS.AUTO_REJECTED,moderationCaseId:'mod-ai-appeal'});
await assert.rejects(()=>appeals.submit(seller,'mod-ai-appeal',{
  sellerStatement:'Прикладываю новое доказательство для независимой повторной проверки.',
  evidenceRefs:['evidence:missing']
}),error=>error.code==='APPEAL_EVIDENCE_INVALID');
await repo.put('ModerationEvidence',{id:'modev-valid',moderationCaseId:'mod-ai-appeal',offerId:'o-ai-appeal',productId:'p-ai-appeal',sellerId:'seller-1',status:'active'});
const aiAppeal=await appeals.submit(seller,'mod-ai-appeal',{
  sellerStatement:'Прикладываю новое доказательство для независимой повторной проверки.',
  evidenceRefs:['evidence:modev-valid']
});
assert.equal(aiAppeal.moderationCase.decision,MODERATION_DECISIONS.SECOND_AI_REVIEW);

const riskBase=await approved('risk');
const risk=await monitoring.recordSignal(owner,{
  offerId:riskBase.offerId,
  type:'complaint_spike',
  evidenceRefs:['metric:complaints:24h'],
  safeDetails:{count:8},
  idempotencyKey:'complaints-risk-1'
});
assert.equal(risk.moderationCase.decision,MODERATION_DECISIONS.AI_REVIEW_REQUIRED);
assert.equal((await repo.get('Offer','o-risk')).moderationStatus,MODERATION_DECISIONS.AI_REVIEW_REQUIRED);
const sameRisk=await monitoring.recordSignal(owner,{
  offerId:'o-risk',
  type:'complaint_spike',
  evidenceRefs:['metric:complaints:24h'],
  idempotencyKey:'complaints-risk-1'
});
assert.equal(sameRisk.reused,true);
assert.equal(sameRisk.moderationCase.id,risk.moderationCase.id);

const hardBase=await approved('hard');
const hard=await monitoring.recordSignal(owner,{
  offerId:hardBase.offerId,
  type:'document_revoked',
  severity:'critical',
  evidenceRefs:['document:certificate-1'],
  idempotencyKey:'revoked-hard-1'
});
assert.equal(hard.moderationCase.decision,MODERATION_DECISIONS.QUARANTINED);
assert.equal(hard.moderationCase.completedAt,'2026-09-14T12:00:00.000Z');

await approved('scan',{sellerId:'seller-scan'});
await repo.put('Seller',{id:'seller-scan',status:'suspended'});
const scan=await monitoring.scan(owner);
assert.equal(scan.checked>=1,true);
assert.equal(scan.routed>=1,true);
assert.equal((await repo.get('Offer','o-scan')).moderationStatus,MODERATION_DECISIONS.QUARANTINED);

await approved('incident-a');
await approved('incident-b');
const incident=await incidents.open(owner,{
  title:'Отзыв партии поставщика',
  reason:'Получено подтверждение критического дефекта партии.',
  selector:{offerIds:['o-incident-a','o-incident-b']},
  evidenceRefs:['supplier-notice:42']
});
assert.equal(incident.affectedCount,2);
assert.equal(incident.quarantinedCount,2);
assert.equal((await repo.get('Offer','o-incident-a')).moderationStatus,MODERATION_DECISIONS.QUARANTINED);
assert.equal((await repo.get('Offer','o-incident-b')).moderationStatus,MODERATION_DECISIONS.QUARANTINED);
assert.equal((await incidents.list(owner,{status:'open'})).length,1);
const resolvedIncident=await incidents.resolve(owner,incident.id,{
  action:'recheck',
  reason:'Поставщик подтвердил безопасную партию; запускаем повторные алгоритмические проверки.'
});
assert.equal(resolvedIncident.status,'resolved');
assert.equal(resolvedIncident.resolution.outcomes.checked,2);
assert.equal(resolvedIncident.resolution.outcomes.published,2);
assert.equal((await repo.get('Offer','o-incident-a')).moderationStatus,MODERATION_DECISIONS.AUTO_APPROVED);
assert.equal((await repo.get('Offer','o-incident-b')).moderationStatus,MODERATION_DECISIONS.AUTO_APPROVED);
assert.equal((await incidents.list(owner,{status:'open'})).length,0);
const repeatedRepublication=await republication.request(owner,incident.effects[0].moderationCaseId,{reason:'Поставщик подтвердил безопасную партию; запускаем повторные алгоритмические проверки.'});
assert.equal(repeatedRepublication.reused,true);
await assert.rejects(()=>republication.request(owner,riskBase.id,{reason:'Повторная проверка опубликованного товара не разрешена.'}),error=>error.code==='REPUBLICATION_NOT_ALLOWED');

await assert.rejects(
  ()=>appeals.submit(seller,risk.moderationCase.id,{sellerStatement:'Недостаточно доказательств',evidenceRefs:[]}),
  error=>error.code==='MODERATION_DECISION_NOT_APPEALABLE'||error.code==='APPEAL_NEW_EVIDENCE_REQUIRED'
);
assert.equal((await repo.list('UnifiedAudit')).some(row=>row.action==='moderation.incident.open'),true);
assert.equal((await repo.list('UnifiedAudit')).some(row=>row.action==='moderation.appeal.submit'),true);
assert.equal((await repo.list('ModerationPostPublicationSignal')).length>=4,true);

console.log('EINEIRO moderation lifecycle tests: OK');
