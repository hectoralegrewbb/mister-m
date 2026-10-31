// Procedural pixel-art backgrounds. Layers are prerendered once per (theme, view size) and scrolled with parallax.
// Animated touches (stars, neon, candles, pigeons) are drawn per frame on top.
import { tuning } from './config.js';

const FONT = '8px Silkscreen, monospace';
function rng(seed) { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const px = (c, color, x, y, w, h) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); };
function disc(c, color, cx, cy, r) { c.fillStyle = color; for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
function layer(w, h) { const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.ceil(w)); canvas.height = Math.max(1, Math.ceil(h)); const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; return [canvas, c]; }
function text(c, s, x, y, color, align = 'center') { c.font = FONT; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillStyle = color; c.fillText(s, Math.round(x), Math.round(y)); }

const themes = {
  plaza: { sky: ['#2b1b4f', '#4a2a6c', '#7b3a7f', '#b5527b', '#e5785f', '#f6a86b'], far: '#3a2a5e', mid: ['#4c3672', '#5d4585'], lit: '#f7cd73', floor: ['#6c5878', '#5e4c6b'], curb: '#8c7596', wall: '#493a64' },
  barrio: { sky: ['#0a0818', '#120d28', '#1b1238', '#271848', '#33205a', '#3f2a68'], far: '#1d1534', mid: ['#2c2148', '#382a58'], lit: '#ffd27a', floor: ['#2b2638', '#252032'], curb: '#5b4f70', wall: '#2a2142' },
  vigilia: { sky: ['#060d1a', '#0a1626', '#10213a', '#172d4c', '#1f3a5c', '#2b4a6c'], far: '#13203a', mid: ['#1e2f4c', '#27395a'], lit: '#ffc46a', floor: ['#3a3548', '#322e40'], curb: '#6a6080', wall: '#1d2b46' },
  casa: { sky: ['#2a0f1e', '#3a1428', '#4a1a30', '#5a2036', '#6a273c', '#7a2e42'], far: '#40162a', mid: ['#561c34', '#6a2440'], lit: '#ffd27a', floor: ['#4a2a3c', '#3c2132'], curb: '#d8b060', wall: '#5a2036' }
};

function building(c, x, baseY, w, h, body, lit, r, { shutters = false, roof = true } = {}) {
  px(c, body, x, baseY - h, w, h);
  px(c, '#00000033', x + w - 3, baseY - h, 3, h);
  if (roof) { px(c, '#ffffff18', x, baseY - h, w, 2); px(c, '#00000040', x - 1, baseY - h - 2, w + 2, 2); }
  const cols = Math.max(1, Math.floor((w - 6) / 10)), rows = Math.max(1, Math.floor((h - 10) / 14));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const wx = x + 5 + i * 10, wy = baseY - h + 8 + j * 14, on = r() < .45;
    px(c, on ? lit : '#00000044', wx, wy, 5, 7);
    if (on) px(c, '#ffffff33', wx, wy, 5, 1);
    if (shutters && !on) for (let k = 0; k < 7; k += 2) px(c, '#ffffff10', wx, wy + k, 5, 1);
  }
}

function sky(c, w, h, pal, floorTop) {
  const band = Math.ceil(floorTop / pal.length);
  pal.forEach((color, i) => { px(c, color, 0, i * band, w, band + 1); if (i) for (let x = 0; x < w; x += 2) px(c, pal[i], x + (i % 2), i * band - 1, 1, 1); });
}

function lamp(c, x, baseY, h, color = '#1c1630', glow = '#ffd27a') {
  px(c, color, x, baseY - h, 3, h); px(c, color, x - 5, baseY - h, 12, 2); px(c, glow, x - 5, baseY - h + 2, 4, 2);
  for (let i = 1; i <= 4; i++) { c.globalAlpha = .05; px(c, glow, x - 5 - i * 3, baseY - h + 2 + i * 3, 4 + i * 6, 3); c.globalAlpha = 1; }
}

