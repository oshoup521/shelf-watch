"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { supabase, InventoryItem } from "@/lib/supabase";
import ItemCard from "@/components/ItemCard";
import AddItemModal from "@/components/AddItemModal";
import EditItemModal from "@/components/EditItemModal";
import { subscribeToPush, getNotificationStatus, unsubscribeFromPush } from "@/lib/pushNotifications";
import { showToast } from "@/lib/toastStore";
import { useCategories } from "@/hooks/useCategories";

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
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAlertSheet, setShowAlertSheet] = useState<"expired" | "expiring_soon" | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"expiry" | "name">("expiry");
  const [isOffline, setIsOffline] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    getNotificationStatus().then(setNotificationsEnabled);
  }, []);

  // ── Custom Categories ──
  const { customCategories, addCategory, deleteCategory } = useCategories(userId);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  async function handleAddCat() {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    setAddingCat(true);
    const ok = await addCategory(trimmed);
    if (ok) showToast(`"${trimmed}" category add ho gayi! 🏷️`, "success");
    if (ok) setNewCatName("");
    setAddingCat(false);
  }

  // ── Pull-to-Refresh ──
  const mobileRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(-1);
  const touchPullY = useRef(0);
  const [pullY, setPullY] = useState(0);
  const PULL_THRESHOLD = 65;
  const MAX_PULL = 80;

  const CACHE_KEY = `sw-inventory-${userId}`;

  // ── Offline detection ──
  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ── Cache initialInventory to localStorage on first load ──
  useEffect(() => {
    if (initialInventory.length > 0) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(initialInventory)); } catch { /* quota exceeded */ }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync inventory to localStorage whenever it updates ──
  useEffect(() => {
    if (inventory.length > 0) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(inventory)); } catch { /* quota exceeded */ }
    }
  }, [inventory]); // eslint-disable-line react-hooks/exhaustive-deps

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
    try {
      const { data, error } = await supabase
        .from("inventory").select("*").eq("user_id", userId).order("expiry_date", { ascending: true });
      if (error) throw error;
      const items: InventoryItem[] = (data ?? []).map((item: Omit<InventoryItem, "status">) => ({
        ...item, status: computeStatus(item.expiry_date),
      }));
      setInventory(items);
      setIsOffline(false);
    } catch {
      // Network failure — load from cache
      setIsOffline(true);
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed: Omit<InventoryItem, "status">[] = JSON.parse(cached);
          setInventory(parsed.map((item) => ({ ...item, status: computeStatus(item.expiry_date) })));
        }
      } catch { /* corrupt cache */ }
    }
    setLoading(false);
  }, [userId, CACHE_KEY]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = useCallback((id: string) => {
    setInventory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleModalSuccess = useCallback(() => {
    setShowModal(false);
    refresh();
  }, [refresh]);

  const handleEditSuccess = useCallback((updated: InventoryItem) => {
    setInventory((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditingItem(null);
  }, []);

  // ── Supabase Real-time Sync ──
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel(`inventory:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory", filter: `user_id=eq.${userId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            const newItem = {
              ...(payload.new as Omit<InventoryItem, "status">),
              status: computeStatus((payload.new as InventoryItem).expiry_date),
            } as InventoryItem;
            setInventory((prev) =>
              [...prev, newItem].sort(
                (a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
              )
            );
          } else if (payload.eventType === "UPDATE") {
            const updatedItem = {
              ...(payload.new as Omit<InventoryItem, "status">),
              status: computeStatus((payload.new as InventoryItem).expiry_date),
            } as InventoryItem;
            setInventory((prev) => prev.map((i) => (i.id === updatedItem.id ? updatedItem : i)));
          } else if (payload.eventType === "DELETE") {
            setInventory((prev) => prev.filter((i) => i.id !== (payload.old as InventoryItem).id));
          }
        }
      )
      .subscribe((status: string) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pull-to-Refresh touch handler ──
  useEffect(() => {
    const el = mobileRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartY.current < 0) return;
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta > 5) {
        e.preventDefault();
        const eased = Math.min(delta * 0.5, MAX_PULL);
        touchPullY.current = eased;
        setPullY(eased);
      }
    };

    const onTouchEnd = () => {
      if (touchPullY.current >= PULL_THRESHOLD) {
        refresh();
      }
      touchStartY.current = -1;
      touchPullY.current = 0;
      setPullY(0);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = inventory
    .filter((item) =>
      (filter === "all" || item.status === filter) &&
      (searchQuery.trim() === "" || item.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    )
    .sort((a, b) =>
      sortBy === "name"
        ? a.name.localeCompare(b.name)
        : new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
    );
  const total = inventory.length;
  const expiringSoon = expiringSoonItems.length;
  const expired = expiredItems.length;
  const good = inventory.filter((i) => i.status === "good").length;

  const filterLabel = (f: Filter) =>
    f === "all" ? "Sab Items" : f === "expiring_soon" ? "⏰ Jald Expire" : "💀 Expired Items";

  const toggleNotifications = async () => {
    try {
      if (notificationsEnabled) {
        const result = await unsubscribeFromPush(userId);
        if (result === "ok") { setNotificationsEnabled(false); showToast("Notifications disable ho gayi 🔕", "success"); }
        else showToast(result, "error");
      } else {
        const result = await subscribeToPush(userId);
        if (result === "ok") { setNotificationsEnabled(true); showToast("Notifications enable ho gayi! 🔔", "success"); }
        else showToast(result, "error");
      }
    } catch (err) { showToast(`Error: ${err instanceof Error ? err.message : String(err)}`, "error"); }
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };

  // ── Selection helpers ──
  const toggleSelectionMode = () => {
    setSelectionMode((v) => { if (v) setSelectedIds(new Set()); return !v; });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filtered.map((i) => i.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""} delete karna chahte ho?`);
    if (!confirmed) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("inventory").delete().in("id", ids);
    if (error) {
      showToast("Bulk delete nahi hua, dobara try karo", "error");
    } else {
      setInventory((prev) => prev.filter((item) => !selectedIds.has(item.id)));
      showToast(`${ids.length} item delete ho gaye 🗑️`, "success");
      setSelectedIds(new Set());
      setSelectionMode(false);
    }
    setBulkDeleting(false);
  };

  // ── Export helpers ──
  const exportCSV = () => {
    const header = ["Name", "Category", "Quantity", "Unit", "Expiry Date", "Status"];
    const rows = inventory.map((item) => [
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.category}"`,
      item.quantity,
      item.quantity_unit ?? "pcs",
      item.expiry_date,
      item.status === "good" ? "Theek Hai" : item.status === "expiring_soon" ? "Jald Expire" : "Expired",
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shelfwatch-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV download ho gaya! 📊", "success");
  };

  const exportPDF = () => {
    const now = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const rows = inventory.map((item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td>${item.quantity} ${item.quantity_unit ?? "pcs"}</td>
        <td>${item.expiry_date}</td>
        <td class="${item.status}">${item.status === "good" ? "✓ Theek" : item.status === "expiring_soon" ? "⚠ Jald" : "✕ Expired"}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ShelfWatch Inventory</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { margin: 0 0 4px; font-size: 22px; }
      p.sub { margin: 0 0 20px; color: #666; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { background: #f3f4f6; padding: 8px 10px; text-align: left; border-bottom: 2px solid #e5e7eb; }
      td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
      tr:last-child td { border-bottom: none; }
      .good { color: #16a34a; font-weight: 600; }
      .expiring_soon { color: #d97706; font-weight: 600; }
      .expired { color: #dc2626; font-weight: 600; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>🛒 ShelfWatch Inventory</h1>
    <p class="sub">Export date: ${now} &nbsp;|&nbsp; Total: ${inventory.length} items</p>
    <table>
      <thead><tr><th>Name</th><th>Category</th><th>Qty</th><th>Expiry</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
    </body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
    showToast("PDF window khul gaya — Print/Save karo 🖨️", "success");
  };

  const alertSheetItems = showAlertSheet === "expired" ? expiredItems : expiringSoonItems;
  const alertSheetTitle = showAlertSheet === "expired"
    ? `🚨 ${expiredItems.length} item expire ho gaye`
    : `⏰ ${expiringSoonItems.length} item jald expire honge`;

  /* ─────────────────── OFFLINE BANNER ─────────────────── */
  const OfflineBanner = () => !isOffline ? null : (
    <div style={{ background: "#78350f", color: "#fef3c7", borderRadius: "12px", padding: "10px 14px", marginBottom: "10px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
      <span>📡</span>
      <span>Offline ho — cached data dikh raha hai. Internet aane pe refresh karo.</span>
    </div>
  );

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
      <div ref={mobileRef} className="mobile-only sw-bg" style={{ minHeight: "100dvh", paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>

        <header className="sw-header" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="sw-header-inner">
            <div className="sw-logo">
              <span className="sw-logo-icon">🛒</span>
              <span className="sw-logo-text">ShelfWatch</span>
              {realtimeConnected && (
                <span title="Live sync active" style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginLeft: 6, boxShadow: "0 0 0 2px #22c55e40", animation: "sw-pulse 2s infinite" }} />
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button className="sw-icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </button>
              <button className="sw-icon-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
                <GearIcon />
              </button>
            </div>
          </div>
        </header>

        {/* ── Pull-to-Refresh Indicator ── */}
        <div
          className="sw-ptr-badge"
          aria-live="polite"
          aria-label={loading ? "Refresh ho raha hai" : pullY >= PULL_THRESHOLD ? "Chhod do refresh ke liye" : "Upar se neeche khicho"}
          style={{
            transform: pullY > 0
              ? `translateX(-50%) translateY(${(pullY / MAX_PULL) * 100 - 100}%)`
              : loading
              ? "translateX(-50%) translateY(0%)"
              : "translateX(-50%) translateY(-100%)",
            transition: pullY > 0 ? "none" : "transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease",
            opacity: pullY > 0 ? pullY / MAX_PULL : loading ? 1 : 0,
            top: `calc(58px + env(safe-area-inset-top))`,
          }}
        >
          {loading
            ? <span className="sw-ptr-spinner" />
            : <span className="sw-ptr-arrow" style={{ transform: `rotate(${pullY >= PULL_THRESHOLD ? 180 : 0}deg)` }}>↓</span>
          }
          <span>{loading ? "Refresh ho raha hai..." : pullY >= PULL_THRESHOLD ? "Chhod do! 🔄" : "Khicho refresh ke liye"}</span>
        </div>

        <div className="sw-content">
          <div className="sw-stats">
            <div className="sw-stat sw-stat--blue"><span className="sw-stat-num">{total}</span><span className="sw-stat-label">Total</span></div>
            <div className="sw-stat sw-stat--green"><span className="sw-stat-num">{good}</span><span className="sw-stat-label">Theek Hai</span></div>
            <div className="sw-stat sw-stat--amber"><span className="sw-stat-num">{expiringSoon}</span><span className="sw-stat-label">Jald Expire</span></div>
            <div className="sw-stat sw-stat--red"><span className="sw-stat-num">{expired}</span><span className="sw-stat-label">Expired</span></div>
          </div>

          <OfflineBanner />
          <AlertBanner cls="sw-alert-card" />

          {/* Search + Sort */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--sw-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Naam se dhundo..."
                style={{ width: "100%", height: "42px", paddingLeft: "34px", paddingRight: searchQuery ? "32px" : "12px", borderRadius: "12px", border: "1px solid var(--sw-border)", background: "var(--sw-surface)", color: "var(--sw-text)", fontSize: "14px", outline: "none", WebkitAppearance: "none" }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 20, height: 20, borderRadius: "50%", background: "var(--sw-surface2)", border: "none", color: "var(--sw-muted)", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              )}
            </div>
            <button
              onClick={() => setSortBy(s => s === "expiry" ? "name" : "expiry")}
              style={{ height: "42px", padding: "0 12px", borderRadius: "12px", border: "1px solid var(--sw-border)", background: sortBy === "name" ? "var(--sw-accent2)" : "var(--sw-surface)", color: sortBy === "name" ? "#fff" : "var(--sw-text)", fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap", cursor: "pointer" }}
            >
              {sortBy === "expiry" ? "⏱ Expiry" : "🔤 A-Z"}
            </button>
          </div>

          <div className="sw-filters">
            {(["all", "expiring_soon", "expired"] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`sw-chip ${filter === f ? "sw-chip--active" : ""}`}>
                {f === "all" ? "Sab" : f === "expiring_soon" ? "⏰ Jald" : "💀 Expired"}
              </button>
            ))}
            <button onClick={toggleSelectionMode} className={`sw-chip ${selectionMode ? "sw-chip--active" : ""}`} style={{ marginLeft: "auto" }}>
              {selectionMode ? "✕ Cancel" : "☑ Select"}
            </button>
          </div>

          {/* Bulk action toolbar */}
          {selectionMode && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--sw-muted)", flex: 1 }}>
                {selectedIds.size === 0 ? "Koi select nahi" : `${selectedIds.size} select`}
              </span>
              <button onClick={selectedIds.size === filtered.length ? deselectAll : selectAll}
                style={{ fontSize: 12, padding: "6px 12px", borderRadius: 10, border: "1px solid var(--sw-border)", background: "var(--sw-surface)", color: "var(--sw-text)", cursor: "pointer" }}>
                {selectedIds.size === filtered.length ? "Deselect All" : "Select All"}
              </button>
              <button onClick={handleBulkDelete} disabled={selectedIds.size === 0 || bulkDeleting}
                style={{ fontSize: 12, padding: "6px 12px", borderRadius: 10, border: "none", background: selectedIds.size > 0 ? "#dc2626" : "var(--sw-surface2)", color: selectedIds.size > 0 ? "#fff" : "var(--sw-muted)", cursor: selectedIds.size > 0 ? "pointer" : "default", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                {bulkDeleting ? <span className="sw-spin" style={{ width: 12, height: 12 }} /> : "🗑"} Delete ({selectedIds.size})
              </button>
            </div>
          )}

          {/* Export buttons */}
          {!selectionMode && inventory.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              <button onClick={exportCSV} style={{ flex: 1, height: 36, borderRadius: 10, border: "1px solid var(--sw-border)", background: "var(--sw-surface)", color: "var(--sw-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                📊 CSV Export
              </button>
              <button onClick={exportPDF} style={{ flex: 1, height: 36, borderRadius: 10, border: "1px solid var(--sw-border)", background: "var(--sw-surface)", color: "var(--sw-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                🖨️ PDF Export
              </button>
            </div>
          )}

          {loading ? (
            <div className="sw-skeleton-list">{[1,2,3].map((i) => <div key={i} className="sw-skeleton" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="sw-empty">
              <span className="sw-empty-icon">{searchQuery.trim() ? "🔍" : "📦"}</span>
              <p className="sw-empty-title">{searchQuery.trim() ? `"${searchQuery}" nahi mila` : filter === "all" ? "Abhi kuch nahi hai" : filter === "expiring_soon" ? "Sab safe hai!" : "Koi expire nahi hua!"}</p>
              <p className="sw-empty-sub">{searchQuery.trim() ? "Alag naam se try karo" : filter === "all" ? "+ dabao aur pehla saaman add karo" : "Bahut badhiya 🎉"}</p>
            </div>
          ) : (
            <div className="sw-list">{filtered.map((item) => (
              <ItemCard key={item.id} item={item} onDelete={handleDelete} onEdit={setEditingItem}
                selectionMode={selectionMode} selected={selectedIds.has(item.id)} onToggleSelect={toggleSelect} />
            ))}</div>
          )}

          <div className="sw-fab-row">
            {!selectionMode && <button onClick={() => setShowModal(true)} className="sw-fab" aria-label="Add item"><PlusIcon /></button>}
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
                <label className="sw-notif-toggle" aria-label="Toggle push notifications">
                  <input type="checkbox" checked={notificationsEnabled} onChange={toggleNotifications} />
                  <span className="sw-notif-slider" />
                </label>
              </div>
              <div style={{ borderTop: "1px solid var(--sw-border)", paddingTop: 16, marginTop: 8 }}>
                <p className="sw-setting-label" style={{ marginBottom: 6 }}>🏷️ Custom Categories</p>
                <p className="sw-setting-sub" style={{ marginBottom: 12 }}>Apni categories banao aur manage karo</p>
                {customCategories.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--sw-muted)", marginBottom: 12 }}>Koi custom category nahi hai abhi</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {customCategories.map((cat) => (
                      <span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20, background: "var(--sw-surface2)", fontSize: 13, color: "var(--sw-text)" }}>
                        {cat}
                        <button onClick={() => deleteCategory(cat)} style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", fontSize: 11, lineHeight: 1, padding: 0 }} aria-label={`Delete ${cat}`}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCat(); } }}
                    placeholder="Nayi category ka naam..."
                    maxLength={30}
                    style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid var(--sw-border)", background: "var(--sw-surface)", color: "var(--sw-text)", fontSize: 14, padding: "0 12px", outline: "none" }}
                  />
                  <button
                    onClick={handleAddCat}
                    disabled={!newCatName.trim() || addingCat}
                    style={{ height: 44, padding: "0 16px", borderRadius: 12, background: "#16a34a", color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", opacity: (!newCatName.trim() || addingCat) ? 0.4 : 1 }}
                  >
                    {addingCat ? "..." : "Add"}
                  </button>
                </div>
              </div>
              <div className="sw-setting-item" style={{ marginTop: 16 }}>
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
                  }} onEdit={setEditingItem} />
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
              {realtimeConnected && (
                <span title="Live sync active" style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", marginLeft: 6, boxShadow: "0 0 0 2px #22c55e40", animation: "sw-pulse 2s infinite" }} />
              )}
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
              <button className="dsk-sidebar-action" onClick={toggleNotifications}>{notificationsEnabled ? "🔕 Disable Notifications" : "🔔 Enable Notifications"}</button>
              <button className="dsk-sidebar-action dsk-sidebar-action--danger" onClick={signOut}>🚪 Sign Out</button>
            </div>
          </aside>

          {/* Main content */}
          <main className="dsk-main">
            <OfflineBanner />
            <AlertBanner cls="sw-alert-card" />

            <div className="dsk-main-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h2 className="dsk-section-title">{filterLabel(filter)}</h2>
                <span className="dsk-item-count">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {!selectionMode && <>
                  <button onClick={exportCSV} disabled={inventory.length === 0}
                    style={{ height: 36, padding: "0 12px", borderRadius: 10, border: "1px solid var(--sw-border)", background: "var(--sw-surface)", color: "var(--sw-text)", fontSize: 12, fontWeight: 600, cursor: inventory.length > 0 ? "pointer" : "default", opacity: inventory.length > 0 ? 1 : 0.4, whiteSpace: "nowrap" }}>
                    📊 CSV
                  </button>
                  <button onClick={exportPDF} disabled={inventory.length === 0}
                    style={{ height: 36, padding: "0 12px", borderRadius: 10, border: "1px solid var(--sw-border)", background: "var(--sw-surface)", color: "var(--sw-text)", fontSize: 12, fontWeight: 600, cursor: inventory.length > 0 ? "pointer" : "default", opacity: inventory.length > 0 ? 1 : 0.4, whiteSpace: "nowrap" }}>
                    🖨️ PDF
                  </button>
                </>}
                <button onClick={toggleSelectionMode}
                  style={{ height: 36, padding: "0 12px", borderRadius: 10, border: "1px solid var(--sw-border)", background: selectionMode ? "var(--sw-accent2)" : "var(--sw-surface)", color: selectionMode ? "#fff" : "var(--sw-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {selectionMode ? "✕ Cancel" : "☑ Select"}
                </button>
                {!selectionMode && <>
                  <div style={{ position: "relative" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sw-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Naam se dhundo..."
                      style={{ height: "36px", width: "200px", paddingLeft: "30px", paddingRight: searchQuery ? "28px" : "10px", borderRadius: "10px", border: "1px solid var(--sw-border)", background: "var(--sw-surface)", color: "var(--sw-text)", fontSize: "13px", outline: "none", WebkitAppearance: "none" }}
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, borderRadius: "50%", background: "var(--sw-surface2)", border: "none", color: "var(--sw-muted)", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    )}
                  </div>
                  <button
                    onClick={() => setSortBy(s => s === "expiry" ? "name" : "expiry")}
                    style={{ height: "36px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--sw-border)", background: sortBy === "name" ? "var(--sw-accent2)" : "var(--sw-surface)", color: sortBy === "name" ? "#fff" : "var(--sw-text)", fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap", cursor: "pointer" }}
                  >
                    {sortBy === "expiry" ? "⏱ Expiry" : "🔤 A-Z"}
                  </button>
                </>}
              </div>
            </div>

            {/* Desktop bulk action toolbar */}
            {selectionMode && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--sw-border)", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "var(--sw-muted)", flex: 1 }}>
                  {selectedIds.size === 0 ? "Items pe click karo select karne ke liye" : `${selectedIds.size} select`}
                </span>
                <button onClick={selectedIds.size === filtered.length ? deselectAll : selectAll}
                  style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--sw-border)", background: "var(--sw-surface)", color: "var(--sw-text)", cursor: "pointer" }}>
                  {selectedIds.size === filtered.length ? "Deselect All" : "Select All"}
                </button>
                <button onClick={handleBulkDelete} disabled={selectedIds.size === 0 || bulkDeleting}
                  style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "none", background: selectedIds.size > 0 ? "#dc2626" : "var(--sw-surface2)", color: selectedIds.size > 0 ? "#fff" : "var(--sw-muted)", cursor: selectedIds.size > 0 ? "pointer" : "default", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                  {bulkDeleting ? <span className="sw-spin" style={{ width: 12, height: 12 }} /> : "🗑"} Delete ({selectedIds.size})
                </button>
              </div>
            )}

            {loading ? (
              <div className="dsk-skeleton-grid">{[1,2,3,4].map((i) => <div key={i} className="dsk-skeleton" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="dsk-empty">
                <span className="dsk-empty-icon">{searchQuery.trim() ? "🔍" : "📦"}</span>
                <p className="dsk-empty-title">{searchQuery.trim() ? `"${searchQuery}" nahi mila` : filter === "all" ? "Abhi kuch nahi hai" : filter === "expiring_soon" ? "Sab safe hai!" : "Koi expire nahi hua!"}</p>
                <p className="dsk-empty-sub">{searchQuery.trim() ? "Alag naam se try karo" : filter === "all" ? '"Add Item" button se pehla item add karo' : "Bahut badhiya 🎉"}</p>
              </div>
            ) : (
              <div className="dsk-grid">{filtered.map((item) => (
                <ItemCard key={item.id} item={item} onDelete={handleDelete} onEdit={setEditingItem}
                  selectionMode={selectionMode} selected={selectedIds.has(item.id)} onToggleSelect={toggleSelect} />
              ))}</div>
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
                  <label className="sw-notif-toggle" aria-label="Toggle push notifications">
                    <input type="checkbox" checked={notificationsEnabled} onChange={toggleNotifications} />
                    <span className="sw-notif-slider" />
                  </label>
                </div>
                <div style={{ borderTop: "1px solid var(--sw-border)", paddingTop: 16, marginTop: 8 }}>
                  <p className="dsk-settings-label" style={{ marginBottom: 6 }}>🏷️ Custom Categories</p>
                  <p className="dsk-settings-sub" style={{ marginBottom: 12 }}>Apni categories banao aur manage karo</p>
                  {customCategories.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--sw-muted)", marginBottom: 12 }}>Koi custom category nahi hai abhi</p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      {customCategories.map((cat) => (
                        <span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20, background: "var(--sw-surface2)", fontSize: 13, color: "var(--sw-text)" }}>
                          {cat}
                          <button onClick={() => deleteCategory(cat)} style={{ background: "none", border: "none", color: "var(--sw-muted)", cursor: "pointer", fontSize: 11, lineHeight: 1, padding: 0 }} aria-label={`Delete ${cat}`}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCat(); } }}
                      placeholder="Nayi category ka naam..."
                      maxLength={30}
                      style={{ flex: 1, height: 36, borderRadius: 8, border: "1px solid var(--sw-border)", background: "var(--sw-surface)", color: "var(--sw-text)", fontSize: 13, padding: "0 10px", outline: "none" }}
                    />
                    <button
                      onClick={handleAddCat}
                      disabled={!newCatName.trim() || addingCat}
                      style={{ height: 36, padding: "0 14px", borderRadius: 8, background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", opacity: (!newCatName.trim() || addingCat) ? 0.4 : 1 }}
                    >
                      {addingCat ? "..." : "Add"}
                    </button>
                  </div>
                </div>
                <div className="dsk-settings-item" style={{ marginTop: 16 }}>
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
                  }} onEdit={setEditingItem} />
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

      {/* Edit Item Modal (shared) */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          userId={userId}
          onClose={() => setEditingItem(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}
