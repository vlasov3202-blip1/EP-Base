export function bridgeChannelAdapter(adapter,{connectorId=null,type='messaging',extraCapabilities=[]}={}){
  if(!adapter?.name)throw new Error('adapter name required');
  const capabilities=new Set(extraCapabilities);
  const handlers={};
  const add=(cap,fn)=>{if(typeof fn==='function'){capabilities.add(cap);handlers[cap]=fn;}};
  add('receive_messages',adapter.poll?.bind(adapter)?async({input})=>adapter.poll(input||{}):null);
  add('send_message',adapter.sendMessage?.bind(adapter)?async({input})=>adapter.sendMessage(input||{}):null);
  add('publish',adapter.publish?.bind(adapter)?async({input,ctx})=>adapter.publish({ctx,item:input.item||input}):null);
  add('webhooks',adapter.normalizeWebhook?.bind(adapter)?async({input})=>adapter.normalizeWebhook(input):null);
  return{connectorId:connectorId||adapter.name,type,capabilities:[...capabilities],handlers,healthCheck:typeof adapter.checkConnection==='function'?()=>adapter.checkConnection():null,rawAdapter:adapter};
}

export function bridgeServiceConnector({connectorId,type,capabilities,service,handlers,healthCheck=null}){
  if(!connectorId||!type||!service)throw new Error('connectorId, type and service required');
  const normalized={};
  for(const [cap,method] of Object.entries(handlers||{})){
    if(typeof method==='function')normalized[cap]=method;
    else if(typeof method==='string'&&typeof service[method]==='function')normalized[cap]=async({ctx,input,idempotencyKey})=>service[method]({ctx,...input,idempotencyKey});
  }
  return{connectorId,type,capabilities:[...new Set(capabilities||Object.keys(normalized))],handlers:normalized,healthCheck};
}

export async function checkConnectorHealth(registry,{timeoutMs=5000}={}){
  const result=[];
  for(const connector of registry.list()){
    const started=Date.now();
    if(typeof connector.healthCheck!=='function'){result.push({connectorId:connector.connectorId,status:'unknown',latencyMs:null});continue;}
    try{
      const value=await Promise.race([Promise.resolve(connector.healthCheck()),new Promise((_,reject)=>setTimeout(()=>reject(new Error('health timeout')),timeoutMs))]);
      result.push({connectorId:connector.connectorId,status:value?.ok===false?'degraded':'healthy',latencyMs:Date.now()-started,details:value??null});
    }catch(error){result.push({connectorId:connector.connectorId,status:'error',latencyMs:Date.now()-started,error:String(error?.message||error)});}
  }
  return result;
}
