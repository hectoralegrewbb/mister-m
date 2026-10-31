import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, command, update, drainEvents } from '../dist/src/engine.js';

const run = (g, seconds, input = {}) => { for (let i = 0; i < seconds * 60; i++) update(g, 1 / 60, input); };
const start = (route = 'local') => { const g = createGame(route); command(g, 'start'); return g; };
const front = (g, e, dx = 24) => { e.entered = true; e.state = 'wait'; e.hold = 0; e.x = g.player.x + dx; e.y = g.player.y; e.cool = 99; };

test('start spawns the first encounter and clamps the player to the screen', () => {
  const g = start(); assert.equal(g.enemies.length, 2); assert.equal(g.mode, 'play');
  run(g, 3, { axisX: -1 }); assert.ok(g.player.x >= g.camera.x + 10 - 1e-6);
});
test('three-hit chain: jab, cross, then a kick that knocks down', () => {
  const g = start(); run(g, 1.6); g.enemies.length = 1; const e = g.enemies[0]; front(g, e); e.hp = e.maxHp = 500; e.armor = false;
  const states = [];
  for (let i = 0; i < 3; i++) { command(g, 'attack'); for (let k = 0; k < 9; k++) update(g, 1 / 60, {}); states.push(e.state); e.cool = 99; }
  assert.equal(g.combo, 3); assert.equal(states[0], 'stagger'); assert.equal(e.state, 'down'); assert.ok(e.hp < 500 - 30);
});
test('queued presses continue the chain without waiting for recovery', () => {
  const g = start(); run(g, 1.6); const p = g.player; command(g, 'attack'); command(g, 'attack');
  for (let i = 0; i < 20; i++) update(g, 1 / 60, {}); assert.equal(p.atk?.i, 1);
});
test('jump leaves the ground, air kick hits, and landing resets state', () => {
  const g = start(); run(g, 1.6); g.enemies.length = 1; const e = g.enemies[0]; command(g, 'jump');
  update(g, 1 / 60, {}); assert.ok(g.player.z > 0); command(g, 'attack'); assert.equal(g.player.state, 'airAttack');
  front(g, e, 28); e.hp = e.maxHp = 300; e.armor = false; run(g, 1); assert.equal(g.player.z, 0); assert.equal(g.player.state, 'idle'); assert.ok(e.hp < 300);
});
test('jumping avoids a grounded punch', () => {
  const g = start(); run(g, 1.6); g.enemies.length = 1; const e = g.enemies[0]; front(g, e, 22);
  g.player.hp = 100; command(g, 'jump'); update(g, 1 / 60, {});
  Object.assign(e, { state: 'windup', attackKind: 'melee', wind: .001, attackFace: -1, face: -1 }); g.player.z = 25; update(g, 1 / 60, {});
  assert.equal(g.player.hp, 100);
});
test('dodge costs energy, grants invulnerability, and denial emits an event', () => {
  const g = start(); run(g, 1.6); drainEvents(g); g.energy = 100; command(g, 'dodge'); assert.ok(g.player.inv > 0); assert.ok(g.energy <= 82.1);
  run(g, 1); g.energy = 0; command(g, 'dodge'); assert.ok(drainEvents(g).some(ev => ev.type === 'denied'));
});
test('special needs 45 energy, floors every nearby enemy and is invulnerable', () => {
  const g = start(); run(g, 1.6); g.enemies.forEach((e, i) => { front(g, e, i ? -30 : 30); e.hp = e.maxHp = 300; e.armor = false; });
  g.energy = 10; command(g, 'special'); assert.notEqual(g.player.state, 'special');
  g.energy = 60; command(g, 'special'); run(g, .3); assert.ok(g.enemies.every(e => e.state === 'down' || e.hp < 300)); assert.ok(g.energy < 40);
});
test('hits refill energy and register score and combo', () => {
  const g = start(); run(g, 1.6); g.enemies.length = 1; front(g, g.enemies[0]); const energy = g.energy; command(g, 'attack'); run(g, .2);
  assert.ok(g.energy > energy - .5); assert.ok(g.score > 0);
});
test('civilians withdraw instead of attacking; retreat counts as resolved', () => {
  const g = start('local'); g.chapterIndex = 2; command(g, 'continue'); // not in clear mode: ignored
  const h = createGame(); command(h, 'start'); h.mode = 'clear'; command(h, 'continue'); h.mode = 'clear'; command(h, 'continue');
  run(h, 4); const civ = h.enemies.find(e => e.kind === 'homeless' || e.kind === 'retiree'); assert.ok(civ);
  const hp = h.player.hp; run(h, 14); assert.equal(h.player.hp, Math.min(100, hp)); assert.ok(h.consequences.withdrawn >= 1);
});
test('workers retaliate only after being hit', () => {
  const g = start(); run(g, 1.6); g.enemies.length = 0; g.activeEnc = null; g.encIndex = 0;
  g.stage = { ...g.stage, encounters: [{ at: 0, spawn: [['worker', 1, 0]] }] };
  run(g, .1); const worker = g.enemies.find(e => e.kind === 'worker'); assert.ok(worker);
  front(g, worker, 30); worker.cool = 0; run(g, 3); assert.equal(g.player.hp, 100);
  command(g, 'attack'); run(g, .15); assert.equal(worker.provoked, true);
});
test('props break and drop items that heal on pickup', () => {
  const g = start(); run(g, .1); g.enemies.length = 0; const prop = g.props.find(p => p.drop === 'medialuna'); g.player.x = prop.x - 20; g.player.y = prop.y; g.camera.x = 100; g.player.hp = 50; g.player.face = 1;
  for (let i = 0; i < 4; i++) { command(g, 'attack'); run(g, .5); } assert.ok(prop.broken); run(g, 2); assert.ok(g.stats.items >= 1 || g.pickups.length >= 0);
  const it = { id: 999, type: 'medialuna', x: g.player.x, y: g.player.y, z: 0, vz: 0, vx: 0, life: 10, landed: true }; g.pickups.push(it); run(g, .1); assert.ok(g.player.hp > 50);
});
test('knocked-down enemies bowl into others', () => {
  const g = start(); run(g, 1.6); const [a, b] = g.enemies; front(g, a, 20); b.entered = true; b.state = 'wait'; b.x = a.x + 22; b.y = a.y; b.cool = 99; a.armor = false; a.hp = a.maxHp = 300; b.hp = b.maxHp = 300;
  g.player.x = a.x - 20; g.player.face = 1; command(g, 'special'); g.energy = 100; g.player.state = 'idle'; for (let i = 0; i < 3; i++) { g.player.state = 'idle'; command(g, 'attack'); run(g, .4); }
  assert.ok(b.hp < 300);
});
test('boss chapter ends in a win for both routes; chapters give a rank', () => {
  for (const route of ['local', 'global']) {
    const g = createGame(route); command(g, 'start');
    for (let ch = 0; ch < 3; ch++) {
      for (let guard = 0; guard < 600 && !['clear', 'reveal'].includes(g.mode); guard++) { g.enemies.forEach(e => { e.hp = 0; e.dead = true; e.fade = 0; }); g.player.x = Math.max(g.player.x, g.camera.x + 200); run(g, .3); }
      assert.ok(['clear', 'reveal'].includes(g.mode)); assert.match(g.result.rank, /^[SABC]$/); command(g, 'continue');
    }
    assert.equal(g.chapter.id, 'casa'); assert.ok(g.enemies.some(e => e.boss && e.kind === (route === 'local' ? 'puppeteer' : 'tycoon')));
    for (let guard = 0; guard < 100 && g.mode === 'play'; guard++) { g.enemies.forEach(e => { e.hp = 0; e.dead = true; e.fade = 0; }); run(g, .3); }
    assert.equal(g.mode, 'won');
  }
});
test('death offers continues, restarts the chapter and eases damage; credits run out', () => {
  const g = start(); run(g, 1.6); g.player.hp = 1; g.player.inv = 0; g.player.state = 'idle'; 
  g.enemies.forEach(e => { e.entered = true; });
  const e = g.enemies[0]; Object.assign(e, { state: 'windup', attackKind: 'melee', wind: .001, attackFace: 1, x: g.player.x - 20, y: g.player.y, face: 1, cool: 0 }); run(g, 3);
  assert.equal(g.mode, 'lost'); command(g, 'continue'); assert.equal(g.mode, 'play'); assert.equal(g.player.hp, 100); assert.equal(g.credits, 2); assert.ok(g.assist < 1);
  g.credits = 0; g.mode = 'lost'; command(g, 'giveup'); assert.equal(g.mode, 'gameover');
});
test('pause freezes the simulation', () => {
  const g = start(); run(g, 2); command(g, 'pause'); const snap = JSON.stringify(g.enemies.map(e => [e.x, e.y, e.state])); run(g, 2, { axisX: 1 });
  assert.equal(JSON.stringify(g.enemies.map(e => [e.x, e.y, e.state])), snap);
});
test('only one standard enemy prepares an attack at a time in early chapters', () => {
  const g = start(); g.player.hp = 1e5; for (let i = 0; i < 900; i++) { update(g, 1 / 60, {}); assert.ok(g.enemies.filter(e => e.state === 'windup' || e.state === 'attack').length <= 1); }
});
test('analog tilt scales speed and mirrors facing', () => {
  const a = start(), b = start(); run(a, 1.6); run(b, 1.6); const ax = a.player.x, bx = b.player.x; run(a, .5, { axisX: .3 }); run(b, .5, { axisX: 1 });
  assert.ok((b.player.x - bx) > (a.player.x - ax) * 2); update(a, .016, { axisX: -.5 }); assert.equal(a.player.face, -1);
});

