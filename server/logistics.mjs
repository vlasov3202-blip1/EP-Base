import crypto from 'node:crypto';

export class LogisticsProviderRegistry {
  #providers=new Map();
  register(name,provider){if(!name||!provider)throw new Error('provider required');this.#providers.set(name,provider);return this}
  get(name){const p=this.#providers.get(name);if(!p)throw new Error(`logistics provider not registered:${name}`);return p}
  list(){return [...this.#providers.keys()]}
}

export class ShipmentService {
  constructor({repo,audit,events,providers}){this.repo=repo;this.audit=audit;this.events=events;this.providers=providers}
  async create(ctx,{orderId,provider='default',from,to,packages=[],idempotencyKey}){
    if(!idempotencyKey)throw new Error('idempotencyKey required');
    const existing=this.repo.list(ctx,'Shipment').find(x=>x.idempotencyKey===idempotencyKey);if(existing)return existing;
    const remote=await this.providers.get(provider).createShipment({orderId,from,to,packages,idempotencyKey});
    const shipment={id:crypto.randomUUID(),orderId,provider,idempotencyKey,providerShipmentId:remote.id,status:remote.status||'created',trackingNumber:remote.trackingNumber||null,trackingUrl:remote.trackingUrl||null,eta:remote.eta||null,history:[],createdAt:new Date().toISOString()};
    this.repo.put(ctx,'Shipment',shipment);this.events.emit(ctx,'shipment.created',{shipmentId:shipment.id,orderId});this.audit.write(ctx,{action:'shipment.create',entity:'Shipment',entityId:shipment.id,meta:{provider,orderId}});return shipment;
  }
  async sync(ctx,shipmentId){const s=this.repo.get(ctx,'Shipment',shipmentId);if(!s)throw new Error('shipment not found');const remote=await this.providers.get(s.provider).getShipment(s.providerShipmentId);const stamp={at:new Date().toISOString(),status:remote.status||s.status};const next={...s,status:remote.status||s.status,trackingNumber:remote.trackingNumber||s.trackingNumber,trackingUrl:remote.trackingUrl||s.trackingUrl,eta:remote.eta||s.eta,history:[...(s.history||[]),stamp]};this.repo.put(ctx,'Shipment',next);this.events.emit(ctx,'shipment.synced',{shipmentId,status:next.status});return next}
  async cancel(ctx,shipmentId){const s=this.repo.get(ctx,'Shipment',shipmentId);if(!s)throw new Error('shipment not found');const remote=await this.providers.get(s.provider).cancelShipment(s.providerShipmentId);const next={...s,status:remote.status||'cancelled'};this.repo.put(ctx,'Shipment',next);this.audit.write(ctx,{action:'shipment.cancel',entity:'Shipment',entityId:shipmentId});return next}
}