function floor(c, w, h, floorTop, t, kind, r) {
  px(c, t.curb, 0, floorTop, w, 3); px(c, '#00000055', 0, floorTop + 3, w, 1);
  const bottom = h;
  px(c, t.floor[0], 0, floorTop + 4, w, bottom - floorTop - 4);
  if (kind === 'tiles') {
    for (let row = 0, y = floorTop + 4; y < bottom; row++, y += 10 + row) {
      px(c, t.floor[1], 0, y, w, 1);
      for (let x = (row % 2) * 12; x < w; x += 24) px(c, t.floor[1], x, y, 1, 10 + row);
    }
  } else if (kind === 'asphalt') {
    for (let i = 0; i < w / 6; i++) px(c, '#ffffff0c', r() * w, floorTop + 8 + r() * (bottom - floorTop - 10), 2, 1);
    for (let x = 200; x < w; x += 520) for (let i = 0; i < 6; i++) { c.globalAlpha = .55; px(c, '#e8e0f0', x + i * 14, floorTop + 14, 8, bottom - floorTop - 18); c.globalAlpha = 1; }
  } else if (kind === 'marble') {
    for (let y = floorTop + 4, row = 0; y < bottom; y += 14, row++) for (let x = (row % 2) * 14; x < w; x += 28) px(c, t.floor[1], x, y, 14, 14);
    px(c, '#9c2338', 0, floorTop + 16, w, bottom - floorTop - 28); px(c, '#d8b060', 0, floorTop + 16, w, 1); px(c, '#d8b060', 0, bottom - 13, w, 1);
  }
  px(c, '#00000040', 0, bottom - 2, w, 2);
}

function paintPlaza(L, view, worldW, floorTop, t) {
  const r = rng(11);
  // far: skyline + obelisk
  const [, f] = [0, L.far.c];
  for (let x = 0, i = 0; x < L.far.w; i++) { const w = 26 + r() * 30, h = 40 + r() * 70; px(f, t.far, x, floorTop - h, w, h + 6); x += w + 2; }
  const ox = L.far.w * .55; px(f, '#46346a', ox, floorTop - 150, 7, 156); for (let i = 0; i < 6; i++) px(f, '#46346a', ox + 1 + (i < 3 ? 0 : 1), floorTop - 156 - i, 5 - Math.floor(i / 2), 1); px(f, '#7a5a98', ox, floorTop - 150, 1, 156);
  // mid: apartment blocks + tree line
  const m = L.mid.c;
  for (let x = 0, i = 0; x < L.mid.w; i++) { const w = 40 + r() * 34, h = 60 + r() * 60; building(m, x, floorTop + 2, w, h, t.mid[i % 2], t.lit, r); x += w + 4 + r() * 12; }
  // near: casa de gobierno, kiosk, lamps, trees
  const n = L.near.c, palaceX = 470;
  px(n, '#c98a9c', palaceX, floorTop - 76, 190, 78); px(n, '#e3a8b4', palaceX - 6, floorTop - 80, 202, 5); px(n, '#a8667c', palaceX, floorTop - 4, 190, 6);
  for (let i = 0; i < 8; i++) { px(n, '#f0c4cc', palaceX + 10 + i * 22, floorTop - 70, 8, 66); px(n, '#a8667c', palaceX + 16 + i * 22, floorTop - 70, 2, 66); }
  for (let i = 0; i < 3; i++) { px(n, '#3a2438', palaceX + 62 + i * 30, floorTop - 38, 16, 34); px(n, '#6b4660', palaceX + 62 + i * 30, floorTop - 38, 16, 2); }
  for (let i = 0; i < 12; i++) px(n, '#c98a9c', palaceX + 52 + i * 7, floorTop - 98 + Math.abs(6 - i) * 2, 7, 22 - Math.abs(6 - i) * 2);
  px(n, '#e3a8b4', palaceX + 52, floorTop - 100, 84, 3); px(n, '#cfd8e8', palaceX + 94, floorTop - 126, 2, 28); px(n, '#8fc0e6', palaceX + 96, floorTop - 126, 16, 5); px(n, '#fff', palaceX + 96, floorTop - 123, 16, 2); px(n, '#8fc0e6', palaceX + 96, floorTop - 121, 16, 3);
  px(n, '#4e3657', 30, floorTop - 46, 100, 48); px(n, '#ad617d', 30, floorTop - 52, 100, 10); text(n, 'KIOSCO 24H', 80, floorTop - 44, '#f5d5af'); px(n, '#221a2e', 42, floorTop - 34, 76, 32); px(n, '#d5fa47', 44, floorTop - 30, 72, 2);
  for (let x = 250; x < L.near.w - 100; x += 310) lamp(n, x, floorTop + 2, 70);
  for (const x of [330, 790, 1020]) { px(n, '#3a2230', x, floorTop - 34, 5, 38); disc(n, '#2f6a58', x + 2, floorTop - 46, 18); disc(n, '#3d8a70', x - 4, floorTop - 50, 11); disc(n, '#245a4a', x + 9, floorTop - 40, 9); }
  px(n, '#5a4468', 640, floorTop - 12, 40, 3); px(n, '#3a2c48', 642, floorTop - 9, 3, 10); px(n, '#3a2c48', 675, floorTop - 9, 3, 10);
}

