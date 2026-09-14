const CAPABILITIES=new Set(['TEXT','IMAGE','VIDEO','SEARCH','DISPLAY','SOCIAL_FEED','RETARGETING','GEO_TARGETING','AUDIENCE_TARGETING','LOOKALIKE','CONVERSION_API','WEBHOOKS','BUDGET_CONTROL','BID_CONTROL','PAUSE_RESUME','REALTIME_METRICS','OFFLINE_CONVERSIONS','APP_INSTALL','DEEP_LINK','UTM_TRACKING']);
const LIFECYCLE=['DISCOVERED','CONFIGURED','AUTHENTICATED','SANDBOX_TESTED','LIVE_TESTED','CERTIFIED','DEGRADED','DISABLED'];

export class MarketingConnectorRegistry{
  #connectors=new Map();
  register(connector){if(!connector?.id)throw new Error('connector id required');if(this.#connectors.has(connector.id))throw new Error('connector already registered');for(const capability of connector.capabilities||[])if(!CAPABILITIES.has(capability))throw new Error(`unknown connector capability: ${capability}`);this.#connectors.set(connector.id,connector);return this;}
  get(id){return this.#connectors.get(id)||null;}
  list(){return [...this.#connectors.values()].map(connector=>connector.describe());}
}

export class AcquisitionConnector{
  constructor({id,label,capabilities=[],credentialRef=null,driver=null}={}){if(!id||!label)throw new Error('connector id/label required');this.id=id;this.label=label;this.capabilities=[...new Set(capabilities)];this.credentialRef=credentialRef;this.driver=driver;this.state=credentialRef?'CONFIGURED':'DISCOVERED';this.evidence={realPublicationVerified:false,liveMetricsVerified:false,verifiedAt:null};}
  describe(){return{id:this.id,label:this.label,capabilities:[...this.capabilities],state:this.state,evidence:{...this.evidence},configured:Boolean(this.credentialRef),secretExposed:false};}
  supports(capability){return this.capabilities.includes(capability);}
  async authenticate(){if(!this.credentialRef||!this.driver?.authenticate)throw connectorError(this.id,'CONNECTOR_NOT_CONFIGURED');await this.driver.authenticate({credentialRef:this.credentialRef});this.state='AUTHENTICATED';return this.describe();}
  async certify({sandbox=false}={}){if(!this.driver?.certify)throw connectorError(this.id,'CONNECTOR_CERTIFICATION_UNAVAILABLE');const evidence=await this.driver.certify({credentialRef:this.credentialRef,sandbox});if(!sandbox&&(!evidence?.realPublicationVerified||!evidence?.liveMetricsVerified))throw connectorError(this.id,'LIVE_EVIDENCE_REQUIRED');this.evidence={realPublicationVerified:Boolean(evidence?.realPublicationVerified),liveMetricsVerified:Boolean(evidence?.liveMetricsVerified),verifiedAt:evidence?.verifiedAt||new Date().toISOString()};this.state=sandbox?'SANDBOX_TESTED':'CERTIFIED';return this.describe();}
  async publish(payload){this.assertCertified();if(!this.driver?.publish)throw connectorError(this.id,'CONNECTOR_PUBLISH_UNAVAILABLE');return this.driver.publish({...payload,credentialRef:this.credentialRef});}
  async pause(payload){if(!['CERTIFIED','DEGRADED'].includes(this.state)||!this.driver?.pause)throw connectorError(this.id,'CONNECTOR_PAUSE_UNAVAILABLE');return this.driver.pause({...payload,credentialRef:this.credentialRef});}
  async metrics(payload){this.assertCertified();if(!this.driver?.metrics)throw connectorError(this.id,'CONNECTOR_METRICS_UNAVAILABLE');return this.driver.metrics({...payload,credentialRef:this.credentialRef});}
  assertCertified(){if(this.state!=='CERTIFIED'||!this.evidence.realPublicationVerified||!this.evidence.liveMetricsVerified)throw connectorError(this.id,'CONNECTOR_NOT_CERTIFIED');}
}

export function createSilentRunConnectorRegistry({yandexCredentialRef=null,vkCredentialRef=null,drivers={}}={}){
  return new MarketingConnectorRegistry()
    .register(new AcquisitionConnector({id:'yandex_direct',label:'Yandex Direct',credentialRef:yandexCredentialRef,driver:drivers.yandex_direct,capabilities:['TEXT','IMAGE','SEARCH','DISPLAY','RETARGETING','GEO_TARGETING','AUDIENCE_TARGETING','CONVERSION_API','BUDGET_CONTROL','BID_CONTROL','PAUSE_RESUME','REALTIME_METRICS','OFFLINE_CONVERSIONS','APP_INSTALL','DEEP_LINK','UTM_TRACKING']}))
    .register(new AcquisitionConnector({id:'vk_ads',label:'VK Ads',credentialRef:vkCredentialRef,driver:drivers.vk_ads,capabilities:['TEXT','IMAGE','VIDEO','SOCIAL_FEED','RETARGETING','GEO_TARGETING','AUDIENCE_TARGETING','LOOKALIKE','CONVERSION_API','WEBHOOKS','BUDGET_CONTROL','BID_CONTROL','PAUSE_RESUME','REALTIME_METRICS','APP_INSTALL','DEEP_LINK','UTM_TRACKING']}));
}

export const MARKETING_CONNECTOR_CAPABILITIES=Object.freeze([...CAPABILITIES]);
export const MARKETING_CONNECTOR_LIFECYCLE=Object.freeze([...LIFECYCLE]);
function connectorError(id,code){return Object.assign(new Error(`${id}: ${code.toLowerCase().replaceAll('_',' ')}`),{status:409,code});}
