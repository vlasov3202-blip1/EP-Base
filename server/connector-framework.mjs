import crypto from 'node:crypto';

export const CONNECTOR_CAPABILITIES=Object.freeze(['publish','update_price','update_stock','delete_listing','receive_messages','send_message','receive_orders','returns','ads','analytics','webhooks']);

export class ConnectorError extends Error{
  constructor(message,{code='CONNECTOR_ERROR',retryable=false,status=null,details=null}={}){super(message);this.name='ConnectorError';this.code=code;this.retryable=retryable;this.status=status;this.details=details;}
}

export class ConnectorRegistry{
  constructor(){this.connectors=new Map();}
  register(connector){if(!connector?.connectorId)throw new Error('connectorId required');if(this.connectors.has(connector.connectorId))throw new Error(`connector already registered: ${connector.connectorId}`);const capabilities=new Set(connector.capabilities||[]);for(const cap of capabilities)if(!CONNECTOR_CAPABILITIES.includes(cap))throw new Error(`unsupported connector capability: ${cap}`);this.connectors.set(connector.connectorId,{...connector,capabilities});return connector;}
  get(id){return this.connectors.get(id)||null;}
  list(){return [...this.connectors.values()].map(x=>({...x,capabilities:[...x.capabilities]}));}
  supports(id,capability){return Boolean(this.get(id)?.capabilities?.has(capability));}
  discover(capability){return this.list().filter(x=>x.capabilities.includes(capability));}
}

export class ConnectorRuntime{
  constructor({registry,repoFactory,now=()=>new Date(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){if(!registry)throw new Error('registry required');if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.registry=registry;this.repoFactory=repoFactory;this.now=now;this.sleep=sleep;}
  async execute(ctx,{connectorId,capability,input={},idempotencyKey=null,maxAttempts=3}={}){
    const connector=this.registry.get(connectorId);if(!connector)throw new ConnectorError('connector not found',{code:'CONNECTOR_NOT_FOUND'});if(!this.registry.supports(connectorId,capability))throw new ConnectorError('capability not supported',{code:'CAPABILITY_NOT_SUPPORTED'});
    const repo=this.repoFactory(ctx);const key=idempotencyKey||`auto:${connectorId}:${capability}:${crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex')}`;
    const existing=(await repo.list('ConnectorExecution')).find(x=>x.idempotencyKey===key&&x.status==='succeeded');if(existing)return existing;
    let lastError=null;
    for(let attempt=1;attempt<=Math.max(1,maxAttempts);attempt++){
      const startedAt=this.now().toISOString();
      try{
        const handler=connector.handlers?.[capability]||connector[capability];if(typeof handler!=='function')throw new ConnectorError('capability handler missing',{code:'CAPABILITY_HANDLER_MISSING'});
        const result=await handler.call(connector,{ctx,input,idempotencyKey:key});
        const execution={id:`cex_${crypto.randomUUID()}`,connectorId,capability,idempotencyKey:key,attempt,status:'succeeded',startedAt,finishedAt:this.now().toISOString(),result:structuredClone(result??null)};await repo.put('ConnectorExecution',execution);await this.#writeHealth(repo,connectorId,{status:'healthy',lastSuccessAt:execution.finishedAt,lastError:null});return execution;
      }catch(error){lastError=normalizeConnectorError(error);const failed={id:`cex_${crypto.randomUUID()}`,connectorId,capability,idempotencyKey:key,attempt,status:'failed',retryable:lastError.retryable,error:{code:lastError.code,message:lastError.message,status:lastError.status},startedAt,finishedAt:this.now().toISOString()};await repo.put('ConnectorExecution',failed);await this.#writeHealth(repo,connectorId,{status:lastError.retryable?'degraded':'error',lastError:failed.error,lastFailureAt:failed.finishedAt});if(!lastError.retryable||attempt>=maxAttempts)break;await this.sleep(Math.min(250*2**(attempt-1),2000));}
    }
    throw lastError||new ConnectorError('connector execution failed');
  }
  async #writeHealth(repo,connectorId,patch){const current=(await repo.list('ConnectorHealth')).find(x=>x.connectorId===connectorId)||{id:`health:${connectorId}`,connectorId};await repo.put('ConnectorHealth',{...current,...patch,checkedAt:this.now().toISOString()});}
}

export function normalizeConnectorError(error){if(error instanceof ConnectorError)return error;const code=error?.code||'CONNECTOR_ERROR';const status=Number(error?.status||error?.statusCode)||null;const retryable=Boolean(error?.retryable)||status===429||(status!=null&&status>=500);return new ConnectorError(String(error?.message||error),{code,retryable,status});}
