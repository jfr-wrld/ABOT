/**
 * Liquid glass: the page behind a glass surface bends at its rim, like light through a lens,
 * instead of only being blurred. The bend is an SVG displacement map, drawn here for the
 * surface's size and corner radius, and applied with `backdrop-filter: url(#…)`.
 *
 * Only Chromium renders an SVG filter as a backdrop filter (Chrome, Edge, Samsung Internet and
 * the Android WebView the app runs in). Elsewhere the surface keeps the frosted CSS glass.
 */

/** True where `backdrop-filter: url(#…)` actually renders: Chromium, not iOS WebKit (CriOS). */
export function liquidGlassSupported(ua: string): boolean {
  return /\b(Chrome|Chromium)\/\d+/.test(ua) && !/\bCriOS\//.test(ua);
}

/**
 * Where the backdrop under (x, y) is sampled from, as an offset in -1..1 on each axis (scaled by
 * the filter's strength). Inside the flat middle nothing moves; across the bezel (the band of
 * width `bezel` along the edge) the sample is pulled inward, most at the very edge, following
 * the slope of a rounded lens. So the rim shows the content just inside it, bent.
 */
export function displacementAt(x: number, y: number, w: number, h: number, radius: number, bezel: number): [number, number] {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const px = x - w / 2;
  const py = y - h / 2;
  const qx = Math.abs(px) - (w / 2 - r);
  const qy = Math.abs(py) - (h / 2 - r);
  // Signed distance to the rounded rectangle (negative inside), and the outward normal.
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const outside = Math.hypot(ox, oy);
  const dist = outside + Math.min(Math.max(qx, qy), 0) - r;
  const depth = -dist;
  if (depth >= bezel || depth < 0 || bezel <= 0) return [0, 0];
  let nx: number;
  let ny: number;
  if (outside > 0) {
    nx = ox / outside;
    ny = oy / outside;
  } else if (qx > qy) {
    nx = 1;
    ny = 0;
  } else {
    nx = 0;
    ny = 1;
  }
  nx *= Math.sign(px) || 1;
  ny *= Math.sign(py) || 1;
  // 1 at the edge, 0 where the bezel meets the flat middle: the slope of a quarter circle.
  const s = depth / bezel;
  const mag = 1 - Math.sqrt(s * (2 - s));
  return [-nx * mag, -ny * mag];
}

/** The displacement map as RGBA pixels: red carries x, green y, 128 meaning "stay". */
export function displacementPixels(w: number, h: number, radius: number, bezel: number): Uint8ClampedArray<ArrayBuffer> {
  const px = new Uint8ClampedArray(new ArrayBuffer(w * h * 4));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [dx, dy] = displacementAt(x + 0.5, y + 0.5, w, h, radius, bezel);
      const i = (y * w + x) * 4;
      px[i] = Math.round(128 + dx * 127);
      px[i + 1] = Math.round(128 + dy * 127);
      px[i + 2] = 128;
      px[i + 3] = 255;
    }
  }
  return px;
}
