import assert from 'node:assert/strict';
import {SpatialFoundationService} from './spatial-foundation.mjs';
import {SpatialReconstructionProvider,SpatialReconstructionRouter} from './spatial-reconstruction.mjs';
import {DisagreementService} from './returns-disagreements.mjs';

class Repo{constructor(){this.m=new Map()}async put(t,x){if(!this.m.has(t))this.m.set(t,new Map());this.m.get(t).set(x.id,structuredClone(x));return x}async list(t){return [...(this.m.get(t)?.values()||[])].map(value=>structuredClone(value))}async get(t,id){return this.m.get(t)?.get(id)||null}}
const repo=new Repo();const service=new SpatialFoundationService({repoFactory:()=>repo});const ctx={companyId:'c1'};
await repo.put('Order',{id:'o1'});

const capture=await service.createCapture(ctx,{captureMethod:'LIDAR',scaleSource:'device_depth',dimensions:{width:1200,height:800,depth:600,unit:'mm'},dimensionConfidence:.94,depthDataAvailable:true,cameraPosesAvailable:true,reconstructionStatus:'ready',productId:'p1'});
const asset=await service.attachAsset(ctx,{subtype:'GLB',uri:'https://example.invalid/p1.glb',captureId:capture.id,productId:'p1',dimensions:capture.dimensions,dimensionConfidence:.94});
const exact=service.assessExactness({capture,asset});
assert.equal(exact.exact,true);assert.equal(exact.mode,'MEASURED_3D');

const fallback=service.assessExactness({capture:{...capture,dimensionConfidence:.3,dimensions:null,scaleSource:null},asset:null});
assert.equal(fallback.exact,false);assert.equal(fallback.mode,'VISUAL_FALLBACK');

const router=new SpatialReconstructionRouter({providers:[new SpatialReconstructionProvider({id:'lidar',capabilities:['LIDAR'],reconstruct:async()=>({uri:'x.glb',dimensions:{width:1,height:2,depth:3},dimensionConfidence:.9,scaleSource:'depth'})})]});
assert.equal((await router.run({captureMethod:'LIDAR'})).result.mode,'MEASURED_3D');
const weak=new SpatialReconstructionRouter({providers:[new SpatialReconstructionProvider({id:'photo',capabilities:['PHOTOGRAMMETRY'],reconstruct:async()=>({uri:'x.glb',dimensionConfidence:.4})})]});
assert.equal((await weak.run({captureMethod:'PHOTOGRAMMETRY'})).result.mode,'VISUAL_FALLBACK');

await assert.rejects(()=>service.createEvidence(ctx,{orderId:'o1',assetId:asset.id,explicitlySaved:false}),/explicit save/);
const evidence=await service.createEvidence(ctx,{orderId:'o1',assetId:asset.id,captureId:capture.id,explicitlySaved:true});
assert.equal(evidence.type,'SPATIAL_EVIDENCE');
const disagreements=new DisagreementService({repoFactory:()=>repo});
await assert.rejects(()=>disagreements.open(ctx,{orderId:'o1',issueType:'mismatch',buyerClaim:'x',evidence:[{type:'LIVE_BUFFER'}]}),/unsaved evidence/);
const d=await disagreements.open(ctx,{orderId:'o1',issueType:'mismatch',buyerClaim:'x',evidence:[evidence.id]});
assert.deepEqual(d.evidence,[evidence.id]);

console.log('spatial-foundation.test.mjs ok');
