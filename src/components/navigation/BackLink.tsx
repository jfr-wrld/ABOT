"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { normalizePath } from "@/components/layout/usePagePath";
import { previousIs } from "@/lib/nav-memory";

/**
 * A "‹ Parent" link. When the parent is the page the lifter came from, it goes back in history
 * instead of opening the parent fresh, so the parent comes back where it was scrolled (and its
 * tab and filters with it). Opened any other way, it is a plain link.
 */
export function BackLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (previousIs(normalizePath(href.split(/[?#]/)[0]!))) {
          e.preventDefault();
          router.back();
        }
      }}
      {...rest}
    />
  );
}
