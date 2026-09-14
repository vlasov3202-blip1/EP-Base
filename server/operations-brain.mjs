import crypto from 'node:crypto';

export class OperationsBrain{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async snapshot(ctx){const repo=this.repoFactory(ctx);const [campaigns,leads,products,tasks,orders,payments,shipments,finance,exceptions]=await Promise.all(['MarketingCampaign','Lead','Product','Task','Order','Payment','Shipment','FinanceEntry','Exception'].map(e=>repo.list(e)));return{campaigns,leads,products,tasks,orders,payments,shipments,finance,exceptions};}
  async analyze(ctx){const s=await this.snapshot(ctx);const signals=[];
    const activeCampaigns=s.campaigns.filter(x=>x.status==='active');for(const c of activeCampaigns){const roas=c.spent?c.revenue/c.spent:null;if(roas!=null&&roas<1.5&&c.spent>0)signals.push(sig('marketing','bad','Реклама расходует бюджет с низкой окупаемостью',{campaignId:c.id,roas},'reduce_marketing'))}
    const slowLeads=s.leads.filter(x=>Number(x.firstResponse||0)>5&& !['won','lost'].includes(x.status));if(slowLeads.length)signals.push(sig('sales','warn',`${slowLeads.length} обращений вышли за срок первого ответа`,{leadIds:slowLeads.map(x=>x.id)},'rebalance_sales'));
    const highDemand=s.products.filter(x=>Number(x.demand||0)>=80);for(const p of highDemand){const stock=Number(p.quantity??p.stock??0);if(stock>0&&stock<=2)signals.push(sig('warehouse','warn',`Высокий спрос при низком остатке: ${p.name||p.id}`,{productId:p.id,stock,demand:p.demand},'prioritize_restock'))}
    const unpaid=s.orders.filter(o=>['created','accepted'].includes(o.status)&&!s.payments.some(p=>p.orderId===o.id&&['succeeded','paid'].includes(p.status)));if(unpaid.length)signals.push(sig('payments','warn',`${unpaid.length} заказов ожидают оплату`,{orderIds:unpaid.map(x=>x.id)},'payment_followup'));
    const stuck=s.shipments.filter(x=>{const trackedAt=x.trackingUpdatedAt||x.statusUpdatedAt||x.updatedAt||x.createdAt;return ['created','in_transit'].includes(x.status)&&trackedAt&&this.now().getTime()-Date.parse(trackedAt)>48*3600_000});if(stuck.length)signals.push(sig('logistics','bad',`${stuck.length} отправлений без обновления более 48 часов`,{shipmentIds:stuck.map(x=>x.id)},'sync_logistics'));
    const income=s.finance.filter(x=>x.type==='income').reduce((a,x)=>a+Number(x.amount||0),0);const expense=s.finance.filter(x=>x.type==='expense').reduce((a,x)=>a+Number(x.amount||0),0);if(expense>income&&expense>0)signals.push(sig('finance','bad','Расходы превышают доходы',{income,expense},'protect_cashflow',true));
    const failedTasks=s.tasks.filter(x=>['failed','not_done'].includes(x.status));if(failedTasks.length>=3)signals.push(sig('operations','bad','Повторяющиеся невыполненные задачи',{count:failedTasks.length},'staff_correction',true));
    return{signals,summary:{marketing:activeCampaigns.length,sales:s.leads.length,products:s.products.length,orders:s.orders.length,payments:s.payments.length,shipments:s.shipments.length,income,expense,cashflow:income-expense},generatedAt:this.now().toISOString()};
  }
  async plan(ctx){const repo=this.repoFactory(ctx);const analysis=await this.analyze(ctx);const actions=[];for(const s of analysis.signals){const rec={id:`act_${crypto.randomUUID()}`,domain:s.domain,action:s.action,reason:s.message,requiresOwner:s.requiresOwner,status:s.requiresOwner?'waiting_owner':'planned',evidence:s.evidence,createdAt:this.now().toISOString()};await repo.put('OperationalAction',rec);actions.push(rec);if(s.requiresOwner)await repo.put('Exception',{id:`exc_${rec.id}`,type:s.domain,title:s.message,detail:s.action,severity:'bad',requiresOwner:true,status:'open',evidence:s.evidence,createdAt:this.now().toISOString()});}
    return{...analysis,actions};
  }
}
function sig(domain,severity,message,evidence,action,requiresOwner=false){return{domain,severity,message,evidence,action,requiresOwner}}
