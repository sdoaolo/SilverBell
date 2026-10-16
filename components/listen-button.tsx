"use client";

import { useEffect, useState } from "react";

/** 브라우저 음성으로 안내 전화 문구를 미리 들려준다 (실제 전화는 Solapi ARS) */
export function ListenButton({ text, className = "" }: { text: string; className?: string }) {
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => window.speechSynthesis?.cancel();
  }, []);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const synth = window.speechSynthesis;
        if (playing) {
          synth.cancel();
          setPlaying(false);
          return;
        }
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "ko-KR";
        u.rate = 0.85; // 어르신이 듣기 좋게 천천히
        u.onend = () => setPlaying(false);
        u.onerror = () => setPlaying(false);
        setPlaying(true);
        synth.speak(u);
      }}
      className={className}
    >
      {playing ? "■ 그만 듣기" : "▶ 소리 듣기"}
    </button>
  );
}
