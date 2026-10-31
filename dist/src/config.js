// Tuning and static data only. No logic, no DOM. World units are internal pixels.
export const tuning = Object.freeze({
  lane: 64, maxHp: 100, maxEnergy: 100, edgeMargin: 10,
  walkSpeed: 108, laneSpeed: 46, accel: 1100, decel: 1500,
  gravity: 950, jumpSpeed: 255, airControl: .8,
  dodge: { time: .24, speed: 210, cost: 18, inv: .34, cooldown: .45 },
  special: { cost: 45, startup: .1, active: .22, total: .46, dmg: 22, rangeX: 66, rangeY: 28, push: 90 },
  airKick: { dmg: 12, reach: 34, depth: 14, push: 70, minFall: -30 },
  combo: { chain: .26, reset: 1.6 },
  hurt: { stun: .34, inv: .6, knock: 80, downInv: 1.1 },
  energyPerHit: 4, energyRegen: 2, healOnChapter: 15,
  steps: [
    { name: 'jab', startup: .06, active: .06, total: .2, dmg: 8, stun: .3, push: 70, reach: 28, depth: 14, lunge: 55, down: false, score: 50, hitStop: .05 },
    { name: 'cross', startup: .07, active: .06, total: .22, dmg: 10, stun: .34, push: 90, reach: 32, depth: 14, lunge: 70, down: false, score: 60, hitStop: .06 },
    { name: 'kick', startup: .1, active: .08, total: .38, dmg: 15, stun: 0, push: 150, reach: 38, depth: 15, lunge: 110, down: true, score: 100, hitStop: .1 }
  ]
});

// Pickups. Food heals; the rest is the "botín" of Mister M's side business (points + loot counter).
export const items = Object.freeze({
  medialuna: { label: 'MEDIALUNA', hp: 12 },
  mate: { label: 'MATE', energy: 35 },
  choripan: { label: 'CHORIPÁN', hp: 28 },
  asado: { label: 'ASADO', hp: 45, energy: 20 },
  dolar: { label: 'U$S 100', loot: 100 },
  sobre: { label: 'SOBRE', loot: 500 },
  bono: { label: 'BONO', loot: 300, energy: 30 },
  lingote: { label: 'LINGOTE', loot: 1000 },
  maletin: { label: 'MALETÍN', loot: 2500 }
});
// Weighted pool used by props marked drop:'loot' and by defeated enemies.
export const lootPool = Object.freeze([['dolar', 46], ['sobre', 26], ['bono', 16], ['lingote', 9], ['maletin', 3]]);
export const grab = Object.freeze({ range: 22, depth: 9, push: .18, hold: 3, knee: { dmg: 7, cool: .3, stun: .5 }, throwSpec: { dmg: 18, push: 240, lift: 140, down: true, score: 150, hitStop: .12 } });

// Fictional archetypes. Civilians never attack unless provoked (see behavior).
export const enemyKinds = Object.freeze({
  militant: { label: 'MILITANTE', variant: 'militant', behavior: 'pursue', hp: 44, speed: 44, dmg: 7, windup: .5, recover: 1.1, reach: 30, prop: 'placard', sign: 'PLAZA' },
  agitator: { label: 'AGITADOR', variant: 'agitator', behavior: 'pursue', hp: 38, speed: 56, dmg: 6, windup: .4, recover: .95, reach: 30 },
  worker: { label: 'TRABAJADOR', variant: 'worker', behavior: 'counter', hp: 62, speed: 42, dmg: 11, windup: .62, recover: 1.2, reach: 32, armor: true },
  pyme: { label: 'PYME', variant: 'pyme', behavior: 'block', hp: 50, speed: 40, dmg: 0, windup: .5, recover: 1, reach: 30 },
  merchant: { label: 'COMERCIANTE', variant: 'merchant', behavior: 'block', hp: 46, speed: 42, dmg: 0, windup: .5, recover: 1, reach: 30 },
  homeless: { label: 'PERSONA SIN HOGAR', variant: 'homeless', behavior: 'retreat', hp: 40, speed: 58, dmg: 0, windup: .5, recover: 1, reach: 30 },
  retiree: { label: 'JUBILADO', variant: 'retiree', behavior: 'retreat', hp: 40, speed: 36, dmg: 0, windup: .5, recover: 1, reach: 30 },
  student: { label: 'ESTUDIANTE', variant: 'student', behavior: 'counter', hp: 36, speed: 62, dmg: 6, windup: .4, recover: .9, reach: 28 },
  puppeteer: { label: 'EL TITIRITERO', variant: 'puppeteer', behavior: 'pursue', boss: true, armor: true, hp: 240, speed: 40, dmg: 12, windup: .7, recover: 1, reach: 42, depth: 16, charge: true },
  tycoon: { label: 'EL MAGNATE', variant: 'tycoon', behavior: 'pursue', boss: true, armor: true, hp: 260, speed: 44, dmg: 13, windup: .65, recover: .95, reach: 44, depth: 16, charge: true }
});

