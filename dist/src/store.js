// Small persisted preferences + records. Fails soft when storage is blocked (private mode, file://).
const KEY = 'misterM.v06';
const defaults = { best: { local: 0, global: 0 }, music: true, sfx: true, haptics: true, lefty: false, touch: null, tutorial: false };

export function loadStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...defaults, ...saved, best: { ...defaults.best, ...(saved.best || {}) } };
  } catch { return { ...defaults, best: { ...defaults.best } }; }
}
export function saveStore(store) { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage unavailable */ } }
