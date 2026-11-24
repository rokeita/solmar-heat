// localStorage save/load for SOLMAR HEAT.
const KEY = 'solmar-heat-save-v1';
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d !== 'object' || !d) return null;
    return d;
  } catch (e) { return null; }
}
export function saveGame(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
}
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
