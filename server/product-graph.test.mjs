import assert from 'node:assert/strict';
import {createDemoProductGraph,ProductGraph} from './product-graph.mjs';

const g=createDemoProductGraph();
const shelves=g.search({query:'полка oak',category:'home.shelf',limit:10});
assert.ok(shelves.items.length>0);
assert.ok(shelves.items.every(x=>x.category==='home.shelf'));
assert.ok(shelves.items[0].relevance>=shelves.items.at(-1).relevance);

const first=shelves.items[0];
assert.equal(g.validateCategory(first).ok,true);
const related=g.recommendRelated(first.id,{limit:5});
assert.ok(related.some(x=>x.category==='home.vase'||x.category==='home.book'));

const page1=g.search({category:'home.book',limit:20});
assert.equal(page1.items.length,20);
assert.ok(page1.nextCursor);
const page2=g.search({category:'home.book',limit:20,cursor:page1.nextCursor});
assert.equal(page2.items.length,20);
assert.notEqual(page1.items[0].id,page2.items[0].id);

const bad=new ProductGraph();bad.addProduct({id:'x',name:'X',category:'unknown.x',attributes:{}});
assert.equal(bad.validateCategory(bad.get('x')).ok,false);

const contextShelf=shelves.items[0].id;
const vaseNoContext=g.search({query:'ваза',category:'home.vase',limit:10});
const vaseWithContext=g.search({query:'ваза',category:'home.vase',limit:10,contextProductIds:[contextShelf]});
assert.ok(vaseWithContext.items[0].relevance>=vaseNoContext.items[0].relevance);

console.log('EINEIRO Product Graph tests: OK');
