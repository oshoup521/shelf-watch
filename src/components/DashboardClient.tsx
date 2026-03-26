"use client";

import { useState, useCallback, useEffect } from "react";
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

const GearIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,opacity:0.5}}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

export default function DashboardClient({ initialInventory, userId }: Props) {
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [filter, setFilter] = useState<Filter>("all");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAlertSheet, setShowAlertSheet] = useState<"expired" | "expiring_soon" | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("sw-theme") as "dark" | "light" | null;
    const preferred = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    const initial = saved ?? preferred;
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("sw-theme", next);
    document.documentElement.dataset.theme = next;
  };

  const expiredItems = inventory.filter((i) => i.status === "expired");
  const expiringSoonItems = inventory.filter((i) => i.status === "expiring_soon");
  const showAlert = !alertDismissed && (expiredItems.length > 0 || expiringSoonItems.length > 0);

  function computeStatus(expiry_date: string): InventoryItem["status"] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiry_date + "T00:00:00");
    const diff = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return "expired";
    if (diff <= 3) return "expiring_soon";
    return "good";
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inventory").select("*").eq("user_id", userId).order("expiry_date", { ascending: true });
    const items: InventoryItem[] = (data ?? []).map((item: Omit<InventoryItem, "status">) => ({
      ...item, status: computeStatus(item.expiry_date),
    }));
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

  const filtered = inventory.filter((item) => filter === "all" || item.status === filter);
  const total = inventory.length;
  const expiringSoon = expiringSoonItems.length;
  const expired = expiredItems.length;
  const good = inventory.filter((i) => i.status === "good").length;

  const filterLabel = (f: Filter) =>
    f === "all" ? "Sab Items" : f === "expiring_soon" ? "⏰ Jald Expire" : "💀 Expired Items";

  const enableNotifications = async () => {
    try {
      const result = await subscribeToPush(userId);
      if (result === "ok") { showToast("Notifications enable ho gayi! 🔔", "success"); setShowSettings(false); }
      else showToast(result, "error");
    } catch (err) { showToast(`Error: ${err instanceof Error ? err.message : String(err)}`, "error"); }
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };

  const alertSheetItems = showAlertSheet === "expired" ? expiredItems : expiringSoonItems;
  const alertSheetTitle = showAlertSheet === "expired"
    ? `🚨 ${expiredItems.length} item expire ho gaye`
    : `⏰ ${expiringSoonItems.length} item jald expire honge`;

  /* ─────────────────── ALERT BANNER (shared) ─────────────────── */
  const AlertBanner = ({ cls }: { cls: string }) => !showAlert ? null : (
    <div className={cls}>
      {expiredItems.length > 0 && (
        <button className="sw-alert-row sw-alert-row--red sw-alert-row--btn" onClick={() => setShowAlertSheet("expired")}>
          <span className="sw-alert-emoji">🚨</span>
          <div className="sw-alert-body">
            <p className="sw-alert-title">{expiredItems.length} item expire ho {expiredItems.length === 1 ? "gaya" : "gaye"}!</p>
            <p className="sw-alert-names">{expiredItems.map((i) => i.name).join(" · ")}</p>
          </div>
          <ChevronRight />
        </button>
      )}
      {expiringSoonItems.length > 0 && (
        <button className="sw-alert-row sw-alert-row--amber sw-alert-row--btn" onClick={() => setShowAlertSheet("expiring_soon")}>
          <span className="sw-alert-emoji">⏰</span>
          <div className="sw-alert-body">
            <p className="sw-alert-title">{expiringSoonItems.length} item jald expire {expiringSoonItems.length === 1 ? "hoga" : "honge"}!</p>
            <p className="sw-alert-names">{expiringSoonItems.map((i) => i.name).join(" · ")}</p>
          </div>
          <ChevronRight />
        </button>
      )}
      <button className="sw-alert-dismiss" onClick={() => setAlertDismissed(true)}>
        Theek hai, samajh gaya ✓
      </button>
    </div>
  );

  return (
    <>
      {/* ══════════════════════════════════════════
          MOBILE LAYOUT  (hidden on ≥ 768px)
      ══════════════════════════════════════════ */}
      <div className="mobile-only sw-bg" style={{ minHeight: "100dvh", paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>

        <header className="sw-header" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="sw-header-inner">
            <div className="sw-logo">
              <span className="sw-logo-icon">🛒</span>
              <span className="sw-logo-text">ShelfWatch</span>
            </div>
            <button className="sw-icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <button className="sw-icon-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
              <GearIcon />
            </button>
          </div>
        </header>

        <div className="sw-content">
          <div className="sw-stats">
            <div className="sw-stat sw-stat--blue"><span className="sw-stat-num">{total}</span><span className="sw-stat-label">Total</span></div>
            <div className="sw-stat sw-stat--green"><span className="sw-stat-num">{good}</span><span className="sw-stat-label">Theek Hai</span></div>
            <div className="sw-stat sw-stat--amber"><span className="sw-stat-num">{expiringSoon}</span><span className="sw-stat-label">Jald Expire</span></div>
            <div className="sw-stat sw-stat--red"><span className="sw-stat-num">{expired}</span><span className="sw-stat-label">Expired</span></div>
          </div>

          <AlertBanner cls="sw-alert-card" />

          <div className="sw-filters">
            {(["all", "expiring_soon", "expired"] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`sw-chip ${filter === f ? "sw-chip--active" : ""}`}>
                {f === "all" ? "Sab" : f === "expiring_soon" ? "⏰ Jald" : "💀 Expired"}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="sw-skeleton-list">{[1,2,3].map((i) => <div key={i} className="sw-skeleton" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="sw-empty">
              <span className="sw-empty-icon">📦</span>
              <p className="sw-empty-title">{filter === "all" ? "Abhi kuch nahi hai" : filter === "expiring_soon" ? "Sab safe hai!" : "Koi expire nahi hua!"}</p>
              <p className="sw-empty-sub">{filter === "all" ? "+ dabao aur pehla saaman add karo" : "Bahut badhiya 🎉"}</p>
            </div>
          ) : (
            <div className="sw-list">{filtered.map((item) => <ItemCard key={item.id} item={item} onDelete={handleDelete} />)}</div>
          )}

          <div className="sw-fab-row">
            <button onClick={() => setShowModal(true)} className="sw-fab" aria-label="Add item"><PlusIcon /></button>
          </div>
        </div>

        {/* Mobile – Settings bottom sheet */}
        {showSettings && (
          <>
            <div className="sw-backdrop" onClick={() => setShowSettings(false)} />
            <div className="sw-sheet">
              <div className="sw-sheet-handle" />
              <h2 className="sw-sheet-title">Settings</h2>
              <div className="sw-setting-item">
                <div><p className="sw-setting-label">🔔 Push Notifications</p><p className="sw-setting-sub">Expire hone se pehle alert pao</p></div>
                <button className="sw-setting-btn" onClick={enableNotifications}>Enable</button>
              </div>
              <div className="sw-setting-item">
                <div><p className="sw-setting-label">🚪 Sign Out</p><p className="sw-setting-sub">Account se bahar jao</p></div>
                <button className="sw-setting-btn sw-setting-btn--danger" onClick={signOut}>Bahar Jao</button>
              </div>
            </div>
          </>
        )}

        {/* Mobile – Alert detail bottom sheet */}
        {showAlertSheet && (
          <>
            <div className="sw-backdrop" onClick={() => setShowAlertSheet(null)} />
            <div className="sw-sheet sw-alert-detail-sheet">
              <div className="sw-sheet-handle" />
              <h2 className="sw-sheet-title">{alertSheetTitle}</h2>
              <div className="sw-alert-sheet-list">
                {alertSheetItems.map((item) => (
                  <ItemCard key={item.id} item={item} onDelete={(id) => {
                    handleDelete(id);
                    if (alertSheetItems.length - 1 === 0) setShowAlertSheet(null);
                  }} />
                ))}
              </div>
              <button className="sw-alert-sheet-close" onClick={() => setShowAlertSheet(null)}>✕ Wapas Jao</button>
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════
          DESKTOP LAYOUT  (hidden on < 768px)
      ══════════════════════════════════════════ */}
      <div className="desktop-only dsk-root">

        {/* Desktop Header */}
        <header className="dsk-header">
          <div className="dsk-header-inner">
            <div className="dsk-logo">
              <span className="dsk-logo-icon">🛒</span>
              <span className="dsk-logo-text">ShelfWatch</span>
            </div>
            <button className="dsk-add-btn" onClick={() => setShowModal(true)}>
              <PlusIcon /> Add Item
            </button>
            <button className="dsk-icon-btn" onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <button className="dsk-icon-btn" onClick={() => setShowSettings(true)} title="Settings">
              <GearIcon />
            </button>
          </div>
        </header>

        {/* Desktop Body */}
        <div className="dsk-body">

          {/* Left Sidebar */}
          <aside className="dsk-sidebar">

            {/* Stats card */}
            <div className="dsk-sidebar-card">
              <p className="dsk-sidebar-title">Overview</p>
              <div className="dsk-stat-list">
                <div className="dsk-stat-item"><span className="dsk-stat-name">Total Items</span><span className="dsk-stat-val dsk-stat-val--blue">{total}</span></div>
                <div className="dsk-stat-item"><span className="dsk-stat-name">Theek Hai</span><span className="dsk-stat-val dsk-stat-val--green">{good}</span></div>
                <div className="dsk-stat-item"><span className="dsk-stat-name">Jald Expire</span><span className="dsk-stat-val dsk-stat-val--amber">{expiringSoon}</span></div>
                <div className="dsk-stat-item"><span className="dsk-stat-name">Expired</span><span className="dsk-stat-val dsk-stat-val--red">{expired}</span></div>
              </div>
            </div>

            {/* Filter nav */}
            <div className="dsk-sidebar-card">
              <p className="dsk-sidebar-title">Filter</p>
              <nav className="dsk-nav">
                {(["all", "expiring_soon", "expired"] as Filter[]).map((f) => (
                  <button key={f} className={`dsk-nav-item ${filter === f ? "dsk-nav-item--active" : ""}`} onClick={() => setFilter(f)}>
                    {f === "all" ? "📋 Sab Items" : f === "expiring_soon" ? "⏰ Jald Expire" : "💀 Expired"}
                    <span className="dsk-nav-count">{f === "all" ? total : f === "expiring_soon" ? expiringSoon : expired}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Account actions */}
            <div className="dsk-sidebar-card">
              <p className="dsk-sidebar-title">Account</p>
              <button className="dsk-sidebar-action" onClick={enableNotifications}>🔔 Enable Notifications</button>
              <button className="dsk-sidebar-action dsk-sidebar-action--danger" onClick={signOut}>🚪 Sign Out</button>
            </div>
          </aside>

          {/* Main content */}
          <main className="dsk-main">
            <AlertBanner cls="sw-alert-card" />

            <div className="dsk-main-header">
              <h2 className="dsk-section-title">{filterLabel(filter)}</h2>
              <span className="dsk-item-count">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {loading ? (
              <div className="dsk-skeleton-grid">{[1,2,3,4].map((i) => <div key={i} className="dsk-skeleton" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="dsk-empty">
                <span className="dsk-empty-icon">📦</span>
                <p className="dsk-empty-title">{filter === "all" ? "Abhi kuch nahi hai" : filter === "expiring_soon" ? "Sab safe hai!" : "Koi expire nahi hua!"}</p>
                <p className="dsk-empty-sub">{filter === "all" ? '"Add Item" button se pehla item add karo' : "Bahut badhiya 🎉"}</p>
              </div>
            ) : (
              <div className="dsk-grid">{filtered.map((item) => <ItemCard key={item.id} item={item} onDelete={handleDelete} />)}</div>
            )}
          </main>
        </div>

        {/* Desktop – Settings dialog */}
        {showSettings && (
          <>
            <div className="dsk-backdrop" onClick={() => setShowSettings(false)} />
            <div className="dsk-dialog">
              <div className="dsk-dialog-header">
                <p className="dsk-dialog-title">⚙️ Settings</p>
                <button className="dsk-dialog-close" onClick={() => setShowSettings(false)}>✕</button>
              </div>
              <div className="dsk-dialog-body">
                <div className="dsk-settings-item">
                  <div><p className="dsk-settings-label">🔔 Push Notifications</p><p className="dsk-settings-sub">Expire hone se pehle alert pao</p></div>
                  <button className="dsk-settings-btn" onClick={enableNotifications}>Enable</button>
                </div>
                <div className="dsk-settings-item">
                  <div><p className="dsk-settings-label">🚪 Sign Out</p><p className="dsk-settings-sub">Account se bahar jao</p></div>
                  <button className="dsk-settings-btn dsk-settings-btn--danger" onClick={signOut}>Sign Out</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Desktop – Alert detail dialog */}
        {showAlertSheet && (
          <>
            <div className="dsk-backdrop" onClick={() => setShowAlertSheet(null)} />
            <div className="dsk-dialog">
              <div className="dsk-dialog-header">
                <p className="dsk-dialog-title">{alertSheetTitle}</p>
                <button className="dsk-dialog-close" onClick={() => setShowAlertSheet(null)}>✕</button>
              </div>
              <div className="dsk-dialog-body">
                {alertSheetItems.map((item) => (
                  <ItemCard key={item.id} item={item} onDelete={(id) => {
                    handleDelete(id);
                    if (alertSheetItems.length - 1 === 0) setShowAlertSheet(null);
                  }} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Item Modal (shared) */}
      {showModal && (
        <AddItemModal userId={userId} onClose={() => setShowModal(false)} onSuccess={handleModalSuccess} />
      )}
    </>
  );
}
