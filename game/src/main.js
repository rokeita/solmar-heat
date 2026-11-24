// SOLMAR HEAT — boot, game loop, camera, state machine and wiring.
// HUD is created before missions (missions write to the feed during start).
import * as THREE from 'three';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildCity } from './city.js';
import { makeCar, drivePlayerCar, CAR_COLORS } from './vehicles.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Missions, LANDMARKS } from './missions.js';
import { HUD } from './hud.js';
import { loadSave, saveGame as persistSave, clearSave } from './save.js';
import { setupShot } from './shots.js';
import { clamp, pick } from './utils.js';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffc98f);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const G = {
  scene, camera, renderer,
  state: 'menu', // menu | playing | paused | busted
  cash: 120, time: 0,
  camYaw: Math.PI, camPitch: 0.32, camDist: 11,
  shotMode: false, shotName: null,
  muted: false,
  city: null, player: null, traffic: null, police: null, missions: null, hud: null, audio: null, input: null,
};
G.saveGame = () => persistSave({ cash: G.cash, missionIndex: G.missions ? G.missions.index : 0, muted: G.muted });

// HUD first: missions write to the feed during start.
G.hud = new HUD();
G.audio = new AudioSys();
G.input = new Input(canvas);
G.city = buildCity(scene);
G.traffic = new Traffic(scene, G.city);
G.police = new Police(scene);
G.missions = new Missions(scene);
G.player = new Player(scene);

G.onBusted = () => {
  if (G.state !== 'playing') return;
  const fine = Math.min(100, 20 * Math.max(1, G.police.wanted));
  G.cash = Math.max(0, G.cash - fine);
  G.police.wanted = 0;
  G.police.cleanTimer = 0;
  if (G.player.inCar) G.player.exitCar(G);
  G.player.health = 100;
  G.player.pos.set(LANDMARKS.PLAZA.x, 0, LANDMARKS.PLAZA.z);
  G.player.mesh.group.position.copy(G.player.pos);
  G.audio.busted();
  G.audio.siren(false);
  G.state = 'busted';
  G.hud.showBusted(`The Port Solmar PD caught you. Fine: $${fine}. Mama Rosa will want words.`);
  G.hud.setCash(G.cash);
  G.saveGame();
};

function resetWorld(fromSave) {
  // Clear police force and respawn traffic is overkill; reset the player state.
  G.cash = fromSave && fromSave.cash != null ? fromSave.cash : 120;
  G.player.health = 100;
  G.player.pos.set(0, 0, 8);
  G.player.heading = 0;
  G.player.inCar = false;
  G.player.car = null;
  G.player.mesh.group.visible = true;
  G.player.mesh.group.position.copy(G.player.pos);
  G.police.wanted = 0;
  G.police.cleanTimer = 0;
  G.camYaw = Math.PI;
  G.camPitch = 0.32;
  G.camDist = 11;
  G.missions.start(G);
  const savedJob = fromSave && fromSave.missionIndex != null ? fromSave.missionIndex : 0;
  if (savedJob > 0 && savedJob < 3) {
    // Resume at the saved job: point the player at its first stage.
    G.missions.index = savedJob;
    G.missions.stage = 0;
    G.missions.timer = 0;
    if (savedJob === 1) G.missions._setTarget(G, LANDMARKS.DOCKS, 'Pick up the package at the Docks.');
    if (savedJob === 2) { G.police.addHeat(3, 'heat run'); G.missions._setTarget(G, LANDMARKS.SAFE, 'Survive 40 s at 3 stars, then reach the Safehouse.'); }
  }
  G.hud.setCash(G.cash);
  G.hud.setWanted(0);
  G.hud.setHealth(1);
  G.hud.setCarHealth(1);
}

function startGame(fromSave) {
  G.audio.ensure();
  G.audio.startMusic();
  resetWorld(fromSave);
  G.hud.hideScreens();
  G.state = 'playing';
}

G.hud.onNew = () => { clearSave(); startGame(null); };
G.hud.onContinue = () => { startGame(loadSave()); };
G.hud.onResume = () => { G.state = 'playing'; G.hud.hideScreens(); };
G.hud.onRestart = () => { clearSave(); startGame(null); };
G.hud.onBustedOk = () => { G.state = 'playing'; G.hud.hideScreens(); };
G.hud.onMute = () => {
  G.muted = !G.muted;
  G.audio.setMuted(G.muted);
  G.hud.setMuteLabel(G.muted);
  G.saveGame();
};

// Menu: show Continue when a save exists.
const existing = loadSave();
if (existing && existing.muted) { G.muted = true; G.audio.setMuted(true); G.hud.setMuteLabel(true); }
G.hud.showMenu(!!existing);

// Screenshot presets: ?shot=cover|drive|street|mission
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
let shotFrames = 0;
if (shot) {
  G.shotMode = true;
  G.shotName = shot;
  G.audio.setMuted(true);
  setupShot(shot, G);
}

// Debug handle: lets a play-test (or a player) inspect live state.
window.__G = G;

