import {createDemoProductGraph} from './product-graph.mjs';

const graph=createDemoProductGraph();

const aliases=new Map([
  ['shelf','home.shelf'],['полка','home.shelf'],['shelves','home.shelf'],
  ['vase','home.vase'],['ваза','home.vase'],
  ['book','home.book'],['книга','home.book'],
  ['chair','home.chair'],['кресло','home.chair'],
  ['headlight','auto.headlight'],['фара','auto.headlight'],
  ['hood','auto.hood'],['капот','auto.hood'],
  ['engine','auto.engine'],['двигатель','auto.engine'],
  ['monitor','tech.monitor'],['монитор','tech.monitor'],
  ['audio','tech.audio']
]);

export function normalizeCategory(category){
  const raw=String(category??'').trim().toLowerCase();
  if(!raw)return null;
  return aliases.get(raw)||raw;
}

export function createCatalogSource(productGraph=graph){
  return async(_ctx,{query='',category=null,attributes={},limit=24,cursor=null,contextProductIds=[]}={})=>productGraph.search({query,category:normalizeCategory(category),attributes,limit,cursor,contextProductIds});
}

export {graph as productGraph};
