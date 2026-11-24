// Port Solmar: the city itself. A 7x7 road grid on a painted ground texture,
// instanced towers with lit-window facades, a rooftop city sign, streetlights
// kept on sidewalks (never in roads), beach palms and ocean, sunset lighting.
import * as THREE from 'three';
import { rand, randInt, pick, clamp } from './utils.js';

export const ROADS = [-156, -104, -52, 0, 52, 104, 156];
export const ROAD_W = 10;
export const CITY_HALF = 182;

const BLOCK_CENTERS = [-130, -78, -26, 26, 78, 130];

function groundTexture() {
  const S = 1024, W = 420; // world [-210, 210] maps to [0, 1024]
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d');
  const toMap = (v) => (v + W / 2) / W * S;
  // Grass base.
  g.fillStyle = '#5d8a4a'; g.fillRect(0, 0, S, S);
  // Beach strip along the south edge (z > 172).
  g.fillStyle = '#e8d39a'; g.fillRect(0, toMap(172), S, S - toMap(172));
  // Sidewalk blocks.
  g.fillStyle = '#b9b3a4';
  for (const bx of BLOCK_CENTERS) for (const bz of BLOCK_CENTERS) {
    g.fillRect(toMap(bx - 24), toMap(bz - 24), toMap(48) - toMap(0), toMap(48) - toMap(0));
  }
  // Roads.
  g.fillStyle = '#4a4a52';
  for (const r of ROADS) {
    g.fillRect(toMap(r - ROAD_W / 2), 0, toMap(ROAD_W) - toMap(0), S);
    g.fillRect(0, toMap(r - ROAD_W / 2), S, toMap(ROAD_W) - toMap(0));
  }
  // Lane dashes (yellow centre lines).
  g.fillStyle = '#c9a227';
  for (const r of ROADS) {
    for (let v = -200; v < 200; v += 16) {
      g.fillRect(toMap(r) - 1.5, toMap(v), 3, toMap(7) - toMap(0));
      g.fillRect(toMap(v), toMap(r) - 1.5, toMap(7) - toMap(0), 3);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = '#f2f2f2';
  for (const rx of ROADS) for (const rz of ROADS) {
    for (let i = -4; i <= 4; i += 2) {
      g.fillRect(toMap(rx + i - 0.8), toMap(rz - 7), 1.6, toMap(4) - toMap(0));
      g.fillRect(toMap(rx + i - 0.8), toMap(rz + 3), 1.6, toMap(4) - toMap(0));
      g.fillRect(toMap(rx - 7), toMap(rz + i - 0.8), toMap(4) - toMap(0), 1.6);
      g.fillRect(toMap(rx + 3), toMap(rz + i - 0.8), toMap(4) - toMap(0), 1.6);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function facadeTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8a7f74'; g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 8; x < 120; x += 20) {
      const lit = Math.random() < 0.55;
      g.fillStyle = lit ? (Math.random() < 0.7 ? '#ffd76a' : '#9fd8ff') : '#2c3440';
      g.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2b4a'; g.fillRect(0, 0, 512, 96);
  g.strokeStyle = '#ffd75e'; g.lineWidth = 4; g.strokeRect(4, 4, 504, 88);
  g.fillStyle = '#ffd75e'; g.font = 'bold 58px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('PORT SOLMAR', 256, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  group.add(ground);

  // Ocean beyond the beach (south, +z).
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 260),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e, transparent: true, opacity: 0.92 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.15, 190 + 130);
  group.add(ocean);

  // Buildings: one instanced box per block (plaza block at 0,0 stays open).
  const facade = facadeTexture();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const boxMat = new THREE.MeshLambertMaterial({ map: facade });
  const spots = [];
  for (const bx of BLOCK_CENTERS) for (const bz of BLOCK_CENTERS) {
    if (bx === 26 && bz === -26) continue; // sign tower block handled separately
    if (bx === 0 || bz === 0) continue; // keep plaza block open (centers are -26/26, so this is the (26,26) area check below)
    spots.push({ x: bx, z: bz });
  }
  // Plaza: no building in the block centred (26, 26) — the city plaza.
  const plazaSpot = spots.findIndex((s) => s.x === 26 && s.z === 26);
  if (plazaSpot >= 0) spots.splice(plazaSpot, 1);
  const tints = [0xffffff, 0xffe0b8, 0xd8e6ff, 0xffd9c9, 0xe2ffd9];
  const inst = new THREE.InstancedMesh(boxGeo, boxMat, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  let tallest = null;
  spots.forEach((s, i) => {
    const w = rand(20, 28), d = rand(20, 28), h = rand(12, 42);
    const y = h / 2;
    m.compose(new THREE.Vector3(s.x + rand(-2, 2), y, s.z + rand(-2, 2)), q, new THREE.Vector3(w, h, d));
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, col.setHex(pick(tints)));
    colliders.push({ minX: s.x - w / 2, maxX: s.x + w / 2, minZ: s.z - d / 2, maxZ: s.z + d / 2 });
    if (!tallest || h > tallest.h) tallest = { x: s.x, z: s.z, h, w };
  });
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  group.add(inst);

  // Rooftop sign on the tallest tower.
  if (tallest) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 8.6),
      new THREE.MeshBasicMaterial({ map: signTexture(), side: THREE.DoubleSide }),
    );
    sign.position.set(tallest.x, tallest.h + 5, tallest.z);
    sign.rotation.y = Math.PI / 4;
    group.add(sign);
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 1.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    post.position.set(tallest.x, tallest.h + 0.8, tallest.z);
    group.add(post);
  }

  // Streetlights: mid-block on sidewalks only — offset 7 from a road line, at
  // block-centre cross streets, so no lamp ever stands in a road.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d34 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const lampGeo = new THREE.SphereGeometry(0.55, 8, 6);
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.24, 7, 6);
  for (const r of ROADS) {
    for (const b of BLOCK_CENTERS) {
      for (const [x, z] of [[r + 7, b], [r - 7, b], [b, r + 7], [b, r - 7]]) {
        if (Math.abs(x) > CITY_HALF || Math.abs(z) > CITY_HALF) continue;
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 3.5, z);
        group.add(pole);
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(x, 7.2, z);
        group.add(lamp);
      }
    }
  }

  // Palms: beach row and plaza cluster.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e, side: THREE.DoubleSide });
  function palm(x, z, s) {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.4 * s, 6 * s, 6), trunkMat);
    trunk.position.y = 3 * s;
    trunk.rotation.z = 0.12;
    t.add(trunk);
    for (let i = 0; i < 5; i++) {
      const fr = new THREE.Mesh(new THREE.ConeGeometry(1.6 * s, 3.2 * s, 4), frondMat);
      fr.position.y = 6.2 * s;
      fr.rotation.z = Math.PI / 2 + rand(-0.3, 0.3);
      fr.rotation.y = (i / 5) * Math.PI * 2;
      fr.scale.set(1, 0.45, 1);
      t.add(fr);
    }
    t.position.set(x, 0, z);
    group.add(t);
  }
  for (let x = -180; x <= 180; x += 24) palm(x + rand(-4, 4), 186 + rand(-2, 4), rand(0.9, 1.3));
  palm(-8, 18, 1.2); palm(8, 34, 1.1); palm(34, 18, 1.0); palm(18, 34, 1.15);

  // Sunset lighting.
  scene.fog = new THREE.Fog(0xffc98f, 140, 460);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(-140, 90, 60);
  scene.add(sun);

  return { group, colliders };
}

