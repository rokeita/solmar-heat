// Procedural WebAudio sound for SOLMAR HEAT: engine hum, sirens, punches,
// cash, crashes and a low-key music loop. Everything is synthesized; no audio
// files are loaded. All calls are safe before the context exists.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.sirenNodes = null;
    this.engineNodes = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (e) { return false; }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
    if (m) this.siren(false);
  }
  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  _noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.25;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    } catch (e) {}
  }
  click() { this._tone(660, 0.07, 'square', 0.08); }
  punch() { this._noise(0.12, 0.35, 900); this._tone(140, 0.1, 'sine', 0.25, 60); }
  cash() { this._tone(880, 0.09, 'sine', 0.18); setTimeout(() => this._tone(1320, 0.14, 'sine', 0.18), 90); }
  pickup() { this._tone(520, 0.1, 'triangle', 0.2, 780); }
  crash(v) { this._noise(0.25, Math.min(0.5, 0.2 + (v || 0) * 0.02), 700); this._tone(90, 0.2, 'sawtooth', 0.15, 45); }
  busted() { this._tone(440, 0.4, 'sawtooth', 0.16, 220); setTimeout(() => this._tone(330, 0.5, 'sawtooth', 0.16, 165), 350); }
  engine(on, rpm01) {
    if (!this.ctx || this.muted) { if (this.engineNodes) { try { this.engineNodes.o.stop(); } catch (e) {} this.engineNodes = null; } return; }
    try {
      if (on && !this.engineNodes) {
        const o = this.ctx.createOscillator(); o.type = 'sawtooth';
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
        const g = this.ctx.createGain(); g.gain.value = 0.05;
        o.connect(f); f.connect(g); g.connect(this.master); o.start();
        this.engineNodes = { o, g, f };
      } else if (!on && this.engineNodes) {
        try { this.engineNodes.o.stop(); } catch (e) {}
        this.engineNodes = null;
      }
      if (this.engineNodes) {
        this.engineNodes.o.frequency.value = 55 + rpm01 * 130;
        this.engineNodes.g.gain.value = 0.03 + rpm01 * 0.05;
      }
    } catch (e) {}
  }
  siren(on) {
    if (!this.ctx) return;
    try {
      if (on && !this.sirenNodes) {
        const o = this.ctx.createOscillator(); o.type = 'triangle';
        const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.9;
        const lg = this.ctx.createGain(); lg.gain.value = 260;
        lfo.connect(lg); lg.connect(o.frequency);
        o.frequency.value = 820;
        const g = this.ctx.createGain(); g.gain.value = this.muted ? 0 : 0.05;
        o.connect(g); g.connect(this.master);
        o.start(); lfo.start();
        this.sirenNodes = { o, lfo, g };
      } else if (!on && this.sirenNodes) {
        try { this.sirenNodes.o.stop(); this.sirenNodes.lfo.stop(); } catch (e) {}
        this.sirenNodes = null;
      }
      if (this.sirenNodes) this.sirenNodes.g.gain.value = this.muted ? 0 : 0.05;
    } catch (e) {}
  }
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 0, 65.4, 0, 49, 0, 58.3, 73.4];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const n = bass[this.musicStep % bass.length];
      this.musicStep++;
      if (n) this._tone(n, 0.42, 'triangle', 0.10);
      if (this.musicStep % 4 === 0) this._tone(220 + (this.musicStep % 3) * 55, 0.18, 'sine', 0.045);
    }, 300);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
}
