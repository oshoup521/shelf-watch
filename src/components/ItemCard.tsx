"use client";

import { useRef, useState } from "react";
import { supabase, InventoryItem } from "@/lib/supabase";
import { showToast } from "@/lib/toastStore";

interface Props {
  item: InventoryItem;
  onDelete: (id: string) => void;
  onEdit: (item: InventoryItem) => void;
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

export default function ItemCard({ item, onDelete, onEdit }: Props) {
  const [swipeX, setSwipeX] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const startX = useRef<number | null>(null);
  const isDragging = useRef(false);
  const SWIPE_THRESHOLD = 144; // 2 buttons × 72px each

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

  function handleEdit() {
    setSwipeX(0);
    onEdit(item);
  }

  const days = daysRemaining(item.expiry_date);
  const emoji = categoryEmoji[item.category] ?? "📦";

  return (
    <div className="sw-card-wrap">
      {/* Actions background — two-tone hint visible as card slides */}
      <div className="sw-card-actions-bg">
        <div className="sw-card-edit-bg-hint">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </div>
        <div className="sw-card-delete-bg-hint">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </div>
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

        {/* Desktop hover actions — hidden on touch devices */}
        <div className="sw-card-hover-actions">
          <button
            className="sw-card-hover-edit"
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            title="Edit karo"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button
            className="sw-card-hover-delete"
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            title="Delete karo"
            disabled={deleting}
          >
            {deleting ? <div className="sw-spin" style={{ width: 12, height: 12 }} /> : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                </svg>
                Delete
              </>
            )}
          </button>
        </div>
      </div>

      {/* Swipe action buttons */}
      {swipeX <= -SWIPE_THRESHOLD / 2 && (
        <>
          <button className="sw-card-edit-btn" onClick={handleEdit}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span className="sw-card-action-label">Edit</span>
          </button>
          <button className="sw-card-delete-btn" onClick={handleDelete} disabled={deleting}>
            {deleting
              ? <div className="sw-spin" />
              : <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                  </svg>
                  <span className="sw-card-action-label">Delete</span>
                </>
            }
          </button>
        </>
      )}
    </div>
  );
}
