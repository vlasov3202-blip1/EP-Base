export class MarketReadRepository{
  constructor(store){if(!store?.listCompanyIds||!store?.tenant)throw new Error('market store required');this.store=store;}
  async list(entity){const ids=await this.store.listCompanyIds();const out=[];for(const companyId of ids){const rows=await this.store.tenant({companyId}).list(entity);for(const row of rows)out.push({...row,sourceCompanyId:row.sourceCompanyId||companyId});}return out;}
  async get(entity,id){const ids=await this.store.listCompanyIds();let found=null;for(const companyId of ids){const row=await this.store.tenant({companyId}).get(entity,id);if(!row)continue;if(found)throw Object.assign(new Error(`ambiguous market id:${entity}:${id}`),{code:'MARKET_ID_COLLISION'});found={...row,sourceCompanyId:row.sourceCompanyId||companyId};}return found;}
  async put(){throw Object.assign(new Error('MarketReadRepository is read-only'),{code:'MARKET_READ_ONLY'});}
  async remove(){throw Object.assign(new Error('MarketReadRepository is read-only'),{code:'MARKET_READ_ONLY'});}
}

export function marketRepoFactory(store){const repo=new MarketReadRepository(store);return()=>repo;}
