// Breakable street props and pickups: the interactive part of the environment.
import { tuning, items, lootPool } from './config.js';
import { emit, rand } from './util.js';

const propSize = { crate: { hp: 2, w: 13 }, bin: { hp: 2, w: 10 }, cart: { hp: 3, w: 18 } };

export function createProps(g, defs) {
  g.props = defs.map(def => ({ id: ++g.nextId, shake: 0, broken: false, fade: 0, ...propSize[def.type], ...def }));
  g.pickups = [];
}

export function canHitProp(prop) { return !prop.broken; }

export function hitProp(g, prop, from) {
  prop.hp -= 1; prop.shake = .18;
  emit(g, 'propHit', { x: prop.x, y: prop.y, type: prop.type });
  if (prop.hp > 0) return;
  prop.broken = true; prop.fade = .35;
  emit(g, 'propBreak', { x: prop.x, y: prop.y, type: prop.type });
  if (prop.drop) spawnPickup(g, prop.drop === 'loot' ? rollLoot(g) : prop.drop, prop.x, prop.y);
}

export function rollLoot(g) {
  const total = lootPool.reduce((s, [, w]) => s + w, 0); let r = rand(g) * total;
  for (const [type, w] of lootPool) { if ((r -= w) < 0) return type; }
  return lootPool[0][0];
}
export function spawnPickup(g, type, x, y) {
  g.pickups.push({ id: ++g.nextId, type, x, y, z: 12, vz: 110, vx: (rand(g) - .5) * 50, life: 14, landed: false });
}

function applyItem(g, pickup) {
  const def = items[pickup.type], p = g.player;
  if (def.hp) p.hp = Math.min(tuning.maxHp, p.hp + def.hp);
  if (def.energy) g.energy = Math.min(tuning.maxEnergy, g.energy + def.energy);
  g.stats.items++;
  if (def.loot) { g.loot += def.loot; g.stats.loot += def.loot; g.score += Math.round(def.loot / 2); } else g.score += 100;
  emit(g, 'pickup', { x: pickup.x, y: pickup.y, type: pickup.type, label: def.label, hp: def.hp || 0, energy: def.energy || 0, loot: def.loot || 0 });
}

export function updateProps(g, dt) {
  for (const prop of g.props) {
    prop.shake = Math.max(0, prop.shake - dt);
    if (prop.broken) prop.fade -= dt;
  }
  g.props = g.props.filter(prop => !prop.broken || prop.fade > 0);
  const p = g.player;
  for (const it of g.pickups) {
    it.life -= dt;
    if (!it.landed) {
      it.x += it.vx * dt; it.z += it.vz * dt; it.vz -= tuning.gravity * .6 * dt;
      if (it.z <= 0) { it.z = 0; it.landed = true; }
    }
    const def = items[it.type];
    const useless = !def.loot && (!def.energy || g.energy >= tuning.maxEnergy) && (!def.hp || p.hp >= tuning.maxHp);
    // Loot is magnetic: it drifts toward Mister M when he is close.
    if (def.loot && it.landed && Math.abs(it.x - p.x) < 40 && Math.abs(it.y - p.y) < 22) { it.x += Math.sign(p.x - it.x) * 70 * dt; it.y += Math.sign(p.y - it.y) * 40 * dt; }
    if (!useless && !p.dead && Math.abs(it.x - p.x) < 15 && Math.abs(it.y - p.y) < 12 && p.z < 14) { it.life = 0; applyItem(g, it); }
  }
  g.pickups = g.pickups.filter(it => it.life > 0);
}
