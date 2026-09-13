export const VisualCapability=Object.freeze({
  STANDARD_MEDIA:'STANDARD_MEDIA',
  OBJECT_360:'OBJECT_360',
  SPATIAL_PLACE:'SPATIAL_PLACE',
  WALL_PLACE:'WALL_PLACE',
  BODY_TRY_ON:'BODY_TRY_ON',
  FACE_TRY_ON:'FACE_TRY_ON',
  VEHICLE_TRY_ON:'VEHICLE_TRY_ON',
  MEASURED_3D:'MEASURED_3D'
});

export const deviceLayouts=Object.freeze({
  phone:{orientation:'portrait-first',cameraZone:{left:.04,right:.04,top:.06,bottom:.18},catalog:'bottom-sheet',controls:'bottom'},
  tablet:{orientation:'adaptive',cameraZone:{left:.05,right:.32,top:.06,bottom:.08},catalog:'right-panel',controls:'bottom'},
  desktop:{orientation:'landscape',cameraZone:{left:.04,right:.34,top:.05,bottom:.06},catalog:'right-panel',controls:'floating'}
});

export const scenePacks=Object.freeze({
  home:{id:'home',surface:'room',scanPattern:'room-depth',allowed:['home.shelf','home.vase','home.book','home.chair','home.lamp']},
  garage:{id:'garage',surface:'vehicle-space',scanPattern:'vehicle-contour',allowed:['auto.headlight','auto.hood','auto.bumper','auto.wheel','auto.part']},
  desk:{id:'desk',surface:'work-surface',scanPattern:'plane-grid',allowed:['tech.monitor','tech.keyboard','tech.laptop','tech.accessory']},
  body:{id:'body',surface:'person',scanPattern:'body-outline',allowed:['fashion.apparel','fashion.shoes','fashion.accessory']},
  face:{id:'face',surface:'face',scanPattern:'face-safe-outline',allowed:['beauty.glasses','beauty.cosmetic','fashion.headwear']},
  measured:{id:'measured',surface:'measured-space',scanPattern:'dimension-grid',allowed:['*']}
});

export function capabilityForProduct(product={}){
  const declared=Array.isArray(product.visualCapabilities)?product.visualCapabilities:[];
  if(declared.length)return [...new Set(declared.filter(x=>Object.values(VisualCapability).includes(x)))];
  const c=String(product.categoryId||product.category||'');
  if(c.startsWith('home.'))return [VisualCapability.STANDARD_MEDIA,VisualCapability.SPATIAL_PLACE];
  if(c.startsWith('auto.'))return [VisualCapability.STANDARD_MEDIA,VisualCapability.VEHICLE_TRY_ON,VisualCapability.SPATIAL_PLACE];
  if(c.startsWith('fashion.'))return [VisualCapability.STANDARD_MEDIA,VisualCapability.BODY_TRY_ON];
  return [VisualCapability.STANDARD_MEDIA];
}

export function chooseScenePack(slots=[]){
  const cats=slots.map(x=>String(x.category||x.categoryId||''));
  if(cats.some(x=>x.startsWith('auto.')))return scenePacks.garage;
  if(cats.some(x=>x.startsWith('tech.')))return scenePacks.desk;
  if(cats.some(x=>x.startsWith('fashion.')))return scenePacks.body;
  if(cats.some(x=>x.startsWith('beauty.')))return scenePacks.face;
  return scenePacks.home;
}

export function cameraSafeZoneForViewport({width,height}={}){
  const kind=width<700?'phone':width<1100?'tablet':'desktop';
  return {device:kind,...deviceLayouts[kind],width,height};
}

export function normalizeVisualAsset(product={}){
  const images=Array.isArray(product.images)?product.images.filter(Boolean):[];
  const capability=capabilityForProduct(product);
  return {
    productId:product.id||null,
    sourceImages:images,
    needsIsolation:Boolean(images.length&&!product.isolatedAssetUrl),
    isolatedAssetUrl:product.isolatedAssetUrl||null,
    model3dUrl:product.model3dUrl||null,
    capability,
    preferredMode:capability.includes(VisualCapability.MEASURED_3D)?'measured-3d':capability.includes(VisualCapability.SPATIAL_PLACE)?'spatial':'media'
  };
}
