// Atlas loader and pixel-exact frame drawing. Owns decoded images; consumers never see the cache.
import { spriteManifest } from '../assets/sprites/manifest.js';

const atlases = new Map(), flashes = new Map();

export function loadSprites(onProgress) {
  const names = Object.keys(spriteManifest.variants);
  let done = 0;
  return Promise.all(names.map(name => new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('timeout ' + name)), 20000);
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') await img.decode();
        clearTimeout(timer); atlases.set(name, img); onProgress?.(++done, names.length); resolve();
      } catch (error) { clearTimeout(timer); reject(error); }
    };
    img.onerror = () => { clearTimeout(timer); reject(new Error('image ' + name)); };
    img.src = new URL('../assets/sprites/' + spriteManifest.variants[name].image + '?v=' + spriteManifest.version, import.meta.url).href;
  })));
}

export const spritesReady = () => atlases.size === Object.keys(spriteManifest.variants).length;
export const frameInfo = (variant, id) => spriteManifest.variants[variant]?.frames[id];
export const variantHeight = variant => spriteManifest.variants[variant]?.height || 74;

function silhouette(variant) {
  if (flashes.has(variant)) return flashes.get(variant);
  const src = atlases.get(variant), canvas = document.createElement('canvas');
  canvas.width = src.width; canvas.height = src.height;
  const c = canvas.getContext('2d');
  c.drawImage(src, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height);
  flashes.set(variant, canvas);
  return canvas;
}

// x,y = pivot (feet) in canvas pixels. rot=true lays the body on its back (head away from facing direction).
export function drawFrame(ctx, variant, id, x, y, { flip = false, lying = false, flash = false, alpha = 1 } = {}) {
  const f = frameInfo(variant, id), img = atlases.get(variant);
  if (!f || !img) return false;
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y - (lying ? f.px : 0)));
  if (flip) ctx.scale(-1, 1);
  if (lying) ctx.rotate(-Math.PI / 2);
  ctx.drawImage(flash ? silhouette(variant) : img, f.x, f.y, f.w, f.h, -f.px, -f.py, f.w, f.h);
  ctx.restore();
  return true;
}

// Crops the hero's head from the idle frame into a small HUD canvas.
export function drawPortrait(canvas) {
  const f = frameInfo('hero', 'a-10'), img = atlases.get('hero');
  if (!f || !img) return;
  const c = canvas.getContext('2d'), size = canvas.width;
  c.clearRect(0, 0, size, size); c.imageSmoothingEnabled = false;
  const sx = f.x + Math.max(0, f.hx - Math.floor(size / 2)), sy = f.y + Math.max(0, f.hy - 1);
  c.fillStyle = '#3a2a5a'; c.fillRect(0, 0, size, size);
  c.drawImage(img, sx, sy, size, size, 0, 0, size, size);
}
