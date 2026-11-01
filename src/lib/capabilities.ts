"use client";
import { useEffect, useState } from "react";

export interface Capabilities {
  wasm: boolean;
  simd: boolean;
  sharedArrayBuffer: boolean;
  deviceMemoryGb: number | null;
  mobile: boolean;
}

export function detectCapabilities(): Capabilities {
  let wasm = false;
  try {
    wasm =
      typeof WebAssembly === "object" &&
      typeof WebAssembly.instantiate === "function";
  } catch {
    wasm = false;
  }
  let simd = false;
  try {
    simd =
      wasm &&
      WebAssembly.validate(
        new Uint8Array([
          0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10,
          10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
        ]),
      );
  } catch {
    simd = false;
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    wasm,
    simd,
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    deviceMemoryGb:
      typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    mobile: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent),
  };
}

export function useCapabilities(): Capabilities | null {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  useEffect(() => {
    setCaps(detectCapabilities());
  }, []);
  return caps;
}
