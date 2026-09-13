import crypto from 'node:crypto';

export class ModerationService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async review(ctx,{productId,categorySchema=null}={}){
    const repo=this.repoFactory(ctx);const p=await repo.get('Product',productId);if(!p)throw new Error('product not found');
    const schema=categorySchema||await latestSchema(repo,p.categoryId||p.category);const result=evaluateProduct(p,schema);
    const rec={id:`mod_${crypto.randomUUID()}`,productId,status:result.allowed?'approved':'blocked',issues:result.issues,reviewedAt:this.now().toISOString()};await repo.put('ModerationCase',rec);return rec;
  }
  async checkProduct(ctx,product={}){
    const repo=this.repoFactory(ctx);const schema=await latestSchema(repo,product.categoryId||product.category);return evaluateProduct(product,schema);
  }
}

async function latestSchema(repo,categoryId){if(!categoryId)return{};const rows=(await repo.list('CategorySchema')).filter(x=>x.categoryId===categoryId&&x.status==='active').sort((a,b)=>Number(b.version||0)-Number(a.version||0));const schema=rows[0]||{};return schema.contract?.moderation?{...schema.contract.moderation,mandatoryFields:schema.mandatoryFields||schema.contract.identity?.mandatoryFields||[]}:schema.moderation?{...schema.moderation,mandatoryFields:schema.mandatoryFields||[]}:schema;}

function evaluateProduct(p={},categorySchema={}){
  const issues=[];if(categorySchema.forbidden)issues.push({code:'category_forbidden',severity:'block'});
  for(const f of categorySchema.mandatoryFields||[])if(p[f]==null&&p.attributes?.[f]==null)issues.push({code:'missing_field',field:f,severity:'block'});
  for(const d of categorySchema.documents||[])if(!(p.documents||[]).some(x=>x.type===d))issues.push({code:'missing_document',document:d,severity:'block'});
  for(const c of categorySchema.certificates||[])if(!(p.certificates||[]).some(x=>x.type===c))issues.push({code:'missing_certificate',certificate:c,severity:'block'});
  if(categorySchema.age&&Number(p.ageRestriction||0)<Number(categorySchema.age))issues.push({code:'age_restriction_missing',severity:'block'});
  if(categorySchema.restricted===true)issues.push({code:'category_restricted',severity:'review'});
  return{allowed:!issues.some(x=>x.severity==='block'),issues};
}
