"use client";

type ToastType = "success" | "error" | "warning";

interface ToastEvent {
  message: string;
  type: ToastType;
  id: number;
}

type ToastListener = (toast: ToastEvent) => void;

let listeners: ToastListener[] = [];
let idCounter = 0;

export function showToast(message: string, type: ToastType = "success"): void {
  const toast: ToastEvent = { message, type, id: ++idCounter };
  listeners.forEach((l) => l(toast));
}

export function subscribeToToasts(listener: ToastListener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export type { ToastType, ToastEvent };
