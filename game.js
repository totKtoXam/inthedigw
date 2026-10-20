import * as THREE from "three";
import { BAYTEREK, buildBayterekWorld } from "./baiterek.js";

const $ = id => document.getElementById(id);
const PLAYER_RADIUS = 0.46, EYE_HEIGHT = 1.72;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ac6df);
scene.fog = new THREE.FogExp2(0x9ac6df, 0.00155);
const camera = new THREE.PerspectiveCamera(73, innerWidth/innerHeight, 0.06, 650);
camera.rotation.order = "YXZ";
const renderer = new THREE.WebGLRenderer({
  antialias: false, powerPreference: "low-power", alpha: false
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.30;
renderer.setSize(innerWidth,innerHeight);
$("viewport").appendChild(renderer.domElement);

// Warm directional light and ambient sky: zero texture downloads, no paid API.
scene.add(new THREE.HemisphereLight(0xeaf8ff,0x6f785e,2.65));
const sunlight = new THREE.DirectionalLight(0xffeccd,3.0);
sunlight.position.set(-110,175,85);
scene.add(sunlight);
const sunny = new THREE.Mesh(new THREE.SphereGeometry(13,12,8),
  new THREE.MeshBasicMaterial({color:0xfff5d7,fog:false}));
sunny.position.set(-390,330,-260);
scene.add(sunny);

const model = buildBayterekWorld();
scene.add(model.group);
const player = {
  x:BAYTEREK.start[0],z:BAYTEREK.start[1],y:0,vy:0,
  grounded:true,startX:BAYTEREK.start[0],startZ:BAYTEREK.start[1],
};
let yaw=0,pitch=0;
let playing=false,mapOpen=false;
const pressed=new Set();
const bounds=185;
let frames=0,fpsAccum=0,lastFrame=performance.now(),uiAccum=0;

$("objects").textContent="1";
$("world-source").textContent="Байтерек · 3D-реконструкция, без платных API";
$("load-message").textContent="Сцена Байтерека готова · 105 м · шар 22 м";
$("coordinates").textContent=BAYTEREK.latitude.toFixed(5)+"° N, "+BAYTEREK.longitude.toFixed(5)+"° E";

const quality = {low:0.65,medium:0.85,high:1.0};
function setQuality(){
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,quality[$("quality").value]));
  renderer.setSize(innerWidth,innerHeight);
}
$("quality").addEventListener("change",setQuality);
setQuality();
window.addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  renderMap(false);
  if(mapOpen)renderMap(true);
});
$("reload").textContent="↻ Начало";
$("reload").title="Вернуться ко входу на площадь Байтерека";
$("reload").addEventListener("click",()=>{
  player.x=BAYTEREK.start[0];player.z=BAYTEREK.start[1];
  player.startX=player.x;player.startZ=player.z;
  player.y=0;player.vy=0;player.grounded=true;
  yaw=0;pitch=0;
  notify("Возвращение к Байтереку");
});

let toastTimer;
function notify(message){
  const toast=$("toast");
  toast.textContent=message;toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove("visible"),4000);
}

const collisionCircle=(x,z,obj)=>{
  const r=(obj.radius||0)+PLAYER_RADIUS;
  return (x-obj.x)**2+(z-obj.z)**2 < r*r;
};
const collisionBox=(x,z,obj)=>{
  return Math.abs(x-obj.x)<obj.halfX+PLAYER_RADIUS &&
    Math.abs(z-obj.z)<obj.halfZ+PLAYER_RADIUS;
};
function collides(x,z){
  if(Math.abs(x)>bounds||Math.abs(z)>bounds)return true;
  return model.colliders.some(c=>c.type==="circle" ?
    collisionCircle(x,z,c):collisionBox(x,z,c));
}
function worldGroundLevel(x,z){
  return Math.hypot(x,z)<40.3 ? 0.31:0;
}
function move(dt){
  if(!playing||mapOpen)return;
  const forward=Number(pressed.has("KeyW")||pressed.has("ArrowUp"))-
                Number(pressed.has("KeyS")||pressed.has("ArrowDown"));
  const strafe=Number(pressed.has("KeyD")||pressed.has("ArrowRight"))-
               Number(pressed.has("KeyA")||pressed.has("ArrowLeft"));
  const magnitude=Math.hypot(forward,strafe)||1;
  const f=forward/magnitude,s=strafe/magnitude;
  const walk=pressed.has("ShiftLeft")||pressed.has("ShiftRight")?8.0:4.4;
  const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*walk*dt;
  const dz=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*walk*dt;
  const x=player.x+dx,z=player.z+dz;
  if(!collides(x,player.z))player.x=x;
  if(!collides(player.x,z))player.z=z;

  if(pressed.has("Space")&&player.grounded){
    player.vy=6.1;player.grounded=false;
  }
  player.vy-=16*dt;
  player.y+=player.vy*dt;
  const floor=worldGroundLevel(player.x,player.z);
  if(player.y<=floor){player.y=floor;player.vy=0;player.grounded=true;}
}

function setPointer(){
  renderer.domElement.requestPointerLock().catch(()=>{
    notify("Разрешите захват мыши для управления камерой.");
  });
}
$("play").addEventListener("click",setPointer);
renderer.domElement.addEventListener("click",()=>{
  if(!playing&&!mapOpen)setPointer();
});
document.addEventListener("pointerlockchange",()=>{
  playing=document.pointerLockElement===renderer.domElement;
  $("overlay").classList.toggle("hidden",playing||mapOpen);
  if(!playing)pressed.clear();
});
document.addEventListener("mousemove",e=>{
  if(!playing||mapOpen)return;
  yaw-=e.movementX*0.00215;
  pitch=Math.max(-1.43,Math.min(1.43,pitch-e.movementY*0.00215));
});
document.addEventListener("keydown",e=>{
  if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))
    e.preventDefault();
  if(e.code==="KeyM"&&!e.repeat){
    showFullMap(!mapOpen);
    return;
  }
  if(mapOpen&&e.code==="Escape"){showFullMap(false);return;}
  pressed.add(e.code);
});
document.addEventListener("keyup",e=>pressed.delete(e.code));
window.addEventListener("blur",()=>pressed.clear());

