"use client";

import { useRef, useState } from "react";
import { supabase, InventoryItem } from "@/lib/supabase";
import { showToast } from "@/lib/toastStore";
import { compressImage } from "@/lib/imageUtils";

const CATEGORIES = [
  "Dairy", "Vegetables", "Fruits", "Meat",
  "Beverages", "Snacks", "Grains", "Condiments", "Frozen", "General",
];

interface Props {
  item: InventoryItem;
  userId: string;
  onClose: () => void;
  onSuccess: (updated: InventoryItem) => void;
}

function computeStatus(expiry: string): InventoryItem["status"] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry + "T00:00:00");
  const diff = Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "expired";
  if (diff <= 3) return "expiring_soon";
  return "good";
}

export default function EditItemModal({ item, userId, onClose, onSuccess }: Props) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [quantity, setQuantity] = useState(item.quantity);
  const [expiryDate, setExpiryDate] = useState(item.expiry_date);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(item.image_url ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(file: File | null) {
    if (imagePreview && imagePreview !== item.image_url) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
    setRemoveImage(file === null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !expiryDate) return;
    setSubmitting(true);

    let image_url = item.image_url;

    if (imageFile) {
      try {
        const compressed = await compressImage(imageFile);
        const path = `${userId}/${item.id}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("item-images")
          .upload(path, compressed, { contentType: "image/jpeg", upsert: true });
        if (uploadError) {
          showToast("Photo upload nahi hui", "warning");
        } else {
          const { data: urlData } = supabase.storage.from("item-images").getPublicUrl(path);
          image_url = urlData.publicUrl;
        }
      } catch (err) {
        console.error("[image] unexpected error:", err);
      }
    } else if (removeImage) {
      image_url = undefined;
    }

    const updates = {
      name: name.trim(),
      category,
      quantity,
      expiry_date: expiryDate,
      image_url: image_url ?? null,
    };

    const { error } = await supabase.from("inventory").update(updates).eq("id", item.id);

    if (error) {
      showToast("Update nahi hua, dobara try karo", "error");
      setSubmitting(false);
      return;
    }

    showToast(`"${name.trim()}" update ho gaya! ✅`, "success");
    const updated: InventoryItem = {
      ...item,
      name: updates.name,
      category: updates.category,
      quantity: updates.quantity,
      expiry_date: updates.expiry_date,
      image_url: image_url,
      status: computeStatus(expiryDate),
    };
    onSuccess(updated);
  }

  const inputStyle: React.CSSProperties = { fontSize: "16px" };
  const inputClass =
    "w-full h-[52px] border border-gray-200 rounded-xl px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl overflow-y-auto animate-slide-up"
        style={{
          maxHeight: "calc(90dvh - env(safe-area-inset-top))",
          paddingBottom: "env(safe-area-inset-bottom)",
          overscrollBehavior: "contain",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">✏️ Item Edit Karo</h2>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center text-gray-400 active:text-gray-700 rounded-full"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4 pt-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Item ka naam *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
                <option key={c} value={c}>{c}</option>
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
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
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

          {/* Image picker */}
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
              "Changes Save Karo ✓"
            )}
          </button>
        </form>
      </div>
    </>
  );
}
