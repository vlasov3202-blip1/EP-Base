import crypto from 'node:crypto';
import {OfferRankingService} from './offer-ranking.mjs';

export class ChannelAllocatorService{
  constructor({repoFactory,now=()=>new Date(),minOrganicScore=78}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;this.minOrganicScore=minOrganicScore;}
  async recommend(ctx,{offerId,candidateChannels=[]}={}){
    const repo=this.repoFactory(ctx);const offer=await repo.get('Offer',offerId);if(!offer)throw new Error('offer not found');
    const ranked=await new OfferRankingService({repoFactory:this.repoFactory,now:this.now}).rank(ctx,{offerIds:[offerId],limit:1});const organic=ranked[0]||null;
    if(!organic||organic.organicScore<this.minOrganicScore){const rec={id:`channel-rec:${crypto.randomUUID()}`,offerId,productId:offer.productId,decision:'improve_first',organicScore:organic?.organicScore||0,channels:[],reason:'Предложение не прошло органический порог качества и релевантности. Рекламный бюджет не может обойти этот порог.',createdAt:this.now().toISOString()};await repo.put('ChannelAllocationRecommendation',rec);return rec;}
    const connections=(await repo.list('ChannelConnection')).filter(x=>x.enabled&&['connected','online'].includes(x.status));const available=new Set(connections.map(x=>x.channel));const requested=candidateChannels.length?candidateChannels:[...available];const channels=requested.filter(x=>x!=='eineiro_market'&&available.has(x));
    const rec={id:`channel-rec:${crypto.randomUUID()}`,offerId,productId:offer.productId,decision:channels.length?'recommend_external_channels':'ready_waiting_channels',organicScore:organic.organicScore,channels,reason:channels.length?'Система рекомендует внешнее продвижение: предложение прошло органический отбор и доступные каналы подключены.':'Предложение прошло органический отбор, но подходящие внешние каналы пока не подключены.',createdAt:this.now().toISOString()};await repo.put('ChannelAllocationRecommendation',rec);return rec;
  }
}