function paintBarrio(L, view, worldW, floorTop, t) {
  const r = rng(23), f = L.far.c, m = L.mid.c, n = L.near.c;
  for (let x = 0; x < L.far.w; ) { const w = 22 + r() * 26, h = 36 + r() * 80; px(f, t.far, x, floorTop - h, w, h + 6); x += w + 1; }
  for (let x = 0, i = 0; x < L.mid.w; i++) { const w = 44 + r() * 30, h = 70 + r() * 70; building(m, x, floorTop + 2, w, h, t.mid[i % 2], t.lit, r, { shutters: true }); px(m, '#00000066', x + 8, floorTop - h - 8, 1, 8); x += w + 3; }
  const shops = [['ALMACÉN', '#8c3a56', '#f0d8a8'], ['TALLER PYME', '#2f5f78', '#d8e8f0'], ['BAR', '#4a2a6a', '#ff7bb8'], ['KIOSCO', '#3a6a4a', '#d8f0b0'], ['PANADERÍA', '#8a5a2a', '#ffe0a8'], ['FERRETERÍA', '#5a4a7a', '#e0d0ff']];
  let x = 8;
  for (let i = 0; x < L.near.w - 60; i++) {
    const [name, body, accent] = shops[i % shops.length], w = 84 + (i % 3) * 14, h = 62 + (i % 2) * 8;
    px(n, t.wall, x, floorTop - h, w, h + 2); px(n, '#00000040', x + w - 3, floorTop - h, 3, h);
    px(n, body, x + 4, floorTop - h + 6, w - 8, 12); text(n, name, x + w / 2, floorTop - h + 15, accent);
    const shut = i % 3 === 1;
    px(n, shut ? '#4a4258' : '#17121f', x + 8, floorTop - 40, w - 16, 38);
    if (shut) for (let y = floorTop - 40; y < floorTop - 2; y += 3) px(n, '#5e5574', x + 8, y, w - 16, 1); else { px(n, '#ffd27a33', x + 8, floorTop - 40, w - 16, 38); px(n, '#ffd27a', x + 12, floorTop - 36, 14, 10); }
    for (let k = 0; k < w - 8; k += 8) px(n, k % 16 ? '#e8e0f0' : body, x + 4 + k, floorTop - 42, 8, 5);
    if (i % 4 === 2) { px(n, '#d5fa47', x + 14, floorTop - 28, 3, 12); px(n, '#ff7bb8', x + 24, floorTop - 24, 8, 2); }
    x += w + 6;
  }
  for (let lx = 160; lx < L.near.w - 60; lx += 340) lamp(n, lx, floorTop + 2, 74);
  L.neon = []; x = 8; for (let i = 0; x < L.near.w - 60; i++) { const w = 84 + (i % 3) * 14; if (i % 6 === 2) L.neon.push({ x: x + 4, y: floorTop - 62 + 6, w: w - 8, h: 12 }); x += w + 6; }
}

