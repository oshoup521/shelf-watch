"use client";

import { useMemo } from "react";
import { InventoryItem } from "@/lib/supabase";
import { getEmojiForCategory } from "@/lib/categories";

interface Props {
  inventory: InventoryItem[];
  onClose: () => void;
}

export default function AnalyticsModal({ inventory, onClose }: Props) {
  const stats = useMemo(() => {
    const total = inventory.length;
    const good = inventory.filter((i) => i.status === "good").length;
    const expiringSoon = inventory.filter((i) => i.status === "expiring_soon").length;
    const expired = inventory.filter((i) => i.status === "expired").length;
    const healthScore = total === 0 ? 100 : Math.round((good / total) * 100);

    // Items expired this calendar month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const expiredThisMonth = inventory.filter((i) => {
      const d = new Date(i.expiry_date + "T00:00:00");
      return i.status === "expired" && d >= monthStart;
    });

    // Category breakdown
    const catMap: Record<string, { total: number; good: number; expiringSoon: number; expired: number }> = {};
    for (const item of inventory) {
      if (!catMap[item.category]) {
        catMap[item.category] = { total: 0, good: 0, expiringSoon: 0, expired: 0 };
      }
      catMap[item.category].total++;
      if (item.status === "expired") catMap[item.category].expired++;
      else if (item.status === "expiring_soon") catMap[item.category].expiringSoon++;
      else catMap[item.category].good++;
    }
    const categories = Object.entries(catMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
    const maxCategoryTotal = Math.max(...categories.map((c) => c.total), 1);

    // Most at-risk category
    const mostAtRisk = [...categories].sort(
      (a, b) => b.expired + b.expiringSoon - (a.expired + a.expiringSoon)
    )[0];

    // Expiry timeline (good items only, expiring within N days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = (dateStr: string) => {
      const d = new Date(dateStr + "T00:00:00");
      return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };
    const in7 = inventory.filter((i) => { const d = daysUntil(i.expiry_date); return d >= 0 && d <= 7; }).length;
    const in14 = inventory.filter((i) => { const d = daysUntil(i.expiry_date); return d > 7 && d <= 14; }).length;
    const in30 = inventory.filter((i) => { const d = daysUntil(i.expiry_date); return d > 14 && d <= 30; }).length;

    // Top 5 most-expired names (for fun insight)
    const nameCounts: Record<string, number> = {};
    for (const item of inventory) {
      if (item.status === "expired") nameCounts[item.name] = (nameCounts[item.name] ?? 0) + 1;
    }
    const topWasted = Object.entries(nameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    return { total, good, expiringSoon, expired, healthScore, expiredThisMonth, categories, maxCategoryTotal, mostAtRisk, in7, in14, in30, topWasted };
  }, [inventory]);

  // SVG ring for health score
  const RADIUS = 42;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashOffset = CIRC * (1 - stats.healthScore / 100);
  const healthColor = stats.healthScore >= 70 ? "#22c55e" : stats.healthScore >= 40 ? "#f59e0b" : "#ef4444";
  const healthLabel = stats.healthScore >= 70 ? "Sab Badhiya! 🎉" : stats.healthScore >= 40 ? "Theek Theek 😐" : "Dhyan Do! ⚠️";

  const monthName = new Date().toLocaleString("en-IN", { month: "long" });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "var(--sw-bg)",
        display: "flex",
        flexDirection: "column",
        overscrollBehavior: "contain",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 16px 14px",
          paddingTop: "max(16px, env(safe-area-inset-top))",
          borderBottom: "1px solid var(--sw-border)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Back"
          style={{
            background: "none",
            border: "none",
            color: "var(--sw-muted)",
            fontSize: 22,
            cursor: "pointer",
            lineHeight: 1,
            padding: "4px 8px 4px 0",
          }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--sw-text)" }}>
            📊 Analytics &amp; Insights
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "var(--sw-muted)" }}>
            Apni pantry ki poori kahani
          </p>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 16px",
          paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {stats.total === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--sw-muted)" }}>
            <div style={{ fontSize: 52 }}>📦</div>
            <p style={{ marginTop: 14, fontSize: 15, fontWeight: 600 }}>Inventory khaali hai</p>
            <p style={{ fontSize: 13 }}>Pehle kuch items add karo!</p>
          </div>
        ) : (
          <>
            {/* ── Row 1: Health Ring + Quick Stats ── */}
            <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
              {/* Health Ring */}
              <div
                style={{
                  background: "var(--sw-card)",
                  borderRadius: 16,
                  padding: "16px 12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 126,
                  gap: 6,
                }}
              >
                <svg width={110} height={110} viewBox="0 0 110 110">
                  {/* Track */}
                  <circle cx={55} cy={55} r={RADIUS} fill="none" stroke="var(--sw-border)" strokeWidth={11} />
                  {/* Progress */}
                  <circle
                    cx={55}
                    cy={55}
                    r={RADIUS}
                    fill="none"
                    stroke={healthColor}
                    strokeWidth={11}
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 55 55)"
                    style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
                  />
                  <text x={55} y={52} textAnchor="middle" dominantBaseline="central" fontSize={20} fontWeight={800} fill={healthColor}>
                    {stats.healthScore}%
                  </text>
                  <text x={55} y={70} textAnchor="middle" fontSize={10} fill="var(--sw-muted)">
                    Health
                  </text>
                </svg>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: healthColor, textAlign: "center" }}>
                  {healthLabel}
                </p>
              </div>

              {/* 4 Quick Stat Tiles */}
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { icon: "🗑️", value: stats.expiredThisMonth.length, label: `Waste (${monthName})`, color: "#ef4444" },
                  { icon: "⏰", value: stats.expiringSoon, label: "Jald Expire", color: "#f59e0b" },
                  { icon: "✅", value: stats.good, label: "Safe Items", color: "#22c55e" },
                  { icon: "📦", value: stats.total, label: "Total Items", color: "#60a5fa" },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: "var(--sw-card)",
                      borderRadius: 12,
                      padding: "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{s.icon}</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                      {s.value}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--sw-muted)", lineHeight: 1.3 }}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Expiry Timeline ── */}
            <div style={{ background: "var(--sw-card)", borderRadius: 16, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--sw-text)" }}>
                ⏳ Expiry Timeline
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { label: "Agli 7 din", value: stats.in7, color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" },
                  { label: "8 – 14 din", value: stats.in14, color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
                  { label: "15 – 30 din", value: stats.in30, color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)" },
                ].map((t) => (
                  <div
                    key={t.label}
                    style={{
                      flex: 1,
                      background: t.bg,
                      borderRadius: 12,
                      padding: "12px 6px",
                      textAlign: "center",
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    <div style={{ fontSize: 24, fontWeight: 800, color: t.color, lineHeight: 1 }}>
                      {t.value}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--sw-muted)", marginTop: 4, lineHeight: 1.3 }}>
                      {t.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Category Breakdown ── */}
            {stats.categories.length > 0 && (
              <div style={{ background: "var(--sw-card)", borderRadius: 16, padding: "14px 16px" }}>
                <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "var(--sw-text)" }}>
                  📂 Category Breakdown
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {stats.categories.map((cat) => {
                    const barPct = (cat.total / stats.maxCategoryTotal) * 100;
                    const goodPct = cat.total > 0 ? (cat.good / cat.total) * 100 : 0;
                    const soonPct = cat.total > 0 ? (cat.expiringSoon / cat.total) * 100 : 0;
                    const expiredPct = cat.total > 0 ? (cat.expired / cat.total) * 100 : 0;
                    return (
                      <div key={cat.name}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 5,
                          }}
                        >
                          <span
                            style={{ fontSize: 13, color: "var(--sw-text)", display: "flex", alignItems: "center", gap: 6 }}
                          >
                            <span>{getEmojiForCategory(cat.name)}</span>
                            <span style={{ fontWeight: 600 }}>{cat.name}</span>
                          </span>
                          <span style={{ fontSize: 12, color: "var(--sw-muted)", fontWeight: 600 }}>
                            {cat.total} item{cat.total !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {/* Stacked bar */}
                        <div
                          style={{
                            position: "relative",
                            height: 9,
                            borderRadius: 99,
                            background: "var(--sw-border)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              height: "100%",
                              width: `${barPct}%`,
                              display: "flex",
                              borderRadius: 99,
                              transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                            }}
                          >
                            <div style={{ width: `${goodPct}%`, background: "#22c55e", height: "100%" }} />
                            <div style={{ width: `${soonPct}%`, background: "#f59e0b", height: "100%" }} />
                            <div style={{ width: `${expiredPct}%`, background: "#ef4444", height: "100%" }} />
                          </div>
                        </div>
                        {/* Per-category mini legend (only when has issues) */}
                        {(cat.expired > 0 || cat.expiringSoon > 0) && (
                          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                            {cat.expired > 0 && (
                              <span style={{ fontSize: 11, color: "#ef4444" }}>
                                {cat.expired} expired
                              </span>
                            )}
                            {cat.expiringSoon > 0 && (
                              <span style={{ fontSize: 11, color: "#f59e0b" }}>
                                {cat.expiringSoon} jald expire
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div style={{ display: "flex", gap: 14, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--sw-border)" }}>
                  {[["#22c55e", "Safe"], ["#f59e0b", "Jald Expire"], ["#ef4444", "Expired"]].map(([color, label]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "var(--sw-muted)" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Most At-Risk Category ── */}
            {stats.mostAtRisk && stats.mostAtRisk.expired + stats.mostAtRisk.expiringSoon > 0 && (
              <div
                style={{
                  background: "rgba(239,68,68,0.07)",
                  border: "1px solid rgba(239,68,68,0.18)",
                  borderRadius: 16,
                  padding: "14px 16px",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <span style={{ fontSize: 24, flexShrink: 0, marginTop: 1 }}>🔥</span>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#ef4444" }}>
                    Sabse Zyada At-Risk Category
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--sw-text)", lineHeight: 1.5 }}>
                    <strong>
                      {getEmojiForCategory(stats.mostAtRisk.name)} {stats.mostAtRisk.name}
                    </strong>{" "}
                    mein{" "}
                    <span style={{ color: "#ef4444", fontWeight: 700 }}>
                      {stats.mostAtRisk.expired + stats.mostAtRisk.expiringSoon}
                    </span>{" "}
                    item{stats.mostAtRisk.expired + stats.mostAtRisk.expiringSoon !== 1 ? "s" : ""} expire ho
                    {stats.mostAtRisk.expired + stats.mostAtRisk.expiringSoon === 1 ? " gaya ya hoga" : " gaye ya honge"}.
                  </p>
                </div>
              </div>
            )}

            {/* ── Waste This Month ── */}
            {stats.expiredThisMonth.length > 0 && (
              <div style={{ background: "var(--sw-card)", borderRadius: 16, padding: "14px 16px" }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--sw-text)" }}>
                  🗑️ {monthName} mein Waste Hua
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {stats.expiredThisMonth.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "9px 12px",
                        background: "rgba(239,68,68,0.07)",
                        borderRadius: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{getEmojiForCategory(item.category)}</span>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--sw-text)" }}>
                            {item.name}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: "var(--sw-muted)" }}>{item.category}</p>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>
                        Expire: {item.expiry_date}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── All Good state ── */}
            {stats.expired === 0 && stats.expiringSoon === 0 && (
              <div
                style={{
                  background: "rgba(34,197,94,0.07)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  borderRadius: 16,
                  padding: "20px 16px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 36 }}>🎉</div>
                <p style={{ margin: "10px 0 4px", fontSize: 15, fontWeight: 700, color: "#22c55e" }}>
                  Bilkul Badhiya!
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--sw-muted)" }}>
                  Sab items fresh hain — ek bhi expire nahi!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
