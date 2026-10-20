const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function functionBody(name) {
  const start = source.indexOf("function " + name + "(");
  assert.ok(start >= 0, "Function not found: " + name);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) {
      return source.slice(start, i + 1);
    }
  }
  throw new Error("Unclosed function: " + name);
}

const needed = [
  "rng", "fromLonLat", "toCoordinates", "getBuildingHeight",
  "getRoadWidth", "bounds", "signedArea", "osmToWorld",
  "pointInside", "sqSegmentDistance", "makeFallbackWorld", "collides"
];
const context = {
  place: { lat: 51.1283, lon: 71.4305 },
  PLAYER_RADIUS: 0.47,
  buildings: []
};
vm.runInNewContext(
  needed.map(functionBody).join("\n") +
  "\nglobalThis.geo = { fromLonLat, toCoordinates, getBuildingHeight, getRoadWidth, bounds, signedArea, osmToWorld, pointInside, sqSegmentDistance, makeFallbackWorld, collides };",
  context
);
const g = context.geo;

test("3D application files link to the imported Three.js module", () => {
  assert.match(html, /type="module" src="\.\/game\.js"/);
  assert.match(html, /three@0\.180\.0/);
  assert.match(html, /OpenStreetMap contributors/);
  assert.match(source, /overpass-api\.de\/api\/interpreter/);
});

test("latitude and longitude roundtrip within 1e-7 degrees", () => {
  const lat = 51.1287, lon = 71.4308;
  const [x, z] = g.fromLonLat(lon, lat);
  const [returnedLat, returnedLon] = g.toCoordinates(x, z);
  assert.ok(Math.abs(lat - returnedLat) < 1e-7);
  assert.ok(Math.abs(lon - returnedLon) < 1e-7);
});

test("2D building collision catches inside and near-wall positions", () => {
  const poly = [[0,0],[10,0],[10,10],[0,10]];
  const bbox = g.bounds(poly);
  context.buildings = [{poly, bbox}];
  assert.equal(g.pointInside(5, 5, poly), true);
  assert.equal(g.pointInside(12, 5, poly), false);
  assert.equal(g.collides(5, 5), true);
  assert.equal(g.collides(10.2, 5), true);
  assert.equal(g.collides(11, 5), false);
  context.buildings = [];
});

test("OSM geometry becomes buildings and roads with metric height", () => {
  const lat = context.place.lat, lon = context.place.lon;
  const p = (dLat,dLon) => ({lat:lat+dLat,lon:lon+dLon});
  const elements = [
    {type:"way",tags:{building:"yes",height:"12 m"},geometry:[
      p(0,0),p(0,0.0001),p(0.0001,0.0001),p(0.0001,0),p(0,0)
    ]},
    {type:"way",tags:{highway:"residential"},geometry:[
      p(-0.0001,0),p(-0.0001,0.0002)
    ]}
  ];
  const data = g.osmToWorld(elements);
  assert.equal(data.buildings.length, 1);
  assert.equal(data.roads.length, 1);
  assert.equal(data.buildings[0].height, 12);
  assert.equal(data.buildings[0].poly.length, 4);
  assert.equal(data.roads[0].width, 8);
});

test("fallback always returns a traversable synthetic city", () => {
  const a = g.makeFallbackWorld();
  const b = g.makeFallbackWorld();
  assert.ok(a.buildings.length > 10);
  assert.ok(a.roads.length > 5);
  assert.equal(a.buildings[0].height, b.buildings[0].height);
  assert.equal(a.buildings[0].poly[0][0], b.buildings[0].poly[0][0]);
});

test("source does not request paid Google Map Tiles or API keys", () => {
  assert.doesNotMatch(source, /createGooglePhotorealistic3DTileset|YOUR_GOOGLE_MAPS_API_KEY/);
  assert.ok(source.includes('overpass-api.de'));
});
