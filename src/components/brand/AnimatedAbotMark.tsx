"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

/** The same geometry as AbotMark: a flat-top hexagon plate, a 22 hole, an inner ring at 31. */
const HEX = "M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z";
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The ABOT plate assembling itself, the way a plate goes onto a bar: its outline is traced in
 * Volt, the plate fills while turning one flat (60 degrees), the centre hole is punched, the inner
 * ring is scored, and one band of light passes across it (the same sweep as a ticked set). About
 * 0.9 s. With reduced motion it is simply drawn.
 */
export function AnimatedAbotMark({ size = 88, delay = 0 }: { size?: number; delay?: number }) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const at = (t: number) => (reduce ? 0 : delay + t);
  const still = reduce ?? false;

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      fill="none"
      initial={still ? false : { rotate: -60, scale: 0.86 }}
      animate={{ rotate: 0, scale: 1 }}
      transition={{ delay: at(0.15), type: "spring", stiffness: 140, damping: 16 }}
      className="overflow-visible text-accent"
    >
      <defs>
        {/* The hole is a mask: white keeps the plate, the black circle grows to punch it out. */}
        <mask id={`hole-${id}`}>
          <rect width="100" height="100" fill="white" />
          <motion.circle
            cx="50"
            cy="50"
            fill="black"
            initial={still ? false : { r: 0 }}
            animate={{ r: 22 }}
            transition={{ delay: at(0.5), duration: 0.32, ease: EASE }}
          />
        </mask>
        <clipPath id={`plate-${id}`}>
          <path d={HEX} />
        </clipPath>
        <linearGradient id={`sweep-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" stopOpacity="0.55" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 1. Outline traced. */}
      <motion.path
        d={HEX}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinejoin="round"
        initial={still ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: at(0), duration: 0.45, ease: EASE }}
      />
      {/* 2. Plate fills, 3. hole punched (mask). */}
      <motion.path
        d={HEX}
        fill="currentColor"
        mask={`url(#hole-${id})`}
        initial={still ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: at(0.3), duration: 0.25 }}
      />
      {/* 4. Inner ring scored. */}
      <motion.circle
        cx="50"
        cy="50"
        r="31"
        stroke="var(--color-bg, #09090b)"
        strokeWidth={2.5}
        initial={still ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: at(0.62), duration: 0.35, ease: EASE }}
        style={{ rotate: -90, transformOrigin: "50px 50px" }}
      />
      {/* 5. One band of light across the plate. */}
      {!still && (
        <g clipPath={`url(#plate-${id})`}>
          <motion.rect
            y="0"
            width="40"
            height="100"
            fill={`url(#sweep-${id})`}
            initial={{ x: -50 }}
            animate={{ x: 120 }}
            transition={{ delay: at(0.85), duration: 0.5, ease: "easeInOut" }}
          />
        </g>
      )}
    </motion.svg>
  );
}

/** "ABOT", each letter rising out of a slot one after another. */
export function AnimatedWordmark({ delay = 0, className = "" }: { delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span aria-hidden="true" className={`flex overflow-hidden ${className}`}>
      {"ABOT".split("").map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={reduce ? false : { y: "105%" }}
          animate={{ y: 0 }}
          transition={{ delay: reduce ? 0 : delay + i * 0.06, type: "spring", stiffness: 380, damping: 26 }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}
