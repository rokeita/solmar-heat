// AI traffic and pedestrians for SOLMAR HEAT. Traffic cars follow the road
// grid, stop for the car ahead and turn at intersections; pedestrians stroll
// the sidewalks, fall when hit or punched, and respawn.
import * as THREE from 'three';
import { clamp, dist2, pick, rand, randInt } from './utils.js';
import { ROADS, nearestRoad, resolveCircle } from './city.js';
import { makeCar, CAR_COLORS } from './vehicles.js';

const PED_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1, 0x1abc9c];

function makePedMesh(scene, color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.95, 8), new THREE.MeshLambertMaterial({ color }));
  body.position.y = 0.95;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({ color: 0xc98d64 }));
  head.position.y = 1.62;
  g.add(head);
  scene.add(g);
  return g;
}

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    this.peds = [];
    for (let i = 0; i < 11; i++) this.spawnCar(true);
    for (let i = 0; i < 22; i++) this.spawnPed(true);
  }
  spawnCar(initial) {
    const car = makeCar(this.scene, pick(CAR_COLORS), false);
    const horizontal = Math.random() < 0.5;
    const lane = pick(ROADS);
    const along = pick(ROADS) + rand(-18, 18);
    const dir = Math.random() < 0.5 ? 1 : -1;
    car.group.position.set(horizontal ? along : lane, 0, horizontal ? lane : along);
    car.ai = { axis: horizontal ? 'x' : 'z', dir, lane, speed: rand(8, 12), laneOff: dir > 0 ? 2.2 : -2.2 };
    car.heading = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    car.group.rotation.y = car.heading;
    this.cars.push(car);
    return car;
  }
  spawnPed(initial) {
    const mesh = makePedMesh(this.scene, pick(PED_COLORS));
    const p = { mesh, pos: mesh.position, heading: 0, speed: rand(1.4, 2.6), target: null, down: false, downTimer: 0 };
    p.fall = () => {
      if (p.down) return;
      p.down = true;
      p.downTimer = 5;
      p.mesh.rotation.x = Math.PI / 2;
      p.mesh.position.y = 0.4;
    };
    this._placePed(p);
    this.peds.push(p);
    return p;
  }
  _placePed(p) {
    const r = pick(ROADS);
    const along = pick(ROADS) + rand(-20, 20);
    const side = Math.random() < 0.5 ? 7 : -7;
    if (Math.random() < 0.5) { p.pos.set(along, 0, r + side); } else { p.pos.set(r + side, 0, along); }
    p.target = this._pedTarget();
    p.down = false;
    p.mesh.rotation.set(0, 0, 0);
    p.mesh.visible = true;
  }
  _pedTarget() {
    const r = pick(ROADS);
    const along = pick(ROADS) + rand(-20, 20);
    const side = Math.random() < 0.5 ? 7 : -7;
    return Math.random() < 0.5 ? { x: along, z: r + side } : { x: r + side, z: along };
  }
  nearestCar(pos, maxDist) {
    let best = null, bestD = maxDist;
    for (const car of this.cars) {
      if (car.wrecked) continue;
      const d = dist2(pos.x, pos.z, car.group.position.x, car.group.position.z);
      if (d < bestD) { best = car; bestD = d; }
    }
    return best;
  }
  update(dt, G) {
    const playerPos = G.player.inCar && G.player.car
      ? G.player.car.group.position : G.player.pos;
    for (const car of this.cars) {
      if (car.wrecked) continue;
      if (G.player.inCar && car === G.player.car) continue;
      this._driveAI(car, dt, G, playerPos);
    }
    for (const p of this.peds) {
      if (p.down) {
        p.downTimer -= dt;
        if (p.downTimer <= 0) this._placePed(p);
        continue;
      }
      const t = p.target;
      const dx = t.x - p.pos.x, dz = t.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) { p.target = this._pedTarget(); continue; }
      p.heading = Math.atan2(dx, dz);
      p.pos.x += (dx / d) * p.speed * dt;
      p.pos.z += (dz / d) * p.speed * dt;
      p.mesh.rotation.y = p.heading;
      // Knocked over by the player's car.
      if (G.player.inCar && G.player.car) {
        const cd = dist2(p.pos.x, p.pos.z, G.player.car.group.position.x, G.player.car.group.position.z);
        if (cd < 2.4 && Math.abs(G.player.car.speed) > 3) {
          this._knockPed(p, G);
        }
      }
    }
  }
  _knockPed(p, G) {
    p.down = true;
    p.downTimer = 5;
    p.mesh.rotation.x = Math.PI / 2;
    p.mesh.position.y = 0.4;
    G.police.addHeat(1, 'pedestrian hit');
    G.hud.feed('You hit a pedestrian — the PD is coming.');
    G.audio.crash(4);
  }
  _driveAI(car, dt, G, playerPos) {
    const ai = car.ai;
    // Stop for the car ahead (same lane, in front).
    let blocked = false;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const all = [...this.cars, ...G.police.pursuit.map((pc) => pc.car)];
    if (G.player.inCar && G.player.car) all.push(G.player.car);
    for (const other of all) {
      if (other === car || other.wrecked) continue;
      const dx = other.group.position.x - car.group.position.x;
      const dz = other.group.position.z - car.group.position.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 8 && side < 2.6) { blocked = true; break; }
    }
    // Stop for the player on foot crossing ahead.
    if (!G.player.inCar) {
      const dx = G.player.pos.x - car.group.position.x;
      const dz = G.player.pos.z - car.group.position.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 6 && side < 2.2) blocked = true;
    }
    const speed = blocked ? 0 : ai.speed;
    car.group.position.x += Math.sin(car.heading) * speed * dt;
    car.group.position.z += Math.cos(car.heading) * speed * dt;
    car.group.rotation.y = car.heading;
    for (const w of car.wheels) w.rotation.x += speed * dt * 2.2;
    // At an intersection, sometimes turn onto the crossing road.
    const along = ai.axis === 'x' ? car.group.position.x : car.group.position.z;
    const cross = nearestRoad(along);
    if (Math.abs(along - cross) < 1.2 && Math.random() < dt * 0.55) {
      const turnLeft = Math.random() < 0.5;
      const newDir = turnLeft ? -1 : 1;
      const newAxis = ai.axis === 'x' ? 'z' : 'x';
      // Snap onto the crossing road, offset to the right-hand lane.
      if (newAxis === 'x') {
        car.group.position.z = cross + (newDir > 0 ? 2.2 : -2.2);
        car.group.position.x = clamp(car.group.position.x, -178, 178);
        car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.group.position.x = cross + (newDir > 0 ? -2.2 : 2.2);
        car.group.position.z = clamp(car.group.position.z, -178, 178);
        car.heading = newDir > 0 ? 0 : Math.PI;
      }
      ai.axis = newAxis; ai.dir = newDir; ai.lane = cross;
    }
    // Keep inside the city; wrap around the far edge.
    if (car.group.position.x > 180 || car.group.position.x < -180 || car.group.position.z > 180 || car.group.position.z < -180) {
      const np = this._respawnPoint();
      car.group.position.set(np.x, 0, np.z);
      car.heading = np.heading;
      car.ai.axis = np.axis; car.ai.dir = np.dir; car.ai.lane = np.lane;
    }
  }
  _respawnPoint() {
    const horizontal = Math.random() < 0.5;
    const lane = pick(ROADS);
    const edge = pick([-178, 178]);
    const dir = edge < 0 ? 1 : -1;
    return horizontal
      ? { x: edge, z: lane + (dir > 0 ? 2.2 : -2.2), heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2, axis: 'x', dir, lane }
      : { x: lane + (dir > 0 ? -2.2 : 2.2), z: edge, heading: dir > 0 ? 0 : Math.PI, axis: 'z', dir, lane };
  }
}
