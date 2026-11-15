"use client";

import { useEffect, useId, type RefObject } from "react";
import { displacementPixels, liquidGlassSupported } from "@/lib/liquid-glass";

const SVG_NS = "http://www.w3.org/2000/svg";

/** One hidden <svg> holds every glass filter on the page. */
function defs(): SVGDefsElement {
  let svg = document.getElementById("liquid-glass-defs") as SVGSVGElement | null;
  if (!svg) {
    svg = document.createElementNS(SVG_NS, "svg");
    svg.id = "liquid-glass-defs";
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.style.pointerEvents = "none";
    svg.appendChild(document.createElementNS(SVG_NS, "defs"));
    document.body.appendChild(svg);
  }
  return svg.firstChild as SVGDefsElement;
}

function mapUrl(w: number, h: number, radius: number, bezel: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.putImageData(new ImageData(displacementPixels(w, h, radius, bezel), w, h), 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Gives the element real liquid glass where the browser can draw it: an SVG filter, sized to the
 * element and redrawn when it resizes, published as `--liquid-filter` for the CSS in globals.css
 * (`.liquid-glass`, `.glass-lens`). `bezel` is how deep the rim bends (px), `strength` how far
 * (px), `blur` a light softening of what shows through; `on` waits for an element that mounts later.
 */
export function useLiquidGlass(ref: RefObject<HTMLElement | null>, { bezel, strength, blur = 0.6, on = true }: { bezel: number; strength: number; blur?: number; on?: boolean }) {
  const id = `liquid-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  useEffect(() => {
    const el = ref.current;
    if (!on || !el || !liquidGlassSupported(navigator.userAgent)) return;
    if (matchMedia("(prefers-reduced-transparency: reduce)").matches) return;
    document.documentElement.dataset.liquid = "on";

    const filter = document.createElementNS(SVG_NS, "filter");
    filter.id = id;
    filter.setAttribute("color-interpolation-filters", "sRGB");
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("primitiveUnits", "userSpaceOnUse");
    defs().appendChild(filter);

    let last = "";
    const draw = () => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      if (w < 4 || h < 4) return;
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      const key = `${w}x${h}x${radius}`;
      if (key === last) return;
      last = key;
      const url = mapUrl(w, h, radius, Math.min(bezel, w / 2, h / 2));
      if (!url) return;
      filter.setAttribute("x", "0");
      filter.setAttribute("y", "0");
      filter.setAttribute("width", String(w));
      filter.setAttribute("height", String(h));
      filter.innerHTML =
        `<feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="soft"/>` +
        `<feImage href="${url}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>` +
        `<feDisplacementMap in="soft" in2="map" scale="${strength}" xChannelSelector="R" yChannelSelector="G"/>`;
      el.style.setProperty("--liquid-filter", `url(#${id})`);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => {
      ro.disconnect();
      filter.remove();
      el.style.removeProperty("--liquid-filter");
    };
  }, [ref, id, bezel, strength, blur, on]);
}
