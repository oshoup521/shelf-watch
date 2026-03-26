"use client";

import { useRef, useState } from "react";
import { supabase, InventoryItem } from "@/lib/supabase";
import { showToast } from "@/lib/toastStore";

interface Props {
  item: InventoryItem;
  onDelete: (id: string) => void;
}

const statusStyles = {
  good: "bg-green-100 text-green-700",
  expiring_soon: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
};

const statusLabels = {
  good: "Good",
  expiring_soon: "Jald Expire",
  expired: "Expire Ho Gaya",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysRemaining(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr + "T00:00:00");
  const diff = Math.round(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Aaj expire ho raha hai";
  if (diff > 0) return `${diff} din baaki`;
  return `${Math.abs(diff)} din pehle expire hua`;
}

export default function ItemCard({ item, onDelete }: Props) {
  const [swipeX, setSwipeX] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const startX = useRef<number | null>(null);
  const isDragging = useRef(false);

  const SWIPE_THRESHOLD = 80;

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    isDragging.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) {
      isDragging.current = true;
      setSwipeX(Math.max(dx, -SWIPE_THRESHOLD - 20));
    }
  }

  function onTouchEnd() {
    if (swipeX < -SWIPE_THRESHOLD / 2) {
      setSwipeX(-SWIPE_THRESHOLD);
    } else {
      setSwipeX(0);
    }
    startX.current = null;
  }

  function resetSwipe() {
    setSwipeX(0);
  }

  async function handleDelete() {
    const confirmed = window.confirm(`"${item.name}" delete karna chahte ho?`);
    if (!confirmed) {
      resetSwipe();
      return;
    }
    setDeleting(true);
    const { error } = await supabase
      .from("inventory")
      .delete()
      .eq("id", item.id);
    if (error) {
      showToast("Delete nahi hua, dobara try karo", "error");
      setDeleting(false);
      resetSwipe();
    } else {
      showToast(`"${item.name}" delete ho gaya`, "success");
      onDelete(item.id);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete background */}
      <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-5 rounded-2xl">
        <span className="text-white text-sm font-semibold">Delete</span>
      </div>

      {/* Card content */}
      <div
        className="relative bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between transition-transform"
        style={{ transform: `translateX(${swipeX}px)`, touchAction: "pan-y" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => {
          if (!isDragging.current && swipeX < 0) {
            resetSwipe();
          }
        }}
      >
        {/* Thumbnail */}
        {item.image_url && (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-12 h-12 rounded-xl object-cover mr-3 shrink-0"
          />
        )}

        {/* Left: info */}
        <div className="flex-1 min-w-0 pr-3">
          <p className="font-semibold text-gray-900 truncate">{item.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{item.category}</p>
          <p className="text-xs text-gray-500 mt-1">{daysRemaining(item.expiry_date)}</p>
        </div>

        {/* Right: badges + date */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-xs text-gray-500">{formatDate(item.expiry_date)}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
              ×{item.quantity}
            </span>
            <span
              className={`text-xs rounded-full px-2 py-0.5 font-medium ${statusStyles[item.status]}`}
            >
              {statusLabels[item.status]}
            </span>
          </div>
        </div>
      </div>

      {/* Swipe delete button overlay */}
      {swipeX <= -SWIPE_THRESHOLD / 2 && (
        <button
          className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 rounded-r-2xl flex items-center justify-center"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
