// Synthesized SFX and a small chiptune loop (Web Audio). No assets. Starts only after a user gesture.
const noteHz = n => 440 * Math.pow(2, (n - 69) / 12);

const sfxProfiles = {
  swing: { from: 320, to: 120, dur: .07, vol: .035, type: 'sawtooth' },
  hit: { from: 190, to: 50, dur: .11, vol: .1, type: 'square', noise: .06 },
  heavy: { from: 130, to: 36, dur: .2, vol: .14, type: 'square', noise: .12 },
  hurt: { from: 150, to: 40, dur: .22, vol: .1, type: 'sawtooth', noise: .05 },
  jump: { from: 260, to: 560, dur: .12, vol: .05, type: 'square' },
  land: { from: 110, to: 60, dur: .08, vol: .06, type: 'triangle' },
  dodge: { from: 520, to: 900, dur: .1, vol: .035, type: 'sine' },
  special: { from: 220, to: 880, dur: .3, vol: .07, type: 'square' },
  break: { from: 240, to: 70, dur: .18, vol: .08, type: 'sawtooth', noise: .12 },
  coin: { from: 988, to: 1568, dur: .12, vol: .05, type: 'square' },
  grab: { from: 140, to: 100, dur: .09, vol: .07, type: 'square', noise: .05 },
  pickup: { from: 660, to: 1320, dur: .16, vol: .06, type: 'square' },
  ready: { from: 500, to: 900, dur: .14, vol: .04, type: 'sine' },
  denied: { from: 150, to: 110, dur: .1, vol: .05, type: 'square' },
  ui: { from: 440, to: 660, dur: .06, vol: .04, type: 'square' },
  start: { from: 220, to: 880, dur: .3, vol: .06, type: 'triangle' },
  clear: { from: 392, to: 1046, dur: .5, vol: .06, type: 'square' }
};

// 16-step patterns, MIDI notes (0 = rest). Street theme in A minor, boss theme a tritone-ish darker line.
const tracks = {
  street: { bpm: 138,
    bass: [45, 0, 45, 0, 45, 0, 52, 0, 48, 0, 48, 0, 43, 0, 50, 0],
    lead: [69, 0, 72, 0, 76, 72, 0, 69, 67, 0, 71, 0, 74, 71, 0, 67],
    hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1] },
  boss: { bpm: 158,
    bass: [40, 40, 0, 40, 43, 0, 40, 0, 41, 41, 0, 41, 46, 0, 44, 0],
    lead: [64, 0, 67, 64, 0, 70, 0, 67, 65, 0, 68, 65, 0, 71, 0, 68],
    hat: [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1] }
};

export function createAudio() {
  let ctx = null, master = null, sfxOn = true, musicOn = true, voices = 0, timer = 0, step = 0, nextTime = 0, current = null, noiseBuffer = null;

  function unlock() {
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return false;
      if (!ctx) {
        ctx = new Context(); master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * .3, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    } catch { return false; }
  }

  function tone(from, to, dur, vol, type, when = 0, dest = master) {
    const t = (when || ctx.currentTime), o = ctx.createOscillator(), gain = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(from, t); if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    gain.gain.setValueAtTime(vol, t); gain.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(gain); gain.connect(dest); o.start(t); o.stop(t + dur + .02);
    return o;
  }
  function noise(dur, vol, when = 0, hp = 1200) {
    const t = when || ctx.currentTime, src = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    src.buffer = noiseBuffer; filter.type = 'highpass'; filter.frequency.value = hp;
    gain.gain.setValueAtTime(vol, t); gain.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(master); src.start(t); src.stop(t + dur + .02);
  }

  function sfx(kind) {
    if (!sfxOn || !ctx || ctx.state !== 'running' || voices >= 8) return;
    const p = sfxProfiles[kind]; if (!p) return;
    try {
      voices++; const o = tone(p.from, p.to, p.dur, p.vol, p.type); o.onended = () => { voices--; };
      if (p.noise) noise(p.dur, p.noise);
    } catch { voices = Math.max(0, voices - 1); }
  }

  function schedule() {
    if (!current || !ctx) return;
    const track = tracks[current], stepDur = 60 / track.bpm / 4;
    while (nextTime < ctx.currentTime + .18) {
      const i = step % 16, bass = track.bass[i], lead = track.lead[i];
      if (bass) tone(noteHz(bass), noteHz(bass), stepDur * 1.6, .11, 'triangle', nextTime);
      if (lead && (Math.floor(step / 16) % 2 === 0 || i % 2 === 0)) tone(noteHz(lead), noteHz(lead), stepDur * .9, .035, 'square', nextTime);
      if (track.hat[i]) noise(.03, i % 4 === 0 ? .03 : .015, nextTime, 6000);
      if (i % 8 === 0) { tone(150, 45, .12, .13, 'sine', nextTime); }
      if (i % 8 === 4) noise(.09, .05, nextTime, 1800);
      nextTime += stepDur; step++;
    }
  }

  function playMusic(name) {
    if (current === name) return;
    current = name; step = 0;
    if (!ctx || !musicOn) return;
    nextTime = ctx.currentTime + .05; clearInterval(timer); timer = setInterval(schedule, 40);
  }
  function stopMusic() { clearInterval(timer); timer = 0; current = null; }

  return {
    unlock, sfx, playMusic, stopMusic,
    get sfxOn() { return sfxOn; }, get musicOn() { return musicOn; },
    setSfx(on) { sfxOn = on; },
    setMusic(on) {
      musicOn = on; if (!on) { clearInterval(timer); timer = 0; }
      else if (current && ctx) { nextTime = ctx.currentTime + .05; clearInterval(timer); timer = setInterval(schedule, 40); }
    },
    suspend() { clearInterval(timer); timer = 0; if (ctx?.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().then(() => { if (current && musicOn) { nextTime = ctx.currentTime + .05; clearInterval(timer); timer = setInterval(schedule, 40); } }).catch(() => {}); }
  };
}
