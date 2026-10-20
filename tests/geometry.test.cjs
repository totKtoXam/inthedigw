const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root,file),"utf8");
const index = read("index.html");
const game = read("game.js");
const landmark = read("baiterek.js");
const css = read("style.css");

test("the game imports its own dedicated Bayterek 3D reconstruction",()=>{
  assert.match(game,/import \{ BAYTEREK, buildBayterekWorld \} from "\.\/baiterek\.js"/);
  assert.match(game,/const model = buildBayterekWorld\(\)/);
  assert.match(landmark,/new THREE\.SphereGeometry\(11,56,36\)/);
  assert.match(landmark,/const ribs=16/);
  assert.match(landmark,/const curveY=\[4\.5,19,38,56,66,75,83,91\]/);
});

test("landmark coordinates and dimensions are documented as real measurements",()=>{
  assert.match(landmark,/latitude: 51\.12829/);
  assert.match(landmark,/longitude: 71\.43046/);
  assert.match(landmark,/totalHeight: 105/);
  assert.match(landmark,/sphereDiameter: 22/);
  assert.match(landmark,/sphereCenterY: 94/);
});

test("first-person movement has physical collisions, gravity and a spawn facing Bayterek",()=>{
  assert.match(landmark,/start: \[0, 109\]/);
  assert.match(game,/function collides\(x,z\)/);
  assert.match(game,/function move\(dt\)/);
  assert.match(game,/player\.vy-=16\*dt/);
  assert.match(game,/collisionCircle/);
  assert.match(game,/collisionBox/);
  assert.match(game,/requestPointerLock/);
});

test("the minimap is available in full-screen, keyboard and clickable form",()=>{
  for(const id of ["minimap","map-expanded","fullmap-canvas","close-map","map-toggle"]){
    assert.ok(index.includes('id="'+id+'"'),id+" missing");
  }
  assert.match(game,/showFullMap\(!mapOpen\)/);
  assert.match(game,/\$\("minimap"\)\.addEventListener\("click"/);
  assert.match(game,/renderMap\(true\)/);
  assert.match(css,/#map-expanded\[hidden\]\{display:none\}/);
});

test("zero paid dependencies or false photogrammetry claims",()=>{
  const code = game + landmark + index;
  assert.doesNotMatch(code,/googleapis\.com|maps\.google|mapbox\.com|YOUR_GOOGLE_MAPS_API_KEY|cesium\.ion/);
  assert.doesNotMatch(game,/fetch\(|makeFallbackWorld|overpass-api/);
  assert.match(index,/художественной реконструкцией/);
  assert.match(landmark,/NOT an official BIM model/);
});

test("Three.js is loaded as a free ES module and HTML points to new code",()=>{
  assert.match(index,/three@0\.180\.0/);
  assert.match(index,/type="module" src="\.\/game\.js"/);
  assert.match(index,/role="dialog"/);
});
