// Canvas renderer. Reads public game state + fx; draws at internal pixel resolution (integer-scaled by CSS).
import { drawFrame, frameInfo } from './sprites.js';
import { heroPose, enemyPose } from './poses.js';
import { drawScenery, drawPigeons } from './scenery.js';
import { shakeOffset } from './fx.js';
import { renderPie } from './pie.js';

const UI_FONT = '8px "Press Start 2P", monospace', SMALL_FONT = '8px Silkscreen, monospace';
const rect = (c, color, x, y, w, h) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); };

function label(c, s, x, y, color, font = UI_FONT) {
  c.font = font; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillStyle = '#140e1e';
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) c.fillText(s, Math.round(x) + dx, Math.round(y) + dy);
  c.fillStyle = color; c.fillText(s, Math.round(x), Math.round(y));
}

function shadow(c, x, y, z, big) {
  const w = Math.max(8, (big ? 34 : 26) - Math.floor(z / 3)), h = z > 20 ? 3 : 5;
  c.fillStyle = '#120a1e88';
  c.fillRect(Math.round(x - w / 2 + 2), Math.round(y - Math.floor(h / 2)), w - 4, h);
  c.fillRect(Math.round(x - w / 2), Math.round(y - Math.floor(h / 2)) + 1, w, Math.max(1, h - 2));
}

function drawProp(c, p, x, y, time) {
  const sh = p.shake > 0 ? (Math.floor(time * 60) % 2 ? 1 : -1) : 0, ox = x + sh;
  const alpha = p.broken ? Math.max(0, p.fade / .35) : 1; c.globalAlpha = alpha;
  if (p.type === 'crate') {
    rect(c, '#b8844a', ox - 8, y - 14, 16, 14); rect(c, '#8c5f30', ox - 8, y - 14, 16, 2); rect(c, '#8c5f30', ox - 8, y - 2, 16, 2);
    rect(c, '#8c5f30', ox - 8, y - 14, 2, 14); rect(c, '#8c5f30', ox + 6, y - 14, 2, 14); rect(c, '#9a6c3a', ox - 6, y - 8, 12, 2); rect(c, '#d8a868', ox - 6, y - 12, 12, 1);
  } else if (p.type === 'bin') {
    rect(c, '#6a7a8c', ox - 6, y - 16, 12, 16); rect(c, '#8a9aac', ox - 7, y - 18, 14, 3); rect(c, '#566474', ox - 6, y - 12, 12, 1); rect(c, '#566474', ox - 6, y - 7, 12, 1); rect(c, '#9aaabc', ox - 5, y - 16, 1, 14);
  } else {
    rect(c, '#c63a4a', ox - 11, y - 20, 22, 8); rect(c, '#f0e0c0', ox - 11, y - 20, 22, 2); rect(c, '#6a4a30', ox - 10, y - 12, 20, 9);
    rect(c, '#2a2030', ox - 8, y - 3, 4, 3); rect(c, '#2a2030', ox + 4, y - 3, 4, 3); rect(c, '#ffb347', ox - 4, y - 17, 8, 2);
  }
  c.globalAlpha = 1;
}

