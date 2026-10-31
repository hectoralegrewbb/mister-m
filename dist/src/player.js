// Player state machine: free movement, 3-hit combo chain, jump + air kick, dodge, special.
import { tuning, grab as grabCfg } from './config.js';
import { clamp, sign, approach, emit } from './util.js';
import { canBeHit, hitEnemy, registerHits, releaseSlot, releaseGrab } from './combat.js';
import { canHitProp, hitProp } from './props.js';

const FREE = ['idle', 'walk'];
const specialSpec = { dmg: tuning.special.dmg, stun: 0, push: tuning.special.push, down: true, special: true, score: 150, hitStop: .12 };
const airSpec = { dmg: tuning.airKick.dmg, stun: 0, push: tuning.airKick.push, down: true, score: 80, hitStop: .08 };

export function createPlayer() {
  return { x: 40, y: 34, z: 0, vx: 0, vy: 0, vz: 0, face: 1, state: 'idle', stateT: 0, hp: tuning.maxHp, inv: 0, stun: 0, dodgeCool: 0,
    atk: null, queued: false, chainI: 0, chainT: 0, airHit: false, landed: true, downT: 0, dead: false, step: 0 };
}

const isFree = p => FREE.includes(p.state);

function autoFace(g) {
  const p = g.player;
  let best = null, bestD = 44;
  for (const e of g.enemies) {
    if (!canBeHit(e) || Math.abs(e.y - p.y) > 16) continue;
    const d = Math.abs(e.x - p.x);
    if (d < bestD) { best = e; bestD = d; }
  }
  if (best) p.face = sign(best.x - p.x) || p.face;
}

// Hit everything inside a box in front of (or around) the player.
function strike(g, spec, box) {
  const p = g.player;
  let hits = 0;
  for (const e of g.enemies) {
    if (!canBeHit(e)) continue;
    const dx = (e.x - p.x) * (box.around ? 1 : p.face), dy = Math.abs(e.y - p.y);
    const inX = box.around ? Math.abs(dx) < box.reach + e.halfW : dx > -8 && dx < box.reach + e.halfW;
    if (inX && dy < box.depth) { hitEnemy(g, e, spec, p); hits++; }
  }
  for (const prop of g.props) {
    if (!canHitProp(prop)) continue;
    const dx = (prop.x - p.x) * (box.around ? 1 : p.face), inX = box.around ? Math.abs(dx) < box.reach + prop.w : dx > -8 && dx < box.reach + prop.w;
    if (inX && Math.abs(prop.y - p.y) < box.depth) hitProp(g, prop, p);
  }
  if (hits) registerHits(g, hits, spec);
  return hits;
}

function startAttack(g, index, ax) {
  const p = g.player, step = tuning.steps[index];
  if (Math.abs(ax) > .2) p.face = sign(ax); else autoFace(g);
  Object.assign(p, { state: 'attack', stateT: 0, atk: { i: index, t: 0, hit: false }, queued: false, vx: p.face * step.lunge });
  emit(g, 'swing', { step: index, x: p.x, y: p.y });
}

const canGrab = e => !e.boss && e.entered && !e.dead && !e.escaped && !e.withdrawing && !['down', 'getup', 'hold', 'enter', 'grabbed'].includes(e.state);

function findGrab(g, dir) {
  const p = g.player; let best = null, bestD = grabCfg.range + 1;
  for (const e of g.enemies) {
    const dx = (e.x - p.x) * dir;
    if (!canGrab(e) || dx <= 0 || dx > grabCfg.range || Math.abs(e.y - p.y) > grabCfg.depth) continue;
    if (dx < bestD) { best = e; bestD = dx; }
  }
  return best;
}

function startGrab(g, e) {
  const p = g.player;
  releaseSlot(g, e);
  Object.assign(e, { state: 'grabbed', stateT: 0, wind: 0, attack: 0, charge: 0, stun: 0, vx: 0 });
  Object.assign(p, { state: 'grab', stateT: 0, vx: 0, vy: 0, face: sign(e.x - p.x) || p.face, grab: { id: e.id, t: 0, knees: 0, kneeT: 0 }, atk: null, queued: false });
  emit(g, 'grab', { x: e.x, y: e.y, first: !g.stats.grabbed++ });
}

function kneeHeld(g, ax) {
  const p = g.player, held = g.enemies.find(e => e.id === p.grab.id);
  if (!held || p.grab.kneeT > 0) return;
  if (p.grab.knees >= 2) return throwHeld(g, ax);
  p.grab.knees++; p.grab.kneeT = grabCfg.knee.cool;
  const k = grabCfg.knee; held.hp -= 0; // damage is applied through hitEnemy so score, combo and events stay consistent
  const spec = { dmg: k.dmg, stun: 0, push: 0, down: false, score: 70, hitStop: .06, dir: p.face };
  const stateBefore = held.state; hitEnemy(g, held, spec, p);
  if (held.state !== 'down') { held.state = stateBefore; held.stun = 0; held.vx = 0; }
  registerHits(g, 1, spec);
}

