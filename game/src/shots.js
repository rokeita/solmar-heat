// Screenshot presets behind ?shot=cover|drive|street|mission. Each one stages
// a real gameplay state (no menu) so a headless render shows the game itself.
import { makeCar, POLICE_COLOR } from './vehicles.js';
import { LANDMARKS } from './missions.js';

function giveCar(G, x, z, heading, color, speed) {
  const car = makeCar(G.scene, color, false);
  car.group.position.set(x, 0, z);
  car.heading = heading;
  car.group.rotation.y = heading;
  car.speed = speed;
  car.stolen = true;
  G.traffic.cars.push(car);
  G.player.inCar = true;
  G.player.car = car;
  G.player.mesh.group.visible = false;
  return car;
}

function addPolice(G, x, z, heading) {
  const car = makeCar(G.scene, POLICE_COLOR, true);
  car.group.position.set(x, 0, z);
  car.heading = heading;
  car.group.rotation.y = heading;
  car.speed = 14;
  G.police.pursuit.push({ car });
  return car;
}

export function setupShot(name, G) {
  G.hud.hideScreens();
  G.state = 'playing';
  G.camYaw = Math.PI;
  G.camPitch = 0.30;
  G.camDist = 11;
  if (name === 'cover') {
    // 3-star chase: red player car centre-frame, police head-on ahead.
    const car = giveCar(G, 0, 40, Math.PI, 0xd23b2e, 26);
    G.camYaw = 0; // camera sits south of the car, looking north into town
    addPolice(G, 0, 26, 0);
    addPolice(G, -6, 62, Math.PI);
    G.police.wanted = 3;
    G.missions.index = 1; G.missions.stage = 1;
    G.missions._setTarget(G, LANDMARKS.CAFE, "Deliver the package to Rosa's Cafe.");
    G.hud.setMission('Job 2: The Pickup ($800)', "Deliver the package to Rosa's Cafe.");
    G.hud.feed('Wanted level 3 — every unit is looking for you.');
    G.hud.feed("Mama Rosa: 'Danny, the crew needs wheels. Jack a car and bring it to the Chop Shop on Marlowe Ave.'");
    G.cash = 120;
  } else if (name === 'drive') {
    // Downtown driving down road x=0 into town.
    giveCar(G, 0, 120, Math.PI, 0x2e6fd2, 21);
    G.camYaw = 0;
    G.missions.index = 0; G.missions.stage = 1;
    G.missions._setTarget(G, LANDMARKS.CHOP, 'Deliver the car to the Chop Shop.');
    G.hud.setMission('Job 1: First Wheels ($400)', 'Deliver the car to the Chop Shop.');
    G.cash = 120;
  } else if (name === 'street') {
    // Danny on foot at a crosswalk, pedestrian beside him.
    G.player.pos.set(2, 0, 6);
    G.player.heading = Math.PI;
    G.camYaw = 0;
    G.camDist = 8.5;
    const ped = G.traffic.peds[0];
    if (ped) { ped.pos.set(5, 0, 2); ped.target = { x: 5, z: -30 }; }
    G.missions.index = 0; G.missions.stage = 0;
    G.hud.setMission('Job 1: First Wheels ($400)', 'Steal a car — any car. Press E near one.');
    G.hud.feed("Mama Rosa: 'Danny, the crew needs wheels. Jack a car and bring it to the Chop Shop on Marlowe Ave.'");
    G.cash = 120;
  } else if (name === 'mission') {
    // Driving to the Chop Shop beacon.
    giveCar(G, 52, 104, Math.PI / 2, 0xe8b93a, 20);
    G.camYaw = -Math.PI / 2;
    G.police.wanted = 1;
    G.missions.index = 0; G.missions.stage = 1;
    G.missions._setTarget(G, LANDMARKS.CHOP, 'Deliver the car to the Chop Shop.');
    G.hud.setMission('Job 1: First Wheels ($400)', 'Deliver the car to the Chop Shop.');
    G.cash = 120;
  }
  G.hud.setCash(G.cash);
  G.hud.setWanted(G.police.wanted);
}
