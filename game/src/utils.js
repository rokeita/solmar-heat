// Shared math helpers for SOLMAR HEAT.
export const TAU = Math.PI * 2;
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function rand(a, b) { return a + Math.random() * (b - a); }
export function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function dist2(x1, z1, x2, z2) { const dx = x2 - x1, dz = z2 - z1; return Math.hypot(dx, dz); }
// Shortest signed difference between two angles, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}
export function angleLerp(a, b, t) { return a + angleDiff(b, a) * t; }
