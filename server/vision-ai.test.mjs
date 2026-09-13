import assert from 'node:assert/strict';
import {sampleFrames,minimizeVisionPayload,VisionSearchService} from './vision-ai.mjs';
import {createServices} from './core.mjs';

const frames=[0,100,600,1200,1800,2400].map(atMs=>({atMs,dataUrl:`data:image/jpeg;base64,${atMs}`,filename:'secret.jpg',geo:'x'}));
const picked=sampleFrames(frames,{maxFrames:4,minGapMs:500});
assert.equal(picked.length,4);
assert.deepEqual(picked.map(x=>x.atMs),[0,600,1200,1800]);

const safe=minimizeVisionPayload({frames,voiceText:'нужна фара справа'.repeat(200),locale:'ru-RU'});
assert.equal(safe.frames.length,4);
assert.equal(safe.metadata.geo,null);
assert.equal(safe.metadata.filename,null);
assert.equal(safe.metadata.exif,false);
assert.ok(safe.voiceText.length<=2000);

const ctx={userId:'u1',companyId:'c1',role:'owner'};
const {events,audit}=createServices();
const provider={async understand(){return {intent:'find_product',category:'auto',object:'headlight',problem:null,attributes:{side:'right'},searchQuery:'правая фара focus iii',confidence:.94,needsClarification:false,clarificationQuestion:null}}};
let searched=0;
const many=Array.from({length:87},(_,i)=>({id:`p${i+1}`,relevance:Math.max(.73,.98-i*.002),name:`Option ${i+1}`}));
const service=new VisionSearchService({provider,events,audit,search:async(_ctx,q)=>{searched++;assert.equal(q.limit,100);return {items:many,total:87,nextCursor:null}}});
const out=await service.resolve(ctx,{frames,voiceText:'нужна правая фара',catalogLimit:100});
assert.equal(out.mode,'search');
assert.equal(out.catalog.items.length,87);
assert.equal(out.catalog.total,87);
assert.ok(out.spatialOffers.length>=1&&out.spatialOffers.length<=3);
assert.equal(searched,1);
assert.equal(events.list(ctx).at(-1).type,'vision.intent');

const decisive=new VisionSearchService({provider,search:async()=>({items:[{id:'a',relevance:.98},{id:'b',relevance:.75},{id:'c',relevance:.74}],total:3})});
const decisiveOut=await decisive.resolve(ctx,{frames:[],voiceText:'x'});
assert.equal(decisiveOut.spatialOffers.length,1);

const low=new VisionSearchService({provider:{async understand(){return {intent:'unknown',category:'unknown',object:null,problem:null,attributes:{},searchQuery:'',confidence:.4,needsClarification:true,clarificationQuestion:'Что именно нужно?'}}},search:async()=>{throw new Error('must not search')}});
const lowOut=await low.resolve(ctx,{frames:[],voiceText:''});
assert.equal(lowOut.mode,'clarify');
assert.equal(lowOut.catalog.items.length,0);
assert.equal(lowOut.spatialOffers.length,0);

console.log('EINEIRO vision AI tests: OK');
