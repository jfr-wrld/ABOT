import { CapacitorHttp } from "@capacitor/core";
import { isNativeApp } from "@/lib/native/files";
import { parseVideoUrl } from "./videoUrl";

/**
 * Turns a TikTok share link (vt.tiktok.com/...) into the full video link the player needs. Runs
 * once, when the lifter saves the link, and asks only TikTok (CLAUDE.md lists this exception);
 * the full link is what gets stored, so playing it later needs no lookup.
 */

const TIMEOUT_MS = 8000;
const VIDEO_ID = /\/video\/(\d{8,})/;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS))]);
}

/** The full link, only when it is one the player accepts. */
function checked(url: string): string | null {
  return parseVideoUrl(url)?.kind === "tiktok" ? url : null;
}

/** Android: a native request follows the redirect with no CORS limit; its final URL holds the id. */
async function viaRedirect(link: string): Promise<string | null> {
  const res = await withTimeout(CapacitorHttp.get({ url: link, responseType: "text" }));
  const final = typeof res.url === "string" ? res.url : "";
  if (VIDEO_ID.test(final)) return checked(final.split("?")[0]!);
  const body = typeof res.data === "string" ? res.data : "";
  const m = /https:\/\/www\.tiktok\.com\/@[\w.-]+\/video\/\d{8,}/.exec(body);
  return m ? checked(m[0]) : null;
}

/** TikTok's public oEmbed: readable from a web page, and it accepts share links. */
async function viaOembed(link: string): Promise<string | null> {
  const res = await withTimeout(fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`, { credentials: "omit" }));
  if (!res.ok) return null;
  const j = (await res.json()) as { embed_product_id?: unknown; html?: unknown; author_unique_id?: unknown };
  const fromHtml = typeof j.html === "string" ? /data-video-id="(\d{8,})"/.exec(j.html)?.[1] : undefined;
  const id = typeof j.embed_product_id === "string" && /^\d{8,}$/.test(j.embed_product_id) ? j.embed_product_id : fromHtml;
  if (!id) return null;
  const author = typeof j.author_unique_id === "string" && /^[\w.-]{1,64}$/.test(j.author_unique_id) ? j.author_unique_id : "tiktok";
  return checked(`https://www.tiktok.com/@${author}/video/${id}`);
}

export async function resolveTikTokShortLink(link: string): Promise<string | null> {
  if (isNativeApp()) {
    try {
      const full = await viaRedirect(link);
      if (full) return full;
    } catch {
      // Falls through to oEmbed.
    }
  }
  try {
    return await viaOembed(link);
  } catch {
    return null;
  }
}
