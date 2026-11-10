/**
 * Hardware-feel sounds, synthesised with the Web Audio API: no audio files, nothing to load,
 * nothing that needs the network. One AudioContext is made on the first sound and resumed on
 * each tap (browsers and the Android WebView start it suspended until a gesture).
 *
 * Web Audio plays alongside other apps' music instead of pausing it.
 * Each profile follows the Phase 2 spec:
 * - tick: 12 ms triangle burst, 1400 Hz falling to 300 Hz (steppers, chips, presets)
 * - set complete: dual-tone lock, 600 Hz then 900 Hz, 90 ms in all
 * - rest timer zero: three 1000 Hz pulses
 * - PR unlocked: A major arpeggio 440, 554, 659, 880 Hz
 * - rest countdown: an 800 Hz pip at 3, 2 and 1 seconds left
 * - workout start: a 220 to 440 Hz glide, then an 880 Hz click
 * - workout complete: C major rolled upward (523, 659, 784, 1047 Hz; 1319 Hz on top for a record)
 * - pro unlocked: a three-second sting timed to the celebration screen (see playProUnlocked)
 * - streak grew: a two-second ignition timed to the streak screen (see playStreakFire)
 */

type Wave = OscillatorType;

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a tap so the context is allowed to run before the first timed sound. */
export function unlockAudio(): void {
  audio();
}

interface Tone {
  wave: Wave;
  /** Start frequency (Hz). */
  from: number;
  /** End frequency (Hz); an exponential glide when it differs from `from`. */
  to?: number;
  /** Start, seconds after now. */
  at: number;
  /** Length in seconds. */
  dur: number;
  /** Peak gain, 0..1. */
  peak: number;
}

/** One oscillator with a fast attack and an exponential release, so no tone clicks. */
function tone(ac: AudioContext, { wave, from, to, at, dur, peak }: Tone): void {
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(from, t0);
  if (to !== undefined && to !== from) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.002, dur / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.01);
}

function play(tones: Tone[]): boolean {
  const ac = audio();
  if (!ac) return false;
  try {
    for (const t of tones) tone(ac, t);
    return true;
  } catch {
    // Sound is a convenience; a blocked context is not an error worth surfacing.
    return false;
  }
}

/** Stepper, chip, preset: a dry mechanical tick. */
export function playMechanicalTick(): boolean {
  return play([{ wave: "triangle", from: 1400, to: 300, at: 0, dur: 0.012, peak: 0.18 }]);
}

/** A set ticked off: two tones like a latch closing. */
export function playSetComplete(): boolean {
  return play([
    { wave: "triangle", from: 600, at: 0, dur: 0.04, peak: 0.22 },
    { wave: "triangle", from: 900, at: 0.045, dur: 0.045, peak: 0.22 },
  ]);
}

/** Rest is over: three telemetry pulses. */
export function playRestTimerZero(): boolean {
  return play([0, 0.15, 0.3].map((at) => ({ wave: "square" as Wave, from: 1000, at, dur: 0.09, peak: 0.16 })));
}

/** A personal record: a rising A major arpeggio. */
export function playPRUnlocked(): boolean {
  const notes = [440, 554.37, 659.25, 880];
  return play(notes.map((f, i) => ({ wave: "sine" as Wave, from: f, at: i * 0.09, dur: i === notes.length - 1 ? 0.45 : 0.16, peak: 0.24 })));
}

/** The last three seconds of rest: one short, soft pip per second, below the zero alarm. */
export function playRestCountdown(): boolean {
  return play([{ wave: "triangle", from: 800, at: 0, dur: 0.05, peak: 0.12 }]);
}

/** A workout started: a short rising glide that lands on a click, like power coming on. */
export function playWorkoutStart(): boolean {
  return play([
    { wave: "sine", from: 220, to: 440, at: 0, dur: 0.16, peak: 0.2 },
    { wave: "triangle", from: 880, at: 0.17, dur: 0.05, peak: 0.2 },
  ]);
}

/**
 * A workout finished: a C major chord rolled upward and left to ring. With a record, one higher
 * note on top, so it is told apart without reading the screen.
 */
export function playWorkoutComplete(record = false): boolean {
  const notes = [523.25, 659.25, 783.99, 1046.5, ...(record ? [1318.51] : [])];
  return play(notes.map((f, i) => ({ wave: "sine" as Wave, from: f, at: i * 0.08, dur: 0.7 - i * 0.05, peak: 0.18 })));
}

/**
 * Whether sound can play right now. Browsers keep audio suspended on a page that has not been
 * tapped yet (the return from a payment page is a fresh load), so the caller can ask for a tap.
 */
