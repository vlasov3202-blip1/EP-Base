export const EINEIRO_CORE_VERSION='4.0-recovery';
export const plans={
  Start:{price:0,ai:false,warehouse:'manual',barcodeCamera:true,publishing:false,problemAnalytics:'limited',automation:false},
  Pilot:{price:5,ai:true,warehouse:'full',barcodeCamera:true,publishing:true,problemAnalytics:'full',automation:'recommend'},
  Autopilot:{price:15,ai:true,warehouse:'full',barcodeCamera:true,publishing:true,problemAnalytics:'full',automation:'execute-with-policy'}
};
export const grace={days:7,ai:false,warehouse:'manual',barcodeCamera:true,publishing:false,problemAnalytics:'limited'};
export const roles={
  owner:['*'],
  manager:['sales.read','sales.write','tasks.read','tasks.write','inventory.read','analytics.read'],
  seller:['sales.read','sales.write','inbox.read','inbox.write','price.range.read'],
  warehouse:['inventory.read','inventory.write','tasks.read','tasks.write','barcode.scan'],
  admin:['platform.*']
};
export const entities=['Company','User','Role','Product','Variant','InventoryUnit','Warehouse','Zone','Rack','Shelf','Cell','Customer','Conversation','Message','Lead','Order','OrderItem','Payment','Shipment','Channel','Publication','Task','Event','Decision','Policy','AuditEntry','Recommendation'];
export const decisionPipeline=['event','facts','policy','confidence','decision','action','audit'];
export const ownerDecisionReasons=['limit_exceeded','low_confidence','legal_confirmation','financial_confirmation','serious_anomaly'];
export const connectors={publishing:['avito','drom','farpost','auto_ru','vk','youla','zzap','eineiro_market'],messaging:['avito','vk','youla','eineiro_market'],pilot:['ozon','wildberries','olx_kz']};
export const aiProviders={primary:'openai',fallback:[],currencyLabel:'у.е.',exposeModelName:false};
export const invariants={
  saleCommissionPercent:0,
  cameraSafeZone:'immutable',
  marketHome:'no_catalog_before_request',
  sceneSlots:{oneSelectedProductPerRequestedObject:true,countDrivenByUserIntent:true,noArtificialObjectCap:true},
  variantsPerSlot:{paginated:true,maxPerPage:100,noArtificialTotalCap:true,replaceKeepsAnchor:true},
  cleanViewKeepsPlacedProducts:true,
  exceptionManagement:true
};
export const platformLayers=['Universal Core','Category Schema / Domain Modules','Event Layer','Decision Layer','Policy Layer','Audit Layer','Connector Framework','AI Provider Abstraction','Control Plane','Search / Recommendation / Vision','Market Transactions','Backups / DR','Observability','Queues / Workers','Platform API'];
export function can(role,permission){const grants=roles[role]||[];return grants.includes('*')||grants.includes(permission)||grants.some(x=>x.endsWith('*')&&permission.startsWith(x.slice(0,-1)))}
export function planAllows(plan,capability){const p=plans[plan]||plans.Start;return Boolean(p[capability])}
