"use client";

import { useState, useCallback } from "react";
import { supabase, InventoryItem } from "@/lib/supabase";
import ItemCard from "@/components/ItemCard";
import AddItemModal from "@/components/AddItemModal";
import { subscribeToPush } from "@/lib/pushNotifications";
import { showToast } from "@/lib/toastStore";

type Filter = "all" | "expiring_soon" | "expired";

interface Props {
  initialInventory: InventoryItem[];
  userId: string;
}

export default function DashboardClient({ initialInventory, userId }: Props) {
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [filter, setFilter] = useState<Filter>("all");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAlertSheet, setShowAlertSheet] = useState<"expired" | "expiring_soon" | null>(null);

  const expiredItems = inventory.filter((i) => i.status === "expired");
  const expiringSoonItems = inventory.filter((i) => i.status === "expiring_soon");
  const showAlert = !alertDismissed && (expiredItems.length > 0 || expiringSoonItems.length > 0);

  function computeStatus(expiry_date: string): InventoryItem["status"] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiry_date + "T00:00:00");
    const diff = Math.round(
      (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff < 0) return "expired";
    if (diff <= 3) return "expiring_soon";
    return "good";
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inventory")
      .select("*")
      .eq("user_id", userId)
      .order("expiry_date", { ascending: true });
    const items: InventoryItem[] = (data ?? []).map(
      (item: Omit<InventoryItem, "status">) => ({
        ...item,
        status: computeStatus(item.expiry_date),
      })
    );
    setInventory(items);
    setLoading(false);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = useCallback((id: string) => {
    setInventory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleModalSuccess = useCallback(() => {
    setShowModal(false);
    refresh();
  }, [refresh]);

  const filtered = inventory.filter((item) => {
    if (filter === "all") return true;
    return item.status === filter;
  });

  const total = inventory.length;
  const expiringSoon = inventory.filter((i) => i.status === "expiring_soon").length;
  const expired = inventory.filter((i) => i.status === "expired").length;
  const good = inventory.filter((i) => i.status === "good").length;

  return (
    <div className="sw-bg" style={{ minHeight: "100dvh", paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>

      {/* ── Header ── */}
      <header className="sw-header" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="sw-header-inner">
          <div className="sw-logo">
            <span className="sw-logo-icon">🛒</span>
            <span className="sw-logo-text">ShelfWatch</span>
          </div>
          <button className="sw-icon-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </header>

      <div className="sw-content">

        {/* ── Hero stat row ── */}
        <div className="sw-stats">
          <div className="sw-stat sw-stat--blue">
            <span className="sw-stat-num">{total}</span>
            <span className="sw-stat-label">Total</span>
          </div>
          <div className="sw-stat sw-stat--green">
            <span className="sw-stat-num">{good}</span>
            <span className="sw-stat-label">Theek Hai</span>
          </div>
          <div className="sw-stat sw-stat--amber">
            <span className="sw-stat-num">{expiringSoon}</span>
            <span className="sw-stat-label">Jald Expire</span>
          </div>
          <div className="sw-stat sw-stat--red">
            <span className="sw-stat-num">{expired}</span>
            <span className="sw-stat-label">Expired</span>
          </div>
        </div>

        {/* ── Alert banner ── */}
        {showAlert && (
          <div className="sw-alert-card">
            {expiredItems.length > 0 && (
              <button className="sw-alert-row sw-alert-row--red sw-alert-row--btn" onClick={() => setShowAlertSheet("expired")}>
                <span className="sw-alert-emoji">🚨</span>
                <div className="sw-alert-body">
                  <p className="sw-alert-title">{expiredItems.length} item expire ho {expiredItems.length === 1 ? "gaya" : "gaye"}!</p>
                  <p className="sw-alert-names">{expiredItems.map((i) => i.name).join(" · ")}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,opacity:0.6}}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
            {expiringSoonItems.length > 0 && (
              <button className="sw-alert-row sw-alert-row--amber sw-alert-row--btn" onClick={() => setShowAlertSheet("expiring_soon")}>
                <span className="sw-alert-emoji">⏰</span>
                <div className="sw-alert-body">
                  <p className="sw-alert-title">{expiringSoonItems.length} item jald expire {expiringSoonItems.length === 1 ? "hoga" : "honge"}!</p>
                  <p className="sw-alert-names">{expiringSoonItems.map((i) => i.name).join(" · ")}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,opacity:0.6}}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
            <button className="sw-alert-dismiss" onClick={() => setAlertDismissed(true)}>
              Theek hai, samajh gaya ✓
            </button>
          </div>
        )}

        {/* ── Filter chips ── */}
        <div className="sw-filters">
          {(["all", "expiring_soon", "expired"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`sw-chip ${filter === f ? "sw-chip--active" : ""}`}
            >
              {f === "all" ? "Sab" : f === "expiring_soon" ? "⏰ Jald" : "💀 Expired"}
            </button>
          ))}
        </div>

        {/* ── Item list ── */}
        {loading ? (
          <div className="sw-skeleton-list">
            {[1, 2, 3].map((i) => <div key={i} className="sw-skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="sw-empty">
            <span className="sw-empty-icon">📦</span>
            <p className="sw-empty-title">
              {filter === "all" ? "Abhi kuch nahi hai" : filter === "expiring_soon" ? "Sab safe hai!" : "Koi expire nahi hua!"}
            </p>
            <p className="sw-empty-sub">
              {filter === "all" ? "+ dabao aur pehla saaman add karo" : "Bahut badhiya 🎉"}
            </p>
          </div>
        ) : (
          <div className="sw-list">
            {filtered.map((item) => (
              <ItemCard key={item.id} item={item} onDelete={handleDelete} />
            ))}
          </div>
        )}
        {/* ── FAB row (sticky, always inside column) ── */}
        <div className="sw-fab-row">
          <button
            onClick={() => setShowModal(true)}
            className="sw-fab"
            aria-label="Add item"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Settings bottom sheet ── */}
      {showSettings && (
        <>
          <div className="sw-backdrop" onClick={() => setShowSettings(false)} />
          <div className="sw-sheet">
            <div className="sw-sheet-handle" />
            <h2 className="sw-sheet-title">Settings</h2>

            <div className="sw-setting-item">
              <div>
                <p className="sw-setting-label">🔔 Push Notifications</p>
                <p className="sw-setting-sub">Expire hone se pehle alert pao</p>
              </div>
              <button
                className="sw-setting-btn"
                onClick={async () => {
                  try {
                    const result = await subscribeToPush(userId);
                    if (result === "ok") {
                      showToast("Notifications enable ho gayi! 🔔", "success");
                      setShowSettings(false);
                    } else {
                      showToast(result, "error");
                    }
                  } catch (err) {
                    showToast(`Error: ${err instanceof Error ? err.message : String(err)}`, "error");
                  }
                }}
              >
                Enable
              </button>
            </div>

            <div className="sw-setting-item">
              <div>
                <p className="sw-setting-label">🚪 Sign Out</p>
                <p className="sw-setting-sub">Account se bahar jao</p>
              </div>
              <button
                className="sw-setting-btn sw-setting-btn--danger"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/login";
                }}
              >
                Bahar Jao
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Alert detail sheet ── */}
      {showAlertSheet && (
        <>
          <div className="sw-backdrop" onClick={() => setShowAlertSheet(null)} />
          <div className="sw-sheet sw-alert-detail-sheet">
            <div className="sw-sheet-handle" />
            <h2 className="sw-sheet-title">
              {showAlertSheet === "expired"
                ? `🚨 ${expiredItems.length} item expire ho gaye`
                : `⏰ ${expiringSoonItems.length} item jald expire honge`}
            </h2>
            <div className="sw-alert-sheet-list">
              {(showAlertSheet === "expired" ? expiredItems : expiringSoonItems).map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onDelete={(id) => {
                    handleDelete(id);
                    const remaining = (showAlertSheet === "expired" ? expiredItems : expiringSoonItems).length - 1;
                    if (remaining === 0) setShowAlertSheet(null);
                  }}
                />
              ))}
            </div>
            <button className="sw-alert-sheet-close" onClick={() => setShowAlertSheet(null)}>
              ✕ Wapas Jao
            </button>
          </div>
        </>
      )}

      {showModal && (
        <AddItemModal
          userId={userId}
          onClose={() => setShowModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
