"use client";

import { useEffect, useRef, useState } from "react";
import { makeVideo } from "@/lib/video-export";
import { openSaved, saveFile, shareFile, type SaveResult } from "@/lib/native/files";
import { STORY_FPS, STORY_SECONDS } from "@/lib/story-motion";
import { STORY_HEIGHT, STORY_WIDTH } from "@/lib/story-exporter";
import { useT } from "@/i18n";

export type VideoState =
  | { kind: "idle" }
  | { kind: "making"; progress: number }
  | { kind: "ready"; blob: Blob; fileName: string }
  | { kind: "error"; text: string };

/**
 * Making, sharing and saving a story video, for the workout and the streak studios. The video is
 * made on a tap (it takes a few seconds), so Share is a second tap once the file exists: Safari
 * only opens the share sheet inside a tap. Any change to the card (`key`) drops the old video.
 */
export function useStoryVideo({
  key,
  draw,
  fileName,
  shareText,
}: {
  /** The card the video shows; a different object means a different video. */
  key: object;
  draw: ((ctx: CanvasRenderingContext2D, time: number) => void) | null;
  /** The name without extension, e.g. "abot-story-2026-11-13-matchday". */
  fileName: string;
  shareText: { title: string; text: string };
}) {
  const t = useT();
  const [state, setState] = useState<{ for: object; video: VideoState }>({ for: key, video: { kind: "idle" } });
  const [note, setNote] = useState<{ for: Blob; kind: "info" | "error"; text: string; saved?: Extract<SaveResult, { kind: "saved" }> } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const video: VideoState = state.for === key ? state.video : { kind: "idle" };

  // A changed card cancels a video still being made for the old one.
  useEffect(() => () => abort.current?.abort(), [key]);

  async function make() {
    if (!draw || video.kind === "making") return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    const forKey = key;
    setState({ for: forKey, video: { kind: "making", progress: 0 } });
    try {
      const made = await makeVideo({
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        seconds: STORY_SECONDS,
        fps: STORY_FPS,
        draw,
        signal: ctl.signal,
        onProgress: (p) => setState((s) => (s.for === forKey && s.video.kind === "making" ? { for: forKey, video: { kind: "making", progress: p } } : s)),
      });
      setState({ for: forKey, video: { kind: "ready", blob: made.blob, fileName: `${fileName}.${made.ext}` } });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") setState({ for: forKey, video: { kind: "idle" } });
      else setState({ for: forKey, video: { kind: "error", text: err instanceof Error ? t(err.message) : t("The video could not be made on this device.") } });
    }
  }

  function cancel() {
    abort.current?.abort();
  }

  async function share() {
    if (video.kind !== "ready") return;
    const { blob, fileName: name } = video;
    try {
      const r = await shareFile(new File([blob], name, { type: blob.type }), shareText);
      if (r === "shared") setNote({ for: blob, kind: "info", text: t("Sent to the share sheet.") });
      else if (r === "unsupported") setNote({ for: blob, kind: "error", text: t("This browser cannot share videos. Save it and post it from your gallery.") });
    } catch (err) {
      setNote({ for: blob, kind: "error", text: t("Sharing failed. Save the video and post it from your gallery.") + (err instanceof Error ? ` (${err.message})` : "") });
    }
  }

  async function download() {
    if (video.kind !== "ready") return;
    const { blob, fileName: name } = video;
    setNote({ for: blob, kind: "info", text: t("Saving video…") });
    try {
      const saved = await saveFile(blob, name);
      setNote(
        saved.kind === "saved"
          ? { for: blob, kind: "info", text: t("Saved to your gallery, album ABOT."), saved }
          : { for: blob, kind: "info", text: t("Saved {file}.", { file: name }) },
      );
    } catch (err) {
      setNote({ for: blob, kind: "error", text: t("The video could not be saved.") + (err instanceof Error ? ` (${err.message})` : "") });
    }
  }

  const shownNote = note && video.kind === "ready" && note.for === video.blob ? note : null;
  return {
    video,
    make,
    cancel,
    share,
    download,
    note: shownNote,
    openSaved: (saved: Extract<SaveResult, { kind: "saved" }>) => void openSaved(saved).catch(() => {}),
  };
}