function throwHeld(g, ax) {
  const p = g.player, held = g.enemies.find(e => e.id === p.grab.id);
  const dir = Math.abs(ax) > .3 ? sign(ax) : p.face;
  p.grab = null;
  Object.assign(p, { state: 'throw', stateT: 0, face: dir, vx: 0 });
  if (!held) return;
  held.x += dir * 6; held.state = 'stagger';
  hitEnemy(g, held, { ...grabCfg.throwSpec, dir }, p); registerHits(g, 1, grabCfg.throwSpec);
  emit(g, 'throw', { x: p.x, y: p.y, dir });
}

export function playerCommand(g, action) {
  const p = g.player;
  if (p.dead || ['hurt', 'down', 'getup'].includes(p.state)) return;
  const ax = g.input.axisX || 0, ay = g.input.axisY || 0;
  if (p.state === 'grab') {
    if (action === 'jump') throwHeld(g, ax);
    else if (action === 'attack') kneeHeld(g, ax);
    return;
  }
  if (action === 'attack') {
    if (isFree(p)) startAttack(g, p.chainT > 0 ? p.chainI : 0, ax);
    else if (p.state === 'attack') p.queued = true;
    else if (p.state === 'jump' && p.z > 3) {
      Object.assign(p, { state: 'airAttack', stateT: 0, airHit: false, vz: Math.min(p.vz, -60), vx: p.face * 95 });
      emit(g, 'swing', { step: 3, x: p.x, y: p.y });
    }
  } else if (action === 'jump') {
    if (isFree(p)) { Object.assign(p, { state: 'jump', stateT: 0, vz: tuning.jumpSpeed, z: .01 }); emit(g, 'jump', { x: p.x, y: p.y }); }
  } else if (action === 'dodge') {
    const canDodge = isFree(p) || (p.state === 'attack' && p.atk.hit);
    if (canDodge && p.dodgeCool <= 0 && g.energy >= tuning.dodge.cost) {
      g.energy -= tuning.dodge.cost;
      const dirX = Math.abs(ax) > .2 ? sign(ax) : p.face, dirY = Math.abs(ay) > .2 ? sign(ay) : 0;
      Object.assign(p, { state: 'dodge', stateT: 0, atk: null, queued: false, face: dirX, dodgeDir: dirX, dodgeLane: dirY, inv: tuning.dodge.inv, dodgeCool: tuning.dodge.cooldown });
      emit(g, 'dodge', { x: p.x, y: p.y, dir: dirX });
    } else if (canDodge && g.energy < tuning.dodge.cost) emit(g, 'denied', { action: 'dodge', need: tuning.dodge.cost });
  } else if (action === 'special') {
    const canSpecial = isFree(p) || (p.state === 'attack' && p.atk.hit);
    if (canSpecial && g.energy >= tuning.special.cost) {
      g.energy -= tuning.special.cost;
      Object.assign(p, { state: 'special', stateT: 0, atk: null, queued: false, vx: 0, vy: 0, inv: tuning.special.total, specialHit: false });
      emit(g, 'special', { x: p.x, y: p.y });
    } else if (canSpecial) emit(g, 'denied', { action: 'special', need: tuning.special.cost });
  }
}

function steer(p, ax, ay, dt, control = 1) {
  const norm = Math.max(1, Math.hypot(ax, ay));
  const tx = ax / norm * tuning.walkSpeed * control, ty = ay / norm * tuning.laneSpeed * control;
  p.vx = approach(p.vx, tx, (Math.abs(tx) > Math.abs(p.vx) ? tuning.accel : tuning.decel) * dt);
  p.vy = approach(p.vy, ty, (Math.abs(ty) > Math.abs(p.vy) ? tuning.accel : tuning.decel) * dt);
}

