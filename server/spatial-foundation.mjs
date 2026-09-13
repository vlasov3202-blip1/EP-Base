import crypto from 'node:crypto';

export const MEDIA_ASSET_TYPES=Object.freeze(['IMAGE','VIDEO','DOCUMENT','SPATIAL_ASSET']);
export const SPATIAL_SUBTYPES=Object.freeze(['MESH','GLB','GLTF','USDZ','POINT_CLOUD','GAUSSIAN_SPLAT','DEPTH_MAP']);
export const CAPTURE_METHODS=Object.freeze(['LIDAR','PHOTOGRAMMETRY','IMPORTED']);

export class SpatialFoundationService{
  constructor({repoFactory,now=()=>new Date()}={}){if(typeof repoFactory!=='function')throw new Error('repoFactory required');this.repoFactory=repoFactory;this.now=now;}
  async createCapture(ctx,input={}){
    if(!CAPTURE_METHODS.includes(input.captureMethod))throw new Error('unsupported capture method');
    const dimensions=normalizeDimensions(input.dimensions);
    const capture={id:`spc_${crypto.randomUUID()}`,captureMethod:input.captureMethod,scaleSource:input.scaleSource||null,dimensions,dimensionConfidence:clamp01(input.dimensionConfidence),depthDataAvailable:Boolean(input.depthDataAvailable),cameraPosesAvailable:Boolean(input.cameraPosesAvailable),reconstructionStatus:input.reconstructionStatus||'pending',spatialAssetId:input.spatialAssetId||null,productId:input.productId||null,offerId:input.offerId||null,createdAt:this.now().toISOString()};
    await this.repoFactory(ctx).put('SpatialCapture',capture);return capture;
  }
  async attachAsset(ctx,input={}){
    if(!SPATIAL_SUBTYPES.includes(input.subtype))throw new Error('unsupported spatial subtype');
    if(!input.uri)throw new Error('spatial asset uri required');
    const asset={id:input.id||`spa_${crypto.randomUUID()}`,type:'SPATIAL_ASSET',subtype:input.subtype,uri:input.uri,productId:input.productId||null,offerId:input.offerId||null,captureId:input.captureId||null,dimensions:normalizeDimensions(input.dimensions),dimensionConfidence:clamp01(input.dimensionConfidence),createdAt:this.now().toISOString()};
    await this.repoFactory(ctx).put('MediaAsset',asset);return asset;
  }
  assessExactness({capture,asset}={}){
    const dimensions=asset?.dimensions||capture?.dimensions||null;
    const confidence=Math.max(Number(asset?.dimensionConfidence||0),Number(capture?.dimensionConfidence||0));
    const hasScale=Boolean(capture?.scaleSource)||Boolean(dimensions);
    const reconstructed=['ready','completed'].includes(String(capture?.reconstructionStatus||'').toLowerCase())||Boolean(asset?.uri);
    const exact=Boolean(asset&&asset.type==='SPATIAL_ASSET'&&dimensions&&hasScale&&reconstructed&&confidence>=0.8);
    return exact?{mode:'MEASURED_3D',exact:true,warning:null}:{mode:'VISUAL_FALLBACK',exact:false,warning:'Пространственная модель не подтверждена как точная по масштабу и размерам'};
  }
  async createEvidence(ctx,{orderId,disagreementId,assetId,captureId,explicitlySaved=false}={}){
    if(!explicitlySaved)throw new Error('spatial evidence requires explicit save');
    const evidence={id:`spe_${crypto.randomUUID()}`,orderId:orderId||null,disagreementId:disagreementId||null,assetId:assetId||null,captureId:captureId||null,type:'SPATIAL_EVIDENCE',createdAt:this.now().toISOString()};
    await this.repoFactory(ctx).put('Evidence',evidence);return evidence;
  }
}

function clamp01(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0}
function normalizeDimensions(v){if(!v)return null;const width=Number(v.width),height=Number(v.height),depth=Number(v.depth);if(![width,height,depth].some(Number.isFinite))return null;return{width:Number.isFinite(width)?width:null,height:Number.isFinite(height)?height:null,depth:Number.isFinite(depth)?depth:null,unit:v.unit||'mm'};}
