import crypto from 'node:crypto';
import {normalizeCondition} from './condition-engine.mjs';

export class ImportMappingService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async save(ctx,{name='mapping',sourceType='csv',mapping={},categoryHints={}}={}){const rec={id:`map_${crypto.randomUUID()}`,name,sourceType,mapping:structuredClone(mapping),categoryHints:structuredClone(categoryHints),createdAt:this.now().toISOString(),updatedAt:this.now().toISOString()};await this.repoFactory(ctx).put('ImportMapping',rec);return rec;}
  async suggest(ctx,{headers=[],sampleRows=[]}={}){const norm=x=>String(x||'').trim().toLowerCase();const synonyms={name:['name','title','название','наименование'],description:['description','desc','описание'],price:['price','цена','стоимость'],stock:['stock','qty','quantity','остаток','количество'],sku:['sku','артикул','article'],category:['category','категория'],condition:['condition','состояние'],sellerId:['seller','sellerid','продавец'],region:['region','регион'],images:['images','photo','photos','фото']};const mapping={};for(const h of headers){const n=norm(h);for(const [target,words] of Object.entries(synonyms))if(words.includes(n)&&mapping[target]==null)mapping[target]=h;}return{mapping,confidence:Object.keys(mapping).length/Math.max(1,headers.length),sampleRows:sampleRows.slice(0,3)};}
}

export class UniversalImportEngineV2{
  constructor({repoFactory,categorySchema=null,moderation=null,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.categorySchema=categorySchema;this.moderation=moderation;this.now=now;}
  async importRows(ctx,{rows=[],mapping={},reverseInventory=false,defaultSellerId=null,source='csv'}={}){
    const repo=this.repoFactory(ctx);const result={source,total:rows.length,imported:0,duplicates:0,errors:[],products:[],offers:[],skus:[],inventory:[]};
    for(let i=0;i<rows.length;i++){
      try{
        const row=rows[i];const p=mapRow(row,mapping);if(!p.name)throw new Error('name required');const sellerId=p.sellerId||defaultSellerId||'import';const condition=normalizeCondition(p.condition,{fallback:'USED'});
        const dedupKey=crypto.createHash('sha256').update(JSON.stringify({source,sellerId,sku:p.sku||null,name:p.name,category:p.category||'uncategorized'})).digest('hex');const existing=(await repo.list('ImportRow')).find(x=>x.dedupKey===dedupKey&&x.status==='imported');if(existing){result.duplicates++;continue;}
        const product={id:`prd_${crypto.randomUUID()}`,name:p.name,description:p.description||'',categoryId:p.category||'uncategorized',attributes:p.attributes||{},images:normalizeImages(p.images),status:'active',createdAt:this.now().toISOString()};
        if(this.categorySchema){const v=await this.categorySchema.validateProduct(ctx,product);if(!v.valid)throw new Error(`category validation: ${[...(v.missing||[]),...(v.errors||[])].join(', ')}`);}
        if(this.moderation){const m=await this.moderation.checkProduct?.(ctx,product);if(m&&m.allowed===false)throw new Error(`moderation: ${(m.issues||m.reasons||[]).map?.(x=>x.code||x)?.join(', ')||'blocked'}`);}
        await repo.put('Product',product);
        const sku={id:`sku_${crypto.randomUUID()}`,productId:product.id,code:p.sku||null,condition,attributes:structuredClone(p.skuAttributes||{}),status:'active',createdAt:this.now().toISOString()};await repo.put('SKU',sku);
        const price=Number(p.price||0);if(!Number.isFinite(price)||price<0)throw new Error('invalid price');const mediaReady=product.images.length>0;const offer={id:`off_${crypto.randomUUID()}`,productId:product.id,skuId:sku.id,sellerId,price,condition,stock:Number(p.stock||0),region:p.region||null,deliveryOptions:[],status:'active',visualAssetReady:mediaReady,visualQualityScore:mediaReady?60:0,freshnessAt:this.now().toISOString(),createdAt:this.now().toISOString()};await repo.put('Offer',offer);
        const inv={id:`inv_${crypto.randomUUID()}`,productId:product.id,skuId:sku.id,quantity:Number(p.stock||0),reserved:0,location:reverseInventory?null:(p.location||null),placementStatus:reverseInventory?'unassigned':'assigned',createdAt:this.now().toISOString()};await repo.put('InventoryUnit',inv);
        await repo.put('ImportRow',{id:`import-row:${dedupKey}`,dedupKey,source,sellerId,productId:product.id,skuId:sku.id,offerId:offer.id,status:'imported',createdAt:this.now().toISOString()});
        result.imported++;result.products.push(product.id);result.offers.push(offer.id);result.skus.push(sku.id);result.inventory.push(inv.id);
      }catch(e){result.errors.push({row:i+1,error:String(e.message||e)})}
    }
    return result;
  }
}
function mapRow(row,mapping){const get=k=>mapping[k]?row[mapping[k]]:row[k];return{name:get('name'),description:get('description'),price:get('price'),stock:get('stock'),sku:get('sku'),category:get('category'),condition:get('condition'),sellerId:get('sellerId'),region:get('region'),images:get('images'),location:get('location'),attributes:parseMaybeJson(get('attributes')),skuAttributes:parseMaybeJson(get('skuAttributes'))}}
function parseMaybeJson(v){if(v&&typeof v==='object')return structuredClone(v);if(typeof v!=='string'||!v.trim())return{};try{return JSON.parse(v)}catch{return{}}}
function normalizeImages(v){if(Array.isArray(v))return v;if(typeof v==='string')return v.split(/[;,|]/).map(x=>x.trim()).filter(Boolean);return[]}
