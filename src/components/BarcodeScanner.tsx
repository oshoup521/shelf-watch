"use client";

import { useEffect, useRef, useState } from "react";
import { showToast } from "@/lib/toastStore";

interface ScanResult {
  name: string;
  category: string;
  expiry_date: string | null;
}

interface Props {
  onScanSuccess: (result: ScanResult) => void;
  onSwitchToManual: () => void;
}

type Status = "loading" | "scanning" | "looking_up" | "error";

export default function BarcodeScanner({ onScanSuccess, onSwitchToManual }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectedRef = useRef(false); // prevent duplicate triggers
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let mounted = true;
    let stopScanner: (() => void) | null = null;

    async function startScanner() {
      try {
        // Dynamic import — keeps ZXing out of the server bundle
        const { BrowserMultiFormatReader } = await import("@zxing/browser");

        if (!mounted || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader();

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current,
          async (result, _err, ctrl) => {
            // Skip if already handling a barcode or component unmounted
            if (!result || detectedRef.current || !mounted) return;
            detectedRef.current = true;
            ctrl.stop();
            setStatus("looking_up");

            const barcode = result.getText();
            try {
              const res = await fetch(
                `/api/barcode-lookup?barcode=${encodeURIComponent(barcode)}`
              );
              if (!mounted) return;

              const data = await res.json();

              if (data.error === "not_found") {
                showToast("Product nahi mila, naam manually enter karo", "warning");
                onSwitchToManual();
              } else if (data.error === "invalid_barcode") {
                showToast("Valid barcode nahi tha, dobara try karo", "warning");
                // Reset so user can try again
                detectedRef.current = false;
                setStatus("scanning");
                startScanner();
              } else if (data.error) {
                showToast("Product lookup fail hua, manually enter karo", "warning");
                onSwitchToManual();
              } else {
                onScanSuccess({
                  name: data.name,
                  category: data.category,
                  expiry_date: null,
                });
              }
            } catch {
              if (mounted) {
                showToast("Network error, manually enter karo", "warning");
                onSwitchToManual();
              }
            }
          }
        );

        if (!mounted) {
          controls.stop();
          return;
        }

        stopScanner = () => controls.stop();
        setStatus("scanning");
      } catch {
        if (mounted) setStatus("error");
      }
    }

    startScanner();

    return () => {
      mounted = false;
      stopScanner?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-4">
        <div className="text-4xl">📷</div>
        <p className="text-sm font-medium" style={{ color: "var(--sw-text)" }}>
          Camera access nahi mila
        </p>
        <p className="text-xs" style={{ color: "var(--sw-muted)" }}>
          Browser settings mein camera permission do ya manually enter karo
        </p>
        <button
          onClick={onSwitchToManual}
          className="bg-green-600 text-white px-6 py-3 rounded-xl text-sm font-medium"
        >
          Manual Entry Karo
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      {/* Viewfinder */}
      <div
        className="relative rounded-xl overflow-hidden bg-black"
        style={{ aspectRatio: "4/3" }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Camera loading overlay */}
        {status === "loading" && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
            <div className="w-7 h-7 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm">Camera load ho rahi hai...</p>
          </div>
        )}

        {/* Scanning overlay with barcode viewfinder */}
        {status === "scanning" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Dimmed edges */}
            <div className="absolute inset-0 bg-black/40" />
            {/* Clear window */}
            <div className="relative z-10 w-56 h-28 flex items-center justify-center">
              {/* Corner brackets */}
              <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-green-400 rounded-tl" />
              <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-green-400 rounded-tr" />
              <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-green-400 rounded-bl" />
              <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-green-400 rounded-br" />
              {/* Laser scan line */}
              <div className="absolute left-2 right-2 h-0.5 bg-green-400/80 animate-pulse" />
            </div>
            <p className="relative z-10 mt-3 text-white text-xs font-medium bg-black/60 px-3 py-1.5 rounded-full">
              Barcode camera ke saamne rakh
            </p>
          </div>
        )}

        {/* Product lookup overlay */}
        {status === "looking_up" && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-[3px] border-green-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-white text-sm font-medium">Barcode mila! Product dhundh raha hai...</p>
          </div>
        )}
      </div>

      <p className="text-center text-xs mt-2" style={{ color: "var(--sw-muted)" }}>
        Barcode automatically detect hoga — button dabane ki zaroorat nahi
      </p>
    </div>
  );
}
