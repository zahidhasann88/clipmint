"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDesk } from "./desk-state";
import { DropAnywhere } from "./mat";
import { registerShareWorker } from "@/lib/share";

const NOT_A_DESK = ["/about", "/privacy"];

export function GlobalDrop() {
  const d = useDesk();
  const router = useRouter();
  const path = usePathname();
  const open = (files: File[]) => {
    d.openFiles(files);
    if (NOT_A_DESK.includes(path) || !path) router.push("/");
  };
  const openRef = useRef(open);
  openRef.current = open;
  const busy = d.stage === "brewing";

  useEffect(() => { registerShareWorker(); }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.length || busy) return;
      e.preventDefault();
      openRef.current(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy]);

  return <DropAnywhere disabled={busy} onFiles={open} />;
}
