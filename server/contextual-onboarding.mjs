import crypto from 'node:crypto';

const JIT_FEATURES=Object.freeze({
  price_lab:{title:'Price Lab',message:'EINEIRO предлагает диапазон цены и не выходит за ваши ограничения по марже.'},
  autopilot:{title:'Autopilot',message:'Автопилот выполняет только действия, разрешённые Policy. Всё остальное поднимается как исключение.'},
  negotiation:{title:'Переговоры',message:'ИИ может торговаться только внутри разрешённого диапазона и не подтверждает критические условия без разрешения.'},
  marketing:{title:'Маркетинг',message:'EINEIRO продвигает только органически допустимые товары и не покупает внимание пользователя рекламным бюджетом.'},
  spatial_capture:{title:'Spatial Capture',message:'Пространственный объект считается точным только при подтверждённых размерах и достаточной уверенности.'}
});

export class ContextualOnboardingService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  buildInitialPath({businessType='generic',categories=[],channels=[],hasWarehouse=false,employeeCount=0,hasImport=false}={}){
    const steps=[
      {id:'business_type',required:true},
      {id:'categories',required:true},
      ...(channels.length?[]:[{id:'channels',required:false}]),
      ...(hasWarehouse?[]:[{id:'warehouse',required:false}]),
      ...(employeeCount>0?[]:[{id:'employees',required:false}]),
      ...(hasImport?[]:[{id:'import',required:false}]),
      {id:'ai_mode',required:true}
    ];
    return{businessType,categories:[...categories],steps};
  }
  async start(ctx,profile={}){const repo=this.repoFactory(ctx);const existing=(await repo.list('OnboardingProgress')).find(x=>x.identityId===ctx.identityId&&x.companyId===ctx.companyId);if(existing)return existing;const path=this.buildInitialPath(profile);const progress={id:`onb_${crypto.randomUUID()}`,identityId:ctx.identityId||ctx.userId||null,companyId:ctx.companyId||null,path,completed:[],skipped:[],status:'active',createdAt:this.now().toISOString()};await repo.put('OnboardingProgress',progress);return progress;}
  async mark(ctx,stepId,{skipped=false}={}){const repo=this.repoFactory(ctx);const progress=(await repo.list('OnboardingProgress')).find(x=>x.identityId===(ctx.identityId||ctx.userId||null)&&x.companyId===(ctx.companyId||null));if(!progress)throw new Error('onboarding not started');const next={...progress,completed:skipped?progress.completed:[...new Set([...progress.completed,stepId])],skipped:skipped?[...new Set([...progress.skipped,stepId])]:progress.skipped,updatedAt:this.now().toISOString()};const all=next.path.steps.map(x=>x.id);if(all.every(id=>next.completed.includes(id)||next.skipped.includes(id)))next.status='completed';await repo.put('OnboardingProgress',next);return next;}
  async hintForFirstUse(ctx,feature){const def=JIT_FEATURES[feature];if(!def)return null;const repo=this.repoFactory(ctx);const id=`hint:${ctx.identityId||ctx.userId||'anon'}:${ctx.companyId||'none'}:${feature}`;const seen=(await repo.list('OnboardingHint')).find(x=>x.id===id);if(seen)return null;const hint={id,feature,...def,shownAt:this.now().toISOString()};await repo.put('OnboardingHint',hint);return hint;}
  autonomyEducation(mode='advisor'){const key=String(mode).toLowerCase();const map={advisor:{mode:'Advisor',executes:false,approval:'human'},controlled:{mode:'Controlled',executes:true,approval:'policy'},autopilot:{mode:'Autopilot',executes:true,approval:'policy+exceptions'}};return{...(map[key]||map.advisor),concepts:['limits','rollback','decision_log']};}
}
