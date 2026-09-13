export const CONDITIONS=Object.freeze(['NEW','USED','REFURBISHED','OPEN_BOX','DISPLAY','DISCOUNTED','DAMAGED_PACKAGE','FOR_PARTS']);

const ALIASES=Object.freeze({
  new:'NEW',новый:'NEW',used:'USED',б\/у:'USED',бу:'USED',refurbished:'REFURBISHED',восстановленный:'REFURBISHED',
  open_box:'OPEN_BOX','open box':'OPEN_BOX',display:'DISPLAY',витринный:'DISPLAY',discounted:'DISCOUNTED',уценка:'DISCOUNTED',
  damaged_package:'DAMAGED_PACKAGE','damaged package':'DAMAGED_PACKAGE',for_parts:'FOR_PARTS','for parts':'FOR_PARTS',на_запчасти:'FOR_PARTS'
});

export function normalizeCondition(value,{fallback='USED'}={}){
  if(value==null||value==='')return fallback;
  const raw=String(value).trim();const upper=raw.toUpperCase();if(CONDITIONS.includes(upper))return upper;
  const alias=ALIASES[raw.toLowerCase().replace(/\s+/g,'_')]||ALIASES[raw.toLowerCase()];if(alias)return alias;
  throw Object.assign(new Error(`unsupported condition:${raw}`),{code:'INVALID_CONDITION',value:raw});
}

export function assertCondition(value){const condition=normalizeCondition(value,{fallback:null});if(!condition)throw Object.assign(new Error('condition required'),{code:'CONDITION_REQUIRED'});return condition;}
