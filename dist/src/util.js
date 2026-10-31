// Small pure helpers shared by the simulation modules.
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const sign = value => (value > 0 ? 1 : value < 0 ? -1 : 0);
export const approach = (value, target, step) => (value < target ? Math.min(target, value + step) : Math.max(target, value - step));

// Deterministic generator (mulberry32) so simulations and tests are reproducible.
export function rand(g) {
  g.seed = (g.seed + 0x6d2b79f5) | 0;
  let t = Math.imul(g.seed ^ (g.seed >>> 15), 1 | g.seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Events are the only channel from the simulation to presentation (fx, audio, haptics, ui).
export function emit(g, type, data = {}) {
  g.events.push({ type, ...data });
  if (g.events.length > 64) g.events.shift();
}
