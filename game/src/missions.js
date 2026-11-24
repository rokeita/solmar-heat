// Mama Rosa's crew: three story jobs plus the Chop Shop. Landmarks all sit on
// road intersections so they are always reachable.
import * as THREE from 'three';
import { dist2 } from './utils.js';

export const LANDMARKS = {
  CHOP: { x: 104, z: 104, label: 'Chop Shop' },
  CAFE: { x: 104, z: -104, label: "Rosa's Cafe" },
  SAFE: { x: -104, z: -104, label: 'Safehouse' },
  DOCKS: { x: -156, z: 52, label: 'Docks' },
  PLAZA: { x: 26, z: 26, label: 'Plaza' },
};

const JOBS = [
  { title: 'Job 1: First Wheels ($400)', reward: 400 },
  { title: 'Job 2: The Pickup ($800)', reward: 800 },
  { title: 'Job 3: Heat Run ($1,500)', reward: 1500 },
];

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;
    this.stage = 0;
    this.timer = 0;
    this.heatTimer = 0;
    this.done = false;
    this.target = null;
    // Beacon pillar + ground ring marking the current objective.
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 34, 16, 1, true), mat);
    this.beacon.position.y = 17;
    this.beacon.visible = false;
    scene.add(this.beacon);
    const ring = new THREE.Mesh(new THREE.RingGeometry(4, 5.5, 24), new THREE.MeshBasicMaterial({ color: 0xffd75e, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    this.ring = ring;
    ring.visible = false;
    scene.add(ring);
  }
  _setTarget(G, lm, objective) {
    this.target = lm;
    this.beacon.position.set(lm.x, 17, lm.z);
    this.ring.position.set(lm.x, 0.1, lm.z);
    this.beacon.visible = true;
    this.ring.visible = true;
    G.hud.setMission(JOBS[this.index].title, objective);
  }
  _clearTarget(G) {
    this.target = null;
    this.beacon.visible = false;
    this.ring.visible = false;
  }
  start(G) {
    this.index = 0;
    this.stage = 0;
    this.done = false;
    G.hud.setMission(JOBS[0].title, 'Steal a car — any car. Press E near one.');
    G.hud.feed("Mama Rosa: 'Danny, the crew needs wheels. Jack a car and bring it to the Chop Shop on Marlowe Ave.'");
  }
  _complete(G) {
    const job = JOBS[this.index];
    G.cash += job.reward;
    G.audio.cash();
    G.hud.feed(`${job.title} complete — +$${job.reward}.`);
    G.saveGame();
    this.index++;
    this.stage = 0;
    this.timer = 0;
    if (this.index >= JOBS.length) {
      this.done = true;
      this._clearTarget(G);
      G.hud.setMission('Crew Legend', 'All jobs done — Port Solmar is yours. Free roam!');
      G.hud.feed("Mama Rosa: 'You're a legend now, Danny. The city is yours.'");
      return;
    }
    if (this.index === 1) {
      this._setTarget(G, LANDMARKS.DOCKS, 'Pick up the package at the Docks.');
      G.hud.feed("Mama Rosa: 'Second job. Pick up the package at the Docks — and don't get followed.'");
    } else if (this.index === 2) {
      G.police.addHeat(3, 'heat run');
      this._setTarget(G, LANDMARKS.SAFE, 'Survive 40 s at 3 stars, then reach the Safehouse.');
      G.hud.setMission(JOBS[2].title, 'Survive 40 s at 3 stars, then reach the Safehouse.');
      G.hud.feed("Mama Rosa: 'Last job, Danny. The whole PD is coming. Survive — then get to the Safehouse.'");
    }
  }
  _playerPos(G) {
    return G.player.inCar && G.player.car ? G.player.car.group.position : G.player.pos;
  }
  update(dt, G) {
    if (this.done) return;
    const pp = this._playerPos(G);
    if (this.index === 0) {
      if (this.stage === 0) {
        if (G.player.inCar) {
          this.stage = 1;
          this._setTarget(G, LANDMARKS.CHOP, 'Deliver the car to the Chop Shop.');
          G.hud.feed('Nice wheels. Now deliver it to the Chop Shop.');
        }
      } else if (dist2(pp.x, pp.z, LANDMARKS.CHOP.x, LANDMARKS.CHOP.z) < 10) {
        this._complete(G);
      }
    } else if (this.index === 1) {
      if (this.stage === 0) {
        if (dist2(pp.x, pp.z, LANDMARKS.DOCKS.x, LANDMARKS.DOCKS.z) < 9) {
          this.stage = 1;
          G.police.addHeat(Math.max(0, 2 - G.police.wanted), 'pickup spotted');
          this._setTarget(G, LANDMARKS.CAFE, "Deliver the package to Rosa's Cafe.");
          G.hud.feed('Package grabbed — the PD is onto you! Lose them and get to Rosa\'s Cafe.');
          G.audio.pickup();
        }
      } else if (dist2(pp.x, pp.z, LANDMARKS.CAFE.x, LANDMARKS.CAFE.z) < 9) {
        this._complete(G);
      }
    } else if (this.index === 2) {
      if (this.stage === 0) {
        // Keep the heat on while the timer runs.
        this.heatTimer += dt;
        if (this.heatTimer >= 1) {
          this.heatTimer = 0;
          if (G.police.wanted < 3) G.police.addHeat(3 - G.police.wanted, 'heat run');
        }
        if (G.police.wanted >= 3) {
          this.timer += dt;
          G.hud.setMission(JOBS[2].title, `Survive at 3 stars — ${Math.ceil(40 - this.timer)} s left, then reach the Safehouse.`);
          if (this.timer >= 40) {
            this.stage = 1;
            this._setTarget(G, LANDMARKS.SAFE, 'Reach the Safehouse.');
            G.hud.feed('You survived the heat! Now get to the Safehouse.');
          }
        }
      } else if (dist2(pp.x, pp.z, LANDMARKS.SAFE.x, LANDMARKS.SAFE.z) < 9) {
        this._complete(G);
      }
    }
  }
  // Sell the stolen car the player is driving at the Chop Shop.
  trySell(G) {
    if (!G.player.inCar || !G.player.car || !G.player.car.stolen) return false;
    const car = G.player.car;
    if (dist2(car.group.position.x, car.group.position.z, LANDMARKS.CHOP.x, LANDMARKS.CHOP.z) > 11) return false;
    const price = car.value;
    G.cash += price;
    G.audio.cash();
    G.hud.feed(`Chop Shop paid $${price} for the ride.`);
    // Remove the sold car from traffic.
    const i = G.traffic.cars.indexOf(car);
    if (i >= 0) G.traffic.cars.splice(i, 1);
    this.scene.remove(car.group);
    car.wrecked = true;
    G.player.exitCar(G);
    G.saveGame();
    return true;
  }
}
