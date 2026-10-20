import * as THREE from "three";

const $ = (id) => document.getElementById(id);
const PRESETS = {
  astana: { name:"Астана · Байтерек", lat:51.1283, lon:71.4305 },
  almaty: { name:"Алматы · центр", lat:43.2567, lon:76.9286 },
  paris: { name:"Париж · Эйфелева башня", lat:48.8584, lon:2.2945 }
};
const EYE_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.47;
const RADIUS_METERS = 270;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93b3c5);
scene.fog = new THREE.Fog(0x93b3c5, 175, 560);
const camera = new THREE.PerspectiveCamera(76, innerWidth/innerHeight, 0.08, 680);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:"low-power" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.setSize(innerWidth, innerHeight);
$("viewport").appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdbedff, 0x536b63, 2.1));
const sun = new THREE.DirectionalLight(0xffe7c1, 2.4);
sun.position.set(-140,220,-165);
scene.add(sun);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1400,1400),
  new THREE.MeshStandardMaterial({color:0x626b67,roughness:0.95})
);
ground.rotation.x = -Math.PI/2;
ground.position.y = -0.075;
scene.add(ground);

const roofMat = new THREE.MeshStandardMaterial({color:0x465b60,roughness:0.94});
const roadMat = new THREE.MeshStandardMaterial({color:0x282f34,roughness:0.96});
const curbMat = new THREE.MeshStandardMaterial({color:0x8c8d88,roughness:0.96});
const stripeMat = new THREE.MeshBasicMaterial({color:0xd8d5bf});
const treeTrunkMat = new THREE.MeshStandardMaterial({color:0x66533f});
const leafMat = new THREE.MeshStandardMaterial({color:0x3b7353,roughness:1});
const treeTrunkGeo = new THREE.CylinderGeometry(0.18,0.3,3,5);
const leafGeo = new THREE.IcosahedronGeometry(2.1,0);
const facadeMaterials = Array.from({length:5},(_,i)=>makeFacadeMaterial(i));

let group = new THREE.Group();
scene.add(group);
let buildings = [], roads = [];
let place = PRESETS.astana, sourceMode = "demo", activeRequest = null;
let worldGeneration = 0, toastTimer;
let isPlaying = false, yaw = 0, pitch = 0, minimapVisible = true;
const pressed = new Set();
const player = { x:0, z:0, y:0, vy:0, grounded:true, startX:0, startZ:0 };

const qualityValues = {low:0.65,medium:0.85,high:1.0};
function setQuality(){
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1.0, qualityValues[$("quality").value]));
  renderer.setSize(innerWidth,innerHeight);
  scene.fog.far = $("quality").value === "low" ? 350 : 560;
}
$("quality").addEventListener("change",setQuality);
setQuality();
window.addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

function rng(initial){
  let state = (initial + 0x6d2b79f5) >>> 0;
  return ()=>{state = Math.imul(state ^ (state >>> 15),1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7),61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;};
}
function makeFacadeMaterial(style){
  const canvas=document.createElement("canvas");
  canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext("2d");
  const rand=rng(style*9128+39);
  const base=["#9fa7a6","#a9a29b","#818c92","#9f9187","#7d8d87"][style];
  ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=3){
    ctx.fillStyle=rand()>.5?"#ffffff08":"#131b1c09";
    ctx.fillRect(0,y,256,1);
  }
  for(let row=0;row<5;row++){
    for(let col=0;col<4;col++){
      const x=col*64+11, y=row*51+8, tint=rand();
      ctx.fillStyle="#424c4b";ctx.fillRect(x-3,y-3,46,37);
      ctx.fillStyle=tint>.80?"#a8b8ad":tint>.28?"#344e59":"#c3bc9a";
      ctx.fillRect(x,y,40,31);
      ctx.fillStyle="#dbe8e738";ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+24,y);ctx.lineTo(x,y+29);ctx.fill();
      ctx.fillStyle="#c1c6bc";ctx.fillRect(x+19,y,2,31);
      ctx.fillStyle="#626e70";ctx.fillRect(x-6,y+31,50,3);
    }
    ctx.fillStyle="#363e4228";ctx.fillRect(0,row*51+46,256,3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(0.16,0.16);
  texture.anisotropy=2;
  return new THREE.MeshStandardMaterial({
    map:texture,roughness:0.84,metalness:0.08,side:THREE.DoubleSide
  });
}

