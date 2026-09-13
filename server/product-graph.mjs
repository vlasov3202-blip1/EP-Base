export const UNIVERSAL_CATEGORY_SCHEMA={
  home:{label:'Дом и интерьер',children:{shelf:{label:'Полки',attributes:{material:'string',width:'number',height:'number',depth:'number',color:'string',mount:'string'}},vase:{label:'Вазы',attributes:{material:'string',height:'number',color:'string',style:'string'}},book:{label:'Книги и декор',attributes:{format:'string',topic:'string',color:'string',height:'number'}},chair:{label:'Кресла',attributes:{material:'string',width:'number',height:'number',color:'string',style:'string'}}}},
  auto:{label:'Авто',children:{headlight:{label:'Фары',attributes:{make:'string',model:'string',generation:'string',side:'string',technology:'string',oe:'string'}},hood:{label:'Капоты',attributes:{make:'string',model:'string',generation:'string',color:'string'}},engine:{label:'Двигатели',attributes:{make:'string',model:'string',code:'string',volume:'number',fuel:'string'}}}},
  tech:{label:'Техника',children:{monitor:{label:'Мониторы',attributes:{diagonal:'number',resolution:'string',panel:'string',refreshRate:'number',ports:'array'}},audio:{label:'Аудио',attributes:{type:'string',power:'number',connectivity:'array'}}}}
};

function norm(v){return String(v??'').trim().toLowerCase();}
function tokenize(v){return norm(v).split(/[^\p{L}\p{N}]+/u).filter(Boolean);}
function jaccard(a,b){const A=new Set(tokenize(a)),B=new Set(tokenize(b));if(!A.size||!B.size)return 0;let i=0;for(const x of A)if(B.has(x))i++;return i/(A.size+B.size-i);}

