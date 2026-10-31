// Enemy AI. A director hands out attack turns so the screen stays fair and readable.
// States: hold, enter, idle, wait, approach, windup, attack, recover, stagger, down, getup, retreat.
import { tuning, enemyKinds } from './config.js';
import { clamp, sign, approach, emit, rand } from './util.js';
import { hurtPlayer, releaseSlot, canBeHit, hitEnemy, registerHits } from './combat.js';

const bowlSpec = { dmg: 10, stun: .4, push: 60, down: false, score: 60, hitStop: .06 };
const lanes = 1.6; // depth is compressed: lateral steering weights y by this factor

export function spawnEnemy(g, kindId, side, delay = 0) {
  const kind = enemyKinds[kindId], cam = g.camera.x;
  const e = {
    ...kind, kind: kindId, id: ++g.nextId, maxHp: kind.hp, hp: kind.hp,
    x: side > 0 ? cam + g.view.w + 26 : cam - 26, y: 8 + rand(g) * (tuning.lane - 16), z: 0, vx: 0, vz: 0,
    face: side > 0 ? -1 : 1, state: 'hold', stateT: 0, hold: delay, cool: 1 + delay * .3, stun: 0, flash: 0, inv: 0, shrug: 0,
    wind: 0, attack: 0, attackFace: -1, attackKind: 'melee', charge: 0, hasHit: false,
    provoked: false, withdrawing: false, escaped: false, dead: false, fade: 0,
    turn: g.turnCounter++, side, engageTime: 0, step: 0, entered: false, halfW: kind.boss ? 14 : 10,
    poiseMax: kind.boss ? 45 : 20, poise: kind.boss ? 45 : 20, depth: kind.depth || 14, exitDir: 0
  };
  g.enemies.push(e);
  return e;
}

export const isThreat = e => e.entered && !e.dead && !e.escaped && !e.withdrawing &&
  (e.boss || e.behavior === 'pursue' || (e.behavior === 'counter' && e.provoked));

const busy = e => ['stagger', 'down', 'getup', 'hold', 'enter'].includes(e.state);

function steerTo(e, x, y, dt, speed = e.speed) {
  const dx = x - e.x, dy = y - e.y, dist = Math.hypot(dx, dy * lanes);
  if (dist < 2) return;
  const step = Math.min(dist, speed * dt);
  e.x += dx / dist * step; e.y += dy / dist * step;
  e.step += dt * 9;
}

function updateDown(g, e, dt) {
  const cam = g.camera.x;
  if (!e.landed) {
    e.x += e.vx * dt; e.z += e.vz * dt; e.vz -= tuning.gravity * dt;
    if (Math.abs(e.vx) > 40) {
      for (const other of g.enemies) {
        if (other === e || !canBeHit(other) || e.hitSet.has(other.id)) continue;
        if (Math.abs(other.x - e.x) < 18 && Math.abs(other.y - e.y) < 12) {
          e.hitSet.add(other.id); hitEnemy(g, other, bowlSpec, e); registerHits(g, 1, bowlSpec);
          emit(g, 'bowling', { x: other.x, y: other.y });
        }
      }
    }
    if (e.z <= 0) { e.z = 0; e.vz = 0; e.vx *= .45; e.landed = true; e.downT = e.hp <= 0 ? .5 : .95; emit(g, 'land', { x: e.x, y: e.y, heavy: true, enemy: true }); }
  } else {
    e.x += e.vx * dt; e.vx = approach(e.vx, 0, 500 * dt); e.downT -= dt;
    if (e.downT <= 0) {
      if (e.hp <= 0) { e.dead = true; e.fade = .5; } else { e.state = 'getup'; e.stateT = 0; e.inv = .5; }
    }
  }
  e.x = clamp(e.x, cam - 30, cam + g.view.w + 30);
}