const clock = new THREE.Clock();
let lastDragT = -10;

function updateCamera(dt) {
  const mouse = G.input.consumeMouse();
  if (Math.abs(mouse.dx) + Math.abs(mouse.dy) > 0) {
    G.camYaw -= mouse.dx * 0.0042;
    G.camPitch = clamp(G.camPitch + mouse.dy * 0.003, 0.08, 0.85);
    lastDragT = G.time;
  }
  const wheel = G.input.consumeWheel();
  if (wheel) G.camDist = clamp(G.camDist + wheel * 0.008, 6, 17);
  // When driving and the player is not dragging, ease the camera behind the car.
  if (G.player.inCar && G.player.car && G.time - lastDragT > 1.2) {
    const target = G.player.car.heading + Math.PI;
    let d = target - G.camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    G.camYaw += d * Math.min(1, dt * 1.6);
  }
  const target = G.player.inCar && G.player.car ? G.player.car.group.position : G.player.pos;
  const cp = Math.cos(G.camPitch), sp = Math.sin(G.camPitch);
  const cx = target.x + Math.sin(G.camYaw) * cp * G.camDist;
  const cz = target.z + Math.cos(G.camYaw) * cp * G.camDist;
  const cy = target.y + 1.6 + sp * G.camDist;
  camera.position.set(cx, Math.max(1.2, cy), cz);
  camera.lookAt(target.x, target.y + 1.6, target.z);
}

function handleActions() {
  if (G.input.pressed('KeyP')) {
    if (G.state === 'playing') { G.state = 'paused'; G.hud.showPause(); }
    else if (G.state === 'paused') { G.state = 'playing'; G.hud.hideScreens(); }
  }
  if (G.input.pressed('KeyM')) G.hud.onMute();
  if (G.state !== 'playing') return;
  if (G.input.pressed('KeyF')) {
    const hit = G.player.punch(G);
    if (hit === 'ped') { G.police.addHeat(1, 'pedestrian punched'); G.hud.feed('You punched a pedestrian — someone called the PD.'); }
    if (hit === 'cop') { G.police.addHeat(2, 'cop punched'); G.hud.feed('You punched a cop! The whole PD is coming.'); }
    if (hit === 'car') G.hud.feed('You dented the paint. The owner will notice.');
  }
  if (G.input.pressed('KeyE')) {
    if (G.player.inCar) {
      if (!G.missions.trySell(G)) G.player.exitCar(G);
    } else {
      G.player.tryEnterCar(G);
    }
  }
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  G.time += dt;
  handleActions();
  if (G.state === 'playing') {
    // In shot mode the car holds its throttle so the speedometer stays live,
    // and mission/wanted progression is frozen so the staged scene holds.
    const driving = G.player.inCar && G.player.car;
    if (driving) {
      const car = G.player.car;
      if (G.shotMode) {
        car.speed = Math.min(car.speed + 14 * dt, 26);
        car.heading += 0;
        car.group.position.x += Math.sin(car.heading) * car.speed * dt;
        car.group.position.z += Math.cos(car.heading) * car.speed * dt;
        car.group.rotation.y = car.heading;
        for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.2;
        G.hud.setSpeed(Math.abs(car.speed) * 2.237, car.speed < -0.5 ? 'R' : 'D');
        G.hud.setCarHealth(car.health / car.maxHealth);
      } else {
        const mph = drivePlayerCar(car, dt, G.input, G.city);
        G.hud.setSpeed(mph, car.speed < -0.5 ? 'R' : 'D');
        G.hud.setCarHealth(car.health / car.maxHealth);
        if (car.health <= 0 && !car.wrecked) {
          car.wrecked = true;
          G.audio.crash(10);
          G.hud.feed('Your ride is wrecked! Bail out and find another.');
          G.player.exitCar(G);
        }
      }
      G.audio.engine(true, Math.abs(car.speed) / 26);
    } else {
      G.player.update(dt, G);
      G.hud.setSpeed(0, 'D');
      G.hud.setCarHealth(1);
      G.audio.engine(false, 0);
    }
    G.traffic.update(dt, G);
    G.police.update(dt, G);
    if (!G.shotMode) G.missions.update(dt, G);
    // Slow health regen while the heat is off.
    if (G.police.wanted === 0 && G.player.health < 100) G.player.health = Math.min(100, G.player.health + 2 * dt);
    if (G.player.health <= 0) G.onBusted();
    // Wrecked traffic cars the player drove are left as wrecks; respawn fresh ones.
    if (G.traffic.cars.filter((c) => !c.wrecked).length < 9) G.traffic.spawnCar(false);
  }
  updateCamera(dt);
  // HUD refresh.
  G.hud.setCash(G.cash);
  G.hud.setHealth(G.player.health / 100);
  G.hud.setWanted(G.police.wanted);
  G.hud.drawMinimap(G);
  renderer.render(scene, camera);
  G.input.endFrame();
  if (G.shotMode) {
    shotFrames++;
    if (shotFrames >= 4) window.__shotReady = true;
  }
}
frame();
