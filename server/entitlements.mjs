export const PLANS=Object.freeze({
  Start:{price:0,ai:false,warehouse:'manual',barcodeCamera:true,publishing:false,problemAnalytics:'limited',automation:'off'},
  Pilot:{price:5,ai:true,warehouse:'full',barcodeCamera:true,publishing:true,problemAnalytics:'full',automation:'recommend'},
  Autopilot:{price:15,ai:true,warehouse:'full',barcodeCamera:true,publishing:true,problemAnalytics:'full',automation:'execute_with_policy'}
});

export const GRACE=Object.freeze({days:7,ai:false,warehouse:'manual',barcodeCamera:true,publishing:false,problemAnalytics:'limited',automation:'off'});
export const SALE_COMMISSION_PERCENT=0;

export function effectiveCapabilities({plan='Start',graceActive=false}={}){
  return structuredClone(graceActive?GRACE:(PLANS[plan]||PLANS.Start));
}

export function assertCapability(account,capability,{operation=null}={}){
  const caps=effectiveCapabilities(account);
  if(capability==='ai'&&!caps.ai)throw Object.assign(new Error('ИИ недоступен на текущем тарифе'),{code:'PLAN_AI_DISABLED',status:403});
  if(capability==='publishing'&&!caps.publishing)throw Object.assign(new Error('Публикации через интерфейсы/выгрузки недоступны'),{code:'PLAN_PUBLISHING_DISABLED',status:403});
  if(capability==='analytics.full'&&caps.problemAnalytics!=='full')throw Object.assign(new Error('Расширенная аналитика недоступна'),{code:'PLAN_ANALYTICS_LIMITED',status:403});
  if(capability==='warehouse.automation'&&caps.warehouse!=='full')throw Object.assign(new Error('Автоматизация склада недоступна'),{code:'PLAN_WAREHOUSE_MANUAL',status:403});
  if(capability==='warehouse.write'&&caps.warehouse==='manual'&&!['create','update','delete'].includes(operation||''))throw Object.assign(new Error('В льготном режиме склад доступен только вручную'),{code:'PLAN_WAREHOUSE_MANUAL',status:403});
  return caps;
}

export function publicationAllowed({channel,product}={}){
  const ch=String(channel||'').toLowerCase();const category=String(product?.categoryId||product?.category||'').toLowerCase();const condition=String(product?.condition||'').toLowerCase();
  const restricted=['ozon','wildberries','wb','yandex_market','яндекс маркет'];
  if(restricted.includes(ch)&&category.startsWith('auto.')&&condition!=='new')return {allowed:false,reason:'Для автозапчастей на этом канале на старте разрешены только новые товары'};
  return {allowed:true,reason:null};
}

export function calculateOrderEconomics({items=[],acquiring=0,logistics=0,returns=0,promotion=0,services=0}={}){
  const merchandise=items.reduce((s,x)=>s+Number(x.price||0)*Number(x.quantity||1),0);
  const saleCommission=merchandise*SALE_COMMISSION_PERCENT/100;
  const externalCosts={acquiring:Number(acquiring)||0,logistics:Number(logistics)||0,returns:Number(returns)||0};
  const paidServices={promotion:Number(promotion)||0,services:Number(services)||0};
  const totalExternal=Object.values(externalCosts).reduce((a,b)=>a+b,0);
  const totalServices=Object.values(paidServices).reduce((a,b)=>a+b,0);
  return {merchandise,saleCommissionPercent:SALE_COMMISSION_PERCENT,saleCommission,externalCosts,paidServices,totalExternal,totalServices,sellerReceives:merchandise-totalExternal-totalServices};
}
