"use client";

import { useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";

/**
 * Reorder the workout's exercises: drag a row by its handle, or use the arrows (the keyboard and
 * screen reader route). Nothing changes until Done, so a stray drag can be undone with Cancel.
 */
export function ReorderSheet({ onClose }: { onClose: () => void }) {
  const exercises = useWorkoutStore((s) => s.active?.exercises ?? []);
  const reorder = useWorkoutStore((s) => s.reorderExercises);
  const { byId } = useAllExercises();
  const [order, setOrder] = useState(() => exercises.map((e) => e.id));
  const byItem = new Map(exercises.map((e) => [e.id, e]));

  const move = (i: number, dir: -1 | 1) =>
    setOrder((o) => {
      const j = i + dir;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <Sheet
      open
      onClose={onClose}
      title="Reorder exercises"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              reorder(order);
              onClose();
            }}
          >
            Done
          </Button>
        </div>
      }
    >
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="flex flex-col gap-1.5">
        {order.map((id, i) => {
          const item = byItem.get(id);
          const ex = item ? byId[item.exerciseId] : undefined;
          const name = ex?.name ?? "Removed exercise";
          return (
            <Row key={id} id={id}>
              {(controls) => (
                <>
                  <button
                    type="button"
                    aria-hidden="true"
                    tabIndex={-1}
                    onPointerDown={(e) => controls.start(e)}
                    className="flex h-12 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-text-muted active:cursor-grabbing"
                  >
                    <GripVertical size={18} />
                  </button>
                  {ex && <ExerciseThumb exercise={ex} size={40} />}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${name} up`}
                    className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-white/[0.06] hover:text-text disabled:opacity-30"
                  >
                    <ChevronUp aria-hidden="true" size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === order.length - 1}
                    aria-label={`Move ${name} down`}
                    className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-white/[0.06] hover:text-text disabled:opacity-30"
                  >
                    <ChevronDown aria-hidden="true" size={18} />
                  </button>
                </>
              )}
            </Row>
          );
        })}
      </Reorder.Group>
    </Sheet>
  );
}

function Row({ id, children }: { id: string; children: (controls: ReturnType<typeof useDragControls>) => React.ReactNode }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-surface-2 pr-1"
      whileDrag={{ scale: 1.02, boxShadow: "0 12px 30px rgb(0 0 0 / 0.5)" }}
    >
      {children(controls)}
    </Reorder.Item>
  );
}
