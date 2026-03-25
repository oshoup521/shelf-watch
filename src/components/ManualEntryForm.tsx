"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toastStore";

const CATEGORIES = [
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
];

interface Prefill {
  name?: string;
  category?: string;
  expiry_date?: string;
}

interface Props {
  prefill?: Prefill;
  userId: string;
  onSuccess: () => void;
}

export default function ManualEntryForm({ prefill, userId, onSuccess }: Props) {
  const [name, setName] = useState(prefill?.name ?? "");
  const [category, setCategory] = useState(prefill?.category ?? "General");
  const [quantity, setQuantity] = useState(1);
  const [expiryDate, setExpiryDate] = useState(prefill?.expiry_date ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !expiryDate) return;

    setSubmitting(true);
    const { error } = await supabase.from("inventory").insert({
      user_id: userId,
      name: name.trim(),
      category,
      quantity,
      expiry_date: expiryDate,
    });

    if (error) {
      showToast("Add nahi hua, dobara try karo", "error");
    } else {
      showToast(`"${name.trim()}" add ho gaya!`, "success");
      onSuccess();
    }
    setSubmitting(false);
  }

  /*
   * font-size: 16px on all inputs — iOS Safari zooms in on focus
   * if the input font-size is smaller than 16px.
   */
  const inputStyle: React.CSSProperties = { fontSize: "16px" };
  const inputClass =
    "w-full h-[52px] border border-gray-200 rounded-xl px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Item ka naam *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Amul Doodh"
          required
          className={inputClass}
          style={inputStyle}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Quantity
        </label>
        <input
          type="number"
          value={quantity}
          onChange={(e) =>
            setQuantity(Math.max(1, parseInt(e.target.value) || 1))
          }
          min={1}
          className={inputClass}
          style={inputStyle}
          inputMode="numeric"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Expiry Date *
        </label>
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          required
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !name.trim() || !expiryDate}
        className="w-full h-[56px] bg-green-600 active:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 text-base"
      >
        {submitting ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          "Saaman Add Karo"
        )}
      </button>
    </form>
  );
}
