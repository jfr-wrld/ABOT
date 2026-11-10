export type ParsedVideo =
  | { kind: "youtube"; id: string; start?: number; end?: number; vertical?: true }
  | { kind: "tiktok"; id: string; vertical: true }
  | { kind: "file"; url: string; media: "video" | "image" };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

/** "90", "90s", "1m30s", "1h2m3s" -> seconds. */
function parseTime(v: string | null): number | undefined {
  if (!v) return undefined;
  if (/^\d+$/.test(v)) return Number(v);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(v);
  if (!m || (!m[1] && !m[2] && !m[3])) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function youtube(id: string | undefined, start?: number, vertical = false): ParsedVideo | null {
  if (!id || !YT_ID.test(id)) return null;
  return { kind: "youtube", id, ...(start ? { start } : {}), ...(vertical ? { vertical: true as const } : {}) };
}

/**
 * Understands YouTube (watch, youtu.be, Shorts, embed), full TikTok video links, and direct
 * .mp4/.webm/.mov/.gif files. Anything else, including non-http(s) schemes and TikTok short
 * links (which need the network to resolve), returns null.
 */
export function parseVideoUrl(input: string): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  const t = parseTime(url.searchParams.get("t") ?? url.searchParams.get("start"));

  if (host === "youtu.be") return youtube(url.pathname.slice(1).split("/")[0], t);
  if (YT_HOSTS.has(host)) {
    if (url.pathname === "/watch") return youtube(url.searchParams.get("v") ?? undefined, t);
    const m = /^\/(shorts|embed|live)\/([^/?#]+)/.exec(url.pathname);
    return m ? youtube(m[2], t, m[1] === "shorts") : null;
  }
  if (host === "tiktok.com" || host === "www.tiktok.com" || host === "m.tiktok.com") {
    const m = /\/video\/(\d{8,})/.exec(url.pathname);
    return m ? { kind: "tiktok", id: m[1]!, vertical: true } : null;
  }
  // Files play straight from their host, so plain http (readable and changeable in transit) is out.
  if (url.protocol !== "https:") return null;
  const ext = /\.([a-z0-9]+)$/i.exec(url.pathname)?.[1]?.toLowerCase();
  if (ext === "mp4" || ext === "webm" || ext === "mov") return { kind: "file", url: url.toString(), media: "video" };
  if (ext === "gif") return { kind: "file", url: url.toString(), media: "image" };
  return null;
}

/**
 * Embeds always start muted so they do not stop music the lifter is already playing.
 * YouTube uses the privacy-enhanced nocookie domain; `playlist` makes a single video loop.
 */
export function embedUrl(v: Extract<ParsedVideo, { kind: "youtube" | "tiktok" }>): string {
  if (v.kind === "tiktok") {
    return `https://www.tiktok.com/player/v1/${v.id}?autoplay=1&loop=1&music_info=0&description=0`;
  }
  let u = `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&mute=1&loop=1&playlist=${v.id}&playsinline=1&rel=0&modestbranding=1`;
  if (v.start) u += `&start=${v.start}`;
  if (v.end) u += `&end=${v.end}`;
  return u;
}

export function searchLinks(exerciseName: string): { youtube: string; tiktok: string } {
  return {
    youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} proper form shorts`)}`,
    tiktok: `https://www.tiktok.com/search?q=${encodeURIComponent(`${exerciseName} proper form`)}`,
  };
}
