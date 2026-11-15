import type { IconComponent } from "@/components/icons";

/**
 * The picture at the top of an empty state: the subject's icon on a raised tile that floats
 * gently, with a soft ring breathing out behind it, looping a few times before it rests. CSS
 * only (globals.css, `.empty-float`, `.empty-ring`); still with reduced motion or Visual effects:
 * Light.
 */
export function EmptyArt({ icon: Icon }: { icon: IconComponent }) {
  return (
    <span aria-hidden="true" className="empty-art relative mx-auto flex size-20 items-center justify-center">
      <span className="empty-ring absolute inset-1 rounded-full bg-accent-tint" />
      <span className="empty-float tile relative flex size-14 items-center justify-center rounded-2xl border border-line bg-surface text-accent">
        <Icon size={30} variant="bold" />
      </span>
    </span>
  );
}
