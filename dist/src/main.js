// Composition root: boot, integer-scaled canvas, game loop, and the observers that react to simulation events.
import { createGame, command, update, setView, selectRoute, drainEvents } from './engine.js';
import { stages } from './config.js';
import { bindInput } from './input.js';
import { draw } from './render.js';
import { createScenery, updatePigeons } from './scenery.js';
import { createFx, fxEvent, updateFx } from './fx.js';
import { createAudio } from './audio.js';
import { createUi } from './ui.js';
import { loadSprites, drawPortrait } from './sprites.js';
import { loadStore, saveStore } from './store.js';

const $ = selector => document.querySelector(selector);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const canvas = $('#game'), ctx = canvas.getContext('2d');
const store = loadStore(), g = createGame(), fx = createFx(), audio = createAudio();
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarse = window.matchMedia('(pointer: coarse)');
let reducedMotion = motion.matches, ready = false, scenery = null, sceneryKey = '', scareAt = null, animTime = 0, last = 0, prevEnergy = 0, prevMode = 'menu';
const tut = { done: store.tutorial, step: 0, startX: 0, hurtShown: false };
const canVibrate = typeof navigator.vibrate === 'function';

audio.setMusic(store.music); audio.setSfx(store.sfx);
motion.addEventListener('change', e => { reducedMotion = e.matches; });

/* ---------- Settings & layout ---------- */
const touchOn = () => store.touch ?? coarse.matches;
function applyTouch() { document.body.dataset.touch = touchOn() ? '1' : '0'; }

function fit() {
  applyTouch();
  const box = $('#screen').getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const devW = Math.max(1, Math.floor(box.width * dpr)), devH = Math.max(1, Math.floor(box.height * dpr));
  // Integer device pixels per game pixel keeps the pixel art perfectly crisp.
  const scale = clamp(Math.round(Math.min(devW / 300, devH / 190)), 1, 12);
  const iw = clamp(Math.floor(devW / scale), 160, 480), ih = clamp(Math.floor(devH / scale), 120, 300);
  if (canvas.width !== iw || canvas.height !== ih) { canvas.width = iw; canvas.height = ih; }
  canvas.style.width = (iw * scale / dpr) + 'px'; canvas.style.height = (ih * scale / dpr) + 'px';
  setView(g, iw, ih);
  rebuildScenery();
}
function rebuildScenery() {
  const stage = g.mode === 'menu' ? stages[0] : g.stage, last = stage.encounters[stage.encounters.length - 1].at;
  const key = `${stage.theme}:${g.view.w}x${g.view.h}`;
  if (key === sceneryKey) return;
  sceneryKey = key; $('#screen').style.background = ({ plaza: '#2b1b4f', barrio: '#0a0818', vigilia: '#060d1a', casa: '#2a0f1e' })[stage.theme]; scenery = createScenery(stage.theme, g.view, last + g.view.w + 80);
}
let resizeTimer = 0;
const refit = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => ready && fit(), 120); };
window.addEventListener('resize', refit); window.addEventListener('orientationchange', refit); window.visualViewport?.addEventListener('resize', refit);

/* ---------- Observers: sound, haptics ---------- */
function vibrate(pattern) { if (canVibrate && store.haptics && !document.hidden && !reducedMotion) { try { navigator.vibrate(pattern); } catch { /* ignore */ } } }
function onSimEvent(ev) {
  switch (ev.type) {
    case 'swing': audio.sfx('swing'); break;
    case 'hit': audio.sfx(ev.power > 1 ? 'heavy' : 'hit'); vibrate(ev.power > 1 ? [14] : 8); break;
    case 'playerHurt': audio.sfx('hurt'); vibrate([24, 30, 30]); break;
    case 'jump': audio.sfx('jump'); break;
    case 'land': if (ev.heavy) audio.sfx('land'); break;
    case 'dodge': audio.sfx('dodge'); vibrate(8); break;
    case 'special': audio.sfx('special'); vibrate([12, 24, 18]); break;
    case 'propHit': audio.sfx('hit'); break;
    case 'propBreak': audio.sfx('break'); vibrate(12); break;
    case 'pickup': audio.sfx(ev.loot ? 'coin' : 'pickup'); vibrate(6); break;
    case 'grab': audio.sfx('grab'); vibrate(10); break;
    case 'throw': audio.sfx('heavy'); vibrate([10, 20, 16]); break;
    case 'denied': audio.sfx('denied'); vibrate([8, 30, 8]); break;
    case 'go': audio.sfx('ready'); break;
    case 'chapterClear': audio.sfx('clear'); break;
    case 'chapterStart': audio.playMusic(g.stage.boss ? 'boss' : 'street'); rebuildScenery(); break;
    case 'phase': ui.toast(ev.message.toUpperCase(), 'error', 2.4); break;
    default:
  }
  if (ev.type === 'hit' || ev.type === 'propHit' || ev.type === 'knockdown') scareAt = ev.x;
}

