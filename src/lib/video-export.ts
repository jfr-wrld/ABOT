/**
 * Turns a card's animation into a short video file, on the phone: no server, no upload.
 *
 * Frames are drawn one by one and encoded with WebCodecs, then muxed into an MP4 (mp4-muxer,
 * plain TypeScript, so no WebAssembly and nothing the CSP has to allow). Encoding frame by frame,
 * not in real time, keeps the clip identical on a slow phone and a fast one.
 *
 * H.264 first: Instagram, TikTok and WhatsApp all take it. Where the browser has no H.264
 * encoder (open-source Chromium), VP9 in MP4. Without WebCodecs, MediaRecorder records the
 * canvas in real time (WebM, or MP4 where the browser records it). Otherwise there is no video.
 */
import { ArrayBufferTarget, Muxer } from "mp4-muxer";

export interface VideoJob {
  width: number;
  height: number;
  seconds: number;
  fps: number;
  /** Draws the frame at `time` seconds onto the context. */
  draw: (ctx: CanvasRenderingContext2D, time: number) => void;
  /** 0 to 1 as frames are made. */
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

export interface MadeVideo {
  blob: Blob;
  /** "mp4" or "webm": the file's extension. */
  ext: "mp4" | "webm";
}

const BITRATE = 6_000_000;

/** The encoder settings this browser takes, best first; null when it has no WebCodecs encoder for them. */
async function pickCodec(width: number, height: number, fps: number): Promise<{ config: VideoEncoderConfig; mux: "avc" | "vp9" } | null> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return null;
  const tries: { codec: string; mux: "avc" | "vp9"; extra?: Partial<VideoEncoderConfig> }[] = [
    // High profile, level 4.0: 1080x1920 at 30 fps.
    { codec: "avc1.640028", mux: "avc", extra: { avc: { format: "avc" } } },
    { codec: "avc1.4d0028", mux: "avc", extra: { avc: { format: "avc" } } },
    { codec: "avc1.42e028", mux: "avc", extra: { avc: { format: "avc" } } },
    { codec: "vp09.00.40.08", mux: "vp9" },
  ];
  for (const t of tries) {
    const config: VideoEncoderConfig = { codec: t.codec, width, height, bitrate: BITRATE, framerate: fps, ...t.extra };
    try {
      if ((await VideoEncoder.isConfigSupported(config)).supported) return { config, mux: t.mux };
    } catch {
      // A codec string the browser does not know: try the next.
    }
  }
  return null;
}

function recorderType(): string | null {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined" || !("captureStream" in HTMLCanvasElement.prototype)) return null;
  for (const t of ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return null;
}

/** Whether this device can make a video at all (WebCodecs, or recording a canvas). */
export async function canMakeVideo(width: number, height: number, fps: number): Promise<boolean> {
  return (await pickCodec(width, height, fps)) !== null || recorderType() !== null;
}

function aborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("The video was cancelled.", "AbortError");
}

/** Lets the page paint between frames, so the progress bar moves and Cancel can be tapped. */
const yieldToPage = () => new Promise<void>((r) => setTimeout(r, 0));

export async function makeVideo(job: VideoJob): Promise<MadeVideo> {
  const canvas = document.createElement("canvas");
  canvas.width = job.width;
  canvas.height = job.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("This browser cannot draw the video.");
  const codec = await pickCodec(job.width, job.height, job.fps);
  if (codec) return encodeFrames(job, canvas, ctx, codec.config, codec.mux);
  const type = recorderType();
  if (type) return recordCanvas(job, canvas, ctx, type);
  throw new Error("This device cannot make videos. Download the image instead.");
}

async function encodeFrames(
  job: VideoJob,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  config: VideoEncoderConfig,
  mux: "avc" | "vp9",
): Promise<MadeVideo> {
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: mux, width: job.width, height: job.height, frameRate: job.fps },
    fastStart: "in-memory",
  });
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure = e;
    },
  });
  encoder.configure(config);
  const frames = Math.round(job.seconds * job.fps);
  const step = 1_000_000 / job.fps;
  try {
    for (let i = 0; i < frames; i++) {
      aborted(job.signal);
      if (failure) throw failure;
      job.draw(ctx, i / job.fps);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * step), duration: Math.round(step) });
      // A key frame every two seconds, so a player can seek and a share preview starts quickly.
      encoder.encode(frame, { keyFrame: i % (job.fps * 2) === 0 });
      frame.close();
      job.onProgress?.((i + 1) / frames);
      // Back-pressure: do not queue more frames than the encoder keeps up with.
      while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 4));
      if (i % 3 === 0) await yieldToPage();
    }
    await encoder.flush();
    if (failure) throw failure;
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
  muxer.finalize();
  return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), ext: "mp4" };
}

/** Real-time fallback: plays the animation on the canvas while MediaRecorder records it. */
async function recordCanvas(job: VideoJob, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, type: string): Promise<MadeVideo> {
  const stream = canvas.captureStream(job.fps);
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: BITRATE });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
  job.draw(ctx, 0);
  recorder.start(250);
  const start = performance.now();
  try {
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (job.signal?.aborted) return reject(new DOMException("The video was cancelled.", "AbortError"));
        const time = (performance.now() - start) / 1000;
        job.draw(ctx, Math.min(time, job.seconds));
        job.onProgress?.(Math.min(1, time / job.seconds));
        if (time >= job.seconds) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  } finally {
    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
  }
  await done;
  const mp4 = type.startsWith("video/mp4");
  return { blob: new Blob(chunks, { type: mp4 ? "video/mp4" : "video/webm" }), ext: mp4 ? "mp4" : "webm" };
}
