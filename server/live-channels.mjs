import {AvitoAdapter} from './avito-adapter.mjs';
import {EineiroMarketAdapter,UnconfiguredExternalAdapter} from './channel-adapters.mjs';

export async function createLiveChannelAdapter({ctx,channel,store,configService,fetchImpl=globalThis.fetch}={}){
  if(channel==='eineiro_market')return new EineiroMarketAdapter({repoFactory:c=>store.tenant(c)});
  if(channel==='avito'){
    const credentials=await configService.credentials(ctx,'avito');
    return new AvitoAdapter({clientId:credentials.clientId,clientSecret:credentials.clientSecret,userId:credentials.userId,fetchImpl});
  }
  return new UnconfiguredExternalAdapter(channel);
}

export async function checkChannelConnection({ctx,channel,store,configService,fetchImpl=globalThis.fetch}={}){
  try{
    const adapter=await createLiveChannelAdapter({ctx,channel,store,configService,fetchImpl});
    if(typeof adapter.checkConnection!=='function')throw Object.assign(new Error('Проверка этого канала пока не реализована'),{code:'CHANNEL_NOT_IMPLEMENTED'});
    const details=await adapter.checkConnection();
    const state=channel==='eineiro_market'?await configService.get(ctx,channel):await configService.markCheck(ctx,channel,{ok:true});
    return{ok:true,state,details};
  }catch(error){
    if(channel!=='eineiro_market')await configService.markCheck(ctx,channel,{ok:false,error:error.message}).catch(()=>{});
    throw error;
  }
}