function fromLonLat(lon,lat){
  const metersLon = 111320 * Math.cos(place.lat * Math.PI / 180);
  return [(lon-place.lon)*metersLon,-(lat-place.lat)*111320];
}
function toCoordinates(x,z){
  return [
    place.lat - z/111320,
    place.lon + x/(111320*Math.cos(place.lat*Math.PI/180))
  ];
}
function getBuildingHeight(tags,r){
  const direct = parseFloat(String(tags.height||"").replace(",","."));
  if(Number.isFinite(direct) && direct>2) return Math.min(160,direct);
  const levels=parseFloat(tags["building:levels"]||"");
  if(Number.isFinite(levels)&&levels>0) return Math.min(160,levels*3.25);
  return 9 + Math.floor(r()*10)*3;
}
function getRoadWidth(type){
  if(["motorway","trunk","primary","secondary"].includes(type))return 12;
  if(["tertiary","residential","living_street"].includes(type))return 8;
  if(["service","unclassified"].includes(type))return 5;
  if(["footway","pedestrian","path","cycleway"].includes(type))return 3;
  return 5;
}
function osmToWorld(elements){
  const mapBuildings=[],mapRoads=[];
  const random=rng(1852);
  for(const el of elements){
    if(el.type!=="way"||!Array.isArray(el.geometry))continue;
    const tags=el.tags||{};
    let points=el.geometry.map(p=>fromLonLat(p.lon,p.lat))
      .filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
    if(points.length<2)continue;
    if(tags.building && tags.building!=="no" && points.length>=4){
      const first=points[0],last=points[points.length-1];
      if(Math.hypot(first[0]-last[0],first[1]-last[1])<1)points.pop();
      const bbox=bounds(points);
      const area=Math.abs(signedArea(points));
      if(points.length<3||area<15||area>22000||bbox.maxX-bbox.minX>230)continue;
      if(mapBuildings.length<260){
        mapBuildings.push({poly:points,height:getBuildingHeight(tags,random),style:Math.floor(random()*5),bbox});
      }
    }else if(tags.highway && mapRoads.length<180){
      mapRoads.push({poly:points,width:getRoadWidth(tags.highway),name:tags.name||""});
    }
  }
  return {buildings:mapBuildings,roads:mapRoads};
}
function bounds(poly){
  return {minX:Math.min(...poly.map(p=>p[0])),maxX:Math.max(...poly.map(p=>p[0])),
    minZ:Math.min(...poly.map(p=>p[1])),maxZ:Math.max(...poly.map(p=>p[1]))};
}
function signedArea(poly){
  let a=0;
  for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length];
    a+=p[0]*q[1]-q[0]*p[1];
  }
  return a*0.5;
}
function makeFallbackWorld(){
  const b=[],r=[],rand=rng(5107);
  for(const x of [-200,-125,-50,25,100,175]){
    r.push({poly:[[x,-280],[x,280]],width:10});
  }
  for(const z of [-200,-125,-50,25,100,175]){
    r.push({poly:[[-280,z],[280,z]],width:10});
  }
  for(let x=-1;x<5;x++)for(let z=-1;z<5;z++){
    if(x===1&&z===1)continue;
    const cx=-162.5+x*75,cz=-162.5+z*75;
    const halfX=18+rand()*11,halfZ=16+rand()*12;
    const poly=[[cx-halfX,cz-halfZ],[cx+halfX,cz-halfZ],
      [cx+halfX,cz+halfZ],[cx-halfX,cz+halfZ]];
    b.push({poly,bbox:bounds(poly),height:12+Math.floor(rand()*11)*4,style:Math.floor(rand()*5)});
  }
  return {buildings:b,roads:r};
}
function disposeGroup(node){
  node.traverse(object=>{
    if(object.isMesh && object.geometry && object.geometry!==treeTrunkGeo && object.geometry!==leafGeo)
      object.geometry.dispose();
  });
}
function addBuilding(entry,parent){
  const shape=new THREE.Shape();
  for(let i=0;i<entry.poly.length;i++){
    const [x,z]=entry.poly[i];
    if(i===0)shape.moveTo(x,-z);else shape.lineTo(x,-z);
  }
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{
    depth:entry.height,bevelEnabled:false,curveSegments:1,steps:1
  });
  geometry.rotateX(-Math.PI/2);
  const mesh=new THREE.Mesh(geometry,[roofMat,facadeMaterials[entry.style]]);
  mesh.frustumCulled=true;
  parent.add(mesh);
  // Separate rooftop details keep readable building silhouettes at street level.
  if(entry.height>30 && entry.poly.length===4){
    const bb=entry.bbox;
    const x=(bb.minX+bb.maxX)*0.5,z=(bb.minZ+bb.maxZ)*0.5;
    const box=new THREE.Mesh(new THREE.BoxGeometry(2,1.7,3),roofMat);
    box.position.set(x,entry.height+0.85,z);
    parent.add(box);
  }
}
function roadSegment(p,q,width,parent,decorations){
  const dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);
  if(len<1||len>1400)return;
  const mx=(p[0]+q[0])/2,mz=(p[1]+q[1])/2;
  const rotation=Math.atan2(dx,dz);
  const sidewalk=new THREE.Mesh(new THREE.BoxGeometry(width+3.5,0.07,len),curbMat);
  sidewalk.position.set(mx,0.008,mz);
  sidewalk.rotation.y=rotation;
  parent.add(sidewalk);
  const asphalt=new THREE.Mesh(new THREE.BoxGeometry(width,0.09,len+0.2),roadMat);
  asphalt.position.set(mx,0.059,mz);
  asphalt.rotation.y=rotation;parent.add(asphalt);
  if(width>=8){
    for(let d=5;d<len-4;d+=12){
      const pos=d-len/2;
      const dash=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.012,3.5),stripeMat);
      dash.position.set(mx+Math.sin(rotation)*pos,0.112,mz+Math.cos(rotation)*pos);
      dash.rotation.y=rotation;parent.add(dash);
    }
  }
  if(width>=8 && decorations.count<85 && len>25){
    const d=Math.min(len*0.4,20);
    const x=mx-Math.cos(rotation)*(width/2+2)+Math.sin(rotation)*d;
    const z=mz+Math.sin(rotation)*(width/2+2)+Math.cos(rotation)*d;
    addTree(x,z,parent);
    decorations.count++;
  }
}
function addTree(x,z,parent){
  const trunk=new THREE.Mesh(treeTrunkGeo,treeTrunkMat);
  trunk.position.set(x,1.55,z);
  const leaves=new THREE.Mesh(leafGeo,leafMat);
  leaves.position.set(x,4.2,z);
  leaves.scale.set(1,1.3,1);
  parent.add(trunk,leaves);
}
function buildWorld(data,mode){
  const next = new THREE.Group();
  const decorations={count:0};
  let segmentCount=0;
  for(const road of data.roads){
    for(let i=1;i<road.poly.length && segmentCount<620;i++){
      const a=road.poly[i-1],b=road.poly[i];
      if(Math.abs(a[0])>450&&Math.abs(b[0])>450)continue;
      if(Math.abs(a[1])>450&&Math.abs(b[1])>450)continue;
      roadSegment(a,b,road.width,next,decorations);
      segmentCount++;
    }
  }
  for(const building of data.buildings)addBuilding(building,next);
  scene.remove(group);
  disposeGroup(group);
  group=next;scene.add(group);
  buildings=data.buildings;
  roads=data.roads;
  sourceMode=mode;
  $("objects").textContent=String(buildings.length);
  $("world-source").textContent=mode==="osm"?"Реальные контуры OSM · процедурные фасады":
    "Демо-квартал · не реальные здания";
  placeStart();
}
function pointInside(x,z,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a[1]>z)!==(b[1]>z) &&
       x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function sqSegmentDistance(x,z,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;
  const t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l)):0;
  const px=a[0]+dx*t,pz=a[1]+dz*t;
  return (x-px)**2+(z-pz)**2;
}
function collides(x,z){
  for(const b of buildings){
    const box=b.bbox;
    if(x<box.minX-PLAYER_RADIUS||x>box.maxX+PLAYER_RADIUS ||
       z<box.minZ-PLAYER_RADIUS||z>box.maxZ+PLAYER_RADIUS)continue;
    if(pointInside(x,z,b.poly))return true;
    for(let i=0;i<b.poly.length;i++){
      if(sqSegmentDistance(x,z,b.poly[i],b.poly[(i+1)%b.poly.length])<PLAYER_RADIUS**2)
        return true;
    }
  }
  return false;
}
function placeStart(){
  let found=false;
  for(let r=0;r<160&&!found;r+=5){
    for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){
      const x=r*Math.cos(angle),z=r*Math.sin(angle);
      if(!collides(x,z)){player.x=x;player.z=z;found=true;break;}
    }
  }
  player.y=0;player.vy=0;player.grounded=true;
  player.startX=player.x;player.startZ=player.z;
  yaw=0;pitch=0;camera.rotation.set(0,0,0);
}

