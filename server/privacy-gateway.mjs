const EMAIL=/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE=/(?<!\d)(?:\+?7|8)[\s()-]*\d{3}[\s()-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)/g;
const CARD=/(?<!\d)(?:\d[ -]*?){13,19}(?!\d)/g;
const PLATE=/\b[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{2,3}\b/gi;
const BLOCKED_KEYS=new Set(['rawImage','rawVideo','biometrics','fullAddress','passport','snils','inn','dataUrl','base64','rawMedia']);

export class PrivacyGateway{
  constructor({allowExternal=true}={}){this.allowExternal=allowExternal;}
  sanitizeText(text=''){let out=String(text);const tokens=[];const replace=(re,type)=>{out=out.replace(re,m=>{const token=`<${type}_${tokens.length+1}>`;tokens.push({token,type});return token})};replace(EMAIL,'EMAIL');replace(PHONE,'PHONE');replace(CARD,'PAYMENT');replace(PLATE,'PLATE');return{text:out,tokens};}
  sanitizeContext(input={}){const cloned=structuredClone(input);const walk=(v,key=null)=>{if(key&&BLOCKED_KEYS.has(key))return undefined;if(typeof v==='string')return this.sanitizeText(v).text;if(Array.isArray(v))return v.map(x=>walk(x)).filter(x=>x!==undefined);if(v&&typeof v==='object'){const o={};for(const [k,val] of Object.entries(v)){const clean=walk(val,k);if(clean!==undefined)o[k]=clean;}return o}return v};return walk(cloned)||{};}
  prepareExternal({text='',context={},media=[]}={}){if(!this.allowExternal)throw Object.assign(new Error('external AI disabled by privacy gateway'),{code:'PRIVACY_EXTERNAL_DISABLED'});const cleanText=this.sanitizeText(text);const cleanContext=this.sanitizeContext(context);const safeMedia=(media||[]).filter(x=>x?.sanitized===true).map(x=>({id:x.id,type:x.type,url:x.url||null,redactions:x.redactions||[]}));return{text:cleanText.text,context:cleanContext,media:safeMedia,privacy:{piiTokens:cleanText.tokens.length,rawMediaForwarded:false,sanitizedMediaForwarded:safeMedia.length}};}
  async prepare({input={},providerId=null,capability=null,metadata={}}={}){
    if(!this.allowExternal)throw Object.assign(new Error('external AI disabled by privacy gateway'),{code:'PRIVACY_EXTERNAL_DISABLED'});
    const safeFrames=Array.isArray(input.frames)?input.frames.filter(x=>x?.sanitized===true&&typeof x.dataUrl==='string').slice(0,4).map(x=>({dataUrl:x.dataUrl,atMs:Number(x.atMs)||0,sanitized:true})):[];
    const base={...structuredClone(input)};delete base.frames;const prepared=this.sanitizeContext(base);if(safeFrames.length)prepared.frames=safeFrames;
    return {...prepared,__privacy:{providerId,capability,rawMediaForwarded:false,sanitizedMediaForwarded:safeFrames.length,minimumNecessary:true,metadata:this.sanitizeContext(metadata)}};
  }
}
