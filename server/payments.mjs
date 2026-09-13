import crypto from 'node:crypto';

export class PaymentProviderRegistry {
  #providers=new Map();
  register(name,provider){if(!name||!provider)throw new Error('provider required');this.#providers.set(name,provider);return this}
  get(name){const p=this.#providers.get(name);if(!p)throw new Error(`payment provider not registered:${name}`);return p}
  list(){return [...this.#providers.keys()]}
}

export class PaymentService {
  constructor({repo,audit,events,providers}){this.repo=repo;this.audit=audit;this.events=events;this.providers=providers}
  async create(ctx,{orderId,amount,currency='RUB',provider='default',idempotencyKey}){
    if(!idempotencyKey)throw new Error('idempotencyKey required');
    const existing=this.repo.list(ctx,'Payment').find(x=>x.idempotencyKey===idempotencyKey);
    if(existing)return existing;
    const adapter=this.providers.get(provider);
    const remote=await adapter.createPayment({orderId,amount,currency,idempotencyKey});
    const payment={id:crypto.randomUUID(),orderId,amount,currency,provider,idempotencyKey,providerPaymentId:remote.id,status:remote.status||'pending',confirmationUrl:remote.confirmationUrl||null,refundedAmount:0,createdAt:new Date().toISOString()};
    this.repo.put(ctx,'Payment',payment);this.events.emit(ctx,'payment.created',{paymentId:payment.id,orderId});this.audit.write(ctx,{action:'payment.create',entity:'Payment',entityId:payment.id,meta:{provider,orderId}});return payment;
  }
  async sync(ctx,paymentId){const p=this.repo.get(ctx,'Payment',paymentId);if(!p)throw new Error('payment not found');const remote=await this.providers.get(p.provider).getPayment(p.providerPaymentId);const next={...p,status:remote.status||p.status};this.repo.put(ctx,'Payment',next);this.events.emit(ctx,'payment.synced',{paymentId,status:next.status});return next}
  async refund(ctx,paymentId,{amount,idempotencyKey}){const p=this.repo.get(ctx,'Payment',paymentId);if(!p)throw new Error('payment not found');if(!idempotencyKey)throw new Error('idempotencyKey required');const existing=this.repo.list(ctx,'Refund').find(x=>x.idempotencyKey===idempotencyKey);if(existing)return existing;const value=Math.min(Number(amount)||0,p.amount-p.refundedAmount);if(value<=0)throw new Error('refund amount invalid');const remote=await this.providers.get(p.provider).refund({providerPaymentId:p.providerPaymentId,amount:value,currency:p.currency,idempotencyKey});const refund={id:crypto.randomUUID(),paymentId,amount:value,idempotencyKey,providerRefundId:remote.id,status:remote.status||'pending',createdAt:new Date().toISOString()};this.repo.put(ctx,'Refund',refund);this.repo.put(ctx,'Payment',{...p,refundedAmount:p.refundedAmount+value,status:p.refundedAmount+value>=p.amount?'refunded':'partially_refunded'});this.events.emit(ctx,'payment.refunded',{paymentId,refundId:refund.id,amount:value});this.audit.write(ctx,{action:'payment.refund',entity:'Payment',entityId:paymentId,meta:{amount:value}});return refund}
}
