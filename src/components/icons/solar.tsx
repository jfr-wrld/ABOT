import { forwardRef, type CSSProperties, type SVGProps } from "react";

export type IconVariant = "duotone" | "linear";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  size?: number | string;
  /** Bold Duotone or Linear; each icon has its own default (see scripts/make-icons.mjs), and
   *  icons of 18 px or less default to Linear. */
  variant?: IconVariant;
  color?: string;
  /** Accepted so call sites written for stroke icons keep compiling; Solar shapes ignore it. */
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
}

export type IconComponent = ReturnType<typeof solarIcon>;

type Shape = { body: string; w: number; h: number };

/**
 * One Solar icon as a component. The SVG bodies come from the generated module, built at
 * development time from the icon set's own files, so nothing is fetched at run time.
 */
export function solarIcon(name: string, fallback: IconVariant, duotone: Shape, linear: Shape) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size = 24, variant, color, style, className, ...props },
    ref,
  ) {
    // Stroke settings mean nothing to Solar's filled shapes; keep them off the <svg>.
    const { strokeWidth: _strokeWidth, absoluteStrokeWidth: _absolute, ...rest } = props;
    void _strokeWidth;
    void _absolute;
    // Duotone needs room: at 18 px and under its two layers close up into a blot, so small icons
    // are drawn in line unless a style is asked for.
    const small = typeof size === "number" ? size <= 18 : parseFloat(size) <= 18;
    const shape = (variant ?? (small ? "linear" : fallback)) === "linear" ? linear : duotone;
    const css: CSSProperties | undefined = color ? { color, ...style } : style;
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox={`0 0 ${shape.w} ${shape.h}`}
        fill="none"
        className={className ? `solar ${className}` : "solar"}
        style={css}
        {...rest}
        dangerouslySetInnerHTML={{ __html: shape.body }}
      />
    );
  });
  Icon.displayName = name;
  return Icon;
}
