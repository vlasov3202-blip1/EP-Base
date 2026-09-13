import crypto from 'node:crypto';

export class CreativeFactory{
  constructor({copyGenerator,visualRenderer=null,videoRenderer=null,now=()=>new Date()}={}){if(typeof copyGenerator!=='function')throw new Error('copyGenerator required');this.copyGenerator=copyGenerator;this.visualRenderer=visualRenderer;this.videoRenderer=videoRenderer;this.now=now;}
  async create({campaign,product=null,audience={},angle=null,format='image',channel='eineiro_market',constraints={}}={}){
    const copy=await this.copyGenerator({campaign,product,audience,angle,format,channel,constraints});
    const concept={id:`concept_${crypto.randomUUID()}`,headline:String(copy.headline||''),text:String(copy.text||''),cta:String(copy.cta||''),visualPrompt:String(copy.visualPrompt||''),angle:copy.angle||angle||null,format,channel,createdAt:this.now().toISOString()};
    let asset=null;
    if(format==='video'&&this.videoRenderer)asset=await this.videoRenderer({concept,campaign,product,audience,constraints});
    if(format!=='video'&&this.visualRenderer)asset=await this.visualRenderer({concept,campaign,product,audience,constraints});
    return {...concept,assetUrl:asset?.url||asset?.assetUrl||null,assetId:asset?.id||null,renderStatus:asset?'ready':'awaiting_renderer'};
  }
  async mutate({parent,performance,campaign,product=null,channel=null}={}){
    const weakness=performance?.ctr<.02?'первый визуальный контакт':performance?.conversion<.03?'оффер и призыв':'масштабирование сильной подачи';
    return this.create({campaign,product,channel:channel||parent.channel,format:parent.format,angle:`Изменить ${weakness}; сохранить сильные элементы варианта ${parent.variant||''}`,constraints:{parent,performance}});
  }
}

export function createRuleBasedCopyGenerator(){return async({campaign,product,audience,angle,channel})=>{const name=product?.name||campaign?.products?.[0]||'товар';const focus=angle||'решение задачи клиента';const audienceHint=audience?.segment?` для ${audience.segment}`:'';return{headline:`${name}: ${focus}`,text:`Покажите ценность ${name}${audienceHint}. Без выдуманных характеристик, только факты карточки товара.`,cta:channel==='eineiro_market'?'Посмотреть в сцене':'Узнать подробнее',visualPrompt:`Рекламный визуал ${name}, фокус: ${focus}, чистая композиция, без ложных свойств товара`,angle:focus};};}