export function updatePlayer(g, dt, input) {
  const p = g.player;
  p.inv = Math.max(0, p.inv - dt); p.dodgeCool = Math.max(0, p.dodgeCool - dt);
  p.chainT = Math.max(0, p.chainT - dt); p.stateT += dt;
  const ax = Number.isFinite(input.axisX) ? clamp(input.axisX, -1, 1) : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const ay = Number.isFinite(input.axisY) ? clamp(input.axisY, -1, 1) : (input.down ? 1 : 0) - (input.up ? 1 : 0);
  g.input = { axisX: ax, axisY: ay };
  const T = tuning;
  switch (p.state) {
    case 'idle': case 'walk':
      if (Math.abs(ax) > .2) p.face = sign(ax);
      steer(p, ax, ay, dt);
      p.state = Math.hypot(p.vx, p.vy) > 8 ? 'walk' : 'idle';
      p.walkRun = Math.hypot(p.vx, p.vy) > 78;
      if (p.state === 'walk') p.step += dt * Math.hypot(p.vx, p.vy) / 11;
      if (input.attack) startAttack(g, p.chainT > 0 ? p.chainI : 0, ax);
      else if (Math.abs(ax) > .5 && findGrab(g, sign(ax))) { p.pushT = (p.pushT || 0) + dt; if (p.pushT >= grabCfg.push) { p.pushT = 0; startGrab(g, findGrab(g, sign(ax))); } }
      else p.pushT = 0;
      break;
    case 'grab': {
      const held = g.enemies.find(e => e.id === p.grab?.id);
      if (!held || held.state !== 'grabbed') { p.grab = null; p.state = 'idle'; break; }
      p.grab.t += dt; p.grab.kneeT = Math.max(0, p.grab.kneeT - dt);
      p.vx = 0; p.vy = approach(p.vy, 0, T.decel * dt);
      held.x = p.x + p.face * 15; held.y = p.y + .2; held.face = -p.face;
      if (p.grab.t > grabCfg.hold) { releaseGrab(g); p.state = 'idle'; emit(g, 'grabBreak', { x: p.x, y: p.y }); }
      break;
    }
    case 'throw':
      if (p.stateT >= .26) p.state = 'idle';
      break;
    case 'attack': {
      const a = p.atk, step = T.steps[a.i];
      a.t += dt; p.vx = approach(p.vx, 0, T.decel * .7 * dt); p.vy = approach(p.vy, 0, T.decel * dt);
      if (!a.hit && a.t >= step.startup) { a.hit = true; strike(g, step, { reach: step.reach, depth: step.depth }); }
      if (a.hit && a.t >= step.startup + step.active && p.queued && a.i < T.steps.length - 1) startAttack(g, a.i + 1, ax);
      else if (a.t >= step.total) {
        p.chainI = a.i < T.steps.length - 1 ? a.i + 1 : 0; p.chainT = a.i < T.steps.length - 1 ? T.combo.chain : 0;
        p.atk = null; p.state = 'idle';
      }
      break;
    }
    case 'jump': case 'airAttack': {
      if (Math.abs(ax) > .2 && p.state === 'jump') p.face = sign(ax);
      if (p.state === 'jump') steer(p, ax, ay, dt, T.airControl);
      p.vz -= T.gravity * dt; p.z += p.vz * dt;
      if (p.state === 'airAttack' && !p.airHit && p.vz < T.airKick.minFall) {
        if (strike(g, airSpec, { reach: T.airKick.reach, depth: T.airKick.depth })) p.airHit = true;
      }
      if (p.z <= 0) {
        p.z = 0; p.vz = 0; p.vx *= .4; p.state = 'idle'; p.chainT = 0;
        emit(g, 'land', { x: p.x, y: p.y, heavy: false });
      }
      break;
    }
    case 'dodge': {
      const k = 1 - p.stateT / T.dodge.time * .5;
      p.vx = p.dodgeDir * T.dodge.speed * k; p.vy = p.dodgeLane * T.laneSpeed * 1.8 * k;
      if (p.stateT >= T.dodge.time) { p.state = 'idle'; p.vx *= .3; p.vy = 0; }
      break;
    }
    case 'special':
      if (!p.specialHit && p.stateT >= T.special.startup) {
        p.specialHit = true; strike(g, specialSpec, { around: true, reach: T.special.rangeX, depth: T.special.rangeY });
      }
      if (p.stateT >= T.special.total) p.state = 'idle';
      break;
    case 'hurt':
      p.vx = approach(p.vx, 0, T.decel * dt); p.stun -= dt;
      if (p.stun <= 0) p.state = 'idle';
      break;
    case 'down':
      if (!p.landed) {
        p.vz -= T.gravity * dt; p.z += p.vz * dt;
        if (p.z <= 0) { p.z = 0; p.vz = 0; p.vx *= .35; p.landed = true; p.downT = p.dead ? .9 : .65; emit(g, 'land', { x: p.x, y: p.y, heavy: true }); }
      } else {
        p.vx = approach(p.vx, 0, T.decel * dt); p.downT -= dt;
        if (p.downT <= 0 && !p.dead) { p.state = 'getup'; p.stateT = 0; p.inv = T.hurt.downInv; }
      }
      break;
    case 'getup':
      p.vx = 0;
      if (p.stateT >= .3) p.state = 'idle';
      break;
    case 'win':
      p.vx = approach(p.vx, 0, T.decel * dt); p.vy = approach(p.vy, 0, T.decel * dt);
      break;
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.y = clamp(p.y, 2, T.lane - 2);
}
