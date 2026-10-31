// DOM layer: HUD, banners, toasts, menus and result screens. Reads public game state; reports intent through handlers.
import { renderPie, lifeSlices, energySlices } from './pie.js';

const $ = selector => document.querySelector(selector);
const pad6 = n => String(Math.max(0, Math.floor(n))).padStart(6, '0');
const bossNames = { local: 'EL TITIRITERO', global: 'EL MAGNATE' };

export function createUi(handlers) {
  const dom = {
    app: $('#app'), sheet: $('#sheet'), hud: $('#hud'), banner: $('#banner'), bannerOrder: $('#bannerOrder'), bannerTitle: $('#bannerTitle'),
    toast: $('#toast'), hpText: $('#hpText'), lifePie: $('#lifePie'), energyPie: $('#energyPie'), targetPie: $('#targetPie'), loot: $('#loot'), rsLoot: $('#rsLoot'),
    score: $('#score'), combo: $('#combo'), pause: $('#pause'), target: $('#target'), targetName: $('#targetName'),
    portrait: $('#portrait'), fxHurt: $('#fxHurt'), fxFlash: $('#fxFlash'), pad: $('#pad'),
    resultTag: $('#resultTag'), resultTitle: $('#resultTitle'), resultRank: $('#resultRank'), resultText: $('#resultText'), resultMain: $('#resultMain'), resultAlt: $('#resultAlt'),
    rsScore: $('#rsScore'), rsDamage: $('#rsDamage'), rsCombo: $('#rsCombo'), rsWithdrawn: $('#rsWithdrawn'), rsStrikes: $('#rsStrikes'),
    countdown: $('#countdown'), credits: $('#credits'), bestLine: $('#bestLine'), bestLocal: $('#bestLocal'), bestGlobal: $('#bestGlobal')
  };
  const cache = new Map(), screens = [...document.querySelectorAll('[data-screen]')];
  let trail = 100, hurtFlash = 0, time = 0, screen = null, backTo = 'menu', lastMode = '', toastT = 0, bannerT = 0, targetId = null, targetT = 0, countdown = 0, comboPrev = 0;

  const setText = (el, value) => { value = String(value); if (cache.get(el) !== value) { cache.set(el, value); el.textContent = value; } };
  const setWidth = (el, pct) => { const v = Math.round(pct) + '%'; if (cache.get(el) !== v) { cache.set(el, v); el.style.width = v; } };

  function showScreen(name) {
    screen = name;
    dom.sheet.hidden = !name;
    dom.sheet.dataset.for = name || '';
    for (const s of screens) s.hidden = s.dataset.screen !== name;
    const first = name && dom.sheet.querySelector(`[data-screen="${name}"] .btn.primary, [data-screen="${name}"] .btn`);
    if (first && document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function toast(text, kind = 'info', seconds = 2) { dom.toast.textContent = text; dom.toast.dataset.kind = kind; dom.toast.hidden = false; toastT = seconds; }

  function showBanner(title, order) {
    dom.bannerTitle.textContent = title; dom.bannerOrder.textContent = order.toUpperCase();
    dom.banner.hidden = false; dom.banner.style.animation = 'none'; void dom.banner.offsetWidth; dom.banner.style.animation = ''; bannerT = 2.4;
  }

  function setSettings(s, { touchAuto }) {
    const show = (key, on) => {
      const b = document.querySelector(`[data-setting="${key}"]`); if (!b) return;
      b.setAttribute('aria-pressed', String(on)); b.querySelector('b').textContent = on ? 'SÍ' : 'NO';
    };
    show('music', s.music); show('sfx', s.sfx); show('haptics', s.haptics); show('lefty', s.lefty); show('touch', s.touch ?? touchAuto);
    dom.app.classList.toggle('lefty', s.lefty);
  }
  function setBest(best) {
    dom.bestLine.textContent = 'RÉCORD ' + pad6(Math.max(best.local, best.global));
    dom.bestLocal.textContent = 'RÉCORD ' + pad6(best.local); dom.bestGlobal.textContent = 'RÉCORD ' + pad6(best.global);
  }

  // Clicks are delegated: data-act on buttons, data-route on route cards, data-setting on toggles.
  dom.sheet.addEventListener('click', event => {
    const el = event.target.closest('[data-act],[data-route],[data-setting]');
    if (!el) return;
    if (el.dataset.route) return handlers.onPlay(el.dataset.route);
    if (el.dataset.setting) return handlers.onSetting(el.dataset.setting);
    const act = el.dataset.act;
    if (act === 'play') showScreen('route');
    else if (act === 'howto' || act === 'settings') { backTo = screen; showScreen(act); handlers.onUi?.(); }
    else if (act === 'back') showScreen(backTo === 'pause' ? 'pause' : 'menu');
    else handlers.onAction(act);
    if (act !== 'play') handlers.onUi?.();
  });
  dom.pause.addEventListener('click', () => handlers.onAction('pause'));

  function pie(canvas, key, draw) {
    if (cache.get(canvas) === key) return; cache.set(canvas, key);
    const c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height); draw(c);
  }

  function buildResult(g, store) {
    const r = g.result, boss = bossNames[g.route];
    let tag = 'CAPÍTULO COMPLETO', title = r?.title || '', text = g.chapter.aftermath, main = 'SIGUIENTE >', act = 'next', alt = false;
    if (g.mode === 'reveal') {
      tag = 'ACTO FINAL / LOS HILOS DEL PODER'; title = 'NUNCA ESTUVISTE SOLO';
      text = `${g.consequences.withdrawn} personas se retiraron y diste ${g.consequences.strikes} golpes antes de llegar. Tus bolsillos pesan: U$S ${g.loot} en sobres que nadie recuerda haber pedido. Entonces ves los hilos sobre tus manos. ${boss} aparece detrás del telón. Podés obedecer… o cortar los hilos.`;
      main = 'CORTAR LOS HILOS >';
    } else if (g.mode === 'won') {
      tag = g.route === 'local' ? 'FINAL / SIN DUEÑO' : 'FINAL / SIN FRONTERAS'; title = 'LOS HILOS SE CORTAN';
      text = `Mister M vence a ${boss}. Por primera vez, la siguiente decisión es suya. Puntaje final: ${g.score}. Botín: U$S ${g.loot}.${g.score >= Math.max(store.best.local, store.best.global) ? ' ¡Nuevo récord!' : ''} Probá la otra alianza para ver el segundo final.`;
      main = 'OTRA PARTIDA >'; act = 'newgame'; alt = true;
    } else if (g.mode === 'gameover') {
      tag = 'FIN DEL JUEGO'; title = 'CAÍSTE'; text = `Puntaje: ${g.score}. Esquivá la zona naranja, saltá los golpes bajos y usá el especial cuando el cerco se cierre.`;
      main = 'REINTENTAR >'; act = 'newgame'; alt = true;
    }
    dom.resultTag.textContent = tag; dom.resultTitle.textContent = title; dom.resultText.textContent = text;
    dom.resultMain.textContent = main; dom.resultMain.dataset.act = act; dom.resultAlt.hidden = !alt;
    if (r) {
      dom.resultRank.textContent = r.rank; dom.resultRank.dataset.rank = r.rank; dom.resultRank.style.animation = 'none'; void dom.resultRank.offsetWidth; dom.resultRank.style.animation = '';
      dom.rsScore.textContent = r.gained; dom.rsDamage.textContent = r.damage; dom.rsCombo.textContent = r.maxCombo; dom.rsLoot.textContent = r.loot; dom.rsWithdrawn.textContent = r.withdrawn; dom.rsStrikes.textContent = r.strikes;
    }
    dom.resultRank.parentElement.hidden = !r || g.mode === 'gameover';
  }

  // Called when g.mode changes (or after the boot gate).
  function syncMode(g, store) {
    document.body.dataset.play = g.mode === 'play' ? '1' : '0';
    dom.app.dataset.mode = g.mode;
    if (g.mode === 'menu') { dom.hud.hidden = true; if (!['menu', 'route', 'howto', 'settings'].includes(screen)) showScreen('menu'); }
    else if (g.mode === 'play') { showScreen(null); dom.hud.hidden = false; }
    else if (g.mode === 'paused') { showScreen('pause'); }
    else if (g.mode === 'lost') { countdown = 9.99; dom.credits.textContent = g.credits; showScreen('continue'); }
    else if (['clear', 'reveal', 'won', 'gameover'].includes(g.mode)) { buildResult(g, store); showScreen('result'); }
  }

  function update(g, fx, dt) {
    if (g.mode !== lastMode) { lastMode = g.mode; syncMode(g, handlers.store()); }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) dom.toast.hidden = true; }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) dom.banner.hidden = true; }
    if (g.mode === 'lost') {
      countdown -= dt; setText(dom.countdown, Math.max(0, Math.ceil(countdown)));
      if (countdown <= 0) handlers.onAction('giveup');
    }
    dom.fxHurt.style.opacity = String(Math.min(1, fx.hurt / .3));
    dom.fxFlash.style.opacity = String(Math.min(1, fx.flash * 1.6));
    if (g.mode !== 'play' && g.mode !== 'paused') return;
    const p = g.player, hp = Math.max(0, Math.ceil(p.hp));
    time += dt; if (fx.hurt > .25) hurtFlash = .25; hurtFlash = Math.max(0, hurtFlash - dt);
    trail = hp >= trail ? hp : Math.max(hp, trail - 30 * dt);
    const low = hp <= 30 && Math.floor(time * 4) % 2 === 0, tr = Math.round(trail);
    pie(dom.lifePie, `${hp}|${tr}|${low}`, c => renderPie(c, 17, 10, 14, 8, 3, lifeSlices(hp / 100, tr / 100).map((s, i) => (i === 0 && low ? { ...s, top: '#ff7b80' } : s))));
    const ready = g.energy >= 45, en = Math.round(g.energy);
    pie(dom.energyPie, `${en}|${ready}`, c => renderPie(c, 12, 7, 10, 6, 2, energySlices(en / 100, ready)));
    dom.energyPie.classList.toggle('ready', ready);
    dom.lifePie.setAttribute('aria-label', `Vida ${hp} de 100`); dom.energyPie.setAttribute('aria-label', `Energía ${en}%${ready ? ', especial listo' : ''}`);
    setText(dom.hpText, hp);
    setText(dom.loot, Math.round(g.loot).toLocaleString('es-AR'));
    setText(dom.score, pad6(g.score));
    const comboText = g.combo > 1 ? `${g.combo} HITS` : '';
    setText(dom.combo, comboText);
    if (g.combo > comboPrev && g.combo > 1 && !handlers.reducedMotion()) { dom.combo.classList.remove('pop'); void dom.combo.offsetWidth; dom.combo.classList.add('pop'); }
    comboPrev = g.combo;
    // Enemy panel: boss always; otherwise the last struck enemy for a short time.
    const boss = g.enemies.find(e => e.boss && !e.dead);
    let shown = boss || (targetT > 0 ? g.enemies.find(e => e.id === targetId) : null);
    if (targetT > 0) targetT -= dt;
    dom.target.hidden = !shown;
    if (shown) {
      setText(dom.targetName, shown.label); const f = Math.round(shown.hp / shown.maxHp * 100);
      pie(dom.targetPie, 'e' + f, c => renderPie(c, 15, 9, 13, 8, 3, [{ frac: f / 100, top: '#ff9aa2', side: '#a8404c' }, { frac: 1 - f / 100, top: '#3a2a52', side: '#241a34', explode: 1.5 }]));
    }
    for (const b of document.querySelectorAll('.act')) {
      const need = b.dataset.key === 'special' ? 45 : b.dataset.key === 'dodge' ? 18 : 0;
      b.setAttribute('aria-disabled', String(g.mode !== 'play' || g.energy < need));
      if (b.dataset.key === 'special') b.classList.toggle('ready', g.energy >= 45);
    }
    dom.pad.setAttribute('aria-disabled', String(g.mode !== 'play'));
  }

  function onEvent(ev) {
    if (ev.type === 'hit' && ev.id) { targetId = ev.id; targetT = 2.6; }
    if (ev.type === 'chapterStart') showBanner(ev.title, ev.order);
    if (ev.type === 'grab' && ev.first) toast('GOLPE = RODILLAZO · SALTO = ARROJAR', 'hint', 3);
    if (ev.type === 'denied') {
      const b = document.querySelector(`.act[data-key="${ev.action}"]`);
      if (b) { b.classList.remove('denied'); void b.offsetWidth; b.classList.add('denied'); }
      toast(`SIN ENERGÍA · NECESITÁS ${ev.need}`, 'error', 1.2);
    }
  }

  return { showScreen, toast, update, onEvent, setSettings, setBest, syncMode, dom, resetMode() { lastMode = ''; } };
}
