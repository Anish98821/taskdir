"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export function SearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (value) sp.set("q", value);
      else sp.delete("q");
      const qs = sp.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      name="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="search tasks… (press / to focus)"
      className="h-8 w-96 font-mono text-sm"
    />
  );
}
