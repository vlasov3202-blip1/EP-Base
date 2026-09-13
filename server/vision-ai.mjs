import crypto from 'node:crypto';

const DEFAULT_SCHEMA={
  type:'object',additionalProperties:false,
  properties:{
    intent:{type:'string'},
    category:{type:'string'},
    object:{type:['string','null']},
    problem:{type:['string','null']},
    attributes:{type:'object',additionalProperties:{type:['string','number','boolean','null']}},
    searchQuery:{type:'string'},
    confidence:{type:'number',minimum:0,maximum:1},
    needsClarification:{type:'boolean'},
    clarificationQuestion:{type:['string','null']}
  },
  required:['intent','category','object','problem','attributes','searchQuery','confidence','needsClarification','clarificationQuestion']
};

export function sampleFrames(frames,{maxFrames=4,minGapMs=500}={}){
  const sorted=[...frames].filter(f=>f?.dataUrl&&Number.isFinite(f.atMs)).sort((a,b)=>a.atMs-b.atMs);
  const picked=[];
  for(const frame of sorted){
    if(picked.length>=maxFrames)break;
    if(!picked.length||frame.atMs-picked[picked.length-1].atMs>=minGapMs)picked.push(frame);
  }
  if(sorted.length&&picked.length<maxFrames){
    const last=sorted.at(-1);
    if(!picked.some(x=>x.atMs===last.atMs))picked.push(last);
  }
  return picked.slice(0,maxFrames);
}

export function minimizeVisionPayload({frames=[],voiceText='',locale='ru-RU'}={}){
  return {
    requestId:crypto.randomUUID(),
    frames:sampleFrames(frames).map(({dataUrl,atMs})=>({dataUrl,atMs})),
    voiceText:String(voiceText||'').slice(0,2000),
    locale,
    metadata:{device:null,userId:null,geo:null,filename:null,exif:false}
  };
}

export class VisionAnonymizer {
  async anonymize(payload){return minimizeVisionPayload(payload);}
}

export class OpenAIResponsesGateway {
  constructor({apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL,fetchImpl=globalThis.fetch,baseUrl='https://api.openai.com/v1'}={}){
    if(!apiKey)throw new Error('OPENAI_API_KEY required');
    if(!model)throw new Error('OPENAI_MODEL required');
    this.apiKey=apiKey;this.model=model;this.fetch=fetchImpl;this.baseUrl=baseUrl.replace(/\/$/,'');
  }
  async understand({frames,voiceText,locale='ru-RU'}){
    const content=[{type:'input_text',text:`Locale: ${locale}\nVoice/context: ${voiceText||'(none)'}\nUnderstand what the user wants to find or solve. Return only the structured intent.`}];
    for(const frame of frames||[])content.push({type:'input_image',image_url:frame.dataUrl,detail:'low'});
    const body={model:this.model,store:false,instructions:'You are EINEIRO Vision Search. Infer product-search intent from camera frames plus speech. Do not identify people. Ignore faces, names, addresses, license plates and other personal identifiers. Focus only on objects, product-relevant attributes and the user problem. If confidence is low, request one concise clarification.',input:[{role:'user',content}],text:{format:{type:'json_schema',name:'eineiro_vision_intent',strict:true,schema:DEFAULT_SCHEMA}}};
    const res=await this.fetch(`${this.baseUrl}/responses`,{method:'POST',headers:{Authorization:`Bearer ${this.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const json=await res.json().catch(()=>({}));
    if(!res.ok)throw Object.assign(new Error(json?.error?.message||`OpenAI error ${res.status}`),{status:res.status,body:json});
    const text=json.output_text||json.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;
    if(!text)throw new Error('OpenAI response did not contain structured output');
    return {...JSON.parse(text),provider:'openai',model:this.model,responseId:json.id,usage:json.usage||null};
  }
}

function adaptiveSpatialShortlist(items,{max=3,minRelevance=.72}={}){
  const relevant=(items||[]).filter(x=>Number(x.relevance??x.score??0)>=minRelevance);
  if(!relevant.length)return[];
  const top=relevant.slice(0,max);
  const r=i=>Number(top[i]?.relevance??top[i]?.score??0);
  if(top.length===1)return top;
  if(r(0)-r(1)>=.18)return top.slice(0,1);
  if(top.length===2||r(1)-r(2)>=.14)return top.slice(0,2);
  return top;
}

export class VisionSearchService {
  constructor({anonymizer=new VisionAnonymizer(),provider,search,events=null,audit=null,catalogPageSize=24,maxCatalogPageSize=100}={}){
    if(!provider)throw new Error('vision provider required');
    if(typeof search!=='function')throw new Error('search function required');
    this.anonymizer=anonymizer;this.provider=provider;this.search=search;this.events=events;this.audit=audit;this.catalogPageSize=catalogPageSize;this.maxCatalogPageSize=maxCatalogPageSize;
  }
  async resolve(ctx,input={}){
    const safe=await this.anonymizer.anonymize(input);
    const intent=await this.provider.understand(safe);
    const mode=intent.confidence<0.72||intent.needsClarification?'clarify':'search';
    let catalog={items:[],total:0,nextCursor:null};
    let spatialOffers=[];
    if(mode==='search'){
      const limit=Math.max(1,Math.min(Number(input.catalogLimit)||this.catalogPageSize,this.maxCatalogPageSize));
      const raw=await this.search(ctx,{query:intent.searchQuery,category:intent.category,attributes:intent.attributes,limit,cursor:input.cursor??null});
      catalog=Array.isArray(raw)?{items:raw,total:raw.length,nextCursor:null}:{items:raw.items||[],total:raw.total??(raw.items||[]).length,nextCursor:raw.nextCursor??null};
      spatialOffers=adaptiveSpatialShortlist(catalog.items);
    }
    this.events?.emit?.(ctx,'vision.intent',{requestId:safe.requestId,mode,confidence:intent.confidence,category:intent.category,catalogCount:catalog.items.length,spatialCount:spatialOffers.length});
    this.audit?.write?.(ctx,{action:'vision.resolve',entity:'VisionRequest',entityId:safe.requestId,meta:{mode,confidence:intent.confidence,catalogCount:catalog.items.length,spatialCount:spatialOffers.length}});
    return {requestId:safe.requestId,mode,intent,spatialOffers,catalog};
  }
}
