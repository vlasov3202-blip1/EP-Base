import assert from 'node:assert/strict';
import {SearchService} from './search.mjs';

const products=[
  {id:'s1',name:'Полка Oak',category:'shelf',attributes:{material:'wood'},relevance:.98},
  {id:'s2',name:'Полка White',category:'shelf',attributes:{material:'mdf'},relevance:.92},
  {id:'v1',name:'Ваза Sand',category:'vase',attributes:{material:'ceramic'},relevance:.97},
  {id:'b1',name:'Книга Architecture',category:'book',attributes:{format:'hardcover'},relevance:.96}
];
const source=async(_ctx,{category,limit,cursor})=>{const all=products.filter(p=>p.category===category);const offset=Number(cursor)||0;return{items:all.slice(offset,offset+limit),total:all.length,nextCursor:offset+limit<all.length?String(offset+limit):null}};
const search=new SearchService({source,defaultPageSize:1,maxPageSize:100});
const ctx={companyId:'market',userId:'public',role:'owner'};
const slots=await search.searchSlots(ctx,[
  {slotId:'shelf',label:'Полка',category:'shelf',searchQuery:'полка'},
  {slotId:'vase',label:'Ваза',category:'vase',searchQuery:'ваза'},
  {slotId:'book',label:'Книга',category:'book',searchQuery:'книга'}
]);
assert.equal(slots.length,3);
assert.equal(slots[0].slotId,'shelf');
assert.equal(slots[0].current.id,'s1');
assert.equal(slots[0].catalog.total,2);
assert.equal(slots[0].catalog.nextCursor,'1');
assert.equal(slots[1].current.id,'v1');
assert.equal(slots[2].current.id,'b1');
const more=await search.search(ctx,{category:'shelf',limit:1,cursor:'1'});
assert.equal(more.items[0].id,'s2');
assert.equal(more.nextCursor,null);
console.log('EINEIRO slot search tests: OK');
