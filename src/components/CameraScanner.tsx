"use client";

import { useEffect, useRef, useState } from "react";
import { showToast } from "@/lib/toastStore";

interface ScanResult {
  name: string;
  category: string;
  expiry_date: string | null;
  confidence: number;
}

interface Props {
  onScanSuccess: (result: ScanResult) => void;
  onSwitchToManual: () => void;
}

export default function CameraScanner({ onScanSuccess, onSwitchToManual }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (mounted) setCameraError(true);
      }
    }

    startCamera();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleScan() {
    if (!videoRef.current) return;
    setScanning(true);

    // Capture frame
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setScanning(false);
      return;
    }
    ctx.drawImage(video, 0, 0);
    const imageBase64 = canvas
      .toDataURL("image/jpeg", 0.8)
      .replace(/^data:image\/jpeg;base64,/, "");

    try {
      const res = await fetch("/api/scan-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      const data = await res.json();

      if (data.error) {
        showToast("Scan nahi hua, manually enter karo", "warning");
        onSwitchToManual();
      } else {
        onScanSuccess(data as ScanResult);
      }
    } catch {
      showToast("Scan nahi hua, manually enter karo", "warning");
      onSwitchToManual();
    } finally {
      setScanning(false);
    }
  }

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-4">
        <div className="text-4xl">📷</div>
        <p className="text-gray-600 font-medium">Camera access nahi mila</p>
        <p className="text-gray-400 text-sm">
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
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full rounded-xl bg-black"
        style={{ maxHeight: "50vh" }}
      />

      {/* Scanning overlay */}
      {scanning && (
        <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin border-[3px]" />
          <p className="text-white text-sm font-medium">Scan ho raha hai...</p>
        </div>
      )}

      <div className="px-4 pb-4 pt-3">
        <button
          onClick={handleScan}
          disabled={scanning}
          className="w-full min-h-[52px] bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-2xl transition-colors"
        >
          {scanning ? "Scanning..." : "📷 Scan Karo"}
        </button>
      </div>
    </div>
  );
}
