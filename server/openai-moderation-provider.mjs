const DECISIONS=['AUTO_APPROVED','SELLER_ACTION_REQUIRED','AUTO_REJECTED'];

export class OpenAiCompatibleModerationProvider{
  constructor({
    apiKey,
    baseUrl='https://api.openai.com/v1',
    model='gpt-5-mini',
    id='openai-moderation',
    fetchImpl=globalThis.fetch,
    timeoutMs=30000
  }={}){
    if(!apiKey)throw new Error('moderation AI apiKey required');
    if(typeof fetchImpl!=='function')throw new Error('fetch implementation required');
    this.id=id;
    this.apiKey=apiKey;
    this.baseUrl=String(baseUrl).replace(/\/$/,'');
    this.model=model;
    this.fetchImpl=fetchImpl;
    this.timeoutMs=Number(timeoutMs);
    this.capabilities=['moderation'];
    this.qualityScore=85;
    this.costScore=35;
  }

  async execute({capability,input,metadata={}}={}){
    if(capability!=='moderation')throw codedError('unsupported provider capability','UNSUPPORTED_AI_CAPABILITY');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try{
      const response=await this.fetchImpl(this.baseUrl+'/chat/completions',{
        method:'POST',
        headers:{
          'Authorization':'Bearer '+this.apiKey,
          'Content-Type':'application/json'
        },
        body:JSON.stringify({
          model:this.model,
          temperature:0,
          response_format:{
            type:'json_schema',
            json_schema:{
              name:'moderation_review',
              strict:true,
              schema:reviewSchema()
            }
          },
          messages:[
            {
              role:'system',
              content:'You are an evidence-bound commerce moderation classifier. Follow deterministic rule results, use only supplied evidence, never infer personal data, and return only the requested JSON.'
            },
            {role:'user',content:JSON.stringify(input)}
          ]
        }),
        signal:controller.signal
      });
      const payload=await response.json().catch(()=>null);
      if(!response.ok){
        const message=payload?.error?.message||('moderation AI HTTP '+response.status);
        throw codedError(message,'MODERATION_AI_HTTP_ERROR',response.status);
      }
      const raw=payload?.choices?.[0]?.message?.content;
      if(!raw)throw codedError('moderation AI returned no content','MODERATION_AI_EMPTY_RESPONSE',502);
      let review;
      try{review=JSON.parse(raw);}
      catch{throw codedError('moderation AI returned invalid JSON','MODERATION_AI_INVALID_JSON',502);}
      return{
        ...review,
        modelVersion:String(payload.model||this.model),
        promptPolicyVersion:String(input?.promptPolicyVersion||metadata?.promptPolicyVersion||'unknown'),
        usage:payload.usage||{},
        providerRequestId:payload.id||null
      };
    }catch(error){
      if(error?.name==='AbortError')throw codedError('moderation AI request timed out','MODERATION_AI_TIMEOUT',504);
      throw error;
    }finally{
      clearTimeout(timer);
    }
  }
}

function reviewSchema(){
  return{
    type:'object',
    additionalProperties:false,
    required:[
      'decision',
      'reasonCodes',
      'evidenceRefs',
      'confidence',
      'sellerMessage',
      'requiredActions',
      'safeDetails',
      'suspectedViolation'
    ],
    properties:{
      decision:{type:'string',enum:DECISIONS},
      reasonCodes:{type:'array',items:{type:'string'},maxItems:20},
      evidenceRefs:{type:'array',items:{type:'string'},maxItems:30},
      confidence:{type:'number',minimum:0,maximum:1},
      sellerMessage:{type:'string',maxLength:1000},
      requiredActions:{
        type:'array',
        maxItems:20,
        items:{
          type:'object',
          additionalProperties:false,
          required:['action','field','detail'],
          properties:{
            action:{type:'string'},
            field:{type:['string','null']},
            detail:{type:['string','null']}
          }
        }
      },
      safeDetails:{
        type:'object',
        additionalProperties:false,
        required:['summary','newPattern','legalJudgmentRequired','criticalHarm'],
        properties:{
          summary:{type:'string',maxLength:2000},
          newPattern:{type:'boolean'},
          legalJudgmentRequired:{type:'boolean'},
          criticalHarm:{type:'boolean'}
        }
      },
      suspectedViolation:{type:'boolean'}
    }
  };
}

function codedError(message,code,status=500){
  return Object.assign(new Error(message),{code,status});
}

export {reviewSchema as moderationReviewJsonSchema};