function setNotice(message){
  $("toast").textContent=message;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$("toast").classList.remove("visible"),4300);
}
async function loadCity(cityKey){
  const current=++worldGeneration;
  place=PRESETS[cityKey]||PRESETS.astana;
  $("load-message").textContent="Загрузка геоданных "+place.name+"...";
  $("world-source").textContent="Загрузка OpenStreetMap...";
  if(activeRequest)activeRequest.abort();
  const controller=new AbortController();
  activeRequest=controller;
  const timer=setTimeout(()=>controller.abort(),17000);
  const latitudeDelta=RADIUS_METERS/111320;
  const longitudeDelta=RADIUS_METERS/(111320*Math.cos(place.lat*Math.PI/180));
  const s=(place.lat-latitudeDelta).toFixed(6),n=(place.lat+latitudeDelta).toFixed(6);
  const w=(place.lon-longitudeDelta).toFixed(6),e=(place.lon+longitudeDelta).toFixed(6);
  const bbox=`${s},${w},${n},${e}`;
  const query=`[out:json][timeout:15];(way["building"](${bbox});way["highway"](${bbox}););out geom;`;
  try{
    const response=await fetch("https://overpass-api.de/api/interpreter",{
      method:"POST",body:new URLSearchParams({data:query}),signal:controller.signal
    });
    if(!response.ok)throw new Error("HTTP "+response.status);
    const json=await response.json();
    if(current!==worldGeneration)return;
    const data=osmToWorld(json.elements||[]);
    if(data.buildings.length<3||data.roads.length<1)throw new Error("Недостаточно данных OSM");
    buildWorld(data,"osm");
    $("load-message").textContent="Данные OSM загружены · "+data.buildings.length+" зданий";
    setNotice("Реальные улицы загружены: "+place.name);
  }catch(error){
    if(current!==worldGeneration)return;
    buildWorld(makeFallbackWorld(),"demo");
    $("load-message").textContent="OSM недоступен · запущен автономный демо-квартал";
    setNotice("Сервис OSM не ответил ("+error.message+"). Включён демо-режим.");
  }finally{
    clearTimeout(timer);
    if(activeRequest===controller)activeRequest=null;
  }
}
$("city").addEventListener("change",e=>loadCity(e.target.value));
$("reload").addEventListener("click",()=>loadCity($("city").value));
$("play").addEventListener("click",()=>{
  renderer.domElement.requestPointerLock().catch(()=>setNotice("Разреши захват мыши в браузере."));
});
renderer.domElement.addEventListener("click",()=>{
  if(!isPlaying)renderer.domElement.requestPointerLock().catch(()=>{});
});
document.addEventListener("pointerlockchange",()=>{
  isPlaying=document.pointerLockElement===renderer.domElement;
  $("overlay").classList.toggle("hidden",isPlaying);
  if(!isPlaying)pressed.clear();
});
document.addEventListener("mousemove",e=>{
  if(!isPlaying)return;
  yaw-=e.movementX*0.0022;
  pitch=Math.max(-1.45,Math.min(1.45,pitch-e.movementY*0.0022));
});
document.addEventListener("keydown",e=>{
  if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
  if(e.code==="KeyM"&&!e.repeat){
    minimapVisible=!minimapVisible;
    $("minimap").hidden=!minimapVisible;
  }
  pressed.add(e.code);
});
document.addEventListener("keyup",e=>pressed.delete(e.code));
window.addEventListener("blur",()=>pressed.clear());

