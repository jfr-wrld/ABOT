import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A recording stand-in for AudioContext: every oscillator's wave, frequencies and timing. */
interface Osc {
  type: string;
  set: [number, number][];
  ramp: [number, number][];
  start: number;
  stop: number;
}
let oscs: Osc[] = [];

class FakeAudioContext {
  currentTime = 0;
  state = "running";
  destination = {};
  resume = vi.fn(async () => {});
  createOscillator() {
    const o: Osc = { type: "", set: [], ramp: [], start: -1, stop: -1 };
    oscs.push(o);
    return {
      set type(v: string) {
        o.type = v;
      },
      frequency: {
        setValueAtTime: (v: number, t: number) => o.set.push([v, t]),
        exponentialRampToValueAtTime: (v: number, t: number) => o.ramp.push([v, t]),
      },
      connect: (g: unknown) => g,
      start: (t: number) => (o.start = t),
      stop: (t: number) => (o.stop = t),
    };
  }
  createGain() {
    const gain = { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
    return { gain, connect: (d: unknown) => d };
  }
}

beforeEach(() => {
  oscs = [];
  vi.resetModules();
  vi.stubGlobal("window", { AudioContext: FakeAudioContext });
});
afterEach(() => vi.unstubAllGlobals());

const load = () => import("./sound-effects");
const round = (n: number) => Math.round(n * 1000) / 1000;

describe("sound profiles (Phase 2 spec)", () => {
  it("tick: a 12 ms triangle burst from 1400 Hz down to 300 Hz", async () => {
    (await load()).playMechanicalTick();
    expect(oscs).toHaveLength(1);
    expect(oscs[0].type).toBe("triangle");
    expect(oscs[0].set[0][0]).toBe(1400);
    expect(oscs[0].ramp[0][0]).toBe(300);
    expect(round(oscs[0].ramp[0][1] - oscs[0].start)).toBe(0.012);
  });

  it("set complete: 600 Hz then 900 Hz within 90 ms", async () => {
    (await load()).playSetComplete();
    expect(oscs.map((o) => o.set[0][0])).toEqual([600, 900]);
    expect(round(Math.max(...oscs.map((o) => o.stop)) - 0.01)).toBe(0.09);
  });

  it("rest timer zero: three 1000 Hz pulses", async () => {
    (await load()).playRestTimerZero();
    expect(oscs.map((o) => o.set[0][0])).toEqual([1000, 1000, 1000]);
    expect(oscs.map((o) => round(o.start))).toEqual([0, 0.15, 0.3]);
  });

  it("PR unlocked: the 440, 554, 659, 880 Hz arpeggio in order", async () => {
    (await load()).playPRUnlocked();
    expect(oscs.map((o) => Math.round(o.set[0][0]))).toEqual([440, 554, 659, 880]);
    expect(oscs.map((o) => o.start)).toEqual([...oscs.map((o) => o.start)].sort((a, b) => a - b));
  });

  it("stays silent without Web Audio instead of throwing", async () => {
    vi.stubGlobal("window", {});
    expect((await load()).playMechanicalTick()).toBe(false);
  });
});

describe("feedback gate and vibration patterns", () => {
  it("plays sound and the graduated pattern only while Sounds & vibration is on", async () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate, userActivation: { hasBeenActive: true } });
    const { useSettingsStore } = await import("@/store/useSettingsStore");
    const { feedback } = await import("./feedback");

    useSettingsStore.setState({ tapFeedback: true });
    feedback.tick();
    feedback.setComplete();
    feedback.pr();
    expect(vibrate.mock.calls.map((c) => c[0])).toEqual([[8], [15, 30, 25], [30, 40, 60, 40, 100]]);
    const played = oscs.length;
    expect(played).toBe(1 + 2 + 4);

    useSettingsStore.setState({ tapFeedback: false });
    feedback.tick();
    feedback.pr();
    expect(oscs.length).toBe(played);
    expect(vibrate).toHaveBeenCalledTimes(3);
  });
});
