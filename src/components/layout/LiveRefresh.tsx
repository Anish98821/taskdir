"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onmessage = (e) => {
      if (e.data === "change") router.refresh();
    };
    return () => source.close();
  }, [router]);
  return null;
}
