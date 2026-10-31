// Chapter flow: camera, screen locks, encounters, reinforcements, results.
import { tuning, stages, bossForRoute } from './config.js';
import { clamp, emit } from './util.js';
import { spawnEnemy } from './enemies.js';
import { createProps } from './props.js';

export function startChapter(g, index, { heal = 0, fullHp = false } = {}) {
  const stage = stages[index], p = g.player;
  Object.assign(g, {
    chapterIndex: index, stage, chapter: { id: stage.id, theme: stage.theme, title: stage.title, order: stage.order, aftermath: stage.aftermath },
    encIndex: 0, activeEnc: null, go: false, chapterClear: false, clearT: 0, phase2: false, enemies: [], result: null,
    director: { slots: [], gap: 0, lastTurn: -1 }, input: { axisX: 0, axisY: 0 },
    stats: { damageTaken: 0, maxCombo: 0, strikes: 0, withdrawn: 0, items: 0, loot: 0, grabbed: g.stats.grabbed || 0, startScore: g.score },
    combo: 0, comboTimer: 0
  });
  g.camera.x = 0;
  Object.assign(p, { x: 40, y: 34, z: 0, vx: 0, vy: 0, vz: 0, face: 1, state: 'idle', stateT: 0, atk: null, grab: null, queued: false, chainT: 0, inv: .8, dead: false, landed: true });
  p.hp = fullHp ? tuning.maxHp : Math.min(tuning.maxHp, p.hp + heal);
  createProps(g, stage.props);
  emit(g, 'chapterStart', { index, title: stage.title, order: stage.order, boss: !!stage.boss });
  triggerNext(g);
}

function triggerNext(g) {
  const enc = g.stage.encounters[g.encIndex++];
  g.activeEnc = enc; g.go = false;
  for (const [kind, side, delay] of enc.spawn) spawnEnemy(g, kind === '@boss' ? bossForRoute[g.route] : kind, side, delay);
  emit(g, 'encounter', { index: g.encIndex - 1 });
}

export function computeResult(g) {
  const s = g.stats;
  const perf = 100 - s.damageTaken * 1.1 + Math.min(s.maxCombo, 20) * 1.2 - s.strikes * .4;
  const rank = perf >= 92 ? 'S' : perf >= 75 ? 'A' : perf >= 55 ? 'B' : 'C';
  return { title: g.chapter.title, gained: g.score - s.startScore, damage: s.damageTaken, maxCombo: s.maxCombo, strikes: s.strikes, withdrawn: s.withdrawn, items: s.items, loot: s.loot, rank };
}

function finishChapter(g) {
  g.result = computeResult(g);
  g.mode = g.stage.boss ? 'won' : g.chapterIndex === 2 ? 'reveal' : 'clear';
  emit(g, 'chapterResult', { mode: g.mode, rank: g.result.rank });
}

function checkReinforcements(g) {
  const r = g.stage.reinforcements;
  if (!r || g.phase2) return;
  const boss = g.enemies.find(e => e.boss && !e.dead);
  if (boss && boss.hp / boss.maxHp < r.below) {
    g.phase2 = true; g.message = r.message; g.messageTimer = 3;
    for (const [kind, side, delay] of r.spawn) spawnEnemy(g, kind, side, delay);
    emit(g, 'phase', { message: r.message });
  }
}

export function updateWorld(g, dt) {
  const p = g.player, cam = g.camera, w = g.view.w, st = g.stage, T = tuning;
  const next = st.encounters[g.encIndex], lastAt = st.encounters[st.encounters.length - 1].at;
  const maxCam = g.activeEnc ? g.activeEnc.at : next ? next.at : lastAt;
  const target = clamp(p.x - w * .42, 0, maxCam);
  cam.x += (target - cam.x) * Math.min(1, dt * 7);
  if (Math.abs(target - cam.x) < .05) cam.x = target;
  p.x = clamp(p.x, cam.x + T.edgeMargin, cam.x + w - T.edgeMargin);
  checkReinforcements(g);
  if (!g.activeEnc && next && !g.chapterClear && (cam.x >= next.at - 1 || p.x >= next.at + w * .55)) triggerNext(g);
  else if (g.activeEnc && g.enemies.length === 0) {
    g.activeEnc = null;
    if (g.encIndex < st.encounters.length) { g.go = true; emit(g, 'go'); }
    else { g.chapterClear = true; g.clearT = 0; emit(g, 'chapterClear', { boss: !!st.boss }); }
  }
  if (g.chapterClear) {
    g.clearT += dt;
    if (['idle', 'walk'].includes(p.state)) p.state = 'win';
    if (g.clearT >= (st.boss ? 2.2 : 1.6)) finishChapter(g);
  }
}