export class ProductGraph {
  #products=new Map();
  #relations=[];
  addProduct(product){
    if(!product?.id)throw new Error('product.id required');
    if(!product.category)throw new Error('product.category required');
    const value={attributes:{},availability:'available',...structuredClone(product)};
    this.#products.set(value.id,value);return structuredClone(value);
  }
  addRelation({from,to,type,weight=1,meta={}}){
    if(!this.#products.has(from)||!this.#products.has(to))throw new Error('relation products must exist');
    const rel={from,to,type,weight:Number(weight)||1,meta:structuredClone(meta)};this.#relations.push(rel);return structuredClone(rel);
  }
  get(id){const p=this.#products.get(id);return p?structuredClone(p):null;}
  list(){return [...this.#products.values()].map(value=>structuredClone(value));}
  relationsFor(id,type=null){return this.#relations.filter(r=>(r.from===id||r.to===id)&&(!type||r.type===type)).map(value=>structuredClone(value));}
  validateCategory(product){
    const [root,leaf]=String(product.category).split('.');const schema=UNIVERSAL_CATEGORY_SCHEMA[root]?.children?.[leaf];
    if(!schema)return {ok:false,errors:['unknown_category']};
    const errors=[];for(const [key,type] of Object.entries(schema.attributes)){const value=product.attributes?.[key];if(value==null)continue;if(type==='number'&&!Number.isFinite(Number(value)))errors.push(`${key}:number`);if(type==='array'&&!Array.isArray(value))errors.push(`${key}:array`);}
    return {ok:!errors.length,errors};
  }
  recommendRelated(productId,{types=['compatible_with','complements','same_family'],limit=12}={}){
    const rels=this.#relations.filter(r=>types.includes(r.type)&&(r.from===productId||r.to===productId)).sort((a,b)=>b.weight-a.weight);
    const out=[];for(const r of rels){const id=r.from===productId?r.to:r.from;const p=this.#products.get(id);if(p&&!out.some(x=>x.id===id))out.push({...structuredClone(p),relation:r.type,relationWeight:r.weight});if(out.length>=limit)break;}return out;
  }
  search({query='',category=null,attributes={},limit=24,cursor=null,contextProductIds=[]}={}){
    const start=Math.max(0,Number(cursor)||0);const q=norm(query);
    const context=new Set(contextProductIds);
    const scored=[];
    for(const p of this.#products.values()){
      if(p.availability==='unavailable')continue;
      if(category&&p.category!==category&&!p.category.startsWith(`${category}.`))continue;
      let score=.25;
      score+=jaccard(`${p.name||''} ${p.description||''} ${Object.values(p.attributes||{}).join(' ')}`,q)*.45;
      let matched=0,total=0;for(const [k,v] of Object.entries(attributes||{})){if(v==null||v==='')continue;total++;const pv=p.attributes?.[k];if(Array.isArray(pv)?pv.map(norm).includes(norm(v)):norm(pv)===norm(v))matched++;}
      if(total)score+=matched/total*.2;
      const relBoost=this.#relations.filter(r=>context.has(r.from)&&r.to===p.id||context.has(r.to)&&r.from===p.id).reduce((s,r)=>s+Math.min(.1,r.weight*.04),0);score+=relBoost;
      score+=Math.min(.08,Number(p.popularity||0)*.08);
      if(q&&!jaccard(`${p.name||''} ${p.description||''}`,q)&&!Object.values(p.attributes||{}).some(v=>norm(v).includes(q)))score-=.12;
      scored.push({...structuredClone(p),relevance:Math.max(0,Math.min(1,score))});
    }
    scored.sort((a,b)=>b.relevance-a.relevance||String(a.id).localeCompare(String(b.id)));
    const items=scored.slice(start,start+limit);const next=start+limit<scored.length?String(start+limit):null;
    return {items,total:scored.length,nextCursor:next};
  }
}

export function createDemoProductGraph(){
  const g=new ProductGraph();
  for(let i=1;i<=18;i++)g.addProduct({id:`S-${i}`,name:`Полка ${['Oak Line','Graphite','White Arc'][i%3]} ${i}`,category:'home.shelf',price:6900+i*310,attributes:{material:['oak','metal','mdf'][i%3],width:60+(i%5)*20,height:20,depth:22,color:['oak','graphite','white'][i%3],mount:'wall'},popularity:.8-i*.01});
  for(let i=1;i<=36;i++)g.addProduct({id:`V-${i}`,name:`Ваза ${['Sand','Glass','Stone'][i%3]} ${i}`,category:'home.vase',price:1900+i*120,attributes:{material:['ceramic','glass','stone'][i%3],height:18+(i%6)*4,color:['sand','clear','grey'][i%3],style:'modern'},popularity:.76-i*.005});
  for(let i=1;i<=54;i++)g.addProduct({id:`B-${i}`,name:`Книга ${['Art Objects','Architecture','Nordic Home'][i%3]} ${i}`,category:'home.book',price:900+i*65,attributes:{format:'hardcover',topic:['art','architecture','interior'][i%3],color:['black','white','beige'][i%3],height:24+(i%4)},popularity:.72-i*.003});
  for(let i=1;i<=24;i++)g.addProduct({id:`H-${i}`,name:`Фара правая Focus III ${i}`,category:'auto.headlight',price:15400+i*470,attributes:{make:'Ford',model:'Focus III',generation:'III',side:'right',technology:i%2?'halogen':'xenon',oe:`OE-${1000+i}`},popularity:.9-i*.01});
  for(let i=1;i<=30;i++)g.addProduct({id:`M-${i}`,name:`Монитор ${27+(i%3)*2} 4K ${i}`,category:'tech.monitor',price:38900+i*520,attributes:{diagonal:27+(i%3)*2,resolution:'4K',panel:['IPS','VA'][i%2],refreshRate:[60,120,144][i%3],ports:['HDMI','DisplayPort']},popularity:.84-i*.008});
  for(let i=1;i<=18;i++){g.addRelation({from:`S-${i}`,to:`V-${((i-1)%36)+1}`,type:'complements',weight:.9});g.addRelation({from:`S-${i}`,to:`B-${((i-1)%54)+1}`,type:'complements',weight:.86});}
  return g;
}
