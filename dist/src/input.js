// Input: floating joystick (left zone), action buttons, keyboard. Pointer ownership is per pointerId.
// bindInput({ pad, buttons, onAction }) -> { state, clear }. state: axisX, axisY, left/right/up/down, attack, jump, dodge, special.
const keyMap = {
  w: 'up', ArrowUp: 'up', s: 'down', ArrowDown: 'down', a: 'left', ArrowLeft: 'left', d: 'right', ArrowRight: 'right',
  j: 'attack', z: 'attack', k: 'jump', x: 'jump', ' ': 'jump', l: 'special', c: 'special', u: 'dodge', v: 'dodge', Shift: 'dodge',
  Escape: 'pause', p: 'pause'
};
const dead = .16;

export function bindInput({ pad, buttons = [], onAction }) {
  const state = {}, keyboard = new Set(), held = new Map();
  let stick = null; // { id, ox, oy, radius, x, y }
  const base = pad?.querySelector?.('.stick-base'), knob = pad?.querySelector?.('.stick-knob');

  function rebuild() {
    const pressed = new Set([...keyboard, ...[...held.values()].map(h => h.action)]);
    const sx = stick ? stick.x : 0, sy = stick ? stick.y : 0;
    state.axisX = Math.max(-1, Math.min(1, (pressed.has('right') ? 1 : 0) - (pressed.has('left') ? 1 : 0) + sx));
    state.axisY = Math.max(-1, Math.min(1, (pressed.has('down') ? 1 : 0) - (pressed.has('up') ? 1 : 0) + sy));
    state.left = state.axisX < 0; state.right = state.axisX > 0; state.up = state.axisY < 0; state.down = state.axisY > 0;
    for (const a of ['attack', 'jump', 'dodge', 'special']) state[a] = pressed.has(a);
    for (const b of buttons) b.classList.toggle('held', pressed.has(b.dataset.key));
  }
  function showStick(on) {
    if (!pad) return;
    pad.classList.toggle('held', on);
    if (!on) {
      base?.style.setProperty('--bx', ''); base?.style.setProperty('--by', '');
      knob?.style.setProperty('--kx', '0px'); knob?.style.setProperty('--ky', '0px');
    }
  }
  function endStick() { stick = null; showStick(false); rebuild(); }
  function clear() {
    const id = stick?.id; keyboard.clear();
    const owned = [...held.entries()]; held.clear(); stick = null; showStick(false); rebuild();
    for (const [pid, h] of owned) { try { if (h.button.hasPointerCapture?.(pid)) h.button.releasePointerCapture(pid); } catch {} }
    if (id !== undefined) { try { if (pad.hasPointerCapture?.(id)) pad.releasePointerCapture(id); } catch {} }
  }

  window.addEventListener('keydown', e => {
    const action = keyMap[e.key] || keyMap[String(e.key).toLowerCase()];
    if (!action || e.target?.closest?.('input,textarea,[contenteditable]') || (e.target?.closest?.('button') && (e.key === ' ' || e.key === 'Enter'))) return;
    e.preventDefault(); keyboard.add(action); rebuild();
    if (!e.repeat && ['attack', 'jump', 'dodge', 'special', 'pause'].includes(action)) onAction(action);
  });
  window.addEventListener('keyup', e => {
    const action = keyMap[e.key] || keyMap[String(e.key).toLowerCase()];
    if (!action) return; keyboard.delete(action); rebuild();
  });
  window.addEventListener('blur', clear);

  for (const button of buttons) {
    button.addEventListener('pointerdown', e => {
      if (button.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault(); held.set(e.pointerId, { action: button.dataset.key, button });
      try { button.setPointerCapture(e.pointerId); } catch {}
      rebuild(); onAction(button.dataset.key);
    });
    const release = e => { if (held.get(e.pointerId)?.button !== button) return; held.delete(e.pointerId); rebuild(); };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release);
  }

  if (pad) {
    function aim(e) {
      if (!stick || stick.id !== e.pointerId || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
      let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, dist = Math.hypot(dx, dy);
      // The anchor follows the thumb when it drifts far, so the stick never "runs out" of travel.
      if (dist > stick.radius * 1.5) {
        const over = dist - stick.radius * 1.5;
        stick.ox += dx / dist * over; stick.oy += dy / dist * over; dx = e.clientX - stick.ox; dy = e.clientY - stick.oy; dist = Math.hypot(dx, dy);
        const r = pad.getBoundingClientRect();
        base?.style.setProperty('--bx', stick.ox - r.left + 'px'); base?.style.setProperty('--by', stick.oy - r.top + 'px');
      }
      const mag = Math.min(1, dist / stick.radius);
      const strength = mag <= dead ? 0 : Math.pow((mag - dead) / (1 - dead), 1.2);
      stick.x = dist > 0 && strength ? dx / dist * strength : 0; stick.y = dist > 0 && strength ? dy / dist * strength : 0;
      const k = Math.min(dist, stick.radius);
      knob?.style.setProperty('--kx', (dist ? dx / dist * k : 0) + 'px'); knob?.style.setProperty('--ky', (dist ? dy / dist * k : 0) + 'px');
      rebuild();
    }
    pad.addEventListener('pointerdown', e => {
      if (stick || pad.getAttribute('aria-disabled') === 'true' || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      const r = pad.getBoundingClientRect(), radius = Math.max(24, Math.min(46, Math.min(r.width, r.height) * .2));
      const margin = radius * 1.1;
      const ox = Math.max(r.left + margin, Math.min(r.right - margin, e.clientX)), oy = Math.max(r.top + margin, Math.min(r.bottom - margin, e.clientY));
      stick = { id: e.pointerId, ox, oy, radius, x: 0, y: 0 };
      base?.style.setProperty('--bx', ox - r.left + 'px'); base?.style.setProperty('--by', oy - r.top + 'px');
      base?.style.setProperty('--r', radius + 'px');
      showStick(true);
      try { pad.setPointerCapture(e.pointerId); } catch {}
      aim(e);
    });
    pad.addEventListener('pointermove', aim);
    const end = e => { if (stick && stick.id === e.pointerId) endStick(); };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(type, end);
  }
  rebuild();
  return { state, clear };
}
