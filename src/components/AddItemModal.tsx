"use client";

import { useState } from "react";
import CameraScanner from "@/components/CameraScanner";
import ManualEntryForm from "@/components/ManualEntryForm";

type Tab = "camera" | "manual";

interface ScanResult {
  name: string;
  category: string;
  expiry_date: string | null;
}

interface Props {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddItemModal({ userId, onClose, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("camera");
  const [prefill, setPrefill] = useState<{
    name?: string;
    category?: string;
    expiry_date?: string;
  }>({});

  function handleScanSuccess(result: ScanResult) {
    setPrefill({
      name: result.name,
      category: result.category,
      expiry_date: result.expiry_date ?? undefined,
    });
    setActiveTab("manual");
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Bottom sheet — respects home indicator via padding-bottom */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl overflow-y-auto animate-slide-up"
        style={{
          maxHeight: "calc(90dvh - env(safe-area-inset-top))",
          paddingBottom: "env(safe-area-inset-bottom)",
          /* Prevent iOS rubber-band scroll leaking to page */
          overscrollBehavior: "contain",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Nayi Item Add Karo
          </h2>
          {/* 44×44 touch target for close */}
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center text-gray-400 active:text-gray-700 rounded-full"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-4 my-3 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab("camera")}
            className={`flex-1 min-h-[44px] text-sm font-medium rounded-lg transition-colors ${
              activeTab === "camera"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            📷 Camera Scan
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex-1 min-h-[44px] text-sm font-medium rounded-lg transition-colors ${
              activeTab === "manual"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            ✏️ Manual Entry
          </button>
        </div>

        {/* Content */}
        {activeTab === "camera" ? (
          <CameraScanner
            onScanSuccess={handleScanSuccess}
            onSwitchToManual={() => setActiveTab("manual")}
          />
        ) : (
          <ManualEntryForm
            prefill={prefill}
            userId={userId}
            onSuccess={onSuccess}
          />
        )}
      </div>
    </>
  );
}
