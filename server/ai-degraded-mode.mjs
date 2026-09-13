export class AiDegradedModeService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async resolve(ctx,{capability,context={}}={}){const repo=this.repoFactory(ctx);const mode=degradedMode(capability,context);const rec={id:`ai-degraded:${capability}:${Date.now()}`,capability,mode,context:structuredClone(context),createdAt:this.now().toISOString()};await repo.put('AiDegradedMode',rec);return rec;}
}
export function degradedMode(capability,context={}){
  if(capability==='vision')return{status:'manual_fallback',message:'ИИ недоступен: сохранить текущий контекст и предложить ручной выбор или текстовый поиск без ложного результата.',preserve:['camera_session','placed_objects','voice_context'],allowed:['manual_search','browse','retry_later']};
  if(capability==='transcription')return{status:'manual_fallback',message:'Речь недоступна: разрешить текстовый ввод, не ломая текущую сессию.',allowed:['text_input','retry_later']};
  if(capability==='generation')return{status:'hold',message:'Не публиковать незавершённый креатив. Сохранить задачу до восстановления генерации.',allowed:['save_draft','manual_asset']};
  if(capability==='reasoning'||capability==='classification')return{status:'rules_only',message:'Перейти на детерминированные правила и Policy/Decision без ИИ.',allowed:['rules','policy','manual_review']};
  if(capability==='embedding')return{status:'lexical_only',message:'Использовать точный и атрибутный поиск без смыслового слоя.',allowed:['exact','category','attributes','compatibility']};
  return{status:'safe_stop',message:'Автономное ИИ-действие остановлено безопасно.',allowed:['manual_review']};
}
