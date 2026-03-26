"use client";

import { useState } from "react";
import { useCategories } from "@/hooks/useCategories";
import { showToast } from "@/lib/toastStore";

interface Props {
  value: string;
  onChange: (val: string) => void;
  userId: string;
  style?: React.CSSProperties;
  className?: string;
}

export default function CategorySelect({
  value,
  onChange,
  userId,
  style,
  className,
}: Props) {
  const { allCategories, addCategory, loading } = useCategories(userId);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [adding, setAdding] = useState(false);

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === "__add_new__") {
      setShowNewInput(true);
    } else {
      setShowNewInput(false);
      onChange(e.target.value);
    }
  }

  async function handleAddCategory() {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    setAdding(true);
    const ok = await addCategory(trimmed);
    if (ok) {
      onChange(trimmed);
      showToast(`"${trimmed}" category add ho gayi! 🏷️`, "success");
    }
    setNewCatName("");
    setShowNewInput(false);
    setAdding(false);
  }

  function handleCancelNew() {
    setShowNewInput(false);
    setNewCatName("");
  }

  return (
    <div>
      <select
        value={showNewInput ? "__add_new__" : value}
        onChange={handleSelectChange}
        className={className}
        style={style}
        disabled={loading}
      >
        {allCategories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
        <option disabled>──────────</option>
        <option value="__add_new__">➕ Nayi category banao</option>
      </select>

      {showNewInput && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCategory();
              }
              if (e.key === "Escape") handleCancelNew();
            }}
            placeholder="Category ka naam..."
            maxLength={30}
            autoFocus
            className="flex-1 h-[44px] border rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            style={style}
          />
          <button
            type="button"
            onClick={handleAddCategory}
            disabled={!newCatName.trim() || adding}
            className="h-[44px] px-4 bg-green-600 active:bg-green-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors flex items-center justify-center"
          >
            {adding ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Add"
            )}
          </button>
          <button
            type="button"
            onClick={handleCancelNew}
            className="h-[44px] w-[44px] flex items-center justify-center rounded-xl border text-sm"
            style={style}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
