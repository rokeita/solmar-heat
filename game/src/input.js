// Keyboard + mouse input for SOLMAR HEAT. Edge-triggered keys are consumed once
// per frame through pressed(), which main.js clears at the end of each frame.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.edge = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.dragging = false;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.edge.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.dragging = false; });
    canvas.addEventListener('pointerdown', (e) => { this.dragging = true; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup', () => { this.dragging = false; });
    canvas.addEventListener('pointercancel', () => { this.dragging = false; });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    canvas.addEventListener('wheel', (e) => { this.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
  }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this.edge.has(code); }
  endFrame() { this.edge.clear(); this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0; }
  consumeMouse() { const r = { dx: this.mouseDX, dy: this.mouseDY }; this.mouseDX = 0; this.mouseDY = 0; return r; }
  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; }
  // WASD movement axis, camera-relative: x = strafe right, z = forward.
  moveAxis() {
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    const len = Math.hypot(x, z) || 1;
    return { x: x / len, z: z / len };
  }
  run() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
}