function fireAttack(g, e) {
  const p = g.player;
  e.hasHit = false;
  if (e.attackKind === 'charge') { e.charge = .34; e.state = 'attack'; emit(g, 'enemySwing', { x: e.x, y: e.y, charge: true }); return; }
  const fwd = (p.x - e.x) * e.attackFace, dy = Math.abs(p.y - e.y);
  if (fwd >= -4 && fwd < e.reach + 8 && dy < e.depth - 2 && p.z < 14) hurtPlayer(g, e.dmg, e.attackFace, !!e.boss);
  e.attack = .16; e.cool = e.recover; e.state = 'attack';
  emit(g, 'enemySwing', { x: e.x, y: e.y });
}

function updateCharge(g, e, dt) {
  const p = g.player;
  e.charge -= dt; e.x += e.attackFace * 190 * dt; e.y = approach(e.y, p.y, 34 * dt);
  if (!e.hasHit && Math.abs(p.x - e.x) < 18 && Math.abs(p.y - e.y) < e.depth - 2 && p.z < 14) {
    e.hasHit = hurtPlayer(g, e.dmg * 1.3, e.attackFace, true) || e.hasHit;
  }
  if (e.charge <= 0) { e.charge = 0; e.cool = e.recover + .3; e.state = 'recover'; releaseSlot(g, e); }
}

function assignTurns(g) {
  const d = g.director, p = g.player, max = g.stage.maxAttackers;
  d.slots = d.slots.filter(id => { const e = g.enemies.find(x => x.id === id); return e && isThreat(e); });
  while (d.slots.length < max && d.gap <= 0) {
    const ready = g.enemies.filter(e => isThreat(e) && !d.slots.includes(e.id) && !busy(e) && e.cool <= 0 &&
      Math.hypot(e.x - p.x, (e.y - p.y) * 2) < 190).sort((a, b) => a.turn - b.turn);
    const next = ready.find(e => e.turn > d.lastTurn) || ready[0];
    if (!next) break;
    d.slots.push(next.id); next.engageTime = 2.6; d.lastTurn = next.turn;
  }
}

function separate(g) {
  const cam = g.camera.x, w = g.view.w, p = g.player;
  const bodies = g.enemies.filter(e => !e.dead && !e.escaped && !e.withdrawing && e.state !== 'down' && e.state !== 'grabbed' && e.entered);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]; let dx = b.x - a.x, dy = (b.y - a.y) * 2.4, dist = Math.hypot(dx, dy);
        const gap = a.boss || b.boss ? 30 : 24;
        if (dist >= gap) continue;
        if (dist < .001) { dx = a.turn < b.turn ? 1 : -1; dy = 0; dist = 1; }
        const push = (gap - dist) / 2;
        a.x -= dx / dist * push; a.y -= dy / dist * push / 2.4; b.x += dx / dist * push; b.y += dy / dist * push / 2.4;
      }
      // Never push Mister M: enemies route around his footprint.
      let dx = a.x - p.x, dy = (a.y - p.y) * 2.4, dist = Math.hypot(dx, dy);
      const gap = a.boss ? 26 : 20;
      if (dist < gap && p.z < 10) {
        if (dist < .001) { dx = a.side; dy = 0; dist = 1; }
        a.x = p.x + dx / dist * gap; a.y = p.y + dy / dist * gap / 2.4;
      }
      a.x = clamp(a.x, cam + 6, cam + w - 6); a.y = clamp(a.y, 3, tuning.lane - 3);
    }
  }
}

