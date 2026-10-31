import test from 'node:test';
import assert from 'node:assert/strict';
import { bindInput } from '../dist/src/input.js';

class El extends EventTarget {
  constructor(key = '') { super(); this.dataset = { key }; this.attrs = new Map(); this.cls = new Set(); this.captured = new Set();
    this.classList = { add: c => this.cls.add(c), remove: c => this.cls.delete(c), toggle: (c, on) => (on ? this.cls.add(c) : this.cls.delete(c)) }; this.style = { setProperty() {} }; }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 300, bottom: 200, width: 300, height: 200 }; }
  setPointerCapture(id) { this.captured.add(id); } hasPointerCapture(id) { return this.captured.has(id); } releasePointerCapture(id) { this.captured.delete(id); }
  querySelector() { return null; }
}
const ptr = (el, type, id, x = 0, y = 0) => { const e = new Event(type, { cancelable: true }); Object.assign(e, { pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y }); el.dispatchEvent(e); };
function setup() {
  globalThis.window = new EventTarget(); const pad = new El(), attack = new El('attack'), jump = new El('jump'); const actions = [];
  return { pad, attack, jump, actions, input: bindInput({ pad, buttons: [attack, jump], onAction: a => actions.push(a) }) };
}
test('floating joystick anchors where the thumb lands and drives analog axes', () => {
  const { pad, input } = setup(); ptr(pad, 'pointerdown', 1, 100, 100); assert.equal(input.state.axisX, 0);
  ptr(pad, 'pointermove', 1, 130, 100); assert.ok(input.state.axisX > .5 && Math.abs(input.state.axisY) < .01);
  ptr(pad, 'pointerup', 1); assert.equal(input.state.axisX, 0);
});
test('buttons and stick are independent; attack stays held until release', () => {
  const { pad, attack, jump, input, actions } = setup(); ptr(pad, 'pointerdown', 1, 100, 100); ptr(pad, 'pointermove', 1, 140, 100);
  ptr(attack, 'pointerdown', 2); ptr(jump, 'pointerdown', 3); assert.deepEqual(actions, ['attack', 'jump']); assert.ok(input.state.attack && input.state.jump);
  ptr(jump, 'pointerup', 3); assert.ok(input.state.attack && !input.state.jump && input.state.axisX > .5); ptr(attack, 'pointerup', 2); assert.ok(!input.state.attack);
});
test('stick drift moves the anchor so axes stay bounded', () => {
  const { pad, input } = setup(); ptr(pad, 'pointerdown', 1, 100, 100); ptr(pad, 'pointermove', 1, 290, 190);
  assert.ok(Math.hypot(input.state.axisX, input.state.axisY) <= 1.0001); input.clear(); assert.equal(input.state.axisX, 0);
});
