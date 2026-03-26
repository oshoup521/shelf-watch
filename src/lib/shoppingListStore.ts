"use client";

export type ShoppingListItem = {
  id: string;           // unique id (inventory item id or custom uuid)
  name: string;
  category: string;
  quantity: number;
  quantity_unit?: string;
  checked: boolean;
  addedAt: string;      // ISO timestamp
  fromInventoryId?: string; // source inventory item id
};

const KEY_PREFIX = "sw-shopping-list-";

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export function getShoppingList(userId: string): ShoppingListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ShoppingListItem[];
    // Deduplicate by id in case of stale/corrupted data
    const seen = new Set<string>();
    return parsed.filter((i) => i.id && !seen.has(i.id) && seen.add(i.id));
  } catch {
    return [];
  }
}

export function saveShoppingList(userId: string, list: ShoppingListItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list));
  } catch { /* quota exceeded */ }
}

export function addToShoppingList(
  userId: string,
  item: Omit<ShoppingListItem, "checked" | "addedAt">
): ShoppingListItem[] {
  const list = getShoppingList(userId);
  // Avoid duplicates by id or fromInventoryId
  if (list.some((i) => i.id === item.id)) return list;
  if (item.fromInventoryId && list.some((i) => i.fromInventoryId === item.fromInventoryId)) {
    return list;
  }
  const next: ShoppingListItem[] = [
    ...list,
    { ...item, checked: false, addedAt: new Date().toISOString() },
  ];
  saveShoppingList(userId, next);
  return next;
}

export function removeFromShoppingList(userId: string, id: string): ShoppingListItem[] {
  const next = getShoppingList(userId).filter((i) => i.id !== id);
  saveShoppingList(userId, next);
  return next;
}

export function toggleShoppingListItem(userId: string, id: string): ShoppingListItem[] {
  const next = getShoppingList(userId).map((i) =>
    i.id === id ? { ...i, checked: !i.checked } : i
  );
  saveShoppingList(userId, next);
  return next;
}

export function clearCheckedItems(userId: string): ShoppingListItem[] {
  const next = getShoppingList(userId).filter((i) => !i.checked);
  saveShoppingList(userId, next);
  return next;
}
