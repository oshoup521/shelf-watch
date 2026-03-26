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

  const emptyMessages: Record<Filter, { main: string; sub: string }> = {
    all: {
      main: "Koi item nahi mila",
      sub: "+ button se pehla item add karo",
    },
    expiring_soon: {
      main: "Koi item nahi mila",
      sub: "Koi item jald expire hone wala nahi hai",
    },
    expired: {
      main: "Koi item nahi mila",
      sub: "Koi item expire nahi hua — great job!",
    },
  };

  return (
    /* 100dvh = real visible height on iOS Safari (excludes browser chrome) */
    <div
      className="bg-gray-50"
      style={{ minHeight: "100dvh", paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
    >
      {/* Sticky header — padded for Dynamic Island */}
      <header
        className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-green-600">Shelf Watch</h1>
          <span className="text-sm text-gray-500 font-medium">{total} items</span>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            /* min 44×44 touch target */
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-sm text-gray-500 active:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{total}</div>
            <div className="text-xs text-blue-500 mt-0.5">Total</div>
          </div>
          <div className="bg-amber-50 rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{expiringSoon}</div>
            <div className="text-xs text-amber-500 mt-0.5">Expiring Soon</div>
          </div>
          <div className="bg-red-50 rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{expired}</div>
            <div className="text-xs text-red-500 mt-0.5">Expired</div>
          </div>
        </div>

        {/* Enable notifications */}
        <button
          onClick={async () => {
            try {
              const result = await subscribeToPush(userId);
              if (result === "ok") {
                showToast("Notifications enable ho gayi! 🔔", "success");
              } else {
                showToast(result, "error");
              }
            } catch (err) {
              showToast(`Error: ${err instanceof Error ? err.message : String(err)}`, "error");
            }
          }}
          className="w-full min-h-[44px] text-xs text-gray-400 active:text-green-600 transition-colors"
        >
          🔔 Notifications enable karo
        </button>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm">
          {(["all", "expiring_soon", "expired"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 min-h-[44px] text-xs font-medium rounded-xl transition-colors ${
                filter === f
                  ? "bg-green-600 text-white"
                  : "text-gray-500 active:text-gray-700"
              }`}
            >
              {f === "all"
                ? "Sab"
                : f === "expiring_soon"
                ? "Jald Expire"
                : "Expire Ho Gaya"}
            </button>
          ))}
        </div>

        {/* Item list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 h-20 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-gray-700 font-medium">{emptyMessages[filter].main}</p>
            <p className="text-gray-400 text-sm mt-1">{emptyMessages[filter].sub}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <ItemCard key={item.id} item={item} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* FAB — sits above home indicator */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed right-5 z-20 w-14 h-14 bg-green-600 active:bg-green-800 text-white rounded-full shadow-lg shadow-green-600/40 flex items-center justify-center text-3xl transition-colors"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        aria-label="Add item"
      >
        +
      </button>

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
