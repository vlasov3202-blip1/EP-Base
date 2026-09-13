import crypto from 'node:crypto';

const FLOW={created:['accepted','cancelled'],accepted:['packing','cancelled'],packing:['shipped','cancelled'],shipped:['delivered','returned'],delivered:[],returned:[],cancelled:[]};
function assertTransition(from,to){if(!(FLOW[from]||[]).includes(to))throw new Error(`invalid order transition:${from}->${to}`)}
function cleanItems(items){if(!Array.isArray(items)||!items.length)throw new Error('order items required');return items.map(i=>({productId:String(i.productId),name:String(i.name||''),qty:Math.max(1,Number(i.qty)||1),unitPrice:Math.max(0,Number(i.unitPrice)||0)}))}

export class OrderService{
  constructor({repo,audit,events,shipmentProvider=null}={}){this.repo=repo;this.audit=audit;this.events=events;this.shipmentProvider=shipmentProvider}
  async create(ctx,{buyerId,items,currency='RUB',channel='eineiro_market',externalOrderId=null,shipping={}}={}){
    const normalized=cleanItems(items);const total=normalized.reduce((s,i)=>s+i.qty*i.unitPrice,0);
    const order={id:crypto.randomUUID(),buyerId:String(buyerId||'guest'),items:normalized,total,currency,channel,externalOrderId,status:'created',shipping:{...shipping},shipment:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    await this.repo.put(ctx,'Order',order);this.audit?.write(ctx,{action:'order.create',entity:'Order',entityId:order.id,meta:{total,channel}});this.events?.emit(ctx,'order.created',{orderId:order.id,total,channel});return order;
  }
  async get(ctx,id){return this.repo.get(ctx,'Order',id)}
  async list(ctx){return this.repo.list(ctx,'Order')}
  async transition(ctx,id,to,{actor='system',meta={}}={}){
    const order=await this.get(ctx,id);if(!order)throw new Error('order not found');assertTransition(order.status,to);order.status=to;order.updatedAt=new Date().toISOString();await this.repo.put(ctx,'Order',order);this.audit?.write(ctx,{action:`order.${to}`,entity:'Order',entityId:id,meta:{actor,...meta}});this.events?.emit(ctx,`order.${to}`,{orderId:id,...meta});return order;
  }
  async accept(ctx,id){return this.transition(ctx,id,'accepted')}
  async startPacking(ctx,id){return this.transition(ctx,id,'packing')}
  async createShipment(ctx,id,{provider='manual',service='standard'}={}){
    const order=await this.get(ctx,id);if(!order)throw new Error('order not found');if(order.status!=='packing')throw new Error('shipment requires packing status');
    let shipment={id:crypto.randomUUID(),provider,service,status:'created',tracking:null,createdAt:new Date().toISOString()};
    if(this.shipmentProvider?.createShipment) shipment={...shipment,...await this.shipmentProvider.createShipment({ctx,order,provider,service})};
    order.shipment=shipment;order.updatedAt=new Date().toISOString();await this.repo.put(ctx,'Order',order);this.events?.emit(ctx,'shipment.created',{orderId:id,shipmentId:shipment.id,provider});return shipment;
  }
  async markShipped(ctx,id,{tracking=null}={}){
    const order=await this.get(ctx,id);if(!order)throw new Error('order not found');if(!order.shipment)order.shipment={id:crypto.randomUUID(),provider:'manual',service:'standard',status:'created',tracking:null,createdAt:new Date().toISOString()};
    const updated=await this.transition(ctx,id,'shipped',{meta:{tracking}});updated.shipment={...updated.shipment,status:'shipped',tracking:tracking||updated.shipment.tracking||null,shippedAt:new Date().toISOString()};await this.repo.put(ctx,'Order',updated);this.events?.emit(ctx,'shipment.shipped',{orderId:id,tracking:updated.shipment.tracking});return updated;
  }
  async syncTracking(ctx,id){const order=await this.get(ctx,id);if(!order?.shipment)throw new Error('shipment not found');if(!this.shipmentProvider?.track)return order.shipment;const status=await this.shipmentProvider.track({ctx,order,shipment:order.shipment});order.shipment={...order.shipment,...status,checkedAt:new Date().toISOString()};await this.repo.put(ctx,'Order',order);if(order.shipment.status==='delivered'&&order.status==='shipped')await this.transition(ctx,id,'delivered');return order.shipment}
}

export class InMemoryShipmentProvider{
  constructor(){this.map=new Map()}
  async createShipment({order,provider,service}){const id=crypto.randomUUID(),tracking=`EIN-${order.id.slice(0,8).toUpperCase()}`;const s={id,provider,service,tracking,status:'created'};this.map.set(tracking,s);return s}
  async track({shipment}){return this.map.get(shipment.tracking)||shipment}
  setStatus(tracking,status){const s=this.map.get(tracking);if(s)this.map.set(tracking,{...s,status})}
}