export async function audioReady(): Promise<boolean> {
  const ac = audio();
  if (!ac) return false;
  if (ac.state === "running") return true;
  await Promise.race([ac.resume().catch(() => {}), new Promise((r) => setTimeout(r, 150))]);
  return (ac.state as AudioContextState) === "running";
}

/**
 * BLACK PRO unlocked: about three seconds timed to the celebration screen.
 * 0.00 s a charging whoosh while the ring draws and the plate falls; 0.42 s the impact (low thud,
 * metal clank) and the app's own lock (600 then 900 Hz); 0.72 s a G-C-E pickup into a C major
 * chord over a low C as the title lands; 1.15 s four high sparkles with the feature cards;
 * 1.55 s a soft G-B-D shimmer (C major 9) under the button. Peaks stay low so nothing clips.
 */
export function playProUnlocked(): boolean {
  const s = (f: number, at: number, dur: number, peak: number, wave: Wave = "sine"): Tone => ({ wave, from: f, at, dur, peak });
  return play([
    // Charging whoosh.
    { wave: "sawtooth", from: 80, to: 760, at: 0, dur: 0.41, peak: 0.04 },
    { wave: "triangle", from: 160, to: 1500, at: 0.06, dur: 0.36, peak: 0.04 },
    // Impact and lock.
    { wave: "sine", from: 120, to: 38, at: 0.42, dur: 0.4, peak: 0.42 },
    { wave: "triangle", from: 1600, to: 700, at: 0.42, dur: 0.07, peak: 0.16 },
    s(600, 0.5, 0.04, 0.12, "triangle"),
    s(900, 0.55, 0.05, 0.12, "triangle"),
    // Pickup and chord.
    s(392, 0.72, 0.18, 0.14),
    s(523.25, 0.82, 0.18, 0.14),
    s(659.25, 0.92, 0.2, 0.14),
    s(523.25, 1.0, 1.2, 0.09),
    s(659.25, 1.0, 1.2, 0.09),
    s(783.99, 1.0, 1.2, 0.09),
    s(1046.5, 1.0, 1.3, 0.09),
    s(130.81, 1.0, 1.1, 0.14, "triangle"),
    // Sparkles.
    s(2093, 1.15, 0.12, 0.05),
    s(2637, 1.23, 0.12, 0.05),
    s(3136, 1.31, 0.12, 0.05),
    s(4186, 1.39, 0.14, 0.05),
    // Shimmer.
    s(783.99, 1.55, 1.4, 0.05),
    s(987.77, 1.55, 1.4, 0.05),
    s(1174.66, 1.55, 1.5, 0.05),
  ]);
}

/**
 * The week streak grew: about two seconds timed to the streak screen.
 * 0.00 s an ember rising (a soft upward glide); 0.35 s ignition (a low thump under a short roar);
 * 0.40 to 1.20 s crackles; 0.85 s the count rolls over (a two-note pickup); 1.00 s a bright
 * G major chord that rings out; 1.15 s this week's plate lights (the app's lock click).
 */
export function playStreakFire(): boolean {
  const s = (f: number, at: number, dur: number, peak: number, wave: Wave = "sine"): Tone => ({ wave, from: f, at, dur, peak });
  const crackles = [0.42, 0.51, 0.63, 0.7, 0.84, 0.97, 1.08, 1.2].map((at, i) => ({
    wave: "triangle" as Wave,
    from: 2400 - (i % 3) * 400,
    to: 900,
    at,
    dur: 0.014,
    peak: 0.05,
  }));
  return play([
    // Ember.
    { wave: "sine", from: 300, to: 1200, at: 0, dur: 0.32, peak: 0.06 },
    // Ignition.
    { wave: "sine", from: 140, to: 45, at: 0.35, dur: 0.38, peak: 0.36 },
    { wave: "sawtooth", from: 90, to: 420, at: 0.35, dur: 0.55, peak: 0.045 },
    ...crackles,
    // The count rolls over.
    s(587.33, 0.85, 0.1, 0.12),
    s(783.99, 0.93, 0.12, 0.12),
    // Chord.
    s(392, 1.0, 1.2, 0.08),
    s(493.88, 1.0, 1.2, 0.08),
    s(587.33, 1.0, 1.25, 0.08),
    s(783.99, 1.0, 1.3, 0.08),
    s(196, 1.0, 1.0, 0.12, "triangle"),
    // This week's plate lights.
    s(600, 1.15, 0.04, 0.1, "triangle"),
    s(900, 1.2, 0.05, 0.1, "triangle"),
  ]);
}