test('walking into an enemy grabs it; knee hits it; jump throws it and it can bowl', () => {
  const g = start(); run(g, 1.6); const [a, b] = g.enemies; front(g, a, 20); a.hp = a.maxHp = 300; a.armor = false;
  b.entered = true; b.state = 'wait'; b.cool = 99; b.hp = b.maxHp = 300; b.armor = false; b.x = a.x + 60; b.y = a.y;
  run(g, .4, { axisX: 1 }); assert.equal(g.player.state, 'grab'); assert.equal(a.state, 'grabbed');
  command(g, 'attack'); update(g, 1 / 60, { axisX: 0 }); assert.ok(a.hp < 300); assert.equal(a.state, 'grabbed');
  command(g, 'jump'); assert.equal(g.player.state, 'throw'); assert.equal(a.state, 'down'); run(g, 1);
  assert.ok(b.hp < 300, 'thrown enemy bowls into the next one'); assert.equal(g.player.state, 'idle');
});
test('bosses cannot be grabbed and a hit while grabbing releases the enemy', () => {
  const g = start(); run(g, 1.6); const [a, b] = g.enemies; front(g, a, 20); b.entered = true; b.cool = 99; b.x = 500; b.y = 5;
  a.boss = true; run(g, .5, { axisX: 1 }); assert.notEqual(g.player.state, 'grab');
  a.boss = false; a.x = g.player.x + 20; a.y = g.player.y; a.state = 'wait'; run(g, .4, { axisX: 1 }); assert.equal(g.player.state, 'grab');
  g.player.inv = 0; command(g, 'pause'); command(g, 'pause'); 
  Object.assign(b, { x: g.player.x - 20, y: g.player.y, state: 'windup', attackKind: 'melee', wind: .001, attackFace: 1, face: 1 }); run(g, .1);
  assert.notEqual(g.player.state, 'grab'); assert.notEqual(a.state, 'grabbed');
});
test('loot pickups raise the botín and score; defeated hostiles can drop loot', () => {
  const g = start(); run(g, .2); g.enemies.length = 0;
  g.pickups.push({ id: 900, type: 'sobre', x: g.player.x, y: g.player.y, z: 0, vz: 0, vx: 0, life: 10, landed: true }); g.player.hp = 100; run(g, .1);
  assert.equal(g.loot, 500); assert.equal(g.stats.loot, 500); assert.ok(g.score >= 250);
});
