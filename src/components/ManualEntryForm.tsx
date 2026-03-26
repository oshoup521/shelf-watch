"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toastStore";
import { compressImage } from "@/lib/imageUtils";

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

const QUANTITY_UNITS = ["pcs", "kg", "g", "L", "ml", "dozen"];

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
  const [quantityUnit, setQuantityUnit] = useState("pcs");
  const [expiryDate, setExpiryDate] = useState(prefill?.expiry_date ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(file: File | null) {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !expiryDate) return;

    setSubmitting(true);

    const { data: inserted, error } = await supabase
      .from("inventory")
      .insert({
        user_id: userId,
        name: name.trim(),
        category,
        quantity,
        quantity_unit: quantityUnit,
        expiry_date: expiryDate,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      showToast("Add nahi hua, dobara try karo", "error");
      setSubmitting(false);
      return;
    }

    // Compress + upload image if selected
    if (imageFile) {
      try {
        const compressed = await compressImage(imageFile);
        const path = `${userId}/${inserted.id}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("item-images")
          .upload(path, compressed, { contentType: "image/jpeg", upsert: true });

        if (uploadError) {
          showToast("Photo upload nahi hui, baad mein try karo", "warning");
        } else {
          const { data: urlData } = supabase.storage
            .from("item-images")
            .getPublicUrl(path);
          await supabase
            .from("inventory")
            .update({ image_url: urlData.publicUrl })
            .eq("id", inserted.id);
        }
      } catch (err) {
        console.error("[image] unexpected error:", err);
      }
    }

    showToast(`"${name.trim()}" add ho gaya!`, "success");
    onSuccess();
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
        <div className="flex gap-2">
          <input
            type="number"
            value={quantity}
            onChange={(e) =>
              setQuantity(Math.max(1, parseInt(e.target.value) || 1))
            }
            min={1}
            className="flex-1 h-[52px] border border-gray-200 rounded-xl px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            style={inputStyle}
            inputMode="numeric"
          />
          <select
            value={quantityUnit}
            onChange={(e) => setQuantityUnit(e.target.value)}
            className="w-[80px] h-[52px] border border-gray-200 rounded-xl px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            style={inputStyle}
          >
            {QUANTITY_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
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

      {/* Optional image picker */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Photo (optional)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
        />
        {imagePreview ? (
          <div className="relative w-20 h-20">
            <img
              src={imagePreview}
              alt="preview"
              className="w-20 h-20 object-cover rounded-xl"
            />
            <button
              type="button"
              onClick={() => handleImageChange(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center leading-none"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-[52px] w-full border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm flex items-center justify-center gap-2 active:border-green-400 active:text-green-500 transition-colors"
          >
            📷 Photo add karo
          </button>
        )}
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
