// Presentation-only effects: particles, floating text, hit-stop, shake, screen flashes.
// Consumes simulation events; never mutates game state.
const MAX_PARTICLES = 160;
const onomatopoeia = ['¡PUM!', '¡PAF!', '¡ZAS!'];

export function createFx() {
  return { particles: [], texts: [], rings: [], shake: 0, shakeMax: .2, freeze: 0, flash: 0, hurt: 0, time: 0, tick: 0 };
}

function burst(fx, x, y, z, count, { color = '#fff6a8', speed = 90, life = .28, gravity = 220, size = 2 } = {}) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + fx.tick * .7, s = speed * (.55 + ((i * 37) % 10) / 14);
    fx.particles.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .35, vz: Math.sin(a) * s * .8 + 30, life, max: life, color, gravity, size });
  }
  if (fx.particles.length > MAX_PARTICLES) fx.particles.splice(0, fx.particles.length - MAX_PARTICLES);
}
const dust = (fx, x, y, count = 4, dir = 0) => burst(fx, x, y, 1, count, { color: '#c9b8d6', speed: 32, life: .32, gravity: -20, size: 3 }, dir);
const text = (fx, s, x, y, color = '#fff6a8', life = .7) => fx.texts.push({ s, x, y, color, life, max: life });

export function fxEvent(fx, ev, { reducedMotion = false } = {}) {
  fx.tick++;
  const shake = amount => { if (!reducedMotion) { fx.shake = Math.max(fx.shake, amount); fx.shakeMax = Math.max(fx.shakeMax, amount); } };
  switch (ev.type) {
    case 'hit': {
      const heavy = ev.power > 1;
      burst(fx, ev.x, ev.y, 38, heavy ? 12 : 7, { color: ev.special ? '#d5fa47' : '#fff6a8', speed: heavy ? 130 : 90 });
      if (!reducedMotion) fx.freeze = Math.max(fx.freeze, ev.hitStop || .05);
      shake(heavy ? .16 : .07);
      if (heavy) fx.rings.push({ x: ev.x, y: ev.y, z: 38, r: 4, life: .22, max: .22, color: '#fff' });
      text(fx, ev.special ? '¡LIBERTAD!' : heavy ? '¡BAM!' : onomatopoeia[fx.tick % 3], ev.x, ev.y - 70, ev.special ? '#d5fa47' : '#fff6a8');
      break;
    }
    case 'playerHurt':
      fx.hurt = .3; shake(.22); if (!reducedMotion) fx.freeze = Math.max(fx.freeze, .07);
      burst(fx, ev.x, ev.y, 40, 8, { color: '#ff7b80', speed: 80 });
      text(fx, '-' + ev.amount, ev.x, ev.y - 76, '#ff9393');
      break;
    case 'knockdown': dust(fx, ev.x, ev.y, 5); break;
    case 'defeat': if (ev.boss) { fx.flash = .5; shake(.35); } break;
    case 'land': dust(fx, ev.x, ev.y, ev.heavy ? 8 : 4); if (ev.heavy) shake(.1); break;
    case 'jump': dust(fx, ev.x, ev.y, 3); break;
    case 'dodge': dust(fx, ev.x, ev.y, 5); break;
    case 'special':
      fx.rings.push({ x: ev.x, y: ev.y, z: 20, r: 6, life: .4, max: .4, color: '#d5fa47', grow: 150 });
      shake(.18); break;
    case 'propHit': burst(fx, ev.x, ev.y, 14, 4, { color: '#c9a36a', speed: 50, size: 2 }); break;
    case 'propBreak': burst(fx, ev.x, ev.y, 12, 10, { color: '#c9a36a', speed: 100, life: .5, size: 3 }); dust(fx, ev.x, ev.y, 5); shake(.08); break;
    case 'pickup':
      burst(fx, ev.x, ev.y, 18, 8, { color: ev.loot ? '#ffd36a' : '#d5fa47', speed: 60, life: .5, gravity: -40 });
      text(fx, ev.loot ? '+U$S ' + ev.loot : ev.hp ? '+' + ev.hp + ' VIDA' : '+' + ev.energy + ' ENERGÍA', ev.x, ev.y - 30, ev.loot ? '#ffd36a' : '#d5fa47', 1); break;
    case 'grab': text(fx, '¡AGARRE!', ev.x, ev.y - 70, '#fff6a8'); shake(.05); break;
    case 'throw': text(fx, '¡ARROJO!', ev.x, ev.y - 70, '#ffb16a'); dust(fx, ev.x, ev.y, 6); break;
    case 'grabBreak': text(fx, 'SE ZAFÓ', ev.x, ev.y - 70, '#c9dfa6'); break;
    case 'bowling': text(fx, '¡STRIKE!', ev.x, ev.y - 56, '#ffb16a'); break;
    case 'poiseBreak': text(fx, '¡GUARDIA ROTA!', ev.x, ev.y - 82, '#ffb16a', .9); break;
    case 'withdrawn': text(fx, 'SE RETIRA', ev.x, ev.y - 70, '#c9dfa6', .9); break;
    default:
  }
}

export function updateFx(fx, dt) {
  fx.time += dt;
  fx.shake = Math.max(0, fx.shake - dt); fx.flash = Math.max(0, fx.flash - dt); fx.hurt = Math.max(0, fx.hurt - dt);
  for (const p of fx.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.gravity * dt; p.vx *= 1 - 2.2 * dt; if (p.z < 0) { p.z = 0; p.vz = 0; } }
  for (const t of fx.texts) t.life -= dt;
  for (const r of fx.rings) { r.life -= dt; r.r += (r.grow || 90) * dt; }
  fx.particles = fx.particles.filter(p => p.life > 0);
  fx.texts = fx.texts.filter(t => t.life > 0);
  fx.rings = fx.rings.filter(r => r.life > 0);
}

export function shakeOffset(fx) {
  if (fx.shake <= 0) return [0, 0];
  const a = Math.min(1, fx.shake / fx.shakeMax) * 3 * (fx.shakeMax > .12 ? 1.4 : 1);
  return [Math.round(Math.sin(fx.time * 130) * a), Math.round(Math.cos(fx.time * 97) * a * .7)];
}