function paintVigilia(L, view, worldW, floorTop, t) {
  const r = rng(37), f = L.far.c, m = L.mid.c, n = L.near.c;
  for (let x = 0; x < L.far.w; ) { const w = 24 + r() * 30, h = 30 + r() * 70; px(f, t.far, x, floorTop - h, w, h + 6); x += w + 1; }
  for (let x = 0, i = 0; x < L.mid.w; i++) { const w = 46 + r() * 30, h = 56 + r() * 50; building(m, x, floorTop + 2, w, h, t.mid[i % 2], t.lit, r); x += w + 6 + r() * 14; }
  const signs = ['EDUCACIÓN', 'JUBILACIÓN', 'TECHO', 'TRABAJO'];
  for (let x = 40, i = 0; x < L.near.w - 100; x += 170, i++) {
    if (i % 2 === 0) { // tent
      px(n, '#d8d0c0', x, floorTop - 38, 84, 40); for (let k = 0; k < 42; k++) px(n, '#d8d0c0', x + k, floorTop - 38 - Math.floor((42 - Math.abs(k - 21)) / 4), 1, 1 + Math.floor((42 - Math.abs(k - 21)) / 4));
      px(n, '#b0a898', x + 42, floorTop - 50, 1, 52); px(n, '#2a2236', x + 28, floorTop - 24, 28, 24); px(n, '#6a8fd0', x, floorTop - 38, 84, 4);
    } else { // banner between poles
      px(n, '#3a2c48', x, floorTop - 70, 3, 72); px(n, '#3a2c48', x + 100, floorTop - 70, 3, 72);
      px(n, '#d5fa47', x + 3, floorTop - 66, 97, 24); px(n, '#00000033', x + 3, floorTop - 44, 97, 2); text(n, signs[(i >> 1) % signs.length], x + 52, floorTop - 49, '#1b1330');
    }
  }
  for (let x = 0; x < L.near.w; x += 18) px(n, '#8a8fa8', x, floorTop - 6, 1, 8);
  px(n, '#8a8fa8', 0, floorTop - 6, L.near.w, 1); px(n, '#8a8fa8', 0, floorTop - 1, L.near.w, 1);
  L.candles = []; for (let x = 60; x < L.near.w - 20; x += 24 + (x % 3) * 7) L.candles.push({ x, y: floorTop + 10 + (x * 7) % 52 });
}

function paintCasa(L, view, worldW, floorTop, t) {
  const n = L.near.c, w = L.near.w, f = L.far.c, m = L.mid.c;
  px(f, '#34121f', 0, 0, L.far.w, floorTop);
  for (let x = 0; x < L.mid.w; x += 120) { px(m, '#1a1030', x + 20, 24, 56, floorTop - 28); for (let k = 0; k < 28; k++) px(m, '#1a1030', x + 20 + k * 2, 24 - Math.floor(Math.sqrt(28 * 28 - (k - 14) * (k - 14) * 1.0)) / 3, 2, 3); px(m, '#2b2a66', x + 24, 30, 48, floorTop - 38); px(m, '#ffffff22', x + 24, 30, 48, 2); for (let k = 0; k < 6; k++) px(m, '#ffffff55', x + 30 + (k * 29) % 40, 40 + (k * 17) % 40, 1, 1); }
  px(n, t.wall, 0, 0, w, floorTop);
  for (let x = 40; x < w; x += 120) { px(n, '#d8b060', x - 8, 0, 20, 6); px(n, '#8a2a40', x - 5, 6, 14, floorTop - 12); px(n, '#c14a62', x - 5, 6, 3, floorTop - 12); px(n, '#d8b060', x - 8, floorTop - 6, 20, 6); }
  for (let x = 100; x < w; x += 240) { px(n, '#00000055', x, 0, 1, 18); px(n, '#d8b060', x - 12, 18, 25, 3); for (let k = -2; k <= 2; k++) px(n, '#ffe9a8', x + k * 5, 14 + Math.abs(k), 2, 3); }
  px(n, '#b8902f', 0, floorTop - 3, w, 3);
}

const painters = { plaza: paintPlaza, barrio: paintBarrio, vigilia: paintVigilia, casa: paintCasa };
const floorKinds = { plaza: 'tiles', barrio: 'asphalt', vigilia: 'tiles', casa: 'marble' };

export function createScenery(themeId, view, worldW) {
  const t = themes[themeId] || themes.plaza, floorTop = view.h - tuning.lane - 14;
  const L = { floorTop, themeId, view: { ...view } };
  const make = (factor, name) => { const w = worldW * factor + view.w + 32, [canvas, c] = layer(w, view.h); L[name] = { canvas, c, w, factor }; };
  make(.22, 'far'); make(.55, 'mid'); make(1, 'near');
  const [skyCanvas, sc] = layer(view.w, view.h); sky(sc, view.w, view.h, t.sky, floorTop);
  if (themeId === 'plaza') { disc(sc, '#ffcf7a', view.w * .72, floorTop - 20, 26); disc(sc, '#ffe7a8', view.w * .72, floorTop - 20, 20); }
  if (themeId === 'barrio' || themeId === 'vigilia') { disc(sc, '#e8e4ff', view.w * .2, 40, 11); disc(sc, t.sky[1], view.w * .2 + 5, 37, 10); }
  L.sky = skyCanvas;
  painters[themeId] ? painters[themeId](L, view, worldW, floorTop, t) : painters.plaza(L, view, worldW, floorTop, t);
  floor(L.near.c, L.near.w, view.h, floorTop, t, floorKinds[themeId] || 'tiles', rng(5));
  // twinkling stars (night themes) and pigeons (plaza)
  const r = rng(99);
  L.stars = themeId === 'plaza' ? [] : Array.from({ length: 34 }, () => ({ x: r() * view.w, y: 4 + r() * (floorTop * .5), p: r() * 6 }));
  L.pigeons = themeId === 'plaza' ? Array.from({ length: 5 }, (_, i) => ({ x: 120 + i * 190 + r() * 60, y: 10 + r() * 50, state: 'peck', t: r() * 3, vx: 0, vy: 0, away: 0 })) : [];
  L.worldW = worldW;
  return L;
}

