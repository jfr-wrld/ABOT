/**
 * The ABOT mark: a flat-top hexagon weight plate with a round centre hole and an inner
 * ring. Drawn in currentColor so it takes the surrounding text colour.
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
      <path
        d="M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z M50 28 A22 22 0 1 0 50.01 28 Z"
        fill="currentColor"
        fillRule="evenodd"
      />
      <circle cx="50" cy="50" r="31" stroke="var(--color-bg, #09090b)" strokeWidth="2.5" />
    </svg>
  );
}

/** Mark plus the "ABOT" wordmark. Render inside an <h1> or a link; the text is the accessible name. */
export function AbotWordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-accent">
        <AbotMark size={size} />
      </span>
      <span className="text-2xl font-extrabold leading-none tracking-tight">ABOT</span>
    </span>
  );
}
