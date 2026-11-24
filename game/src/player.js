// Danny Cole on foot: walk/run/jump, punch combat, stealing and exiting cars.
import * as THREE from 'three';
import { clamp, dist2 } from './utils.js';
import { resolveCircle } from './city.js';

export function makePlayerMesh(scene) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e6fd2 });
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a5a3b });
  const pants = new THREE.MeshLambertMaterial({ color: 0x222831 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.05, 8), shirt);
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), skin);
  head.position.y = 1.85;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 10), new THREE.MeshLambertMaterial({ color: 0xe8b93a }));
  cap.position.y = 2.08;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.4), new THREE.MeshLambertMaterial({ color: 0xe8b93a }));
  brim.position.set(0, 2.02, 0.38);
  g.add(brim);
  for (const x of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.55, 6), pants);
    leg.position.set(x, 0.28, 0);
    g.add(leg);
  }
  // Punch arm, hidden until a punch swings.
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.9), skin);
  arm.position.set(0.35, 1.35, 0.5);
  arm.visible = false;
  g.add(arm);
  scene.add(g);
  return { group: g, arm };
}

export class Player {
  constructor(scene) {
    this.mesh = makePlayerMesh(scene);
    this.pos = this.mesh.group.position;
    this.pos.set(0, 0, 8);
    this.heading = 0;
    this.velY = 0;
    this.onGround = true;
    this.health = 100;
    this.inCar = false;
    this.car = null;
    this.punchCd = 0;
    this.punchAnim = 0;
  }
  update(dt, G) {
    if (this.punchCd > 0) this.punchCd -= dt;
    if (this.punchAnim > 0) {
      this.punchAnim -= dt;
      this.mesh.arm.visible = this.punchAnim > 0;
    }
    if (this.inCar) return;
    const ax = G.input.moveAxis();
    const speed = G.input.run() ? 7.5 : 4.5;
    // Camera-relative movement: forward is away from the camera.
    const sin = Math.sin(G.camYaw), cos = Math.cos(G.camYaw);
    const mx = (ax.x * cos - ax.z * sin) * speed;
    const mz = (-ax.x * sin - ax.z * cos) * speed;
    const nx = this.pos.x + mx * dt;
    const nz = this.pos.z + mz * dt;
    const res = resolveCircle(nx, nz, 0.6, G.city.colliders);
    this.pos.x = res.x; this.pos.z = res.z;
    if (Math.abs(mx) + Math.abs(mz) > 0.1) {
      this.heading = Math.atan2(mx, mz);
    }
    // Jump + gravity.
    if (G.input.pressed('Space') && this.onGround) { this.velY = 8.5; this.onGround = false; }
    if (!this.onGround) {
      this.velY -= 24 * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.velY = 0; this.onGround = true; }
    }
    this.mesh.group.position.copy(this.pos);
    this.mesh.group.rotation.y = this.heading;
  }
  // Swing a punch. Returns 'ped' | 'cop' | 'car' | null.
  punch(G) {
    if (this.inCar || this.punchCd > 0) return null;
    this.punchCd = 0.45;
    this.punchAnim = 0.28;
    G.audio.punch();
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let best = null, bestD = 2.4;
    for (const p of G.traffic.peds) {
      if (p.down) continue;
      const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD && (dx * fx + dz * fz) / (d || 1) > 0.25) { best = { kind: 'ped', obj: p }; bestD = d; }
    }
    for (const c of G.police.cops) {
      if (c.stagger > 0) continue;
      const dx = c.pos.x - this.pos.x, dz = c.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD && (dx * fx + dz * fz) / (d || 1) > 0.25) { best = { kind: 'cop', obj: c }; bestD = d; }
    }
    if (best) {
      if (best.kind === 'ped') { best.obj.fall(); return 'ped'; }
      best.obj.stagger = 1.2; return 'cop';
    }
    // Dent a nearby car in front of the player.
    for (const car of G.traffic.cars) {
      if (car.wrecked) continue;
      const d = dist2(this.pos.x, this.pos.z, car.group.position.x, car.group.position.z);
      if (d < 2.6) { car.health -= 6; G.audio.crash(2); return 'car'; }
    }
    return null;
  }
  tryEnterCar(G) {
    if (this.inCar) return false;
    let best = null, bestD = 4.5;
    for (const car of G.traffic.cars) {
      if (car.wrecked || car.isPolice) continue;
      const d = dist2(this.pos.x, this.pos.z, car.group.position.x, car.group.position.z);
      if (d < bestD) { best = car; bestD = d; }
    }
    if (!best) return false;
    this.inCar = true;
    this.car = best;
    best.stolen = true;
    this.mesh.group.visible = false;
    G.police.addHeat(1, 'car stolen');
    G.hud.feed("You jacked a ride — the PD noticed.");
    G.audio.pickup();
    return true;
  }
  exitCar(G) {
    if (!this.inCar || !this.car) return;
    const car = this.car;
    this.inCar = false;
    this.car = null;
    this.pos.set(car.group.position.x - Math.sin(car.heading) * 3, 0, car.group.position.z - Math.cos(car.heading) * 3);
    this.mesh.group.visible = true;
    this.mesh.group.position.copy(this.pos);
  }
}
