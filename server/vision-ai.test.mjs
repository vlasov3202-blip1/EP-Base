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
let searched=0;
const provider={async understand(){return {intent:'find_product',category:'auto',object:'headlight',problem:null,attributes:{side:'right'},searchQuery:'правая фара focus iii',confidence:.94,needsClarification:false,clarificationQuestion:null}}};
const service=new VisionSearchService({provider,events,audit,search:async(_ctx,q)=>{searched++;assert.equal(q.limit,3);return [1,2,3,4].map(id=>({id}))}});
const out=await service.resolve(ctx,{frames,voiceText:'нужна правая фара'});
assert.equal(out.mode,'search');
assert.equal(out.offers.length,3);
assert.equal(searched,1);
assert.equal(events.list(ctx).at(-1).type,'vision.intent');

const low=new VisionSearchService({provider:{async understand(){return {intent:'unknown',category:'unknown',object:null,problem:null,attributes:{},searchQuery:'',confidence:.4,needsClarification:true,clarificationQuestion:'Что именно нужно?'}}},search:async()=>{throw new Error('must not search')}});
const lowOut=await low.resolve(ctx,{frames:[],voiceText:''});
assert.equal(lowOut.mode,'clarify');
assert.equal(lowOut.offers.length,0);

console.log('EINEIRO vision AI tests: OK');
