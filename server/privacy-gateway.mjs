const EMAIL=/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE=/(?<!\d)(?:\+?7|8)[\s()-]*\d{3}[\s()-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)/g;
const CARD=/(?<!\d)(?:\d[ -]*?){13,19}(?!\d)/g;
const PLATE=/\b[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{2,3}\b/gi;

export class PrivacyGateway{
  constructor({allowExternal=true}={}){this.allowExternal=allowExternal;}
  sanitizeText(text=''){let out=String(text);const tokens=[];const replace=(re,type)=>{out=out.replace(re,m=>{const token=`<${type}_${tokens.length+1}>`;tokens.push({token,type});return token})};replace(EMAIL,'EMAIL');replace(PHONE,'PHONE');replace(CARD,'PAYMENT');replace(PLATE,'PLATE');return{text:out,tokens};}
  sanitizeContext(input={}){const cloned=structuredClone(input);const walk=v=>{if(typeof v==='string')return this.sanitizeText(v).text;if(Array.isArray(v))return v.map(walk);if(v&&typeof v==='object'){const o={};for(const [k,val] of Object.entries(v)){if(['rawImage','rawVideo','biometrics','fullAddress','passport','snils','inn'].includes(k))continue;o[k]=walk(val)}return o}return v};return walk(cloned);}
  prepareExternal({text='',context={},media=[]}={}){if(!this.allowExternal)throw Object.assign(new Error('external AI disabled by privacy gateway'),{code:'PRIVACY_EXTERNAL_DISABLED'});const cleanText=this.sanitizeText(text);const cleanContext=this.sanitizeContext(context);const safeMedia=(media||[]).filter(x=>x?.sanitized===true).map(x=>({id:x.id,type:x.type,url:x.url||null,redactions:x.redactions||[]}));return{text:cleanText.text,context:cleanContext,media:safeMedia,privacy:{piiTokens:cleanText.tokens.length,rawMediaForwarded:false}};}
}
