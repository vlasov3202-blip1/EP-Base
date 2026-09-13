import crypto from 'node:crypto';

export class SkuInventoryService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async createSku(ctx,{productId,code=null,attributes={},barcode=null}={}){const repo=this.repoFactory(ctx);if(!await repo.get('Product',productId))throw new Error('product not found');const rec={id:`sku_${crypto.randomUUID()}`,productId,code:code||null,attributes:structuredClone(attributes),barcode:barcode||null,status:'active',createdAt:this.now().toISOString()};await repo.put('SKU',rec);return rec;}
  async setStock(ctx,{skuId,locationId,quantity,reserved=0}={}){const repo=this.repoFactory(ctx);const sku=await repo.get('SKU',skuId);if(!sku)throw new Error('sku not found');const id=`stock:${skuId}:${locationId}`;const rec={id,skuId,productId:sku.productId,locationId,quantity:Number(quantity)||0,reserved:Number(reserved)||0,available:Math.max(0,(Number(quantity)||0)-(Number(reserved)||0)),updatedAt:this.now().toISOString()};await repo.put('InventoryUnit',rec);return rec;}
  async availability(ctx,skuId){const rows=(await this.repoFactory(ctx).list('InventoryUnit')).filter(x=>x.skuId===skuId);return{skuId,quantity:rows.reduce((s,x)=>s+Number(x.quantity||0),0),reserved:rows.reduce((s,x)=>s+Number(x.reserved||0),0),available:rows.reduce((s,x)=>s+Number(x.available||0),0),locations:rows};}
}
