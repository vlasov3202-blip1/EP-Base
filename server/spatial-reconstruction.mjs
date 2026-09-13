export const RECONSTRUCTION_CAPABILITIES=Object.freeze(['LIDAR','PHOTOGRAMMETRY','IMPORTED']);

export class SpatialReconstructionProvider{
  constructor({id,capabilities=[],reconstruct,healthCheck=null}={}){if(!id)throw new Error('provider id required');if(typeof reconstruct!=='function')throw new Error('reconstruct function required');this.id=id;this.capabilities=new Set(capabilities);this.reconstructFn=reconstruct;this.healthCheck=healthCheck;}
  supports(method){return this.capabilities.has(method);}
  async reconstruct(input){return this.reconstructFn(input);}
  async health(){return this.healthCheck?this.healthCheck():{ok:true};}
}

export class SpatialReconstructionRouter{
  constructor({providers=[]}={}){this.providers=[];for(const p of providers)this.register(p);}
  register(provider){if(!(provider instanceof SpatialReconstructionProvider))throw new Error('invalid reconstruction provider');if(this.providers.some(x=>x.id===provider.id))throw new Error('duplicate provider');this.providers.push(provider);return provider;}
  async run(input={}){
    const method=input.captureMethod;
    const candidates=this.providers.filter(p=>p.supports(method));
    if(!candidates.length)return{status:'fallback',reason:'NO_RECONSTRUCTION_PROVIDER',result:null};
    const failures=[];
    for(const provider of candidates){
      try{
        const health=await provider.health();if(health?.ok===false){failures.push({providerId:provider.id,error:'unhealthy'});continue;}
        const result=await provider.reconstruct(input);
        const validated=validateReconstruction(result,input);
        if(!validated.ok){failures.push({providerId:provider.id,error:validated.reason});continue;}
        return{status:'ready',providerId:provider.id,result:validated.result};
      }catch(error){failures.push({providerId:provider.id,error:String(error?.message||error)});}
    }
    return{status:'fallback',reason:'RECONSTRUCTION_FAILED',failures,result:null};
  }
}

export function validateReconstruction(result={},input={}){
  if(!result?.uri)return{ok:false,reason:'ASSET_URI_MISSING'};
  const dimensions=result.dimensions||input.dimensions||null;
  const confidence=Math.max(Number(result.dimensionConfidence||0),Number(input.dimensionConfidence||0));
  const hasScale=Boolean(result.scaleSource||input.scaleSource||dimensions);
  const exact=Boolean(dimensions&&hasScale&&confidence>=0.8);
  return{ok:true,result:{...result,dimensions,dimensionConfidence:confidence,scaleSource:result.scaleSource||input.scaleSource||null,exact,mode:exact?'MEASURED_3D':'VISUAL_FALLBACK'}};
}
