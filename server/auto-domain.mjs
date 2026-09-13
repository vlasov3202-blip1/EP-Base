import crypto from 'node:crypto';

export const AUTO_WARRANTY_RULES=Object.freeze({defaultDays:14,electricsDays:0,controlUnitsDays:0,allowCustom:true});

export function warrantyForPart({category='',customDays=null,locked=false}={}){
  if(customDays!=null&&AUTO_WARRANTY_RULES.allowCustom)return {days:Math.max(0,Number(customDays)||0),source:'custom',locked:Boolean(locked)};
  const c=String(category).toLowerCase();
  if(c.includes('элект')||c.includes('electric'))return {days:AUTO_WARRANTY_RULES.electricsDays,source:'rule',locked:false};
  if(c.includes('блок')||c.includes('ecu')||c.includes('control'))return {days:AUTO_WARRANTY_RULES.controlUnitsDays,source:'rule',locked:false};
  return {days:AUTO_WARRANTY_RULES.defaultDays,source:'default',locked:false};
}

export function normalizeAutoPart(input={}){
  if(!input.name)throw new Error('part name required');
  const warranty=warrantyForPart({category:input.category,customDays:input.warrantyDays,locked:input.warrantyLocked});
  return {
    id:input.id||`part_${crypto.randomUUID()}`,
    name:String(input.name),category:String(input.category||''),manufacturer:String(input.manufacturer||''),
    oeNumbers:[...new Set((input.oeNumbers||[]).map(String))],crossNumbers:[...new Set((input.crossNumbers||[]).map(String))],
    internalArticle:String(input.internalArticle||''),barcode:String(input.barcode||''),
    donorId:input.donorId||null,applicability:Array.isArray(input.applicability)?structuredClone(input.applicability):[],
    warranty,photos:(input.photos||[]).filter(Boolean),status:input.status||'draft'
  };
}

export class AutoDomainService{
  constructor({repoFactory,photoRecognizer=null}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.photoRecognizer=photoRecognizer;}
  async createDonor(ctx,input={}){
    if(!input.id)throw new Error('donor id required');const donor={id:input.id,make:input.make||'',model:input.model||'',year:input.year||null,vin:input.vin||null,attributes:structuredClone(input.attributes||{}),createdAt:new Date().toISOString()};await this.repoFactory(ctx).put('DonorVehicle',donor);return donor;
  }
  async createPart(ctx,input={}){
    const part=normalizeAutoPart(input);if(part.donorId){const donor=await this.repoFactory(ctx).get('DonorVehicle',part.donorId);if(donor&&!part.applicability.length)part.applicability=[{make:donor.make,model:donor.model,year:donor.year,source:'donor'}];}await this.repoFactory(ctx).put('Product',part);return part;
  }
  async acceptByPhoto(ctx,{photos=[],donorId=null,hints={}}={}){
    if(!this.photoRecognizer)throw Object.assign(new Error('photo recognizer not configured'),{code:'PHOTO_RECOGNIZER_NOT_CONFIGURED'});
    const selected=photos.filter(Boolean).slice(0,4);if(!selected.length)throw new Error('at least one photo required');
    const recognized=await this.photoRecognizer({photos:selected,hints});
    const existingId=recognized.existingProductId||null;
    if(existingId){const existing=await this.repoFactory(ctx).get('Product',existingId);if(existing)return {mode:'existing',product:existing,confidence:recognized.confidence??null};}
    const product=await this.createPart(ctx,{...recognized.product,photos:selected,donorId});
    return {mode:'new',product,confidence:recognized.confidence??null};
  }
}
