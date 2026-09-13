import crypto from 'node:crypto';

export const CATEGORY_SCHEMA_BLOCKS=Object.freeze(['identity','taxonomy','attributes','variants','condition','compatibility','media','commerce','logistics','search','vision','negotiation','moderation','returns','ai','analytics']);

export class CategorySchemaService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async put(ctx,input={}){
    if(!input.categoryId)throw new Error('categoryId required');
    const repo=this.repoFactory(ctx);const current=(await repo.list('CategorySchema')).filter(x=>x.categoryId===input.categoryId).sort((a,b)=>Number(b.version||0)-Number(a.version||0))[0];
    const contract=normalizeContract(input);
    const rec={
      id:input.id||`catschema_${crypto.randomUUID()}`,categoryId:input.categoryId,
      version:Number(input.version||((current?.version||0)+1)),status:input.status||'active',
      contract,
      // Compatibility fields are retained while callers migrate to contract.*.
      attributes:structuredClone(contract.attributes||{}),mandatoryFields:[...new Set(input.mandatoryFields||contract.identity?.mandatoryFields||[])],
      compatibilityRules:structuredClone(input.compatibilityRules||contract.compatibility?.rules||[]),
      visualCapabilities:[...new Set(input.visualCapabilities||contract.media?.visualCapabilities||[])],
      moderation:structuredClone(contract.moderation||{}),createdAt:input.createdAt||this.now().toISOString(),updatedAt:this.now().toISOString()
    };
    await repo.put('CategorySchema',rec);return rec;
  }
  async active(ctx,categoryId){const rows=(await this.repoFactory(ctx).list('CategorySchema')).filter(x=>x.categoryId===categoryId&&x.status==='active').sort((a,b)=>Number(b.version||0)-Number(a.version||0));return rows[0]||null;}
  async validate(ctx,product={}){
    const schema=await this.active(ctx,product.categoryId||product.category);if(!schema)return{valid:true,missing:[],errors:[],schema:null};
    const attrs=schema.contract?.attributes||schema.attributes||{};const mandatory=[...new Set([...(schema.mandatoryFields||[]),...(schema.contract?.identity?.mandatoryFields||[])])];
    const missing=[];for(const f of mandatory){if(product[f]==null&&product.attributes?.[f]==null)missing.push(f)}
    const errors=[];for(const [k,def] of Object.entries(attrs)){const v=product.attributes?.[k]??product[k];if(v==null)continue;if(def?.type==='number'&&Number.isNaN(Number(v)))errors.push(`${k}:number`);if(def?.type==='array'&&!Array.isArray(v))errors.push(`${k}:array`);if(def?.enum&&!def.enum.includes(v))errors.push(`${k}:enum`)}
    return{valid:missing.length===0&&errors.length===0,missing,errors,schema};
  }
  async validateProduct(ctx,product={}){return this.validate(ctx,product);}
}

function normalizeContract(input={}){
  const source=input.contract||{};const out={};for(const block of CATEGORY_SCHEMA_BLOCKS)out[block]=structuredClone(source[block]??input[block]??{});
  out.identity={...(out.identity||{}),categoryId:input.categoryId,...(out.identity||{})};
  if(input.attributes)out.attributes=structuredClone(input.attributes);
  if(input.compatibilityRules)out.compatibility={...(out.compatibility||{}),rules:structuredClone(input.compatibilityRules)};
  if(input.visualCapabilities)out.media={...(out.media||{}),visualCapabilities:[...new Set(input.visualCapabilities)]};
  if(input.moderation)out.moderation=structuredClone(input.moderation);
  return out;
}
