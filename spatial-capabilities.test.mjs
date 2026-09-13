import assert from 'node:assert/strict';
import {VisualCapability,capabilityForProduct,chooseScenePack,cameraSafeZoneForViewport,normalizeVisualAsset} from './spatial-capabilities.js';

assert.deepEqual(capabilityForProduct({categoryId:'home.shelf'}),[VisualCapability.STANDARD_MEDIA,VisualCapability.SPATIAL_PLACE]);
assert.ok(capabilityForProduct({categoryId:'auto.headlight'}).includes(VisualCapability.VEHICLE_TRY_ON));
assert.equal(chooseScenePack([{category:'auto.headlight'}]).id,'garage');
assert.equal(chooseScenePack([{category:'tech.monitor'}]).id,'desk');
assert.equal(cameraSafeZoneForViewport({width:390,height:844}).device,'phone');
assert.equal(cameraSafeZoneForViewport({width:900,height:1200}).device,'tablet');
assert.equal(cameraSafeZoneForViewport({width:1440,height:900}).device,'desktop');
const asset=normalizeVisualAsset({id:'p1',categoryId:'home.vase',images:['a.jpg']});
assert.equal(asset.needsIsolation,true);assert.equal(asset.preferredMode,'spatial');
console.log('EINEIRO spatial capability tests: OK');
