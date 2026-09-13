export class SearchService {
  constructor({source,defaultPageSize=24,maxPageSize=100}={}){
    if(typeof source!=='function') throw new Error('search source required');
    this.source=source;this.defaultPageSize=defaultPageSize;this.maxPageSize=maxPageSize;
  }
  async search(ctx,{query='',category=null,attributes={},limit=this.defaultPageSize,cursor=null}={}){
    const pageSize=Math.max(1,Math.min(Number(limit)||this.defaultPageSize,this.maxPageSize));
    const result=await this.source(ctx,{query,category,attributes,limit:pageSize,cursor});
    const items=Array.isArray(result)?result:(result.items||[]);
    const normalized=items
      .filter(x=>x&&x.id&&Number.isFinite(Number(x.relevance??x.score??0)))
      .map(x=>({...x,relevance:Number(x.relevance??x.score??0)}))
      .sort((a,b)=>b.relevance-a.relevance)
      .slice(0,pageSize);
    return {items:normalized,nextCursor:Array.isArray(result)?null:(result.nextCursor??null),total:Array.isArray(result)?normalized.length:(result.total??normalized.length)};
  }
  spatialShortlist(items,{max=3,minRelevance=.72}={}){
    const relevant=(items||[]).filter(x=>Number(x.relevance)>=minRelevance);
    if(!relevant.length)return[];
    const top=relevant.slice(0,max);
    const gap=top[0]?.relevance-(top[1]?.relevance??0);
    if(gap>=.18)return top.slice(0,1);
    if(top.length>=2 && top[1].relevance-(top[2]?.relevance??0)>=.14)return top.slice(0,2);
    return top;
  }
  async searchSlots(ctx,slots=[]){
    return Promise.all(slots.map(async(slot,index)=>{
      const catalog=await this.search(ctx,{query:slot.searchQuery||slot.query||'',category:slot.category||null,attributes:slot.attributes||{},limit:slot.limit||this.defaultPageSize,cursor:slot.cursor||null});
      const current=catalog.items[0]||null;
      return {slotId:slot.slotId||`slot-${index+1}`,label:slot.label||slot.object||`Объект ${index+1}`,anchor:slot.anchor||null,current,catalog};
    }));
  }
}
