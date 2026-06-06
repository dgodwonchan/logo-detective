"use client";

import { useState } from "react";
import type { LimitStatus } from "../types";

type Method = "toss" | "kakao" | "naver";

const METHODS: {
  id: Method;
  label: string;
  qr: string;
  color: string;
  textColor: string;
}[] = [
  {
    id: "toss",
    label: "토스",
    qr: "/donate-toss.png",
    color: "bg-[#0064FF] hover:bg-[#0050cc]",
    textColor: "text-white",
  },
  {
    id: "kakao",
    label: "카카오페이",
    qr: "/donate-kakao.png",
    color: "bg-[#FFE812] hover:bg-[#f0d800]",
    textColor: "text-zinc-900",
  },
  {
    id: "naver",
    label: "네이버페이",
    qr: "/donate-naver.png",
    color: "bg-[#03C75A] hover:bg-[#02a04a]",
    textColor: "text-white",
  },
];

export default function DonateModal({
  open,
  onClose,
  reason,
  onUnlocked,
}: {
  open: boolean;
  onClose: () => void;
  reason: "limit" | "voluntary"; // limit = 한도 도달 / voluntary = 자율 후원
  onUnlocked?: (status: LimitStatus) => void;
}) {
  const [selected, setSelected] = useState<Method>("toss");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const onUnlockClick = async () => {
    if (reason !== "limit") {
      onClose();
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/unlock", { method: "POST", credentials: "include" });
      const data = (await res.json()) as LimitStatus;
      if (!res.ok) throw new Error("잠금 해제에 실패했습니다.");
      onUnlocked?.(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const current = METHODS.find((m) => m.id === selected)!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl"
      >
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {reason === "limit"
                  ? "☕ 커피 한 잔으로 24시간 무제한"
                  : "☕ 커피 한 잔 후원하기"}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {reason === "limit"
                  ? "오늘의 무료 분석 5회를 모두 사용하셨습니다. AI 분석 서버 비용을 충당할 수 있도록 도와주시면, 24시간 동안 무제한으로 이용하실 수 있습니다.(후원 금액 자유)"
                  : "Logo Detective는 무료로 운영됩니다. 도움이 되셨다면 커피 한 잔으로 응원해 주세요."}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 결제 수단 탭 */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                  selected === m.id
                    ? `${m.color} ${m.textColor} shadow`
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* QR 코드 */}
        <div className="px-6 py-5">
          <div className="rounded-xl bg-white border border-zinc-200 dark:border-zinc-700 p-3 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.qr}
              alt={`${current.label} 후원 QR`}
              className="max-h-72 w-auto object-contain"
            />
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 text-center leading-relaxed">
            {current.label} 앱으로 QR을 스캔해 주세요.
            <br />
            추천 금액: <strong className="text-zinc-700 dark:text-zinc-300">3,000원 (커피 한 잔)</strong>
          </p>
        </div>

        {/* 액션 */}
        {reason === "limit" ? (
          <div className="px-6 pb-6 space-y-3">
            {error && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}
            <button
              onClick={onUnlockClick}
              disabled={submitting}
              className="w-full rounded-xl bg-zinc-900 dark:bg-white py-3 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition disabled:opacity-50"
            >
              {submitting ? "처리 중..." : "후원 완료했어요 → 24시간 무제한 이용"}
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              내일 다시 올게요
            </button>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">
              후원은 양심에 맡깁니다. 디자이너의 신뢰를 믿어요.
            </p>
          </div>
        ) : (
          <div className="px-6 pb-6">
            <button
              onClick={onClose}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