function drawPickup(c, it, x, y, time) {
  const bob = it.landed ? Math.round(Math.sin(time * 6 + it.id) * 1.5) : 0, yy = y - Math.round(it.z) - 8 + bob;
  if (it.life < 3 && Math.floor(time * 10) % 2) return;
  rect(c, '#120a1e66', x - 6, y - 1, 12, 2);
  const t = it.type;
  if (t === 'medialuna') { rect(c, '#e0a24a', x - 6, yy + 2, 12, 4); rect(c, '#c8822a', x - 4, yy, 8, 2); rect(c, '#f6c878', x - 3, yy + 3, 3, 1); rect(c, '#c8822a', x - 6, yy + 5, 2, 2); rect(c, '#c8822a', x + 4, yy + 5, 2, 2); }
  else if (t === 'mate') { rect(c, '#4a7a3a', x - 4, yy, 8, 7); rect(c, '#7aaa5a', x - 4, yy, 8, 2); rect(c, '#d8d8e0', x + 2, yy - 6, 1, 7); rect(c, '#d8d8e0', x + 2, yy - 6, 3, 1); }
  else if (t === 'choripan') { rect(c, '#e8c078', x - 7, yy + 1, 14, 5); rect(c, '#a8472a', x - 6, yy, 12, 3); rect(c, '#ffe0a0', x - 6, yy + 5, 12, 1); }
  else if (t === 'asado') { rect(c, '#a8382a', x - 7, yy, 14, 7); rect(c, '#d8604a', x - 5, yy + 1, 8, 3); rect(c, '#f0e0c0', x + 3, yy + 2, 3, 3); }
  else if (t === 'dolar') { rect(c, '#2f6a44', x - 7, yy + 1, 14, 7); rect(c, '#5aa468', x - 6, yy + 2, 12, 5); rect(c, '#a8e0b0', x - 2, yy + 3, 4, 3); rect(c, '#2f6a44', x - 1, yy + 4, 2, 1); rect(c, '#a8e0b0', x - 6, yy + 2, 2, 1); }
  else if (t === 'sobre') { rect(c, '#8a6a3a', x - 7, yy, 14, 9); rect(c, '#d8b878', x - 6, yy + 1, 12, 7); rect(c, '#b8924e', x - 6, yy + 1, 12, 1); rect(c, '#b8924e', x - 5, yy + 2, 10, 1); rect(c, '#b8924e', x - 3, yy + 3, 6, 1); rect(c, '#5aa468', x + 1, yy - 2, 5, 3); rect(c, '#a8e0b0', x + 2, yy - 1, 2, 1); }
  else if (t === 'bono') { rect(c, '#3a4a78', x - 6, yy, 12, 9); rect(c, '#f0ecdc', x - 5, yy + 1, 10, 7); rect(c, '#b8b4a4', x - 4, yy + 2, 6, 1); rect(c, '#b8b4a4', x - 4, yy + 4, 8, 1); rect(c, '#ffd36a', x + 1, yy + 5, 3, 3); rect(c, '#c8402a', x + 2, yy + 6, 1, 1); }
  else if (t === 'lingote') { rect(c, '#a8742a', x - 7, yy + 3, 14, 5); rect(c, '#ffd36a', x - 6, yy + 1, 12, 5); rect(c, '#fff0a8', x - 5, yy + 1, 8, 1); rect(c, '#c8922a', x - 6, yy + 5, 12, 1); rect(c, '#a8742a', x - 7, yy + 3, 1, 1); }
  else { rect(c, '#2a1c14', x - 8, yy + 1, 16, 10); rect(c, '#6a4a2e', x - 7, yy + 2, 14, 8); rect(c, '#8a6a46', x - 7, yy + 2, 14, 2); rect(c, '#2a1c14', x - 3, yy - 2, 6, 3); rect(c, '#6a4a2e', x - 2, yy - 1, 4, 1); rect(c, '#ffd36a', x - 5, yy + 5, 2, 3); rect(c, '#ffd36a', x + 3, yy + 5, 2, 3); }
  const loot = ['dolar', 'sobre', 'bono', 'lingote', 'maletin'].includes(t);
  const sparkle = Math.floor(time * (loot ? 7 : 5) + it.id) % 6; if (sparkle < 2) rect(c, '#fff6a8', x + 6, yy - 3 + sparkle * 3, 1, 1);
  if (loot && sparkle === 3) rect(c, '#fff6a8', x - 8, yy + 2, 1, 1);
}

function placard(c, e, x, y) {
  const d = e.face >= 0 ? 1 : -1, px = x + d * 15;
  rect(c, '#8a6a46', px, y - 66, 2, 36); rect(c, '#f4ecd8', px - 11, y - 82, 24, 15); rect(c, '#c63a4a', px - 11, y - 82, 24, 2); rect(c, '#c63a4a', px - 11, y - 69, 24, 1);
  c.font = SMALL_FONT; c.textAlign = 'center'; c.fillStyle = '#7a1f2c'; c.fillText('PLAZA', px + 1, y - 71);
}