/* ---------- Game flow ---------- */
function recordBest() {
  if (g.route && g.score > store.best[g.route]) { store.best[g.route] = g.score; saveStore(store); ui.setBest(store.best); }
}
function resetFx() { fx.particles.length = 0; fx.texts.length = 0; fx.rings.length = 0; fx.freeze = 0; fx.shake = 0; fx.hurt = 0; fx.flash = 0; }
function startRun(route) {
  selectRoute(g, route); audio.unlock(); resetFx(); command(g, 'start');
  tut.step = 0; tut.startX = g.player.x; prevEnergy = g.energy;
  audio.sfx('start'); vibrate([8, 25, 12]);
}
function toMenu() {
  recordBest(); const route = g.route; Object.assign(g, createGame(route, g.view)); resetFx();
  ui.resetMode(); ui.showScreen('menu'); rebuildScenery(); audio.playMusic('street');
}
function onAction(act) {
  if (!ready) return;
  audio.unlock();
  switch (act) {
    case 'pause': if (g.mode === 'play' || g.mode === 'paused') { command(g, 'pause'); if (g.mode === 'paused') audio.suspend(); else audio.resume(); } break;
    case 'resume': if (g.mode === 'paused') { command(g, 'pause'); audio.resume(); } break;
    case 'restart': command(g, 'restart'); audio.resume(); break;
    case 'quit': toMenu(); break;
    case 'next': case 'continue': command(g, 'continue'); break;
    case 'newgame': recordBest(); startRun(g.route); break;
    case 'giveup': command(g, 'giveup'); break;
    default: if (g.mode === 'play') command(g, act);
  }
}
function onSetting(key) {
  if (key === 'touch') store.touch = !touchOn();
  else store[key] = !store[key];
  if (key === 'music') audio.setMusic(store.music);
  if (key === 'sfx') audio.setSfx(store.sfx);
  if (key === 'haptics' && store.haptics) vibrate([12, 25, 12]);
  audio.sfx('ui'); saveStore(store); ui.setSettings(store, { touchAuto: coarse.matches });
  if (key === 'touch') fit();
}
const ui = createUi({
  store: () => store, reducedMotion: () => reducedMotion, onAction, onSetting,
  onPlay: route => { startRun(route); }, onUi: () => audio.sfx('ui')
});
const input = bindInput({
  pad: $('#pad'), buttons: [...document.querySelectorAll('.act')],
  onAction: act => { if (act === 'pause') onAction('pause'); else if (ready && g.mode === 'play') { audio.unlock(); command(g, act); } }
});

