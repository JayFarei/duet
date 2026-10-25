// A quiet, slowly breathing two-note pad per track, so "playing" is audible. Created on the first tap
// (browsers only start audio from a user gesture) and torn down on pause.
let ctx: AudioContext | null = null;
let voice: { stop: () => void } | null = null;

const SCALE = [0, 2, 4, 7, 9, 12, 14]; // major pentatonic-ish, never clashes

export function play(seed: number) {
  stop();
  ctx ??= new AudioContext();
  void ctx.resume();
  const c = ctx, now = c.currentTime;
  const root = 196 * 2 ** (SCALE[seed % SCALE.length] / 12);
  const out = c.createGain();
  out.gain.setValueAtTime(0, now);
  out.gain.linearRampToValueAtTime(0.035, now + 1.2);
  out.connect(c.destination);
  const lfo = c.createOscillator(), depth = c.createGain();
  lfo.frequency.value = 0.18; depth.gain.value = 0.012;
  lfo.connect(depth).connect(out.gain);
  const oscs = [1, 1.5, 2.005].map((m, i) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = i === 1 ? "triangle" : "sine";
    o.frequency.value = root * m;
    g.gain.value = [0.6, 0.25, 0.15][i];
    o.connect(g).connect(out);
    o.start(now);
    return o;
  });
  lfo.start(now);
  voice = {
    stop: () => {
      const t = c.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + 0.25);
      [...oscs, lfo].forEach((o) => o.stop(t + 0.3));
    },
  };
}

export function stop() { voice?.stop(); voice = null; }