export const bossForRoute = Object.freeze({ local: 'puppeteer', global: 'tycoon' });

// spawn tuples: [kind, side (+1 right / -1 left), delay seconds]
export const stages = Object.freeze([
  {
    id: 'plaza', theme: 'plaza', title: '01 / LA PLAZA', order: 'Despejá la plaza', aftermath: 'La plaza se vacía. Las preguntas siguen ahí.', maxAttackers: 1,
    encounters: [
      { at: 0, spawn: [['militant', 1, 0], ['agitator', -1, .4]] },
      { at: 330, spawn: [['militant', 1, 0], ['agitator', -1, .3], ['worker', 1, 1]] }
    ],
    props: [
      { type: 'crate', x: 170, y: 40, drop: 'medialuna' }, { type: 'bin', x: 250, y: 22, drop: 'loot' }, { type: 'crate', x: 380, y: 26, drop: 'loot' },
      { type: 'crate', x: 470, y: 36, drop: 'mate' }, { type: 'bin', x: 560, y: 52, drop: 'loot' }
    ]
  },
  {
    id: 'barrio', theme: 'barrio', title: '02 / EL BARRIO', order: 'Poné el barrio en marcha', aftermath: 'Las persianas bajan. El barrio se queda en silencio.', maxAttackers: 1,
    encounters: [
      { at: 0, spawn: [['worker', 1, 0], ['pyme', -1, .3], ['merchant', 1, .8]] },
      { at: 330, spawn: [['agitator', 1, 0], ['militant', -1, .3], ['merchant', 1, .6], ['worker', -1, 1.2]] },
      { at: 660, spawn: [['militant', 1, 0], ['agitator', -1, 0], ['agitator', 1, 1]] }
    ],
    props: [
      { type: 'cart', x: 150, y: 44, drop: 'choripan' }, { type: 'crate', x: 380, y: 28, drop: 'loot' }, { type: 'crate', x: 600, y: 24, drop: 'medialuna' },
      { type: 'bin', x: 520, y: 50, drop: 'loot' }, { type: 'crate', x: 740, y: 30, drop: 'mate' }, { type: 'cart', x: 860, y: 46, drop: 'asado' }, { type: 'bin', x: 960, y: 30, drop: 'loot' }
    ]
  },
  {
    id: 'vigilia', theme: 'vigilia', title: '03 / LA VIGILIA', order: 'Abrí el acceso al poder', aftermath: 'Llegaste al poder. ¿A quién dejaste atrás?', maxAttackers: 2,
    encounters: [
      { at: 0, spawn: [['homeless', -1, 0], ['retiree', 1, .4], ['student', 1, .8]] },
      { at: 330, spawn: [['agitator', 1, 0], ['student', -1, .3], ['militant', 1, 1], ['retiree', -1, .6]] },
      { at: 660, spawn: [['militant', 1, 0], ['agitator', -1, 0], ['worker', 1, .8], ['student', -1, 1.2]] }
    ],
    props: [
      { type: 'crate', x: 190, y: 30, drop: 'medialuna' }, { type: 'bin', x: 430, y: 24, drop: 'mate' },
      { type: 'crate', x: 600, y: 46, drop: 'choripan' }, { type: 'bin', x: 800, y: 34, drop: 'loot' }, { type: 'crate', x: 940, y: 40, drop: 'loot' }
    ]
  },
  {
    id: 'casa', theme: 'casa', title: '04 / LA CASA DEL PODER', order: 'Cortá los hilos', aftermath: '', maxAttackers: 1, boss: true,
    encounters: [{ at: 0, spawn: [['@boss', 1, .8]] }],
    reinforcements: { below: .5, message: 'Los hilos se tensan…', spawn: [['agitator', -1, 0], ['militant', 1, .4]] },
    props: [{ type: 'crate', x: 120, y: 30, drop: 'asado' }, { type: 'bin', x: 330, y: 50, drop: 'mate' }, { type: 'crate', x: 230, y: 20, drop: 'loot' }]
  }
]);
