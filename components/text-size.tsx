"use client";

import { useEffect, useState } from "react";

type Zoom = "normal" | "large" | "xlarge";
const KEY = "silverbell-zoom";
const OPTIONS: { value: Zoom; label: string }[] = [
  { value: "normal", label: "보통" },
  { value: "large", label: "크게" },
  { value: "xlarge", label: "아주크게" },
];

/** 첫 화면이 그려지기 전에 저장된 글자 크기를 적용 (layout <head>에 넣는다) */
export const zoomInitScript = `try{var z=localStorage.getItem("${KEY}");if(z&&z!=="normal")document.documentElement.dataset.zoom=z}catch(e){}`;

export function TextSizeControl() {
  const [zoom, setZoom] = useState<Zoom>("normal");

  useEffect(() => {
    const current = document.documentElement.dataset.zoom as Zoom | undefined;
    if (current) setZoom(current);
  }, []);

  function apply(z: Zoom) {
    setZoom(z);
    if (z === "normal") delete document.documentElement.dataset.zoom;
    else document.documentElement.dataset.zoom = z;
    try {
      localStorage.setItem(KEY, z);
    } catch {
      // 저장이 막혀도 이번 화면에는 적용된다
    }
  }

  return (
    <div role="group" aria-label="글자 크기" className="flex items-center gap-1 rounded-full bg-navy-800 px-2 py-1">
      <span className="mr-1 text-xs text-zinc-300">글자 크기</span>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={zoom === o.value}
          onClick={() => apply(o.value)}
          className={`rounded-md px-2 py-0.5 text-xs font-bold ${
            zoom === o.value ? "bg-brand-600 text-white" : "text-zinc-300 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
