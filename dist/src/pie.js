// Pixel-art 3D pie chart ("torta de Excel"), used for health/energy. Pure drawing, no game imports.
// slices: [{ frac, top, side, explode (px) }] clockwise from 12 o'clock; fractions should sum to 1.
const TAU = Math.PI * 2;

function inEllipse(x, y, rx, ry) { return (x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1; }

function drawSlice(c, cx, cy, rx, ry, a0, a1, ox, oy, color) {
  c.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    let run = null;
    for (let x = -rx; x <= rx + 1; x++) {
      let on = false;
      if (x <= rx && inEllipse(x, y, rx, ry)) {
        const t = ((Math.atan2(x / rx, -y / ry) / TAU) + 1) % 1;
        on = (a1 - a0 >= .9999) || (t >= a0 && t < a1);
      }
      if (on && run === null) run = x;
      if (!on && run !== null) { c.fillRect(Math.round(cx + ox + run), Math.round(cy + oy + y), x - run, 1); run = null; }
    }
  }
}

export function renderPie(c, cx, cy, rx, ry, depth, slices, outline = '#140e1e') {
  const total = slices.reduce((s, sl) => s + Math.max(0, sl.frac), 0) || 1;
  let acc = 0;
  const parts = slices.filter(s => s.frac > 0.0005).map(s => {
    const a0 = acc / total; acc += s.frac; const a1 = Math.min(1, acc / total), mid = (a0 + a1) / 2 * TAU, ex = s.explode || 0;
    return { ...s, a0, a1, ox: Math.sin(mid) * ex, oy: -Math.cos(mid) * ex * (ry / rx) };
  });
  c.fillStyle = outline;
  for (let d = 0; d <= depth; d++) drawSlice(c, cx, cy + d, rx + 1, ry + 1, 0, 1, 0, 0, outline);
  for (const p of parts) for (let d = depth; d >= 1; d--) drawSlice(c, cx, cy + d, rx, ry, p.a0, p.a1, p.ox, p.oy, p.side);
  for (const p of parts) drawSlice(c, cx, cy, rx, ry, p.a0, p.a1, p.ox, p.oy, p.top);
}

export const lifeSlices = (hp, trail) => [
  { frac: hp, top: '#d5fa47', side: '#7f9422' },
  { frac: Math.max(0, trail - hp), top: '#ffb16a', side: '#a8662a' },
  { frac: Math.max(0, 1 - Math.max(hp, trail)), top: '#d8505c', side: '#7a2430', explode: 1.5 }
];
export const energySlices = (e, ready) => [
  { frac: e, top: ready ? '#e0c8ff' : '#b48cf0', side: '#5a3f9a' },
  { frac: 1 - e, top: '#3a2a52', side: '#241a34', explode: 1 }
];
