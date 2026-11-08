import { EQUIPMENT_LABELS, type Equipment } from "@/types/workout";
import { EquipmentIcon } from "@/components/icons/EquipmentIcon";

/**
 * The gear a routine needs, most used first: icon, name and how many of its exercises use it.
 * Answers "can I do this at my gym today?" before the routine is opened.
 */
export function EquipmentNeeded({ equipment }: { equipment: Equipment[] }) {
  const counts = new Map<Equipment, number>();
  for (const e of equipment) counts.set(e, (counts.get(e) ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return null;
  return (
    <ul aria-label="Equipment" className="mt-3 flex flex-wrap gap-1.5">
      {rows.map(([eq, n]) => (
        <li key={eq} className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-surface-2 px-2 py-1 text-xs">
          <span className="text-accent">
            <EquipmentIcon equipment={eq} size={16} />
          </span>
          {EQUIPMENT_LABELS[eq]}
          {n > 1 && <span className="num text-text-muted">×{n}</span>}
        </li>
      ))}
    </ul>
  );
}