function drawMiniMap(canvas,large=false){
  if(!canvas)return;
  const rect=canvas.getBoundingClientRect();
  if(large){
    const dimension=Math.max(260,Math.min(rect.width||600,rect.height||600,750));
    canvas.width=Math.round(dimension);
    canvas.height=Math.round(dimension);
  }
  const ctx=canvas.getContext("2d");
  const w=canvas.width,h=canvas.height;
  const centerX=w/2,centerY=h/2,scale=large?Math.min(w,h)/435:0.44;
  const tx=x=>centerX+(x-(large?0:player.x))*scale;
  const tz=z=>centerY+(z-(large?0:player.z))*scale;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle="#0e2c32";ctx.fillRect(0,0,w,h);
  ctx.fillStyle="#264739";
  ctx.fillRect(tx(-220),tz(-220),440*scale,440*scale);
  // Deliberately local schematic. No false "satellite" or live map claims.
  ctx.fillStyle="#819394";
  ctx.fillRect(tx(-15),tz(-220),30*scale,440*scale);
  ctx.fillRect(tx(-220),tz(-10),440*scale,20*scale);
  ctx.fillStyle="#bcb8a7";
  ctx.fillRect(tx(-31),tz(-110),62*scale,220*scale);
  ctx.fillRect(tx(-66),tz(-33),132*scale,66*scale);
  ctx.strokeStyle="#adb0aa";ctx.lineWidth=large?11:5;
  ctx.beginPath();ctx.arc(tx(0),tz(0),41*scale,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle="#c3c2b8";
  ctx.beginPath();ctx.arc(tx(0),tz(0),38*scale,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#74877c";ctx.lineWidth=large?5:2;
  ctx.beginPath();ctx.arc(tx(0),tz(0),22*scale,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle="#d5ae56";
  ctx.beginPath();ctx.arc(tx(0),tz(0),11*scale,0,Math.PI*2);ctx.fill();
  if(large){
    ctx.font="bold 17px system-ui";
    ctx.fillStyle="#fff0c4";ctx.fillText("БАЙТЕРЕК",tx(0)+17,tz(0)-9);
    ctx.font="13px system-ui";
    ctx.fillStyle="#e6f1f1";ctx.fillText("105 м / шар 22 м",tx(0)+17,tz(0)+12);
  }
  for(const [x,z] of model.trees){
    const X=tx(x),Z=tz(z);
    if(X<-5||X>w+5||Z<-5||Z>h+5)continue;
    ctx.fillStyle="#287951";
    ctx.beginPath();ctx.arc(X,Z,large?3.2:1.8,0,Math.PI*2);ctx.fill();
  }
  const px=tx(player.x),pz=tz(player.z);
  ctx.save();ctx.translate(px,pz);ctx.rotate(-yaw);
  ctx.fillStyle="#8ffff0";ctx.strokeStyle="#103532";ctx.lineWidth=large?2:1;
  ctx.beginPath();
  const s=large?12:7;
  ctx.moveTo(0,-s);ctx.lineTo(s*0.72,s);ctx.lineTo(0,s*0.4);
  ctx.lineTo(-s*0.72,s);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  if(large){
    ctx.font="12px system-ui";ctx.fillStyle="#d3f7ef";
    ctx.fillText("Схема игровой локации — не спутниковая карта",16,h-18);
  }
}
function renderMap(large){drawMiniMap($(large?"fullmap-canvas":"minimap"),large);}
function showFullMap(open){
  mapOpen=open;
  const node=$("map-expanded");
  node.hidden=!open;
  if(open){
    if(document.pointerLockElement)document.exitPointerLock();
    $("overlay").classList.add("hidden");
    requestAnimationFrame(()=>renderMap(true));
  }else{
    $("overlay").classList.remove("hidden");
  }
}
$("minimap").addEventListener("click",()=>showFullMap(true));
$("map-toggle").addEventListener("click",()=>showFullMap(true));
$("close-map").addEventListener("click",()=>showFullMap(false));
renderMap(false);

function gameLoop(now){
  requestAnimationFrame(gameLoop);
  const dt=Math.min(0.05,(now-lastFrame)/1000);
  lastFrame=now;
  move(dt);
  camera.position.set(player.x,player.y+EYE_HEIGHT,player.z);
  camera.rotation.set(pitch,yaw,0,"YXZ");
  renderer.render(scene,camera);
  frames++;fpsAccum+=dt;uiAccum+=dt;
  if(fpsAccum>=0.65){
    $("fps").textContent=String(Math.round(frames/fpsAccum));
    frames=0;fpsAccum=0;
  }
  if(uiAccum>=0.25){
    const lat=BAYTEREK.latitude-player.z/111320;
    const lon=BAYTEREK.longitude+player.x/(111320*Math.cos(BAYTEREK.latitude*Math.PI/180));
    $("coordinates").textContent=lat.toFixed(5)+"° N, "+lon.toFixed(5)+"° E";
    $("meters").textContent=String(Math.round(Math.hypot(
      player.x-player.startX,player.z-player.startZ)));
    if(!mapOpen)renderMap(false);else renderMap(true);
    uiAccum=0;
  }
}
requestAnimationFrame(gameLoop);