export function nearestRoad(v) {
  let best = ROADS[0];
  for (const r of ROADS) if (Math.abs(v - r) < Math.abs(v - best)) best = r;
  return best;
}
export function isOnRoad(x, z) {
  const onX = ROADS.some((r) => Math.abs(x - r) <= ROAD_W / 2 + 1.5);
  const onZ = ROADS.some((r) => Math.abs(z - r) <= ROAD_W / 2 + 1.5);
  return onX || onZ;
}
// Push a circle (x,z,r) out of building colliders. Returns corrected {x,z}.
export function resolveCircle(x, z, r, colliders) {
  for (const b of colliders) {
    const cx = clamp(x, b.minX, b.maxX);
    const cz = clamp(z, b.minZ, b.maxZ);
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pl = x - (b.minX - r), pr = (b.maxX + r) - x;
        const pt = z - (b.minZ - r), pb = (b.maxZ + r) - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.minX - r; else if (m === pr) x = b.maxX + r;
        else if (m === pt) z = b.minZ - r; else z = b.maxZ + r;
      }
    }
  }
  return { x: clamp(x, -CITY_HALF, CITY_HALF), z: clamp(z, -CITY_HALF, CITY_HALF) };
}
export function randomRoadPoint() {
  const horizontal = Math.random() < 0.5;
  const r = pick(ROADS);
  const along = pick(ROADS) + rand(-20, 20);
  return horizontal ? { x: along, z: r } : { x: r, z: along };
}
