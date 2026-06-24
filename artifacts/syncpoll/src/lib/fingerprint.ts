import React, { useState, useEffect } from "react";

export async function generateDeviceFingerprint(): Promise<string> {
  // Use hardware/OS-level properties that are identical across all browsers
  // on the same physical device, so double-voting from different browsers
  // on the same machine produces the same token.
  const components = [
    navigator.platform,                                      // "Win32", "MacIntel", etc.
    (navigator as any).hardwareConcurrency ?? "",            // CPU core count
    (navigator as any).deviceMemory ?? "",                   // RAM tier (GB)
    window.screen.width,
    window.screen.height,
    window.screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    new Date().getTimezoneOffset(),
  ];

  const rawString = components.join("|");

  // crypto.subtle requires HTTPS or localhost — use it when available,
  // otherwise fall back to a simple deterministic hash safe for HTTP LAN dev.
  if (crypto.subtle?.digest) {
    const encoder = new TextEncoder();
    const data = encoder.encode(rawString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Simple djb2-style hash fallback
  let h = 5381;
  for (let i = 0; i < rawString.length; i++) {
    h = ((h << 5) + h) ^ rawString.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h.toString(16).padStart(8, "0").repeat(8);
}

export function useDeviceFingerprint() {
  const [fingerprint, setFingerprint] = useState<{
    fingerprint: string;
    userAgent: string;
    platform: string;
    screenResolution: string;
    timezone: string;
    hardwareConcurrency: number;
    deviceMemory: string;
  } | null>(null);

  useEffect(() => {
    generateDeviceFingerprint().then((hash) => {
      setFingerprint({
        fingerprint: hash,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hardwareConcurrency: (navigator as any).hardwareConcurrency ?? 0,
        deviceMemory: String((navigator as any).deviceMemory ?? "unknown"),
      });
    });
  }, []);

  return fingerprint;
}
