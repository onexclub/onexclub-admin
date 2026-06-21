/**
 * North India regional guidance for AI diet plans + catalogue review.
 * **Reuse:** Prompts in generate-ai-fallback; reference for seed data migrations.
 */
export const NORTH_INDIA_REGION =
  "North India (Punjab, Delhi NCR, Himachal Pradesh, Haryana)" as const;

/** Preferred staples — locally available, gym-friendly. */
export const NORTH_INDIA_STAPLES = [
  "Roti / chapati / phulka",
  "Paratha (plain or stuffed)",
  "Brown rice / steamed rice",
  "Dal (moong, masoor, chana)",
  "Paneer bhurji / paneer tikka",
  "Chicken curry / tandoori chicken / grilled chicken",
  "Egg bhurji / boiled eggs",
  "Curd (dahi) / lassi / chaach",
  "Poha / upma / daliya",
  "Sabzi (bhindi, gobhi, baingan, mix veg)",
  "Sprouts chaat / roasted chana",
  "Chana salad / kachumber",
  "Idli / dosa (occasional variety ok)",
] as const;

/** Avoid in generated plans — uncommon or confusing for North Indian members. */
export const NORTH_INDIA_AVOID_FOODS = [
  "Quinoa bowls",
  "Turkey breast / wraps",
  "Baked salmon / cod (use rohu/pomfret fish curry or grilled fish instead)",
  "Greek yogurt (use dahi/curd)",
  "Avocado toast",
  "Cauliflower rice",
  "High-fiber western breakfast cereal",
  "Almond milk (use low-fat doodh unless dairy allergy)",
  "Tofu stir-fry (use paneer/soya chunks for veg)",
] as const;

export function northIndiaDietSystemRules(): string {
  return [
    `All meals must suit ${NORTH_INDIA_REGION} members — familiar home/gym food they can buy locally.`,
    `Prefer: ${NORTH_INDIA_STAPLES.slice(0, 8).join(", ")}.`,
    `Avoid or replace: ${NORTH_INDIA_AVOID_FOODS.slice(0, 6).join(", ")}.`,
    "Use Hindi/regional names where natural (e.g. Dal, Roti, Paneer, Dahi, Poha).",
    "Include realistic portions (roti count, katori dal, grams chicken/paneer).",
    "Tea can be included; prefer chai without excess sugar for weight-loss goals.",
  ].join(" ");
}

export function northIndiaMealSchemaExample() {
  return {
    meal_name: "Breakfast",
    meal_time: "08:00",
    meal_type: "breakfast",
    foods: [
      { name: "Anda Bhurji", qty: "2 eggs", calories: 180, protein_g: 14, carbs_g: 4, fat_g: 12 },
      { name: "Roti", qty: "2", calories: 122, protein_g: 5, carbs_g: 30, fat_g: 2 },
    ],
    calories: 302,
    protein_g: 19,
    carbs_g: 34,
    fat_g: 14,
    preparation_note: "Home-style anda bhurji with phulka — Punjabi/Delhi gym breakfast",
  };
}
