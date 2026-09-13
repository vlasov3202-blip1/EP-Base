import assert from 'node:assert/strict';
import {SpatialFoundationService} from './spatial-foundation.mjs';

class Repo{constructor(){this.m=new Map()}async put(t,x){if(!this.m.has(t))this.m.set(t,new Map());this.m.get(t).set(x.id,structuredClone(x));return x}async list(t){return [...(this.m.get(t)?.values()||[])].map(structuredClone)}}
const repo=new Repo();const service=new SpatialFoundationService({repoFactory:()=>repo});const ctx={companyId:'c1'};

const capture=await service.createCapture(ctx,{captureMethod:'LIDAR',scaleSource:'device_depth',dimensions:{width:1200,height:800,depth:600,unit:'mm'},dimensionConfidence:.94,depthDataAvailable:true,cameraPosesAvailable:true,reconstructionStatus:'ready',productId:'p1'});
const asset=await service.attachAsset(ctx,{subtype:'GLB',uri:'https://example.invalid/p1.glb',captureId:capture.id,productId:'p1',dimensions:capture.dimensions,dimensionConfidence:.94});
const exact=service.assessExactness({capture,asset});
assert.equal(exact.exact,true);assert.equal(exact.mode,'MEASURED_3D');

const fallback=service.assessExactness({capture:{...capture,dimensionConfidence:.3,dimensions:null,scaleSource:null},asset:null});
assert.equal(fallback.exact,false);assert.equal(fallback.mode,'VISUAL_FALLBACK');

await assert.rejects(()=>service.createEvidence(ctx,{orderId:'o1',assetId:asset.id,explicitlySaved:false}),/explicit save/);
const evidence=await service.createEvidence(ctx,{orderId:'o1',assetId:asset.id,captureId:capture.id,explicitlySaved:true});
assert.equal(evidence.type,'SPATIAL_EVIDENCE');

console.log('spatial-foundation.test.mjs ok');
