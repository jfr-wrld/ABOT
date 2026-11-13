import { describe, expect, it } from "vitest";
import { bundledThumb, hasPhoto, localPhoto, ownPhotos, remotePhotoOf } from "./exercise-photo";
import { SEED_EXERCISES } from "@/data/exercises";

const fedb = (id: string, images: string[]) => ({ id: `fedb-${id}`, media: images.length ? { motionUrls: images } : {} });

describe("hasPhoto", () => {
  it("is true for a seed exercise with its bundled photo and false for the one without", () => {
    expect(hasPhoto(SEED_EXERCISES.find((e) => e.id === "bench-press-barbell")!)).toBe(true);
    expect(hasPhoto(SEED_EXERCISES.find((e) => e.id === "pike-push-up")!)).toBe(false);
  });

  it("needs images on a free-exercise-db row: no file ships for one without", () => {
    expect(hasPhoto(fedb("Ab_Roller", ["https://x/Ab_Roller/0.jpg"]))).toBe(true);
    expect(bundledThumb(fedb("Ab_Roller", ["https://x/Ab_Roller/0.jpg"]))).toBe("/thumbs/fedb/Ab_Roller.webp");
    expect(hasPhoto(fedb("Kettlebell_Halo", []))).toBe(false);
  });

  it("is false for Atlas and custom exercises", () => {
    expect(hasPhoto({ id: "atlas-chest-press-machine", media: {} })).toBe(false);
    expect(hasPhoto({ id: "custom-123", media: {} })).toBe(false);
  });
});

describe("the lifter's own photos", () => {
  const jpeg = "data:image/jpeg;base64,/9j/AAAA";
  it("count as a photo, start first, and never as a remote one", () => {
    const mine = { id: "custom-1", media: { motionUrls: [jpeg, jpeg.replace("AAAA", "BBBB")] } };
    expect(hasPhoto(mine)).toBe(true);
    expect(localPhoto(mine)).toBe(jpeg);
    expect(ownPhotos(mine)).toHaveLength(2);
    expect(remotePhotoOf(mine)).toBeUndefined();
  });
  it("leave dataset links alone", () => {
    expect(ownPhotos({ id: "x", media: { motionUrls: ["https://x/0.jpg"] } })).toEqual([]);
  });
});
