"use client";

import { useRef, useState } from "react";
import { supabase, InventoryItem } from "@/lib/supabase";
import { showToast } from "@/lib/toastStore";

interface Props {
  item: InventoryItem;
  onDelete: (id: string) => void;
}

const statusBar = {
  good: "sw-card-bar--green",
  expiring_soon: "sw-card-bar--amber",
  expired: "sw-card-bar--red",
};

const statusBadge = {
  good: "sw-badge--green",
  expiring_soon: "sw-badge--amber",
  expired: "sw-badge--red",
};

const statusLabels = {
  good: "✓ Theek",
  expiring_soon: "⏰ Jald",
  expired: "💀 Expired",
};

const categoryEmoji: Record<string, string> = {
  Dairy: "🥛", Vegetables: "🥦", Fruits: "🍎", Meat: "🍖",
  Beverages: "🥤", Snacks: "🍿", Grains: "🌾", Condiments: "🫙",
  Frozen: "🧊", General: "📦",
};

function daysRemaining(dateStr: string): { text: string; urgent: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr + "T00:00:00");
  const diff = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return { text: "Aaj expire!", urgent: true };
  if (diff > 0) return { text: `${diff} din baaki`, urgent: diff <= 3 };
  return { text: `${Math.abs(diff)} din pehle`, urgent: false };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
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
    if (swipeX < -SWIPE_THRESHOLD / 2) setSwipeX(-SWIPE_THRESHOLD);
    else setSwipeX(0);
    startX.current = null;
  }

  async function handleDelete() {
    const confirmed = window.confirm(`"${item.name}" delete karna chahte ho?`);
    if (!confirmed) { setSwipeX(0); return; }
    setDeleting(true);
    const { error } = await supabase.from("inventory").delete().eq("id", item.id);
    if (error) {
      showToast("Delete nahi hua, dobara try karo", "error");
      setDeleting(false);
      setSwipeX(0);
    } else {
      showToast(`"${item.name}" delete ho gaya`, "success");
      onDelete(item.id);
    }
  }

  const days = daysRemaining(item.expiry_date);
  const emoji = categoryEmoji[item.category] ?? "📦";

  return (
    <div className="sw-card-wrap">
      {/* Delete bg */}
      <div className="sw-card-delete-bg">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </div>

      {/* Card */}
      <div
        className="sw-card"
        style={{ transform: `translateX(${swipeX}px)`, touchAction: "pan-y" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (!isDragging.current && swipeX < 0) setSwipeX(0); }}
      >
        {/* Left color bar */}
        <div className={`sw-card-bar ${statusBar[item.status]}`} />

        {/* Image or emoji */}
        <div className="sw-card-thumb">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="sw-card-img" />
          ) : (
            <span className="sw-card-emoji">{emoji}</span>
          )}
        </div>

        {/* Info */}
        <div className="sw-card-info">
          <p className="sw-card-name">{item.name}</p>
          <p className="sw-card-meta">{item.category} · ×{item.quantity}</p>
          <p className={`sw-card-days ${days.urgent ? "sw-card-days--urgent" : ""}`}>{days.text}</p>
        </div>

        {/* Right */}
        <div className="sw-card-right">
          <span className={`sw-badge ${statusBadge[item.status]}`}>{statusLabels[item.status]}</span>
          <span className="sw-card-date">{formatDate(item.expiry_date)}</span>
        </div>
      </div>

      {/* Swipe delete btn */}
      {swipeX <= -SWIPE_THRESHOLD / 2 && (
        <button className="sw-card-delete-btn" onClick={handleDelete} disabled={deleting}>
          {deleting
            ? <div className="sw-spin" />
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          }
        </button>
      )}
    </div>
  );
}