export function updateEnemies(g, dt) {
  const p = g.player, d = g.director, cam = g.camera.x, w = g.view.w;
  d.gap = Math.max(0, d.gap - dt);
  assignTurns(g);
  for (const e of g.enemies) {
    if (e.dead) { e.fade -= dt; continue; }
    e.flash = Math.max(0, e.flash - dt); e.inv = Math.max(0, e.inv - dt); e.shrug = Math.max(0, e.shrug - dt);
    e.cool = Math.max(0, e.cool - dt); e.attack = Math.max(0, e.attack - dt); e.stateT += dt;
    if (e.state === 'hold') { e.hold -= dt; if (e.hold <= 0) { e.state = 'enter'; e.stateT = 0; } continue; }
    if (e.state === 'down') { updateDown(g, e, dt); continue; }
    if (e.state === 'grabbed') continue;
    if (e.state === 'getup') { if (e.stateT >= .35) { e.state = 'wait'; e.cool = Math.max(e.cool, .3); } continue; }
    e.x += e.vx * dt; e.vx = approach(e.vx, 0, 700 * dt);
    if (!e.entered) {
      const inside = e.x > cam + 16 && e.x < cam + w - 16;
      if (inside) { e.entered = true; e.state = 'wait'; }
      else { e.x += sign(cam + w / 2 - e.x) * e.speed * 1.5 * dt; e.step += dt * 9; e.face = sign(p.x - e.x) || e.face; continue; }
    }
    const dx = p.x - e.x, dy = p.y - e.y;
    if (e.behavior === 'retreat' && Math.hypot(dx, dy * 2) < 110) e.withdrawing = true;
    if (e.behavior === 'block' && (e.provoked || Math.hypot(dx, dy * 2) < 56)) e.withdrawing = true;
    if (e.withdrawing) {
      releaseSlot(g, e); e.state = 'retreat'; e.wind = 0; e.attack = 0; e.charge = 0;
      if (!e.exitDir) e.exitDir = e.x >= p.x ? 1 : -1;
      e.face = e.exitDir; e.step += dt * 9; e.x += e.exitDir * e.speed * 1.8 * dt;
      if (e.x > cam + w + 30 || e.x < cam - 30) e.escaped = true;
      continue;
    }
    if (e.stun > 0) { e.state = 'stagger'; e.stun -= dt; if (e.stun <= 0) { e.state = 'wait'; e.cool = Math.max(e.cool, .3); } continue; }
    if (!isThreat(e)) { e.state = 'idle'; e.face = sign(dx) || e.face; continue; }
    if (e.charge > 0) { updateCharge(g, e, dt); continue; }
    if (e.wind > 0) {
      e.state = 'windup'; e.wind = Math.max(0, e.wind - dt);
      if (e.wind === 0) fireAttack(g, e);
      continue;
    }
    if (e.attack > 0) { e.state = 'attack'; continue; }
    if (e.state === 'attack' || e.state === 'recover') {
      e.state = 'recover';
      if (e.cool > 0) continue;
      releaseSlot(g, e);
    }
    const ownsTurn = d.slots.includes(e.id);
    let side = sign(e.x - p.x) || e.side;
    if (p.x - cam < 70) side = 1; else if (cam + w - p.x < 70) side = -1;
    const reach = e.reach;
    e.face = sign(dx) || e.face;
    e.state = ownsTurn ? 'approach' : 'wait';
    if (ownsTurn) {
      e.engageTime -= dt;
      const lateral = Math.abs(dx), aligned = Math.abs(dy) < 8, assist = 1 + (1 - g.assist) * .6;
      if (e.engageTime <= 0 || Math.hypot(dx, dy * 2) > 280) { e.cool = .3; releaseSlot(g, e); }
      else if (!p.dead && e.cool <= 0 && e.charge === 0 && e.boss && lateral > 64 && lateral < 170 && Math.abs(dy) < 12 && rand(g) < dt * 1.2) {
        e.attackKind = 'charge'; e.wind = .8 * assist; e.attackFace = e.face; e.state = 'windup'; continue;
      } else if (!p.dead && lateral <= reach + 4 && aligned && e.cool <= 0 && p.state !== 'down') {
        e.attackKind = 'melee'; e.wind = e.windup * assist; e.attackFace = e.face; e.state = 'windup'; continue;
      }
    }
    const waitDist = 74 + (e.turn % 3) * 22;
    const tx = clamp(p.x + side * (ownsTurn ? reach - 6 : waitDist), cam + 12, cam + w - 12);
    const ty = ownsTurn ? p.y : clamp(p.y + (e.turn % 2 ? 1 : -1) * 16, 5, tuning.lane - 5);
    steerTo(e, tx, ty, dt);
  }
  separate(g);
}
