import crypto from 'node:crypto';

export class FinanceLedgerService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async record(ctx,{type,amount,category,source='manual',orderId=null,mandatory=false,recurring=false,meta={}}={}){
    if(!['income','expense'].includes(type))throw new Error('finance type invalid');if(!(Number(amount)>0))throw new Error('amount must be positive');if(!category)throw new Error('category required');
    const rec={id:`fin_${crypto.randomUUID()}`,type,amount:Number(amount),category,source,orderId,mandatory:Boolean(mandatory),recurring:Boolean(recurring),meta:structuredClone(meta),createdAt:this.now().toISOString()};await this.repoFactory(ctx).put('FinanceEntry',rec);return rec;
  }
  async closeOrder(ctx,{order,acquiring=0,logistics=0,returns=0,promotion=0,services=0}={}){
    if(!order?.id)throw new Error('order required');const gross=Number(order.total||order.amount||0);const entries=[];
    if(gross>0)entries.push(await this.record(ctx,{type:'income',amount:gross,category:'sales',source:order.source||'market',orderId:order.id}));
    for(const [category,amount] of Object.entries({acquiring,logistics,returns,promotion,services}))if(Number(amount)>0)entries.push(await this.record(ctx,{type:'expense',amount:Number(amount),category,source:'order',orderId:order.id,mandatory:['acquiring','logistics','returns'].includes(category)}));
    return entries;
  }
  async summary(ctx,{from=null,to=null}={}){
    let items=await this.repoFactory(ctx).list('FinanceEntry');if(from)items=items.filter(x=>Date.parse(x.createdAt)>=Date.parse(from));if(to)items=items.filter(x=>Date.parse(x.createdAt)<=Date.parse(to));
    const income=items.filter(x=>x.type==='income').reduce((s,x)=>s+x.amount,0);const expenses=items.filter(x=>x.type==='expense').reduce((s,x)=>s+x.amount,0);const mandatory=items.filter(x=>x.type==='expense'&&x.mandatory).reduce((s,x)=>s+x.amount,0);const optional=expenses-mandatory;
    const byCategory={};for(const x of items){byCategory[x.category]=(byCategory[x.category]||0)+(x.type==='income'?x.amount:-x.amount)}
    const bySource={};for(const x of items.filter(x=>x.type==='income'))bySource[x.source]=(bySource[x.source]||0)+x.amount;
    return{income,expenses,mandatory,optional,cashflow:income-expenses,byCategory,bySource,count:items.length};
  }
}
