import { Banana, Bean, Beef, Coffee, Drumstick, Egg, EggFried, Fish, GlassWater, Milk, Nut, Salad, Soup, Sprout, Wheat, CupSoda, Cherry, type LucideIcon } from "lucide-react";
import type { FoodCategory } from "@/lib/nutrition-guide";

/** A drawn icon per food, so the guide reads by picture first. */
export const FOOD_ICON: Record<string, LucideIcon> = {
  "chicken-breast": Drumstick,
  "chicken-thigh": Drumstick,
  egg: Egg,
  "egg-white": EggFried,
  tempeh: Bean,
  tofu: Bean,
  tuna: Fish,
  tilapia: Fish,
  salmon: Fish,
  "beef-lean": Beef,
  "greek-yogurt": Milk,
  "white-rice": Wheat,
  "brown-rice": Wheat,
  potato: Sprout,
  "sweet-potato": Sprout,
  oats: Wheat,
  avocado: Cherry,
  "peanut-butter": Nut,
  banana: Banana,
  whey: CupSoda,
  "black-coffee": Coffee,
  water: GlassWater,
  "coconut-water": GlassWater,
  "soy-milk": Milk,
};

export const CATEGORY_ICON: Record<FoodCategory, LucideIcon> = {
  PROTEIN: Beef,
  CARBS: Wheat,
  FATS: Nut,
  PRE_POST_WORKOUT: Soup,
  DRINK_HYDRATION: GlassWater,
};

/** A food's icon as a component, so pages do not build one during render. */
export function FoodIcon({ id, size, className }: { id: string; size: number; className?: string }) {
  const Icon = FOOD_ICON[id] ?? Salad;
  return <Icon aria-hidden="true" size={size} className={className} />;
}
