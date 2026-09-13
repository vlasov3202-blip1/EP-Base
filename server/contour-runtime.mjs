import {EVENTS} from './event-layer.mjs';

export function registerCoreContours({eventLayer,financeGuard,warehouse,procurement,marketing,channelAllocator,director,priceLab}={}){
  if(!eventLayer)throw new Error('eventLayer required');
  eventLayer.on(EVENTS.DEMAND_UNSERVED,async({ctx,event,repo})=>{
    await repo.put('ContourSignal',{id:`sig:${event.id}:procurement`,domain:'procurement',type:'unserved_demand',payload:event.payload,status:'open',createdAt:event.createdAt});
    if(procurement?.onUnservedDemand)await procurement.onUnservedDemand(ctx,event.payload);
  });
  eventLayer.on(EVENTS.INVENTORY_LOW,async({ctx,event,repo})=>{
    await repo.put('ContourSignal',{id:`sig:${event.id}:warehouse`,domain:'warehouse',type:'low_inventory',payload:event.payload,status:'open',createdAt:event.createdAt});
    if(warehouse?.onInventoryLow)await warehouse.onInventoryLow(ctx,event.payload);
    if(procurement?.onInventoryLow)await procurement.onInventoryLow(ctx,event.payload);
    if(marketing?.onInventoryLow)await marketing.onInventoryLow(ctx,event.payload);
  });
  eventLayer.on(EVENTS.ORDER_PAID,async({ctx,event})=>{if(financeGuard?.onOrderPaid)await financeGuard.onOrderPaid(ctx,event.payload);if(warehouse?.onOrderPaid)await warehouse.onOrderPaid(ctx,event.payload);if(director?.onOrderPaid)await director.onOrderPaid(ctx,event.payload)});
  eventLayer.on(EVENTS.ORDER_RETURNED,async({ctx,event})=>{if(financeGuard?.onReturn)await financeGuard.onReturn(ctx,event.payload);if(marketing?.onReturn)await marketing.onReturn(ctx,event.payload);if(director?.onReturn)await director.onReturn(ctx,event.payload)});
  eventLayer.on(EVENTS.MARKETING_RESULT,async({ctx,event})=>{if(financeGuard?.onMarketingResult)await financeGuard.onMarketingResult(ctx,event.payload);if(channelAllocator?.onMarketingResult)await channelAllocator.onMarketingResult(ctx,event.payload);if(director?.onMarketingResult)await director.onMarketingResult(ctx,event.payload)});
  eventLayer.on(EVENTS.PRICE_CHANGED,async({ctx,event})=>{if(marketing?.onPriceChanged)await marketing.onPriceChanged(ctx,event.payload);if(channelAllocator?.onPriceChanged)await channelAllocator.onPriceChanged(ctx,event.payload);if(director?.onPriceChanged)await director.onPriceChanged(ctx,event.payload)});
  eventLayer.on(EVENTS.SLA_BREACH,async({ctx,event})=>{if(director?.onSlaBreach)await director.onSlaBreach(ctx,event.payload)});
  eventLayer.on(EVENTS.SHIPMENT_DELAYED,async({ctx,event})=>{if(financeGuard?.onShipmentDelayed)await financeGuard.onShipmentDelayed(ctx,event.payload);if(director?.onShipmentDelayed)await director.onShipmentDelayed(ctx,event.payload)});
  return eventLayer;
}