export function drawScenery(ctx, L, camX, time, view) {
  ctx.drawImage(L.sky, 0, 0);
  for (const s of L.stars) { const on = Math.floor(time * 2 + s.p) % 5 !== 0; if (on) { ctx.fillStyle = '#e8e4ff'; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); } }
  for (const name of ['far', 'mid', 'near']) { const l = L[name]; ctx.drawImage(l.canvas, -Math.round(camX * l.factor), 0); }
  if (L.neon) { // flicker: a soft glow over some shop signs
    const on = Math.floor(time * 7) % 11 !== 0;
    ctx.fillStyle = on ? '#ff7bb833' : '#ff7bb808';
    for (const n of L.neon) ctx.fillRect(Math.round(n.x - camX), n.y, n.w, n.h);
  }
  if (L.candles) {
    for (const c of L.candles) {
      const x = Math.round(c.x - camX); if (x < -4 || x > view.w + 4) continue;
      ctx.fillStyle = '#e8e0d0'; ctx.fillRect(x, c.y, 2, 3); ctx.fillStyle = Math.floor(time * 9 + c.x) % 3 ? '#ffb347' : '#ffe07a'; ctx.fillRect(x, c.y - 2, 2, 2);
    }
  }
}

// Pigeons live in world space and flee when the fight comes near.
export function updatePigeons(L, dt, camX, view, playerX, scareAt) {
  for (const b of L.pigeons) {
    if (scareAt !== null && b.state === 'peck' && Math.abs(b.x - scareAt) < 70) { b.state = 'fly'; b.vx = (b.x < scareAt ? -1 : 1) * (60 + (b.x * 7) % 30); b.vy = -50; b.away = 5 + (b.x % 3); }
    if (b.state === 'fly') { b.x += b.vx * dt; b.y += b.vy * dt; b.away -= dt; if (b.away <= 0) { b.state = 'peck'; b.x = camX + 40 + ((b.x * 13) % (view.w - 80)); b.y = 10 + (b.x * 5) % 50; } }
    else { b.t += dt; if (Math.abs(b.x - playerX) < 22) { b.state = 'fly'; b.vx = b.x < playerX ? -70 : 70; b.vy = -55; b.away = 5; } }
  }
}
export function drawPigeons(ctx, L, camX, time, floorTop) {
  for (const b of L.pigeons) {
    const x = Math.round(b.x - camX), y = Math.round(b.state === 'fly' ? floorTop + 10 + b.y : floorTop + 10 + b.y);
    const fly = b.state === 'fly', flap = Math.floor(time * 14 + b.x) % 2;
    ctx.fillStyle = '#9a96ac'; ctx.fillRect(x, y - 4, 6, 3); ctx.fillStyle = '#7c7890'; ctx.fillRect(x + 4, y - 6, 3, 3); ctx.fillStyle = '#f0b060'; ctx.fillRect(x + 7, y - 5, 1, 1);
    if (fly) { ctx.fillStyle = '#b8b4c8'; ctx.fillRect(x + 1, y - (flap ? 8 : 2), 4, 2); } else if (Math.floor(b.t * 3) % 4 === 0) { ctx.fillStyle = '#7c7890'; ctx.fillRect(x + 6, y - 4, 2, 2); }
    if (!fly) { ctx.fillStyle = '#f0b060'; ctx.fillRect(x + 1, y - 1, 1, 2); ctx.fillRect(x + 3, y - 1, 1, 2); }
  }
}
