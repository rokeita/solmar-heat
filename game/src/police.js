// The Port Solmar PD: wanted stars, pursuit cars that chase and ram, foot
// cops who run the player down (2 s of proximity = BUSTED), and heat decay.
import * as THREE from 'three';
import { clamp, dist2, pick, rand } from './utils.js';
import { randomRoadPoint } from './city.js';
import { makeCar, POLICE_COLOR } from './vehicles.js';

function makeCopMesh(scene) {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1d2b4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 1.0, 8), navy);
  body.position.y = 1.0;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), skin);
  head.position.y = 1.72;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 8), navy);
  cap.position.y = 1.92;
  g.add(cap);
  scene.add(g);
  return g;
}

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.wanted = 0;
    this.cleanTimer = 0;
    this.decayAcc = 0;
    this.pursuit = []; // { car }
    this.cops = []; // { mesh, pos, stagger, closeTimer, speed }
    this.flashT = 0;
  }
  addHeat(n, reason) {
    if (this.wanted >= 5 && n > 0) { this.cleanTimer = 0; return; }
    this.wanted = clamp(this.wanted + n, 0, 5);
    this.cleanTimer = 0;
    if (this.wanted > 0 && reason) { /* feed messages are raised by callers */ }
  }
  _spawnPursuit(G) {
    const car = makeCar(this.scene, POLICE_COLOR, true);
    const p = randomRoadPoint();
    // Spawn on a road 45-60 units from the player.
    const pp = G.player.inCar && G.player.car ? G.player.car.group.position : G.player.pos;
    let x = p.x, z = p.z, tries = 0;
    while (dist2(x, z, pp.x, pp.z) < 40 && tries++ < 8) { const q = randomRoadPoint(); x = q.x; z = q.z; }
    car.group.position.set(x, 0, z);
    car.heading = Math.atan2(pp.x - x, pp.z - z);
    this.pursuit.push({ car });
    return car;
  }
  _spawnCop(G) {
    const mesh = makeCopMesh(this.scene);
    const pp = G.player.pos;
    const a = rand(0, Math.PI * 2);
    const r = rand(25, 40);
    mesh.position.set(clamp(pp.x + Math.sin(a) * r, -178, 178), 0, clamp(pp.z + Math.cos(a) * r, -178, 178));
    const cop = { mesh, pos: mesh.position, stagger: 0, closeTimer: 0, speed: rand(5.2, 6.0) };
    this.cops.push(cop);
    return cop;
  }
  _removePursuit(i) {
    const p = this.pursuit[i];
    this.scene.remove(p.car.group);
    this.pursuit.splice(i, 1);
  }
  _removeCop(i) {
    const c = this.cops[i];
    this.scene.remove(c.mesh);
    this.cops.splice(i, 1);
  }
  update(dt, G) {
    this.cleanTimer += dt;
    const pp = G.player.inCar && G.player.car ? G.player.car.group.position : G.player.pos;
    // Heat decay: 25 s clean, then one star per 8 s, only while no police close.
    let policeNear = false;
    for (const p of this.pursuit) if (dist2(p.car.group.position.x, p.car.group.position.z, pp.x, pp.z) < 30) policeNear = true;
    for (const c of this.cops) if (dist2(c.pos.x, c.pos.z, pp.x, pp.z) < 30) policeNear = true;
    if (this.wanted > 0 && this.cleanTimer > 25 && !policeNear) {
      this.decayAcc += dt;
      if (this.decayAcc >= 8) { this.decayAcc = 0; this.wanted -= 1; if (this.wanted === 0) G.hud.feed('The heat is off — for now.'); }
    } else this.decayAcc = 0;

    // Desired force levels.
    const wantPursuit = this.wanted > 0 ? Math.min(this.wanted, 3) : 0;
    const wantCops = this.wanted > 0 ? Math.min(this.wanted, 3) : 0;
    while (this.pursuit.length < wantPursuit) this._spawnPursuit(G);
    while (this.pursuit.length > wantPursuit) this._removePursuit(this.pursuit.length - 1);
    while (this.cops.length < wantCops) this._spawnCop(G);
    while (this.cops.length > wantCops) this._removeCop(this.cops.length - 1);

    // Pursuit cars chase and ram.
    this.flashT += dt;
    const flash = Math.floor(this.flashT * 6) % 2 === 0;
    for (const p of this.pursuit) {
      const car = p.car;
      const dx = pp.x - car.group.position.x;
      const dz = pp.z - car.group.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
      const speed = Math.min(15 + this.wanted * 1.5, 24);
      car.speed = speed;
      car.group.position.x += Math.sin(car.heading) * speed * dt;
      car.group.position.z += Math.cos(car.heading) * speed * dt;
      car.group.rotation.y = car.heading;
      for (const w of car.wheels) w.rotation.x += speed * dt * 2.2;
      if (car.lightBar) {
        car.lightBar.red.material.color.setHex(flash ? 0xff2222 : 0x551111);
        car.lightBar.blue.material.color.setHex(flash ? 0x111155 : 0x2244ff);
      }
      // Ram the player's car, or run down the player on foot.
      if (d < 3.2) {
        if (G.player.inCar && G.player.car) {
          G.player.car.health -= 14 * dt;
          G.player.car.speed *= (1 - 1.5 * dt);
          if (Math.random() < dt * 2) G.audio.crash(6);
        } else {
          G.player.health -= 12 * dt;
          const push = 6 * dt;
          G.player.pos.x += (G.player.pos.x - car.group.position.x) / d * push;
          G.player.pos.z += (G.player.pos.z - car.group.position.z) / d * push;
        }
      }
      // Despawn far-away pursuit cars so they re-spawn near the action.
      if (d > 160) {
        const np = randomRoadPoint();
        car.group.position.set(np.x, 0, np.z);
      }
    }

    // Foot cops run the player down.
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      if (c.stagger > 0) { c.stagger -= dt; continue; }
      const dx = G.player.pos.x - c.pos.x;
      const dz = G.player.pos.z - c.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      if (G.player.inCar) {
        // Cops fall behind a car; teleport back near the player when far.
        if (d > 60) {
          const a = rand(0, Math.PI * 2);
          c.pos.set(clamp(G.player.pos.x + Math.sin(a) * 30, -178, 178), 0, clamp(G.player.pos.z + Math.cos(a) * 30, -178, 178));
        }
        continue;
      }
      c.pos.x += (dx / d) * c.speed * dt;
      c.pos.z += (dz / d) * c.speed * dt;
      c.mesh.rotation.y = Math.atan2(dx, dz);
      if (d < 2.5) {
        c.closeTimer += dt;
        if (c.closeTimer >= 2) {
          G.onBusted();
          c.closeTimer = 0;
          return;
        }
      } else {
        c.closeTimer = Math.max(0, c.closeTimer - dt * 2);
      }
    }
    G.audio.siren(this.wanted > 0);
  }
}
