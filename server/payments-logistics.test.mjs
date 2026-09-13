import assert from 'node:assert/strict';
import {createServices} from './core.mjs';
import {PaymentProviderRegistry,PaymentService} from './payments.mjs';
import {LogisticsProviderRegistry,ShipmentService} from './logistics.mjs';

const a={userId:'u1',companyId:'c1',role:'owner'};const b={userId:'u2',companyId:'c2',role:'owner'};
const {repo,audit,events}=createServices();
let paymentCreates=0;let refunds=0;
const paymentProvider={
  async createPayment({idempotencyKey}){paymentCreates++;return{id:'pp-'+idempotencyKey,status:'pending',confirmationUrl:'https://pay.test/'+idempotencyKey}},
  async getPayment(){return{id:'pp',status:'succeeded'}},
  async refund({idempotencyKey}){refunds++;return{id:'rf-'+idempotencyKey,status:'succeeded'}}
};
const payments=new PaymentService({repo,audit,events,providers:new PaymentProviderRegistry().register('test',paymentProvider)});
const p1=await payments.create(a,{orderId:'o1',amount:1000,provider:'test',idempotencyKey:'pay-1'});
const p2=await payments.create(a,{orderId:'o1',amount:1000,provider:'test',idempotencyKey:'pay-1'});
assert.equal(p1.id,p2.id);assert.equal(paymentCreates,1);assert.equal(repo.list(b,'Payment').length,0);
const synced=await payments.sync(a,p1.id);assert.equal(synced.status,'succeeded');
const r1=await payments.refund(a,p1.id,{amount:400,idempotencyKey:'refund-1'});const r2=await payments.refund(a,p1.id,{amount:400,idempotencyKey:'refund-1'});assert.equal(r1.id,r2.id);assert.equal(refunds,1);

let shipments=0;
const logisticsProvider={
 async createShipment({idempotencyKey}){shipments++;return{id:'sh-'+idempotencyKey,status:'created',trackingNumber:'TRK1'}},
 async getShipment(){return{id:'sh',status:'in_transit',trackingNumber:'TRK1',trackingUrl:'https://track/TRK1'}},
 async cancelShipment(){return{id:'sh',status:'cancelled'}}
};
const delivery=new ShipmentService({repo,audit,events,providers:new LogisticsProviderRegistry().register('test',logisticsProvider)});
const s1=await delivery.create(a,{orderId:'o1',provider:'test',from:{city:'A'},to:{city:'B'},packages:[{weight:2}],idempotencyKey:'ship-1'});const s2=await delivery.create(a,{orderId:'o1',provider:'test',from:{},to:{},packages:[],idempotencyKey:'ship-1'});assert.equal(s1.id,s2.id);assert.equal(shipments,1);assert.equal(repo.list(b,'Shipment').length,0);
const ss=await delivery.sync(a,s1.id);assert.equal(ss.status,'in_transit');assert.equal(ss.trackingNumber,'TRK1');
const sc=await delivery.cancel(a,s1.id);assert.equal(sc.status,'cancelled');
console.log('EINEIRO payments/logistics tests: OK');