function drawLaneMarker(c, e, x, y, camX) {
  const reach = e.attackKind === 'charge' ? 150 : e.reach + 10, d = e.attackFace >= 0 ? 1 : -1, depth = e.attackKind === 'charge' ? 12 : e.depth - 2;
  const left = d > 0 ? x : x - reach;
  c.fillStyle = '#ffb16a40'; c.fillRect(Math.round(left), Math.round(y - depth * .6), reach, Math.round(depth * 1.2 + 2));
  c.fillStyle = '#ffb16a'; c.fillRect(Math.round(left), Math.round(y - depth * .6), reach, 1); c.fillRect(Math.round(left), Math.round(y + depth * .6) + 1, reach, 1);
}

function actorDraw(c, a, isHero, g, time, ctxInfo) {
  const { camX, floorTop } = ctxInfo;
  const x = Math.round(a.x - camX), y = Math.round(floorTop + 10 + a.y);
  const pose = isHero ? heroPose(a, time) : enemyPose(a, time);
  const yy = y - Math.round(a.z || 0) - (pose.bob || 0);
  const variant = isHero ? 'hero' : a.variant;
  const big = !!a.boss;
  if (!isHero && a.dead) c.globalAlpha = Math.max(0, a.fade / .5) * (Math.floor(time * 24) % 2 ? .5 : 1);
  if (!pose.lying) shadow(c, x, y, a.z || 0, big);
  else rect(c, '#120a1e66', x - 30, y - 2, 56, 3);
  if (!isHero && (a.state === 'windup')) drawLaneMarker(c, a, x, y, camX);
  const blink = isHero && a.inv > 0 && !['dodge', 'special', 'down', 'getup'].includes(a.state) && Math.floor(time * 22) % 2;
  if (isHero && a.state === 'dodge') for (const k of [1, 2]) drawFrame(c, variant, pose.id, x - (a.dodgeDir || a.face) * k * 9, yy, { flip: pose.flip, alpha: .32 / k });
  if (!isHero && a.prop === 'placard' && !['down', 'getup', 'stagger', 'retreat'].includes(a.state)) placard(c, a, x, y);
  const flash = (a.flash || 0) > 0 || (!isHero && a.shrug > 0);
  const slide = !isHero && a.state === 'windup' ? Math.round(-(a.attackFace || 1) * (1 - a.wind / a.windup) * 3) : 0;
  if (pose.arc) { const d = pose.flip ? -1 : 1; rect(c, '#ffffffcc', x + d * 22, yy - 40, 2, 16); rect(c, '#ffffff88', x + d * 25, yy - 36, 2, 10); rect(c, '#ffffff55', x + d * 28, yy - 32, 2, 4); }
  drawFrame(c, variant, pose.id, x + slide + (pose.shift || 0) * (pose.flip ? -1 : 1), yy, { flip: pose.flip, lying: pose.lying, flash, alpha: blink ? .45 : 1 });
  c.globalAlpha = 1;
  if (!isHero) {
    const top = yy - frameHeight(variant, pose.id, pose.lying);
    const labelled = a.behavior !== 'pursue' && !a.boss && !a.provoked;
    if (!a.boss && !a.dead && a.hp < a.maxHp && a.entered) {
      const f = a.hp / a.maxHp, py = top - (labelled ? 14 : 6);
      renderPie(c, x, py, 7, 4, 2, [{ frac: f, top: '#ff9aa2', side: '#a8404c' }, { frac: 1 - f, top: '#3a2a52', side: '#241a34', explode: 1 }]);
    }
    if (a.state === 'windup' && Math.floor(time * 16) % 2 === 0) label(c, '!', x, top - 2, '#ffd074');
    else if (a.behavior !== 'pursue' && !a.boss && !a.provoked && !['down', 'getup', 'hold'].includes(a.state) && a.entered) label(c, a.withdrawing ? 'SE RETIRA' : a.label, x, top - 2, a.withdrawing ? '#c9dfa6' : '#eee0d7', SMALL_FONT);
  }
}

function frameHeight(variant, id, lying) { const f = frameInfo(variant, id); return f ? (lying ? 18 : f.h) : 74; }