function suspend() {
  input.clear();
  if (g.mode === 'play') { command(g, 'pause'); }
  audio.suspend();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
window.addEventListener('blur', suspend);
window.addEventListener('pagehide', suspend);
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- First-run hints ---------- */
function tutorialTick() {
  if (tut.done || g.mode !== 'play' || g.chapterIndex !== 0) return;
  const keys = document.body.dataset.touch === '0';
  if (tut.step === 0) {
    ui.toast(keys ? 'WASD PARA MOVERTE' : 'ARRASTRÁ A LA IZQUIERDA PARA MOVERTE', 'hint', .3);
    if (Math.abs(g.player.x - tut.startX) > 36) tut.step = 1;
  } else if (tut.step === 1) {
    ui.toast(keys ? 'J = GOLPE · ¡TOCALO 3 VECES!' : 'TOCÁ GOLPE 3 VECES PARA EL COMBO', 'hint', .3);
    if (g.stats.maxCombo >= 3) { tut.step = 2; tut.t = 4.5; }
  } else if (tut.step === 2) {
    ui.toast(keys ? 'K = SALTO · SALTÁ Y GOLPEÁ EN EL AIRE' : 'SALTO + GOLPE = PATADA AÉREA', 'hint', .3);
    tut.t -= 1 / 60; if (tut.t <= 0) { tut.step = 3; tut.t = 5; }
  } else if (tut.step === 3) {
    ui.toast(keys ? 'CAMINÁ CONTRA UN ENEMIGO PARA AGARRARLO' : 'CAMINÁ CONTRA UN ENEMIGO PARA AGARRARLO · SALTO = ARROJAR', 'hint', .3);
    tut.t -= 1 / 60; if (tut.t <= 0 || g.stats.grabbed > 0) { tut.done = true; store.tutorial = true; saveStore(store); }
  }
}

/* ---------- Loop ---------- */
function frame(t) {
  const dt = last ? clamp((t - last) / 1000, 0, .05) : 0; last = t;
  if (ready) {
    let simDt = dt;
    if (fx.freeze > 0) { fx.freeze = Math.max(0, fx.freeze - dt); simDt = 0; }
    if (g.mode === 'play' && simDt > 0) update(g, simDt, input.state);
    for (const ev of drainEvents(g)) { fxEvent(fx, ev, { reducedMotion }); onSimEvent(ev); ui.onEvent(ev); }
    updateFx(fx, dt);
    if (g.mode !== 'paused') animTime += dt;
    if (scenery) updatePigeons(scenery, dt, g.camera.x, g.view, g.player.x, scareAt); scareAt = null;
    if (g.energy >= 45 && prevEnergy < 45 && g.mode === 'play') { audio.sfx('ready'); ui.toast('¡ESPECIAL LISTO!', 'hint', 1.3); }
    prevEnergy = g.energy;
    if (g.mode !== prevMode) {
      if (['won', 'gameover'].includes(g.mode)) recordBest();
      if (g.mode === 'lost') audio.sfx('hurt');
      prevMode = g.mode;
    }
    tutorialTick();
    if (scenery) draw(ctx, { g, fx, scenery, time: animTime, menu: g.mode === 'menu', reducedMotion });
    ui.update(g, fx, dt);
  }
  requestAnimationFrame(frame);
}

/* ---------- Boot ---------- */
const tips = [
  'TOCÁ GOLPE 3 VECES: JAB, CRUZADO Y PATADA QUE DERRIBA.', 'CUANDO EL PISO SE PONE NARANJA, SALÍ DE LA ZONA.', 'SALTÁ PARA ESQUIVAR LOS GOLPES BAJOS.',
  'ROMPÉ CAJAS Y TACHOS: SALEN MEDIALUNAS, MATE Y CHORIPÁN.', 'LOS ENEMIGOS CAÍDOS PUEDEN LLEVARSE POR DELANTE A SUS COMPAÑEROS.', 'EL ESPECIAL SE CARGA GOLPEANDO. ¡USALO CUANDO TE RODEEN!'
];
async function boot() {
  const started = performance.now(), fill = $('#bootFill'), status = $('#bootStatus'), bar = $('#bootBar');
  $('#bootTip').textContent = 'CONSEJO: ' + tips[Math.floor(Math.random() * tips.length)];
  const setProgress = (done, total, text) => {
    const pct = Math.round(done / total * 100);
    fill.style.width = pct + '%'; bar.setAttribute('aria-valuenow', String(pct)); status.textContent = `${text} ${pct}%`;
  };
  const total = 5 + 11 + 1; let done = 0;
  setProgress(0, total, 'CARGANDO');
  await Promise.all(['8px "Press Start 2P"', '8px Silkscreen', '700 8px Silkscreen'].map(f => document.fonts.load(f)));
  done += 3; setProgress(done, total, 'FUENTES');
  await loadSprites((d, n) => setProgress(done + d, total, 'SPRITES'));
  done += 11 + 2; setProgress(done, total, 'ESCENARIO');
  drawPortrait($('#portrait'));
  ui.setSettings(store, { touchAuto: coarse.matches }); ui.setBest(store.best);
  applyTouch(); fit();
  setProgress(total, total, 'LISTO');
  await new Promise(r => setTimeout(r, Math.max(0, 900 - (performance.now() - started))));
  status.textContent = 'LISTO'; const go = $('#bootGo'); go.hidden = false; go.focus({ preventScroll: true });
  await new Promise(resolve => { go.onclick = resolve; });
  audio.unlock(); audio.playMusic('street');
  $('#boot').hidden = true; document.body.classList.remove('booting');
  ready = true; fit(); ui.update(g, fx, 0);
}
boot().catch(error => { console.error(error); window.showBootError(); });
requestAnimationFrame(frame);

// Test/debug hook (read-only access to public state).
window.__misterM = { g, store, input };
