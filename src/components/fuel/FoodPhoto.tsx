"use client";

import { useState } from "react";
import { FOOD_PHOTOS } from "@/data/food-photos.generated";
import { FoodIcon } from "@/components/phase/foodIcons";

/**
 * A food's bundled photo (public/food/<id>.webp, works offline), or its drawn icon when there
 * is none. The food's name is always written next to it, so the picture is decorative.
 */
export function FoodPhoto({ id, size, className = "" }: { id: string; size: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const has = !failed && id in FOOD_PHOTOS;
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-surface-2 text-text ${className}`}
    >
      {has ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export; files are already small WebP
        <img
          src={`/food/${id}.webp`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <FoodIcon id={id} size={Math.round(size * 0.45)} />
      )}
    </span>
  );
}
