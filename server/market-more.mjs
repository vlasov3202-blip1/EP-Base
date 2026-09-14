import crypto from 'node:crypto';

export const MARKET_MORE_EVENTS=Object.freeze([
  'more_opened','more_section_opened','profile_opened','saves_opened',
  'saved_context_resumed','scene_resumed','orders_history_opened','delivery_opened',
  'return_opened','return_created','disagreement_center_opened','disagreement_created',
  'saved_demand_opened','saved_demand_created','notification_opened','settings_opened',
  'support_chat_started'
]);
const MARKET_MORE_EVENT_SET=new Set(MARKET_MORE_EVENTS);

const REFERENCE_KEYS=Object.freeze(new Set([
  'session_id','trace_id','context_id','scene_id','order_id','return_id',
  'disagreement_id','saved_demand_id','release_id','section','target'
]));

function safeValue(value){
  if(value==null)return null;
  if(typeof value!=='string'&&typeof value!=='number'&&typeof value!=='boolean')throw Object.assign(new Error('invalid event reference'),{status:400,code:'MARKET_EVENT_INVALID'});
  const normalized=String(value).trim();
  if(!normalized||normalized.length>160||!/^[-A-Za-z0-9._:]+$/.test(normalized))throw Object.assign(new Error('invalid event reference'),{status:400,code:'MARKET_EVENT_INVALID'});
  return normalized;
}

export function normalizeMarketMoreEvent(input={}){
  const name=String(input.name||'').trim();
  if(!MARKET_MORE_EVENT_SET.has(name))throw Object.assign(new Error('unsupported market event'),{status:400,code:'MARKET_EVENT_UNSUPPORTED'});
  const refs={};
  for(const [key,value] of Object.entries(input.refs||{})){
    if(!REFERENCE_KEYS.has(key))continue;
    const clean=safeValue(value);
    if(clean!=null)refs[key]=clean;
  }
  return{id:`market_evt_${crypto.randomUUID()}`,name,refs,occurredAt:new Date().toISOString()};
}

export async function recordMarketMoreEvent({store,ctx,input}){
  if(!store||!ctx?.companyId)throw new Error('market event store/context required');
  const event=normalizeMarketMoreEvent(input);
  await store.tenant(ctx).put('MarketFlightEvent',event);
  return event;
}
