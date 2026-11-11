"use client";

import { NumberField } from "@/components/ui/NumberField";
import { cmToFtIn, ftInToCm } from "@/lib/units";
import { PROFILE_LIMITS } from "@/types/workout";
import { useT } from "@/i18n";

const FIELD = "!px-3 !text-left !text-base";

/** Height in cm, or feet and inches for lbs users. Always stored in cm. */
export function HeightField({
  imperial,
  heightCm,
  onChange,
}: {
  imperial: boolean;
  heightCm: number | null;
  onChange: (cm: number | null) => void;
}) {
  const [min, max] = PROFILE_LIMITS.heightCm;
  // Stored as typed and flagged when out of range: a check per keystroke would wipe "1" on the way to "170".
  const off = heightCm !== null && (heightCm < min || heightCm > max);
  const t = useT();
  const range = imperial
    ? t("{min} to {max}", { min: `${cmToFtIn(min).ft} ft ${cmToFtIn(min).inch} in`, max: `${cmToFtIn(max).ft} ft ${cmToFtIn(max).inch} in` })
    : t("{min} to {max}", { min, max: `${max} cm` });
  const errorProps = { "aria-invalid": off || undefined, "aria-describedby": off ? "profile-height-error" : undefined };
  // Leaving the field with a height out of range brings it to the nearest one ABOT accepts, so
  // nothing impossible is kept (a backup would drop it anyway).
  const settle = () => {
    if (off && heightCm !== null) onChange(Math.min(max, Math.max(min, heightCm)));
  };

  if (!imperial) {
    return (
      <div onBlur={settle}>
        <label htmlFor="profile-height" className="mb-1 block text-sm font-semibold">
          {t("Height")} <span className="font-normal text-text-muted">(cm)</span>
        </label>
        <NumberField
          id="profile-height"
          aria-label={t("Height in cm")}
          value={heightCm}
          onCommit={onChange}
          max={max}
          placeholder="–"
          className={FIELD}
          {...errorProps}
        />
        {off && <HeightError range={range} />}
      </div>
    );
  }

  const parts = heightCm === null ? null : cmToFtIn(heightCm);
  const set = (ft: number | null, inch: number | null) =>
    onChange(ft === null && inch === null ? null : ftInToCm(ft ?? 0, Math.min(11, inch ?? 0)));
  return (
    <fieldset onBlur={settle}>
      <legend className="mb-1 text-sm font-semibold">{t("Height")}</legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <NumberField
            aria-label={t("Height, feet")}
            value={parts?.ft ?? null}
            onCommit={(ft) => set(ft, parts?.inch ?? null)}
            max={8}
            placeholder="–"
            className={`${FIELD} !pr-9`}
            {...errorProps}
          />
          <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
            ft
          </span>
        </div>
        <div className="relative">
          <NumberField
            aria-label={t("Height, inches")}
            value={parts?.inch ?? null}
            onCommit={(inch) => set(parts?.ft ?? null, inch)}
            max={11}
            placeholder="–"
            className={`${FIELD} !pr-9`}
            {...errorProps}
          />
          <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
            in
          </span>
        </div>
      </div>
      {off && <HeightError range={range} />}
    </fieldset>
  );
}

function HeightError({ range }: { range: string }) {
  const t = useT();
  return (
    <p id="profile-height-error" className="mt-1 text-xs text-failure">
      {t("Enter {range}", { range })}
    </p>
  );
}
