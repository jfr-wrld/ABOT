"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption<V extends string | number> {
  value: V;
  label: string;
  /** Decorative picture shown before the label, in the list and on the button. */
  icon?: ReactNode;
}

/**
 * The app's dropdown. A native <select> opens the operating system's menu (white or grey, with
 * the system's blue highlight), which breaks the Obsidian and Volt theme, so this draws its own
 * list. It follows the WAI-ARIA select-only combobox pattern: arrow keys, Home/End, Enter or
 * Space to choose, Escape to close, typing a letter to jump. Pair it with <label htmlFor={id}>.
 */
export function Select<V extends string | number>({
  id,
  value,
  options,
  onChange,
  className = "",
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: V;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const autoId = useId();
  const buttonId = id ?? `select-${autoId}`;
  const listId = `${buttonId}-list`;
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selectedIndex];

  // Place the list under the button (or above it when there is more room there).
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const wanted = Math.min(320, options.length * 44 + 8);
    const up = below < wanted && above > below;
    const maxHeight = Math.max(120, Math.min(wanted, up ? above : below));
    // At least 200px wide, never past either screen edge (8px gutter).
    const width = Math.min(Math.max(r.width, 200), window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPos({ top: up ? r.top - 4 - maxHeight : r.bottom + 4, left, width, maxHeight });
  }, [open, options.length]);

  // Focus moves into the list once it is on screen (it renders after its position is known).
  useEffect(() => {
    if (open && pos) list.current?.focus({ preventScroll: true });
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const openedAt = button.current?.getBoundingClientRect().top ?? 0;
    const close = (e: Event) => {
      const t = e.target as Node;
      // Scrolling or tapping inside the list (or on the button) is not "leaving" it.
      if (list.current?.contains(t) || (e.type === "pointerdown" && button.current?.contains(t))) return;
      // A scroll event can arrive late, from a scroll that happened before the tap. Only a
      // scroll that really moved the button away from its list closes it.
      if (e.type === "scroll" && Math.abs((button.current?.getBoundingClientRect().top ?? 0) - openedAt) < 2) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  // Keep the highlighted option visible by scrolling the list only, never the page.
  useEffect(() => {
    const ul = list.current;
    const li = open ? document.getElementById(`${listId}-${active}`) : null;
    if (!ul || !li) return;
    if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop - 4;
    else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight + 4;
  }, [open, pos, active, listId]);

  function show(index = selectedIndex) {
    setActive(index);
    setOpen(true);
  }
  function choose(index: number) {
    const o = options[index];
    if (o) onChange(o.value);
    setOpen(false);
    button.current?.focus();
  }

  function onListKey(e: KeyboardEvent) {
    const last = options.length - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((i) => Math.min(last, i + 1)),
      ArrowUp: () => setActive((i) => Math.max(0, i - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(active),
      " ": () => choose(active),
      Escape: () => {
        setOpen(false);
        button.current?.focus();
      },
      Tab: () => setOpen(false),
    };
    const fn = keys[e.key];
    if (fn) {
      if (e.key !== "Tab") e.preventDefault();
      fn();
      return;
    }
    // Typeahead: the next option starting with that letter.
    if (e.key.length === 1) {
      const k = e.key.toLowerCase();
      const order = [...options.keys()].map((i) => (active + 1 + i) % options.length);
      const hit = order.find((i) => options[i]!.label.toLowerCase().startsWith(k));
      if (hit !== undefined) setActive(hit);
    }
  }

  return (
    <>
      <button
        ref={button}
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            show();
          }
        }}
        className={`flex h-11 min-w-0 items-center justify-between gap-2 rounded-ctl border bg-surface-2 px-3 text-left text-sm text-text transition-colors hover:border-white/25 ${
          open ? "border-accent" : "border-white/[0.12]"
        } ${className}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {current?.icon}
          <span className="truncate">{current?.label ?? ""}</span>
        </span>
        <ChevronDown aria-hidden="true" size={16} className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && pos && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={buttonId}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className="fixed z-[70] overflow-y-auto rounded-xl border border-white/[0.1] bg-surface-2 p-1 shadow-[0_12px_40px_rgb(0_0_0/0.6)] outline-none"
        >
          {options.map((o, i) => {
            const selected = i === selectedIndex;
            return (
              <li
                key={String(o.value)}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm ${
                  i === active ? "bg-white/[0.08] text-text" : "text-text-muted"
                } ${selected ? "font-semibold text-text" : ""}`}
              >
                <Check aria-hidden="true" size={15} className={selected ? "shrink-0 text-accent" : "invisible shrink-0"} />
                {o.icon && <span className="flex w-7 shrink-0 justify-center">{o.icon}</span>}
                <span className="truncate">{o.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
