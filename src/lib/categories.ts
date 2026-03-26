export const DEFAULT_CATEGORIES = [
  "Dairy",
  "Vegetables",
  "Fruits",
  "Meat",
  "Beverages",
  "Snacks",
  "Grains",
  "Condiments",
  "Frozen",
  "General",
] as const;

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];

export const categoryEmoji: Record<string, string> = {
  Dairy: "🥛",
  Vegetables: "🥦",
  Fruits: "🍎",
  Meat: "🍖",
  Beverages: "🥤",
  Snacks: "🍿",
  Grains: "🌾",
  Condiments: "🫙",
  Frozen: "🧊",
  General: "📦",
};

/** Returns the emoji for a category, or 🏷️ for custom/unknown categories. */
export function getEmojiForCategory(category: string): string {
  return categoryEmoji[category] ?? "🏷️";
}