function move(dt){
  if(!isPlaying)return;
  const forward=Number(pressed.has("KeyW")||pressed.has("ArrowUp"))-
    Number(pressed.has("KeyS")||pressed.has("ArrowDown"));
  const sideways=Number(pressed.has("KeyD")||pressed.has("ArrowRight"))-
    Number(pressed.has("KeyA")||pressed.has("ArrowLeft"));
  const length=Math.hypot(forward,sideways)||1;
  const f=forward/length,s=sideways/length;
  const speed=(pressed.has("ShiftLeft")||pressed.has("ShiftRight")?9.0:4.8)*dt;
  const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed;
  const dz=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed;
  const newX=Math.max(-430,Math.min(430,player.x+dx));
  const newZ=Math.max(-430,Math.min(430,player.z+dz));
  if(!collides(newX,player.z))player.x=newX;
  if(!collides(player.x,newZ))player.z=newZ;

  if(pressed.has("Space")&&player.grounded){
    player.vy=6.1;player.grounded=false;
  }
  player.vy-=17*dt;
  player.y+=player.vy*dt;
  if(player.y<=0){player.y=0;player.vy=0;player.grounded=true;}
}
function drawMinimap(){
  if(!minimapVisible)return;
  const canvas=$("minimap"),ctx=canvas.getContext("2d");
  const size=canvas.width,center=size/2,scale=0.46;
  ctx.clearRect(0,0,size,size);
  ctx.fillStyle="#12242d";ctx.fillRect(0,0,size,size);
  const sx=x=>center+(x-player.x)*scale;
  const sy=z=>center+(z-player.z)*scale;
  ctx.strokeStyle="#677980";ctx.lineWidth=4;
  for(const road of roads){
    ctx.beginPath();
    road.poly.forEach((p,i)=>i?ctx.lineTo(sx(p[0]),sy(p[1])):ctx.moveTo(sx(p[0]),sy(p[1])));
    ctx.stroke();
  }
  ctx.fillStyle="#556c6e";
  for(const building of buildings){
    ctx.beginPath();
    building.poly.forEach((p,i)=>i?ctx.lineTo(sx(p[0]),sy(p[1])):ctx.moveTo(sx(p[0]),sy(p[1])));
    ctx.closePath();ctx.fill();
  }
  ctx.save();ctx.translate(center,center);ctx.rotate(-yaw);
  ctx.fillStyle="#8efbd6";ctx.beginPath();
  ctx.moveTo(0,-9);ctx.lineTo(6,7);ctx.lineTo(0,3);ctx.lineTo(-6,7);ctx.closePath();ctx.fill();
  ctx.restore();
  ctx.strokeStyle="#85e6d13c";ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(center,center,50,0,Math.PI*2);ctx.stroke();
}
let previous=performance.now(),frameCount=0,timeSum=0,mapTimer=0,hudTimer=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-previous)/1000,0.05);
  previous=now;
  move(dt);
  camera.position.set(player.x,EYE_HEIGHT+player.y,player.z);
  camera.rotation.set(pitch,yaw,0,"YXZ");
  renderer.render(scene,camera);
  frameCount++;timeSum+=dt;mapTimer+=dt;hudTimer+=dt;
  if(timeSum>=0.65){
    $("fps").textContent=String(Math.round(frameCount/timeSum));
    timeSum=0;frameCount=0;
  }
  if(hudTimer>=0.3){
    const [lat,lon]=toCoordinates(player.x,player.z);
    $("coordinates").textContent=lat.toFixed(5)+"° N, "+lon.toFixed(5)+"° E";
    $("meters").textContent=String(Math.round(Math.hypot(
      player.x-player.startX,player.z-player.startZ)));
    hudTimer=0;
  }
  if(mapTimer>=0.12){drawMinimap();mapTimer=0;}
}
requestAnimationFrame(frame);
loadCity("astana");
