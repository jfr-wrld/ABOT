"use client";

import { useRef } from "react";
import { Check } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { useSettingsStore } from "@/store/useSettingsStore";
import { ACCENT_SWATCHES, DEFAULT_ACCENT, isHex, isVeryDark } from "@/lib/accent";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";
import { Choice } from "./controls";
import { AbotMark } from "@/components/brand/AbotMark";
import { APP_ICONS } from "@/lib/app-icons";
import { isNativeApp } from "@/lib/native/files";

/**
 * Settings > General > Appearance: the primary colour (eight swatches or any colour from the
 * picker, with a small live preview), the app icon, and raised 3D or flat components.
 */
export function AppearanceSettings() {
  const t = useT();
  const accent = useSettingsStore((s) => s.accentColor);
  const style = useSettingsStore((s) => s.componentStyle);
  const icon = useSettingsStore((s) => s.appIcon);
  const update = useSettingsStore((s) => s.update);
  const picker = useRef<HTMLInputElement>(null);
  const current = isHex(accent) ? accent.toLowerCase() : DEFAULT_ACCENT;
  const custom = !ACCENT_SWATCHES.some((sw) => sw.hex === current);
  const pick = (hex: string) => {
    if (hex.toLowerCase() !== current) feedback.tick();
    update({ accentColor: hex.toLowerCase() });
  };

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t("Primary colour")}</legend>
        <div role="radiogroup" aria-label={t("Primary colour")} className="flex flex-wrap gap-2">
          {ACCENT_SWATCHES.map((sw) => {
            const on = sw.hex === current;
            return (
              <button
                key={sw.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={t(sw.label)}
                title={t(sw.label)}
                onClick={() => pick(sw.hex)}
                className={`flex size-11 items-center justify-center rounded-full border-2 transition-transform active:scale-95 ${on ? "border-text" : "border-transparent"}`}
              >
                <span className="flex size-8 items-center justify-center rounded-full border border-ink/15" style={{ background: sw.hex }}>
                  {on && <Check aria-hidden="true" size={16} className={sw.id === "white" || sw.id === "volt" || sw.id === "cyan" ? "text-black" : "text-white"} />}
                </span>
              </button>
            );
          })}
          {/* Any colour: the phone's own picker, opened from a rainbow swatch. */}
          <button
            type="button"
            role="radio"
            aria-checked={custom}
            aria-label={t("Custom colour")}
            title={t("Custom colour")}
            onClick={() => picker.current?.click()}
            className={`relative flex size-11 items-center justify-center rounded-full border-2 ${custom ? "border-text" : "border-transparent"}`}
          >
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full"
              style={{ background: custom ? current : "conic-gradient(#f43f5e, #f97316, #facc15, #84cc16, #22d3ee, #6366f1, #d946ef, #f43f5e)" }}
            >
              {custom && <Check size={16} className="text-white mix-blend-difference" />}
            </span>
          </button>
          <input
            ref={picker}
            type="color"
            value={current}
            onChange={(e) => pick(e.target.value)}
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
          />
        </div>
        {custom && isVeryDark(current) && (
          <p className="text-xs text-text-muted">{t("A very dark colour is lightened a little on the dark theme, so buttons and text stay visible.")}</p>
        )}
        {/* What the colour does across the app, in miniature. */}
        <div aria-hidden="true" className="panel mt-1 flex items-center gap-3 p-3">
          <Button variant="primary" tabIndex={-1} className="pointer-events-none min-h-10 px-4 text-sm">
            {t("Start workout")}
          </Button>
          <span className="chip rounded-full px-3 py-1.5 text-xs font-semibold text-accent-text">{t("Push")}</span>
          <span className="size-8 rounded-full border-4 border-accent" />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t("App icon")}</legend>
        <div role="radiogroup" aria-label={t("App icon")} className="grid grid-cols-6 gap-2">
          {APP_ICONS.map((ic) => {
            const on = ic.id === icon;
            return (
              <button
                key={ic.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={t(ic.label)}
                title={t(ic.label)}
                onClick={() => {
                  if (!on) feedback.tick();
                  update({ appIcon: ic.id });
                }}
                className={`flex aspect-square min-h-11 items-center justify-center rounded-[14px] border-2 p-0.5 ${on ? "border-text" : "border-transparent"}`}
              >
                <span className="flex size-full items-center justify-center rounded-[11px] border border-ink/10" style={{ background: ic.bg, color: ic.fg }}>
                  <AbotMark size={24} />
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-text-muted">
          {isNativeApp()
            ? t("The icon on your home screen changes too. Some phones close ABOT once while they redraw it.")
            : t("Used for the logo in the app and the browser tab.")}
        </p>
      </fieldset>

      <Choice
        name="component-style"
        label={t("Components")}
        info={t("3D gives buttons and cards depth; Flat keeps them plain.")}
        value={style}
        options={[
          { value: "3d" as const, label: t("3D") },
          { value: "flat" as const, label: t("Flat") },
        ]}
        onChange={(componentStyle) => update({ componentStyle })}
      />
    </div>
  );
}
