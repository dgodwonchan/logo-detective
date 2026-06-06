"use client";

import { useState } from "react";

interface Props {
  url: string; // 브랜드 공식 URL (officialUrl)
  name: string; // 브랜드 이름 (fallback 이니셜용)
}

/**
 * 외부 브랜드 로고를 표시하는 컴포넌트.
 * - 1차: Google Favicon API (sz=128, 거의 모든 도메인 커버)
 * - 2차 fallback: 브랜드 이름 첫 글자 이니셜 박스
 */
export default function BrandLogo({ url, name }: Props) {
  const [errored, setErrored] = useState(false);

  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // 잘못된 URL → fallback 처리
  }

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (!domain || errored) {
    return (
      <div
        className="h-16 w-16 rounded-xl bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center text-2xl font-bold text-zinc-600 dark:text-zinc-300 shrink-0"
        aria-label={`${name} 로고 (이미지 없음)`}
      >
        {initial}
      </div>
    );
  }

  return (
    <div className="h-16 w-16 rounded-xl bg-white border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden shrink-0 p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
        alt={`${name} 로고`}
        className="max-h-full max-w-full object-contain"
        onError={() => setErrored(true)}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
