// Maps simulation state to sprite frame ids. Pure functions; the renderer only draws what they return.
import { tuning } from './config.js';

const idle = ['a-10', 'a-34', 'a-35', 'a-47', 'a-45', 'a-46', 'a-48', 'a-11'];
const walk = ['b-02', 'b-04', 'b-08', 'b-09', 'b-14', 'b-15', 'b-21', 'b-33'];
// [anticipation, strike, recovery] for jab, cross, kick
// Guard-walk (boxer shuffle) for low stick tilt: stance contact frames + the step frames from the source art.
const shuffle = ['a-39', 'a-40', 'a-42', 'a-41', 'a-43', 'a-40'];
const attackFrames = [['a-17', 'a-09', 'a-19'], ['a-20', 'a-23', 'a-22'], ['a-31', 'a-02', 'a-26']];
const spinFrames = [['a-02', false], ['a-12', true], ['a-05', false], ['a-15', true], ['a-07', false], ['a-01', true]];

const pick = (list, t) => list[Math.floor(t) % list.length];

export function heroPose(p, time) {
  const flip = p.face < 0;
  switch (p.state) {
    case 'attack': {
      const a = p.atk, step = tuning.steps[a.i];
      const phase = a.t < step.startup ? 0 : a.t < step.startup + step.active ? 1 : 2;
      return { id: attackFrames[a.i][phase], flip };
    }
    case 'airAttack': return { id: 'b-06', flip };
    case 'jump': return { id: p.vz > 90 ? 'b-15' : p.vz > -90 ? 'b-14' : 'b-21', flip };
    case 'dodge': return { id: p.stateT < .12 ? 'b-08' : 'b-09', flip: p.dodgeDir < 0 };
    case 'special': {
      if (p.stateT < tuning.special.startup) return { id: 'a-31', flip };
      const [id, mirror] = spinFrames[Math.floor((p.stateT - tuning.special.startup) * 18) % spinFrames.length];
      return { id, flip: mirror ? !flip : flip };
    }
    case 'hurt': return { id: p.stateT < .12 ? 'b-01' : 'b-10', flip };
    case 'down': return p.landed ? { id: 'b-28', flip, lying: true } : { id: 'b-28', flip };
    case 'getup': return { id: p.stateT < .15 ? 'b-17' : 'b-10', flip };
    case 'win': return { id: Math.floor(time * 2) % 2 ? 'b-36' : 'b-44', flip };
    case 'walk': return { id: p.walkRun ? pick(walk, p.step) : pick(shuffle, p.step * .55), flip, bob: !p.walkRun && Math.floor(p.step * .55) % 2 ? 1 : 0 };
    case 'grab': return { id: p.grab && p.grab.kneeT > 0 ? 'a-31' : 'a-09', flip };
    case 'throw': return { id: p.stateT < .12 ? 'a-09' : 'a-23', flip };
    default: return { id: pick(idle, time * 6), flip };
  }
}

// Enemies drawn from the painted sheets have their own frame names (w0..w7 walk, idle, windup, attack).
const painted = new Set(['worker', 'militant', 'tycoon']);
const paintedWalk = Array.from({ length: 8 }, (_, i) => 'w' + i);

function paintedPose(e, time) {
  const flip = e.face < 0, breath = Math.floor(time * 3 + e.id) % 2;
  switch (e.state) {
    case 'windup': return { id: 'windup', flip, bob: breath };
    case 'attack': return { id: 'attack', flip, shift: 5, arc: true };
    case 'recover': return { id: 'idle', flip, bob: 0 };
    case 'stagger': return { id: 'idle', flip, shift: -3 };
    case 'grabbed': return { id: 'idle', flip, shift: -2 };
    case 'down': return e.landed ? { id: 'idle', flip, lying: true } : { id: 'idle', flip };
    case 'getup': return { id: 'idle', flip, bob: 0 };
    case 'approach': case 'enter': case 'retreat': return { id: pick(paintedWalk, e.step), flip, bob: Math.floor(e.step * 2) % 2 };
    default: return { id: 'idle', flip, bob: breath };
  }
}

export function enemyPose(e, time) {
  if (painted.has(e.variant)) return paintedPose(e, time);
  const flip = e.face < 0, phase = time * 6 + e.id * 1.7;
  switch (e.state) {
    case 'windup': return { id: e.attackKind === 'charge' ? 'a-31' : 'a-17', flip };
    case 'attack': return { id: e.attackKind === 'charge' ? 'b-08' : e.boss ? 'a-02' : e.id % 2 ? 'a-23' : 'a-09', flip };
    case 'recover': return { id: 'a-19', flip };
    case 'stagger': return { id: e.stateT < .1 ? 'b-01' : 'b-10', flip };
    case 'down': return e.landed ? { id: 'b-28', flip, lying: true } : { id: 'b-28', flip };
    case 'getup': return { id: 'b-17', flip };
    case 'grabbed': return { id: 'b-10', flip };
    case 'approach': case 'enter': case 'retreat': return { id: pick(walk, e.step), flip };
    case 'wait': return { id: pick(idle, phase), flip };
    default: return { id: pick(idle, phase), flip };
  }
}
