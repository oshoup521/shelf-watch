"use client";

import { useState, useCallback } from "react";
import {
  ShoppingListItem,
  removeFromShoppingList,
  toggleShoppingListItem,
  clearCheckedItems,
  addToShoppingList,
  saveShoppingList,
  getShoppingList,
} from "@/lib/shoppingListStore";
import { InventoryItem } from "@/lib/supabase";

interface Props {
  userId: string;
  shoppingList: ShoppingListItem[];
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingListItem[]>>;
  suggestedItems: InventoryItem[]; // expired + expiring soon not yet in list
  onClose: () => void;
}

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const CartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);

export default function ShoppingList({ userId, shoppingList, setShoppingList, suggestedItems, onClose }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(1);
  const [customName, setCustomName] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  const unchecked = shoppingList.filter((i) => !i.checked);
  const checked = shoppingList.filter((i) => i.checked);

  const handleToggle = useCallback((id: string) => {
    setShoppingList(toggleShoppingListItem(userId, id));
  }, [userId, setShoppingList]);

  const handleRemove = useCallback((id: string) => {
    setShoppingList(removeFromShoppingList(userId, id));
  }, [userId, setShoppingList]);

  const handleClearChecked = useCallback(() => {
    setShoppingList(clearCheckedItems(userId));
  }, [userId, setShoppingList]);

  const handleAddSuggested = useCallback((item: InventoryItem) => {
    const next = addToShoppingList(userId, {
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      quantity_unit: item.quantity_unit,
      fromInventoryId: item.id,
    });
    setShoppingList(next);
  }, [userId, setShoppingList]);

  const handleAddAllSuggested = useCallback(() => {
    let list = getShoppingList(userId);
    for (const item of suggestedItems) {
      if (!list.some((i) => i.fromInventoryId === item.id)) {
        list = [
          ...list,
          { id: item.id, name: item.name, category: item.category, quantity: item.quantity, quantity_unit: item.quantity_unit, fromInventoryId: item.id, checked: false, addedAt: new Date().toISOString() },
        ];
      }
    }
    saveShoppingList(userId, list);
    setShoppingList(list);
  }, [userId, suggestedItems, setShoppingList]);

  const handleAddCustom = useCallback(() => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const next = addToShoppingList(userId, {
      id,
      name: trimmed,
      category: "Custom",
      quantity: 1,
    });
    setShoppingList(next);
    setCustomName("");
    setAddingCustom(false);
  }, [userId, customName, setShoppingList]);

  const handleUpdateQty = useCallback((id: string, qty: number) => {
    const list = getShoppingList(userId).map((i) =>
      i.id === id ? { ...i, quantity: Math.max(1, qty) } : i
    );
    saveShoppingList(userId, list);
    setShoppingList(list);
    setEditingId(null);
  }, [userId, setShoppingList]);

  return (
    <div className="sw-sheet sw-shopping-sheet">
      <div className="sw-sheet-handle" />

      <div className="sw-shopping-sheet-inner">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingTop: 4 }}>
          <span style={{ fontSize: 22 }}>🛒</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--sw-text)" }}>Shopping List</h2>
            <p style={{ margin: 0, fontSize: 12, color: "var(--sw-muted)" }}>
              {unchecked.length} item baki · {checked.length} kharida
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--sw-muted)", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "4px 8px" }}>✕</button>
        </div>

        {/* ── Suggestions Banner ── */}
        {suggestedItems.length > 0 && (
          <div style={{ background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.25)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#eab308" }}>
                ⚠️ Yeh items khatam hone wale hain!
              </p>
              <button
                onClick={handleAddAllSuggested}
                style={{ fontSize: 11, fontWeight: 600, color: "#eab308", background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                + Sab Add Karo
              </button>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--sw-muted)" }}>
              Repurchase karein?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {suggestedItems.map((item) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "var(--sw-surface2)" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--sw-text)" }}>{item.name}</span>
                    <span style={{ fontSize: 11, color: "var(--sw-muted)", marginLeft: 6 }}>
                      {item.status === "expired" ? "🔴 Expired" : "🟡 Jald Expire"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleAddSuggested(item)}
                    style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#16a34a", border: "none", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Main Shopping List ── */}
        {shoppingList.length === 0 && suggestedItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--sw-muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🛍️</div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Shopping list khaali hai</p>
            <p style={{ margin: "4px 0 0", fontSize: 12 }}>Items add karo ya expire hone par auto-suggest milega</p>
          </div>
        ) : (
          <>
            {unchecked.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "var(--sw-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Kharidna Hai ({unchecked.length})
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {unchecked.map((item) => (
                    <ShoppingRow
                      key={item.id}
                      item={item}
                      onToggle={handleToggle}
                      onRemove={handleRemove}
                      onEditQty={(id, qty) => { setEditingId(id); setEditQty(qty); }}
                      editingId={editingId}
                      editQty={editQty}
                      setEditQty={setEditQty}
                      onSaveQty={handleUpdateQty}
                      onCancelEdit={() => setEditingId(null)}
                    />
                  ))}
                </div>
              </div>
            )}

            {checked.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--sw-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Kharida Gaya ✓ ({checked.length})
                  </p>
                  <button onClick={handleClearChecked} style={{ fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    Clear Karo
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: 0.6 }}>
                  {checked.map((item) => (
                    <ShoppingRow
                      key={item.id}
                      item={item}
                      onToggle={handleToggle}
                      onRemove={handleRemove}
                      onEditQty={(id, qty) => { setEditingId(id); setEditQty(qty); }}
                      editingId={editingId}
                      editQty={editQty}
                      setEditQty={setEditQty}
                      onSaveQty={handleUpdateQty}
                      onCancelEdit={() => setEditingId(null)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Add Custom Item ── */}
        <div style={{ borderTop: "1px solid var(--sw-border)", paddingTop: 14, marginTop: 4 }}>
          {addingCustom ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustom(); } if (e.key === "Escape") setAddingCustom(false); }}
                placeholder="Item ka naam..."
                maxLength={60}
                autoFocus
                style={{ flex: 1, height: 40, borderRadius: 10, border: "1px solid var(--sw-border)", background: "var(--sw-surface)", color: "var(--sw-text)", fontSize: 13, padding: "0 12px", outline: "none" }}
              />
              <button onClick={handleAddCustom} disabled={!customName.trim()}
                style={{ height: 40, padding: "0 14px", borderRadius: 10, background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", opacity: !customName.trim() ? 0.4 : 1 }}>
                Add
              </button>
              <button onClick={() => { setAddingCustom(false); setCustomName(""); }}
                style={{ height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--sw-border)", background: "var(--sw-surface)", color: "var(--sw-muted)", fontSize: 13, cursor: "pointer" }}>
                Ruko
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingCustom(true)}
              style={{ width: "100%", height: 40, borderRadius: 10, border: "1px dashed var(--sw-border)", background: "transparent", color: "var(--sw-muted)", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <CartIcon /> Aur kuch add karo...
            </button>
          )}
        </div>

        {/* Bottom close */}
        <button
          onClick={onClose}
          style={{ width: "100%", marginTop: 14, height: 46, borderRadius: 14, background: "var(--sw-surface2)", border: "1px solid var(--sw-border)", color: "var(--sw-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          ✕ Wapas Jao
        </button>
      </div>
    </div>
  );
}

/* ── Individual row ── */
interface RowProps {
  item: ShoppingListItem;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onEditQty: (id: string, qty: number) => void;
  editingId: string | null;
  editQty: number;
  setEditQty: (v: number) => void;
  onSaveQty: (id: string, qty: number) => void;
  onCancelEdit: () => void;
}

function ShoppingRow({ item, onToggle, onRemove, onEditQty, editingId, editQty, setEditQty, onSaveQty, onCancelEdit }: RowProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "var(--sw-surface2)", transition: "opacity 0.2s" }}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(item.id)}
        style={{ width: 22, height: 22, borderRadius: 6, border: item.checked ? "none" : "2px solid var(--sw-border)", background: item.checked ? "#16a34a" : "transparent", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
        aria-label={item.checked ? "Mark as unchecked" : "Mark as bought"}
      >
        {item.checked && "✓"}
      </button>

      {/* Name + category */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--sw-text)", textDecoration: item.checked ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--sw-muted)" }}>{item.category}</p>
      </div>

      {/* Quantity editor */}
      {editingId === item.id ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="number"
            value={editQty}
            onChange={(e) => setEditQty(Math.max(1, Number(e.target.value)))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSaveQty(item.id, editQty); } if (e.key === "Escape") onCancelEdit(); }}
            min={1}
            style={{ width: 50, height: 28, borderRadius: 6, border: "1px solid var(--sw-border)", background: "var(--sw-surface)", color: "var(--sw-text)", fontSize: 12, textAlign: "center", outline: "none" }}
            autoFocus
          />
          <button onClick={() => onSaveQty(item.id, editQty)} style={{ height: 28, padding: "0 8px", borderRadius: 6, background: "#16a34a", color: "#fff", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer" }}>✓</button>
          <button onClick={onCancelEdit} style={{ height: 28, padding: "0 6px", borderRadius: 6, background: "var(--sw-surface)", border: "1px solid var(--sw-border)", color: "var(--sw-muted)", fontSize: 11, cursor: "pointer" }}>✕</button>
        </div>
      ) : (
        <button
          onClick={() => onEditQty(item.id, item.quantity)}
          style={{ fontSize: 12, color: "var(--sw-muted)", background: "var(--sw-surface)", border: "1px solid var(--sw-border)", borderRadius: 6, padding: "3px 8px", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {item.quantity} {item.quantity_unit ?? "pcs"}
        </button>
      )}

      {/* Delete */}
      <button onClick={() => onRemove(item.id)} style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", flexShrink: 0 }} aria-label="Remove from list">
        <TrashIcon />
      </button>
    </div>
  );
}
