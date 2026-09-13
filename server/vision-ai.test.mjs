import assert from 'node:assert/strict';
import {sampleFrames,minimizeVisionPayload,VisionSearchService} from './vision-ai.mjs';
import {createServices} from './core.mjs';

const frames=[0,100,600,1200,1800,2400].map(atMs=>({atMs,dataUrl:`data:image/jpeg;base64,${atMs}`,filename:'secret.jpg',geo:'x'}));
const picked=sampleFrames(frames,{maxFrames:4,minGapMs:500});
assert.equal(picked.length,4);
assert.deepEqual(picked.map(x=>x.atMs),[0,600,1200,1800]);

const safe=minimizeVisionPayload({frames,voiceText:'нужна полка, на которой стоит ваза и книга'.repeat(80),locale:'ru-RU'});
assert.equal(safe.frames.length,4);
assert.equal(safe.metadata.geo,null);
assert.equal(safe.metadata.filename,null);
assert.equal(safe.metadata.exif,false);
assert.ok(safe.voiceText.length<=2000);

const ctx={userId:'u1',companyId:'c1',role:'owner'};
const {events,audit}=createServices();
const provider={async understand(){return {
  intent:'compose_scene',problem:null,confidence:.96,needsClarification:false,clarificationQuestion:null,
  requestedObjects:[
    {slotId:'shelf',label:'Полка',category:'home.storage',searchQuery:'настенная полка',attributes:{},confidence:.98,anchorHint:'wall'},
    {slotId:'vase',label:'Ваза',category:'home.decor',searchQuery:'ваза для полки',attributes:{},confidence:.95,anchorHint:'on:shelf'},
    {slotId:'book',label:'Книга',category:'books',searchQuery:'книга для композиции',attributes:{},confidence:.93,anchorHint:'on:shelf'}
  ]
}};
const variants={
  shelf:Array.from({length:18},(_,i)=>({id:`s${i+1}`,name:`Полка ${i+1}`,relevance:.99-i*.01})),
  vase:Array.from({length:43},(_,i)=>({id:`v${i+1}`,name:`Ваза ${i+1}`,relevance:.99-i*.005})),
  book:Array.from({length:87},(_,i)=>({id:`b${i+1}`,name:`Книга ${i+1}`,relevance:.99-i*.002}))
};
let searched=0;
const service=new VisionSearchService({provider,events,audit,search:async(_ctx,q)=>{searched++;const items=variants[q.slotId];return {items,total:items.length,nextCursor:null}}});
const out=await service.resolve(ctx,{frames,voiceText:'нужна полка, на которой стоит ваза и книга',catalogLimit:100});
assert.equal(out.mode,'search');
assert.equal(out.sceneSlots.length,3);
assert.equal(out.sceneSlots[0].slotId,'shelf');
assert.equal(out.sceneSlots[0].currentOffer.id,'s1');
assert.equal(out.sceneSlots[0].catalog.total,18);
assert.equal(out.sceneSlots[1].currentOffer.id,'v1');
assert.equal(out.sceneSlots[1].catalog.total,43);
assert.equal(out.sceneSlots[2].currentOffer.id,'b1');
assert.equal(out.sceneSlots[2].catalog.total,87);
assert.equal(searched,3);
assert.equal(events.list(ctx).at(-1).type,'vision.intent');

const low=new VisionSearchService({provider:{async understand(){return {intent:'compose_scene',problem:null,confidence:.95,needsClarification:false,clarificationQuestion:null,requestedObjects:[{slotId:'x',label:'Что-то',category:'unknown',searchQuery:'',attributes:{},confidence:.4,anchorHint:null}]}}},search:async()=>{throw new Error('must not search')}});
const lowOut=await low.resolve(ctx,{frames:[],voiceText:''});
assert.equal(lowOut.mode,'clarify');
assert.equal(lowOut.sceneSlots.length,0);

console.log('EINEIRO vision AI scene-slot tests: OK');
