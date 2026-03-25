"use client";

import { useEffect, useState } from "react";
import { subscribeToToasts, ToastEvent, ToastType } from "@/lib/toastStore";

const variantStyles: Record<ToastType, string> = {
  success: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
  warning: "bg-amber-500 text-white",
};

const variantIcons: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
};

interface ActiveToast extends ToastEvent {
  visible: boolean;
}

export default function ToastProvider() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  useEffect(() => {
    const unsub = subscribeToToasts((toast) => {
      const active: ActiveToast = { ...toast, visible: true };
      setToasts((prev) => [...prev, active]);

      // Start hide animation after 2.7s, remove after 3s
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === toast.id ? { ...t, visible: false } : t))
        );
      }, 2700);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3100);
    });

    return unsub;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium
            transition-all duration-300
            ${variantStyles[toast.type]}
            ${toast.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
          `}
        >
          <span className="text-base">{variantIcons[toast.type]}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
