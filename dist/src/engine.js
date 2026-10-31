// Public API: createGame, setView, selectRoute, command, update, drainEvents. No DOM, no imports from presentation.
// Presentation (fx, audio, haptics, ui) listens to events instead of being called by the simulation.
import { tuning, stages } from './config.js';
import { clamp, emit } from './util.js';
import { createPlayer, playerCommand, updatePlayer } from './player.js';
import { updateEnemies } from './enemies.js';
import { updateProps } from './props.js';
import { startChapter, updateWorld } from './world.js';

export function createGame(route = 'local', view = { w: 384, h: 216 }) {
  return {
    route, mode: 'menu', time: 0, view: { ...view }, seed: 1337, nextId: 0, turnCounter: 0,
    score: 0, loot: 0, combo: 0, comboTimer: 0, energy: 60, kills: 0, credits: 3, deaths: 0, assist: 1,
    player: createPlayer(), enemies: [], props: [], pickups: [], events: [], camera: { x: 0 },
    director: { slots: [], gap: 0, lastTurn: -1 }, input: { axisX: 0, axisY: 0 },
    chapterIndex: 0, stage: stages[0], chapter: { id: stages[0].id, theme: stages[0].theme, title: stages[0].title, order: stages[0].order, aftermath: stages[0].aftermath },
    encIndex: 0, activeEnc: null, go: false, chapterClear: false, clearT: 0, phase2: false, result: null,
    stats: { damageTaken: 0, maxCombo: 0, strikes: 0, withdrawn: 0, items: 0, loot: 0, grabbed: 0, startScore: 0 },
    consequences: { withdrawn: 0, strikes: 0 }, message: '', messageTimer: 0
  };
}

export function selectRoute(g, route) { if (['local', 'global'].includes(route)) g.route = route; }
export function setView(g, w, h) { g.view.w = Math.max(200, Math.round(w)); g.view.h = Math.round(h); }
export function drainEvents(g) { const out = g.events; g.events = []; return out; }

export function command(g, action) {
  if (action === 'start') {
    const { route, view } = g;
    Object.assign(g, createGame(route, view)); g.mode = 'play'; g.energy = 60;
    startChapter(g, 0, { fullHp: true }); g.message = ''; return;
  }
  if (action === 'pause') { if (g.mode === 'play') g.mode = 'paused'; else if (g.mode === 'paused') g.mode = 'play'; return; }
  if (action === 'continue') {
    if (g.mode === 'clear' || g.mode === 'reveal') {
      const aftermath = g.chapter.aftermath;
      g.mode = 'play'; startChapter(g, g.chapterIndex + 1, { heal: tuning.healOnChapter });
      g.message = aftermath; g.messageTimer = 4; return;
    }
    if (g.mode === 'lost') {
      g.credits--; g.deaths++; g.assist = Math.max(.6, 1 - .1 * g.deaths);
      g.score = g.stats.startScore; g.mode = 'play';
      startChapter(g, g.chapterIndex, { fullHp: true }); g.energy = Math.max(g.energy, 50); return;
    }
    return;
  }
  if (action === 'restart' && (g.mode === 'play' || g.mode === 'paused')) {
    g.score = g.stats.startScore; g.mode = 'play'; startChapter(g, g.chapterIndex, { fullHp: true }); return;
  }
  if (action === 'giveup' && g.mode === 'lost') { g.mode = 'gameover'; return; }
  if (g.mode !== 'play') return;
  playerCommand(g, action);
}

export function update(g, dt, input = {}) {
  if (g.mode !== 'play') return;
  dt = clamp(dt, 0, .05); g.time += dt;
  const p = g.player;
  g.energy = Math.min(tuning.maxEnergy, g.energy + tuning.energyRegen * dt);
  g.messageTimer = Math.max(0, g.messageTimer - dt);
  g.comboTimer -= dt; if (g.comboTimer <= 0) g.combo = 0;
  updatePlayer(g, dt, input);
  updateEnemies(g, dt);
  for (const e of g.enemies) {
    if (e.escaped && !e.counted) { e.counted = true; g.consequences.withdrawn++; g.stats.withdrawn++; g.score += 250; emit(g, 'withdrawn', { x: e.x, y: e.y }); }
  }
  g.enemies = g.enemies.filter(e => !(e.dead && e.fade <= 0) && !e.escaped);
  updateProps(g, dt);
  updateWorld(g, dt);
  if (p.dead && p.landed && p.downT <= 0 && g.mode === 'play') {
    g.mode = g.credits > 0 ? 'lost' : 'gameover'; emit(g, 'playerDown', { credits: g.credits });
  }
}
