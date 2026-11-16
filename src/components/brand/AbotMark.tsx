import { MARK_PATH } from "./mark-path";

/**
 * The ABOT mark: a heavy A with a loaded barbell behind it (mark-path.ts). Drawn in
 * currentColor so it takes the surrounding text colour.
 */
export function AbotMark({ size = 24, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
    >
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  );
}

/** Mark plus the "ABOT" wordmark. Render inside an <h1> or a link; the text is the accessible name. */
export function AbotWordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      {/* The mark on the app icon's black tile, Volt in both themes (owner, 2026-11-16): on light
          pages a bare mark could only be the darker lime. On dark pages the tile melts into the page. */}
      <span className="logo-tile flex items-center justify-center rounded-[10px]" style={{ width: size + 6, height: size + 6 }}>
        <AbotMark size={size - 4} />
      </span>
      <span className="text-2xl font-extrabold leading-none tracking-tight">ABOT</span>
    </span>
  );
}
