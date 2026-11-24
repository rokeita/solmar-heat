// Cars for SOLMAR HEAT: box-built bodies with cabins, wheels and (for police)
// a red/blue light bar. One factory serves player-stealable traffic, pursuit
// cars and the player's driven car.
import * as THREE from 'three';
import { clamp, rand, pick } from './utils.js';
import { resolveCircle } from './city.js';

export const CAR_COLORS = [0xd23b2e, 0x2e6fd2, 0xe8b93a, 0x37b268, 0x8e44ad, 0xe67e22, 0xdddddd, 0x222831, 0x16a5a5];
export const POLICE_COLOR = 0xe8e8e8;

export function makeCar(scene, color, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c2126 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), darkMat);
  cabin.position.set(0, 1.05, -0.2);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
    wheels.push(w);
  }
  let lightBar = null;
  if (isPolice) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.3;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.x = 0.3;
    bar.add(red); bar.add(blue);
    bar.position.set(0, 1.45, -0.2);
    g.add(bar);
    lightBar = { red, blue };
  }
  scene.add(g);
  return {
    group: g, wheels, lightBar,
    heading: rand(0, Math.PI * 2), speed: 0, steer: 0,
    health: 100, maxHealth: 100,
    isPolice: !!isPolice, color, value: randInt(150, 320),
    stolen: false, wrecked: false, ai: null,
  };
}
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }

// Arcade driving for the car the player is in. Returns mph.
export function drivePlayerCar(car, dt, input, city) {
  const ax = input.moveAxis();
  const handbrake = input.down('Space');
  const topSpeed = 26; // ~58 mph
  const accel = 16, brake = 26, reverseTop = 9;
  if (ax.z > 0) car.speed += accel * dt;
  else if (ax.z < 0) {
    if (car.speed > 0.5) car.speed -= brake * dt;
    else car.speed -= accel * 0.55 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
  car.speed = clamp(car.speed, -reverseTop, topSpeed);
  const steerTarget = -ax.x * 0.55 * (car.speed >= 0 ? 1 : -1) * (handbrake ? 1.35 : 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * (Math.abs(car.speed) / topSpeed) * 2.4 * dt * Math.sign(car.speed || 1);
  const nx = car.group.position.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.group.position.z + Math.cos(car.heading) * car.speed * dt;
  const res = resolveCircle(nx, nz, 2.3, city.colliders);
  const hit = Math.abs(res.x - nx) > 0.01 || Math.abs(res.z - nz) > 0.01;
  car.group.position.x = res.x;
  car.group.position.z = res.z;
  if (hit && Math.abs(car.speed) > 6) {
    car.health -= Math.abs(car.speed) * 0.9;
    car.speed *= 0.35;
  }
  car.group.rotation.y = car.heading;
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.2;
  return Math.abs(car.speed) * 2.237;
}