function drawStrings(c, g, x, y, time) {
  c.fillStyle = '#e8e4ff66';
  for (const off of [-9, -3, 4, 10]) {
    const sway = Math.round(Math.sin(time * 2 + off) * 1.5), topX = x + off * 2.2;
    for (let yy = 0; yy < y - 44; yy += 2) c.fillRect(Math.round(topX + (off - (topX - x)) * (yy / Math.max(1, y - 44)) + sway * (1 - yy / y)), yy, 1, 1);
  }
}

export function draw(ctx, r) {
  const { g, fx, scenery: L, time, menu } = r, W = g.view.w, H = g.view.h, floorTop = L.floorTop;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  const [sx, sy] = r.reducedMotion ? [0, 0] : shakeOffset(fx);
  ctx.translate(sx, sy);
  const maxCam = Math.max(0, L.worldW - W);
  const camX = Math.round(menu ? (Math.sin(time * .12) * .5 + .5) * maxCam * .5 : g.camera.x);
  drawScenery(ctx, L, camX, time, g.view);
  drawPigeons(ctx, L, camX, time, floorTop);
  const info = { camX, floorTop };
  const list = [];
  if (menu) {
    const hero = { x: camX + W * .62, y: 30, z: 0, face: -1, state: 'idle', inv: 0, flash: 0, p: true };
    list.push({ y: hero.y, f: () => actorDraw(ctx, hero, true, g, time, info) });
    [[camX + W * .2, 22, 'militant'], [camX + W * .34, 44, 'agitator']].forEach(([x, y, kind], i) => {
      const e = { x, y, z: 0, face: 1, state: 'wait', id: i + 2, variant: kind, kind, behavior: 'pursue', prop: kind === 'militant' ? 'placard' : '', entered: true, flash: 0, shrug: 0, label: '' };
      list.push({ y, f: () => actorDraw(ctx, e, false, g, time, info) });
    });
  } else {
    for (const p of g.props) list.push({ y: p.y, f: () => drawProp(ctx, p, Math.round(p.x - camX), Math.round(floorTop + 10 + p.y), time) });
    for (const it of g.pickups) list.push({ y: it.y, f: () => drawPickup(ctx, it, Math.round(it.x - camX), Math.round(floorTop + 10 + it.y), time) });
    for (const e of g.enemies) if (e.state !== 'hold' && (e.entered || Math.abs(e.x - camX - W / 2) < W / 2 + 40)) list.push({ y: e.y + (e.state === 'down' ? -5 : 0), f: () => actorDraw(ctx, e, false, g, time, info) });
    list.push({ y: g.player.y, f: () => actorDraw(ctx, g.player, true, g, time, info) });
  }
  if (g.chapter.id === 'casa' && !menu && !g.chapterClear) drawStrings(ctx, g, Math.round(g.player.x - camX), Math.round(floorTop + 10 + g.player.y), time);
  list.sort((a, b) => a.y - b.y).forEach(item => item.f());
  for (const rg of fx.rings) {
    ctx.globalAlpha = Math.max(0, rg.life / rg.max); ctx.strokeStyle = rg.color; ctx.lineWidth = 1;
    const cx = Math.round(rg.x - camX), cy = Math.round(floorTop + 10 + rg.y - rg.z), w = Math.round(rg.r);
    ctx.strokeRect(cx - w, cy - Math.round(w * .35), w * 2, Math.round(w * .7)); ctx.globalAlpha = 1;
  }
  for (const p of fx.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.6)); ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - camX), Math.round(floorTop + 10 + p.y - p.z), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const t of fx.texts) { const rise = (1 - t.life / t.max) * 14; label(ctx, t.s, Math.max(40, Math.min(W - 40, t.x - camX)), floorTop + 10 + t.y - rise, t.color); }
  if (g.go && !menu) {
    const on = Math.floor(time * 3) % 2 === 0, bob = Math.round(Math.sin(time * 8) * 3);
    if (on) { label(ctx, 'GO', W - 36 + bob, floorTop - 24, '#d5fa47'); rect(ctx, '#d5fa47', W - 20 + bob, floorTop - 33, 8, 3); rect(ctx, '#d5fa47', W - 15 + bob, floorTop - 36, 3, 9); rect(ctx, '#d5fa47', W - 13 + bob, floorTop - 34, 3, 5); }
  }
  ctx.restore();
}
