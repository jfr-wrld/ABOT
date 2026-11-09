import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { expectNoHorizontalOverflow, freshStart } from "./helpers";

const HEVY = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Push Day","15 Jan 2024, 08:30","15 Jan 2024, 09:35","","Bench Press (Barbell)",,"",0,"warmup",40,10,,,
"Push Day","15 Jan 2024, 08:30","15 Jan 2024, 09:35","","Bench Press (Barbell)",,"",1,"normal",80,8,,,
"Push Day","15 Jan 2024, 08:30","15 Jan 2024, 09:35","","Cable Zottman Curl",,"",0,"normal",20,12,,,
"Heavy Bench","22 Jan 2024, 08:30","22 Jan 2024, 09:20","","Bench Press (Barbell)",,"",0,"normal",92.5,3,,,`;

const STRONG = `Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE
2023-03-02 07:15:00;"Upper A";1h 5m;"Barbell Bench Press";1;225;5;0;0;"";"";`;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await freshStart(page);
});

test("a Hevy export is previewed, imported once, and counts toward records", async ({ page }, info) => {
  const file = info.outputPath("hevy.csv");
  await writeFile(file, HEVY);
  await page.goto("/settings?section=data");
  await page.getByLabel("CSV file").setInputFiles(file);

  await expect(page.getByText("Hevy export")).toBeVisible();
  await expect(page.getByText(/2 workouts, 4 sets/)).toBeVisible();
  await expect(page.getByText("1 new custom exercise:")).toBeVisible();
  await expect(page.getByText("Cable Zottman Curl")).toBeVisible();
  // kg is in the file's header, so there is no unit question.
  await expect(page.getByRole("radiogroup", { name: "Weights in this file are in" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Import 2 workouts" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Imported 2 workouts" })).toBeVisible();

  // The same file again adds nothing.
  await page.getByLabel("CSV file").setInputFiles(file);
  await expect(page.getByRole("button", { name: "Nothing new to import" })).toBeDisabled();

  // Home lists recent workouts.
  await page.goto("/");
  await expect(page.getByText("Heavy Bench")).toBeVisible();
  await expect(page.getByText("Push Day")).toBeVisible();

  // Records are worked out from the imported history: the heaviest bench is the 92.5 kg set.
  await page.goto("/exercises/detail?id=bench-press-barbell");
  await expect(page.getByRole("heading", { name: "Personal records" })).toBeVisible();
  await expect(page.getByText(/92\.5/).first()).toBeVisible();

  await page.goto("/exercises");
  await expect(page.getByRole("link", { name: /Cable Zottman Curl/ })).toBeVisible();
});

test("a Strong export without units asks for the unit and converts pounds", async ({ page }, info) => {
  const file = info.outputPath("strong.csv");
  await writeFile(file, STRONG);
  await page.goto("/settings?section=data");
  await page.getByLabel("CSV file").setInputFiles(file);
  await expect(page.getByText("Strong export")).toBeVisible();
  await expect(page.getByText("1 exercise name matched to the library.")).toBeVisible();
  await page.getByRole("radiogroup", { name: "Weights in this file are in" }).getByText("lbs").click();
  await page.getByRole("button", { name: "Import 1 workout" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Imported 1 workout" })).toBeVisible();
  const kg = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, no) => {
      const r = indexedDB.open("abot");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
    const rows = await new Promise<{ exercises: { sets: { weightKg: number }[] }[] }[]>((ok) => {
      const q = db.transaction("sessions").objectStore("sessions").getAll();
      q.onsuccess = () => ok(q.result);
    });
    return rows[0]!.exercises[0]!.sets[0]!.weightKg;
  });
  expect(kg).toBeCloseTo(102.06, 1);
});

test("a file that is not a workout export is refused with the reason", async ({ page }, info) => {
  const file = info.outputPath("contacts.csv");
  await writeFile(file, "name,email\nAna,ana@example.com\n");
  await page.goto("/settings?section=data");
  await page.getByLabel("CSV file").setInputFiles(file);
  await expect(page.getByRole("alert").filter({ hasText: "does not look like a workout export" })).toBeVisible();
});
