// HUD for SOLMAR HEAT: cash, health bars, wanted stars, mission banner,
// message feed, speedometer and the circular minimap.
import { ROADS } from './city.js';
import { LANDMARKS } from './missions.js';

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['cash', 'healthFill', 'carFill', 'stars', 'missionTitle', 'objective', 'minimap', 'feed', 'speed', 'gear', 'menu', 'btnNew', 'btnContinue', 'pauseScreen', 'btnResume', 'btnRestart', 'bustedScreen', 'bustedText', 'btnBustedOk', 'muteBtn']) {
      this.el[id] = document.getElementById(id);
    }
    this.mm = this.el.minimap.getContext('2d');
    this.starEls = [...this.el.stars.querySelectorAll('.star')];
    this.onNew = null; this.onContinue = null; this.onResume = null;
    this.onRestart = null; this.onBustedOk = null; this.onMute = null;
    this.el.btnNew.addEventListener('click', () => this.onNew && this.onNew());
    this.el.btnContinue.addEventListener('click', () => this.onContinue && this.onContinue());
    this.el.btnResume.addEventListener('click', () => this.onResume && this.onResume());
    this.el.btnRestart.addEventListener('click', () => this.onRestart && this.onRestart());
    this.el.btnBustedOk.addEventListener('click', () => this.onBustedOk && this.onBustedOk());
    this.el.muteBtn.addEventListener('click', () => this.onMute && this.onMute());
  }
  setCash(v) { this.el.cash.textContent = '$' + Math.floor(v); }
  setHealth(f) { this.el.healthFill.style.width = Math.max(0, Math.min(100, f * 100)) + '%'; }
  setCarHealth(f) { this.el.carFill.style.width = Math.max(0, Math.min(100, f * 100)) + '%'; }
  setWanted(n) { this.starEls.forEach((s, i) => s.classList.toggle('on', i < n)); }
  setSpeed(mph, gear) {
    this.el.speed.textContent = String(Math.round(mph));
    this.el.gear.textContent = gear;
  }
  setMission(title, objective) {
    this.el.missionTitle.textContent = title || '';
    this.el.objective.textContent = objective || '';
    this.el.objective.style.display = objective ? '' : 'none';
  }
  feed(msg) {
    const div = document.createElement('div');
    div.textContent = msg;
    this.el.feed.prepend(div);
    while (this.el.feed.children.length > 4) this.el.feed.removeChild(this.el.feed.lastChild);
  }
  showMenu(hasSave) {
    this.el.menu.classList.remove('hidden');
    this.el.pauseScreen.classList.add('hidden');
    this.el.bustedScreen.classList.add('hidden');
    this.el.btnContinue.classList.toggle('hidden', !hasSave);
  }
  showPause() {
    this.el.pauseScreen.classList.remove('hidden');
    this.el.menu.classList.add('hidden');
    this.el.bustedScreen.classList.add('hidden');
  }
  showBusted(text) {
    this.el.bustedText.textContent = text;
    this.el.bustedScreen.classList.remove('hidden');
    this.el.menu.classList.add('hidden');
    this.el.pauseScreen.classList.add('hidden');
  }
  hideScreens() {
    this.el.menu.classList.add('hidden');
    this.el.pauseScreen.classList.add('hidden');
    this.el.bustedScreen.classList.add('hidden');
  }
  setMuteLabel(muted) { this.el.muteBtn.textContent = muted ? 'UNMUTE (M)' : 'MUTE (M)'; }
  drawMinimap(G) {
    const ctx = this.mm;
    const S = 180, C = S / 2, scale = S / 150;
    const pp = G.player.inCar && G.player.car ? G.player.car.group.position : G.player.pos;
    const px = pp.x, pz = pp.z;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#12261a';
    ctx.fillRect(0, 0, S, S);
    // Roads.
    ctx.strokeStyle = 'rgba(200,200,200,0.55)';
    ctx.lineWidth = 3;
    for (const r of ROADS) {
      const vx = C + (r - px) * scale;
      if (vx >= -4 && vx <= S + 4) { ctx.beginPath(); ctx.moveTo(vx, 0); ctx.lineTo(vx, S); ctx.stroke(); }
      const hz = C + (r - pz) * scale;
      if (hz >= -4 && hz <= S + 4) { ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(S, hz); ctx.stroke(); }
    }
    const blip = (x, z, color, r) => {
      const bx = C + (x - px) * scale, bz = C + (z - pz) * scale;
      if (bx < 0 || bx > S || bz < 0 || bz > S) return;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(bx, bz, r, 0, Math.PI * 2); ctx.fill();
    };
    // Chop shop blip (green square).
    const csx = C + (LANDMARKS.CHOP.x - px) * scale, csz = C + (LANDMARKS.CHOP.z - pz) * scale;
    if (csx >= 0 && csx <= S && csz >= 0 && csz <= S) {
      ctx.fillStyle = '#37d67a'; ctx.fillRect(csx - 4, csz - 4, 8, 8);
    }
    // Mission target (yellow diamond).
    if (G.missions.target) {
      const tx = C + (G.missions.target.x - px) * scale, tz = C + (G.missions.target.z - pz) * scale;
      if (tx >= 0 && tx <= S && tz >= 0 && tz <= S) {
        ctx.fillStyle = '#ffd75e';
        ctx.beginPath(); ctx.moveTo(tx, tz - 6); ctx.lineTo(tx + 5, tz); ctx.lineTo(tx, tz + 6); ctx.lineTo(tx - 5, tz); ctx.closePath(); ctx.fill();
      }
    }
    // Traffic (white), pursuit (red), cops (blue).
    for (const car of G.traffic.cars) if (!car.wrecked) blip(car.group.position.x, car.group.position.z, '#ffffff', 2);
    for (const p of G.police.pursuit) blip(p.car.group.position.x, p.car.group.position.z, '#ff3b30', 3);
    for (const c of G.police.cops) blip(c.pos.x, c.pos.z, '#3fa9ff', 2.5);
    // Player arrow (centre).
    const heading = G.player.inCar && G.player.car ? G.player.car.heading : G.player.heading;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    ctx.save();
    ctx.translate(C, C);
    ctx.rotate(Math.atan2(fz, fx));
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
