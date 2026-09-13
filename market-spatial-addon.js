import {cameraSafeZoneForViewport,chooseScenePack,scenePacks,VisualCapability} from './spatial-capabilities.js';

function applyLayout(){
  const stage=document.querySelector('.mkt-stage');
  const scene=document.querySelector('.mkt-scene');
  if(!stage||!scene)return;
  const layout=cameraSafeZoneForViewport({width:innerWidth,height:innerHeight});
  stage.dataset.device=layout.device;
  scene.style.setProperty('--camera-safe-left',`${layout.cameraZone.left*100}%`);
  scene.style.setProperty('--camera-safe-right',`${layout.cameraZone.right*100}%`);
  scene.style.setProperty('--camera-safe-top',`${layout.cameraZone.top*100}%`);
  scene.style.setProperty('--camera-safe-bottom',`${layout.cameraZone.bottom*100}%`);
  const slots=[...document.querySelectorAll('.scene-slot')].map(el=>({category:el.dataset.category||el.className.match(/scene-slot-([\w.-]+)/)?.[1]||''}));
  const pack=chooseScenePack(slots);
  scene.dataset.scenePack=pack.id;
  scene.dataset.scanPattern=pack.scanPattern;
}

function exposeRuntime(){window.EINEIRO_SPATIAL={VisualCapability,scenePacks,cameraSafeZoneForViewport,chooseScenePack};}

const observer=new MutationObserver(()=>applyLayout());
observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('resize',applyLayout,{passive:true});
exposeRuntime();applyLayout();
