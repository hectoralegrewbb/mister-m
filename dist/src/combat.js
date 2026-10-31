// Damage resolution shared by player and enemy modules. Emits events; never touches the DOM.
import { tuning } from './config.js';
import { emit, sign, rand } from './util.js';
import { spawnPickup, rollLoot } from './props.js';

export const canBeHit = e => !e.dead && !e.escaped && e.entered && e.inv <= 0 && e.state !== 'down' && e.state !== 'getup';

export function releaseSlot(g, e) {
  const d = g.director, at = d.slots.indexOf(e.id);
  if (at >= 0) { d.slots.splice(at, 1); d.lastTurn = e.turn; d.gap = .35; }
}

export function knockdownEnemy(g, e, dir, push, lift = 120) {
  releaseSlot(g, e);
  Object.assign(e, { state: 'down', stateT: 0, vx: dir * push, vz: lift, z: 1, downT: 0, landed: false, wind: 0, attack: 0, charge: 0, stun: 0, hitSet: new Set() });
  emit(g, 'knockdown', { x: e.x, y: e.y, boss: !!e.boss });
}

function staggerEnemy(g, e, time, dir, push) {
  releaseSlot(g, e);
  Object.assign(e, { state: 'stagger', stun: time, vx: dir * push, wind: 0, attack: 0, charge: 0 });
}

export function registerHits(g, count, spec) {
  g.combo += count; g.comboTimer = tuning.combo.reset;
  g.stats.maxCombo = Math.max(g.stats.maxCombo, g.combo);
  g.score += Math.round(spec.score * count * (1 + Math.min(g.combo, 20) * .04));
  g.energy = Math.min(tuning.maxEnergy, g.energy + tuning.energyPerHit * count);
  emit(g, 'combo', { combo: g.combo });
}

// spec: { dmg, stun, push, down, special, hitStop }
export function hitEnemy(g, e, spec, from) {
  const dir = spec.dir || sign(e.x - from.x) || from.face;
  e.hp -= spec.dmg; e.flash = .12; e.provoked = true;
  if (e.behavior === 'block' || e.behavior === 'retreat') { e.withdrawing = true; e.wind = 0; e.attack = 0; releaseSlot(g, e); }
  if (!e.boss) g.consequences.strikes++, g.stats.strikes++;
  const power = e.hp <= 0 || spec.down ? 2 : 1;
  emit(g, 'hit', { id: e.id, x: e.x, y: e.y, z: e.z, power, dir, special: !!spec.special, hitStop: spec.hitStop, kind: e.kind });
  if (e.hp <= 0) {
    e.hp = 0; g.kills++; g.score += 250; e.provoked = true;
    knockdownEnemy(g, e, dir, spec.push * 1.1 + 40, spec.lift);
    emit(g, 'defeat', { x: e.x, y: e.y, boss: !!e.boss });
    dropLoot(g, e);
    return;
  }
  // Armored enemies shrug off light hits until their poise breaks; only the special floors a boss.
  const resist = e.armor && !spec.special && !(spec.down && !e.boss);
  if (resist) {
    e.poise -= spec.dmg * (spec.down ? 2 : 1); e.shrug = .12;
    if (e.poise <= 0) { e.poise = e.poiseMax; staggerEnemy(g, e, .5, dir, 60); emit(g, 'poiseBreak', { x: e.x, y: e.y }); }
  } else if (spec.down || spec.special) knockdownEnemy(g, e, dir, spec.push, spec.lift);
  else staggerEnemy(g, e, spec.stun, dir, spec.push);
  if (e.withdrawing && e.state !== 'down') e.state = 'retreat';
}

// Hostile enemies carry "gastos reservados"; civilians carry nothing. Bosses drop briefcases.
function dropLoot(g, e) {
  if (e.boss) { for (let i = 0; i < 3; i++) spawnPickup(g, 'maletin', e.x + (i - 1) * 16, e.y); return; }
  if (e.behavior === 'pursue' || e.behavior === 'counter') { if (rand(g) < .4) spawnPickup(g, rollLoot(g), e.x, e.y); }
}

export function releaseGrab(g) {
  const p = g.player, held = g.enemies.find(e => e.state === 'grabbed');
  p.grab = null;
  if (held) { held.state = 'stagger'; held.stun = .3; held.cool = Math.max(held.cool, .6); }
}

export function hurtPlayer(g, amount, dir, down = false) {
  const p = g.player;
  if (p.inv > 0 || p.dead || ['dodge', 'special', 'down', 'getup'].includes(p.state)) return false;
  const dmg = Math.max(1, Math.round(amount * g.assist));
  p.hp = Math.max(0, p.hp - dmg); g.stats.damageTaken += dmg; g.combo = 0;
  if (p.state === 'grab') releaseGrab(g);
  p.atk = null; p.queued = false; p.inv = tuning.hurt.inv; p.chainT = 0;
  if (p.hp <= 0 || down) {
    Object.assign(p, { state: 'down', stateT: 0, vx: dir * tuning.hurt.knock * 1.4, vz: 150, z: 1, landed: false, downT: 0, dead: p.hp <= 0 });
  } else Object.assign(p, { state: 'hurt', stateT: 0, stun: tuning.hurt.stun, vx: dir * tuning.hurt.knock });
  emit(g, 'playerHurt', { amount: dmg, x: p.x, y: p.y, down: p.state === 'down', hp: p.hp });
  return true;
}
