import * as THREE from "three";

/**
 * Bayterek v1 — independently authored architectural reconstruction.
 * Actual reference dimensions: 105m total height, 22m sphere diameter.
 * This is NOT an official BIM model, a photogrammetric scan, or a copy
 * of Google/2GIS/Yandex imagery. Plaza furnishings are approximations.
 */
export const BAYTEREK = Object.freeze({
  name: "Монумент «Астана-Байтерек»",
  latitude: 51.12829,
  longitude: 71.43046,
  totalHeight: 105,
  sphereDiameter: 22,
  sphereCenterY: 94,
  start: [0, 109],
  version: "v1 — ручная архитектурная реконструкция",
});

export function buildBayterekWorld() {
  const world = new THREE.Group();
  world.name = "Bayterek | authored landmark";
  const colliders = [];
  const minMapObjects = [];

  const material = (color, roughness = 0.8, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const white = material(0xeff6f5, 0.33, 0.22);
  const whiteShade = material(0xd9e3df, 0.43, 0.10);
  const gold = new THREE.MeshStandardMaterial({
    color: 0xecc75e, metalness: 0.58, roughness: 0.24,
    emissive: 0x553808, emissiveIntensity: 0.17,
  });
  const goldDark = material(0xa68133, 0.34, 0.45);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x5c8190, roughness: 0.24, metalness: 0.2,
    transparent: true, opacity: 0.82, side: THREE.DoubleSide
  });
  const darkGlass = material(0x334b56, 0.33, 0.25);
  const stone = material(0xaaa89f, 0.96);
  const stoneLight = material(0xcec9bf, 0.96);
  const granite = material(0x6b716b, 0.88);
  const pavement = material(0xc7c4bb, 0.95);
  const path = material(0xa29e94, 0.98);
  const dirt = material(0x716e57, 1);
  const grass = material(0x4d7e51, 1);
  const shrubsMat = material(0x326e4a, 1);
  const leaf = material(0x518760, 1);
  const trunkMat = material(0x6d6250, 1);
  const darkMetal = material(0x384a4d, 0.62, 0.3);

  const cylinder = (rTop, rBottom, height, mat, x, y, z, segments=12) => {
    const object = new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBottom,height,segments),mat);
    object.position.set(x,y,z);
    world.add(object);
    return object;
  };
  const box = (w,h,d,mat,x,y,z,rotation=0) => {
    const object=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    object.position.set(x,y,z);
    object.rotation.y=rotation;
    world.add(object);
    return object;
  };
  const disc=(inner, outer, y, mat, start=0, end=Math.PI*2) => {
    const geometry = new THREE.RingGeometry(inner,outer,128,1,start,end);
    geometry.rotateX(-Math.PI/2);
    const mesh = new THREE.Mesh(geometry,mat);
    mesh.position.y=y;
    world.add(mesh);
    return mesh;
  };
  const beam=(a,b,radius,mat,segments=7) => {
    const start=new THREE.Vector3(...a);
    const end=new THREE.Vector3(...b);
    const delta=end.clone().sub(start);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),segments),mat);
    mesh.position.copy(start.add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    world.add(mesh);
    return mesh;
  };
  const orbit=(radius,tube,y,mat,segments=96) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius,tube,8,segments),mat);
    ring.rotation.x=Math.PI/2;
    ring.position.y=y;
    world.add(ring);
    return ring;
  };
  const pointAt=(r,y,a)=>[Math.cos(a)*r,y,Math.sin(a)*r];

  // Wide mostly-flat civic promenade. Rectangles and paths are
  // hand-authored reference compositions, not a cadastral exact survey.
  box(460,0.14,460,grass,0,-0.14,0);
  box(31,0.08,440,path,0,-0.014,0); // Nurzhol axis (schematic alignment)
  box(440,0.09,20,path,0,-0.01,0);
  box(63,0.10,230,pavement,0,-0.005,0);
  box(128,0.10,67,pavement,0,-0.005,0);

  // Garden strips and repeated stonework in the plaza.
  for(const s of [-1,1]) {
    for(let i=0;i<9;i++){
      const z=-155+i*38;
      const x=s*45;
      box(21,0.10,29,grass,x,-0.007,z);
      box(22,0.11,0.6,stone,x,0.001,z-15);
      box(22,0.11,0.6,stone,x,0.001,z+15);
      box(0.5,0.11,30,stone,x+s*11,0.001,z);
      box(0.5,0.11,30,stone,x-s*11,0.001,z);
      const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1,1),shrubsMat);
      shrub.position.set(x,0.95,z);
      shrub.scale.set(2.2,0.75,5.2);
      world.add(shrub);
    }
  }

  // Broad circular stone podium around the monument.
  cylinder(41,41,0.35,granite,0,0.01,0,96);
  cylinder(39.6,39.6,0.10,pavement,0,0.24,0,96);
  disc(32,37,0.305,stoneLight);
  disc(17.5,21.7,0.314,stone);
  disc(25,25.2,0.321,granite);
  disc(34.5,34.65,0.323,granite);
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8;
    const p=pointAt(28.6,0.34,a);
    const g=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.015,10),stoneLight);
    g.position.set(...p);
    g.rotation.y=-a;
    world.add(g);
  }

  // Stone base and octagonal entrance.
  cylinder(11.8,12.4,1.15,granite,0,0.70,0,12);
  cylinder(10.4,10.6,0.48,stoneLight,0,1.5,0,12);
  cylinder(7.7,8.2,2.6,whiteShade,0,3.0,0,16);
  cylinder(6.5,6.65,1.8,darkGlass,0,3.85,0,16);
  cylinder(8.2,8.2,0.26,white,0,4.96,0,16);
  cylinder(2.7,2.8,0.15,white,0,4.98,0,20);

  // Vertical central elevator shaft with clearly differentiated glazing.
  cylinder(3.0,3.4,68,whiteShade,0,40,0,20);
  cylinder(2.38,2.5,67.5,glass,0,40.1,0,20);
  for(let a=0;a<16;a++){
    const angle=a*Math.PI*2/16;
    beam(pointAt(2.85,7,angle),pointAt(2.85,72,angle),0.13,white,6);
  }
  for(let y=9;y<=72;y+=5){
    orbit(3.0,0.09,y,whiteShade,48);
  }

  // Tree-of-Life white ribs, bending outwards to hold the golden egg.
  // Control points designed as smooth arcing segments for recognizability.
  const ribs=16;
  const curveY=[4.5,19,38,56,66,75,83,91];
  const curveR=[7.6,6.5,5.3,5.7,7.4,10.3,13.0,14.8];
  const points=[];
  for(let i=0;i<ribs;i++){
    const angle=2*Math.PI*i/ribs;
    const one=[];
    for(let j=0;j<curveY.length;j++)one.push(pointAt(curveR[j],curveY[j],angle));
    points.push(one);
    for(let j=1;j<one.length;j++) beam(one[j-1],one[j],0.29,white,7);
  }
  // Alternating diagonal ties and transverse bridges form the recognizable
  // open lattice visible around the crown.
  for(let level=1;level<curveY.length;level++){
    const ringR=curveR[level];
    for(let i=0;i<ribs;i++){
      const next=(i+1)%ribs;
      if(level>=3)beam(points[i][level],points[next][level],0.11,whiteShade,5);
      beam(points[i][level-1],points[next][level],0.105,white,5);
      if(level>=4&&i%2===0){
        beam(points[next][level-1],points[i][level],0.09,whiteShade,5);
      }
    }
    if(level>3)orbit(ringR,0.13,curveY[level],whiteShade,96);
  }
  // Exterior crown spikes continue above the lower portion of the sphere.
  for(let i=0;i<16;i++){
    const a=i*Math.PI*2/16;
    beam(pointAt(14.8,91,a),pointAt(17.3,101.1,a),0.105,white,6);
    beam(pointAt(14.8,91,a),pointAt(16.3,96.4,a+Math.PI*2/16),0.09,whiteShade,5);
  }

  // Actual 22-metre diameter sphere, total height 105m.
  const globe = new THREE.Mesh(new THREE.SphereGeometry(11,56,36),gold);
  globe.position.set(0,94,0);
  world.add(globe);

  // Meridian/latitude panels and dark glazed band show the sphere's
  // distinctive golden glass segments, rather than an untextured yellow ball.
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12;
    const meridian=new THREE.Mesh(new THREE.TorusGeometry(11.055,0.045,5,72,Math.PI*2),goldDark);
    meridian.position.set(0,94,0);
    meridian.rotation.y=a;
    world.add(meridian);
  }
  for(const latitude of [-60,-35,-12,12,35,60]){
    const angle=latitude*Math.PI/180;
    const r=11.07*Math.cos(angle);
    const y=94+11.07*Math.sin(angle);
    orbit(r,0.065,y,goldDark,112);
  }
  // Observation deck represented by a subtle dark equatorial glass belt.
  const glassBelt=new THREE.Mesh(
    new THREE.CylinderGeometry(11.15,11.15,2.2,64,1,true),
    new THREE.MeshStandardMaterial({color:0x9a7d38,transparent:true,opacity:0.25,metalness:0.4,roughness:0.24,side:THREE.DoubleSide})
  );
  glassBelt.position.set(0,94,0);
  world.add(glassBelt);

  // Sculpture grounds — pedestrian furniture and green vegetation
  // are artist-made approximations rather than photogrammetric assets.
  const benchTop=material(0x8d7861,0.88);
  for(let side of [-1,1])for(const z of [-85,-45,45,85]){
    const x=side*25;
    box(3.2,0.21,0.82,benchTop,x,0.61,z);
    for(const edge of [-1.1,1.1])box(0.22,0.6,0.7,darkMetal,x+edge,0.3,z);
    colliders.push({type:"box",x,z,halfX:1.85,halfZ:0.8});
    minMapObjects.push({type:"bench",x,z});
  }
  const treeTrunk=new THREE.CylinderGeometry(0.2,0.3,4,7);
  const crown=new THREE.IcosahedronGeometry(2.35,1);
  const trees=[];
  for(const side of [-1,1]){
    for(const row of [60,75,90]){
      for(let z=-166;z<=166;z+=19){
        const x=side*row;
        const item=new THREE.Group();
        const stem=new THREE.Mesh(treeTrunk,trunkMat);
        stem.position.y=2.05;
        const leaves=new THREE.Mesh(crown,leaf);
        leaves.position.y=5.25;
        leaves.scale.set(1,1.4,1);
        item.add(stem,leaves);
        item.position.set(x,0,z);
        world.add(item);
        trees.push([x,z]);
        colliders.push({type:"circle",x,z,radius:0.36});
      }
    }
  }
  // Low white lamp posts are decorative, with lightweight emissive globes.
  const lightWhite = new THREE.MeshBasicMaterial({color:0xfff2d9});
  const lightSphere=new THREE.SphereGeometry(0.32,10,8);
  for(const x of [-22,22]){
    for(const z of [-120,-60,60,120]){
      cylinder(0.065,0.09,5.7,darkMetal,x,2.85,z,6);
      const globeLight=new THREE.Mesh(lightSphere,lightWhite);
      globeLight.position.set(x,5.8,z);
      world.add(globeLight);
    }
  }

  colliders.push({type:"circle",x:0,z:0,radius:8.0});
  minMapObjects.push({type:"monument",x:0,z:0,radius:11});
  return {
    group:world,colliders,trees,minMapObjects,
    landmark:{x:0,z:0,radius:11,label:"Байтерек",latitude:BAYTEREK.latitude,longitude:BAYTEREK.longitude},
  };
}
