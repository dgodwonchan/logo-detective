"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisResult, LimitStatus, RiskLevel } from "./types";
import CameraCapture from "./components/CameraCapture";
import BrandLogo from "./components/BrandLogo";
import DonateModal from "./components/DonateModal";
import SponsorCard from "./components/SponsorCard";
import ClassBanner from "./components/ClassBanner";

type Status = "idle" | "analyzing" | "result" | "error";

const RISK_META: Record<
  RiskLevel,
  { label: string; emoji: string; tone: string; bg: string; ring: string }
> = {
  safe: {
    label: "안전",
    emoji: "🟢",
    tone: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    ring: "ring-emerald-200 dark:ring-emerald-900",
  },
  caution: {
    label: "주의",
    emoji: "🟡",
    tone: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    ring: "ring-amber-200 dark:ring-amber-900",
  },
  danger: {
    label: "위험",
    emoji: "🔴",
    tone: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    ring: "ring-rose-200 dark:ring-rose-900",
  },
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [limitStatus, setLimitStatus] = useState<LimitStatus | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [donateReason, setDonateReason] = useState<"limit" | "voluntary">("voluntary");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 페이지 진입 시 잔여 횟수 조회
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: LimitStatus) => setLimitStatus(s))
      .catch(() => {});
  }, []);

  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErrorMsg("이미지 파일만 업로드할 수 있습니다.");
      setStatus("error");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrorMsg("이미지 크기는 10MB 이하여야 합니다.");
      setStatus("error");
      return;
    }
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
  }, []);

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const onAnalyze = async () => {
    if (!file) return;
    setStatus("analyzing");
    setErrorMsg("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      // 응답에 limitStatus가 동봉된 경우 항상 갱신
      if (data?.limitStatus) {
        setLimitStatus(data.limitStatus as LimitStatus);
      }
      // Rate limit 도달 → 후원 모달 자동 노출
      if (res.status === 429 && data?.rateLimited) {
        setDonateReason("limit");
        setDonateOpen(true);
        setStatus("idle");
        return;
      }
      if (!res.ok) {
        throw new Error(data?.error || "분석에 실패했습니다.");
      }
      setResult(data as AnalysisResult);
      setStatus("result");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
      setStatus("error");
    }
  };

  const onReset = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* 헤더 */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl overflow-hidden bg-black ring-1 ring-zinc-200 dark:ring-zinc-800 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="로고 디텍티브"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                로고 디텍티브 <span className="text-zinc-400 dark:text-zinc-500 font-medium">by dgodwonchan</span>
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Logo Detective · 로고 표절 감정 도구
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 소셜 아이콘 */}
            <nav className="flex items-center gap-1" aria-label="소셜 채널">
              <a
                href="https://www.youtube.com/@wonchan"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="디고디원찬 유튜브"
                className="h-8 w-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/dgodwonchan"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="디고디원찬 인스타그램"
                className="h-8 w-8 rounded-full flex items-center justify-center text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-950/40 transition"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a
                href="http://minimalist.kr/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="미니멀리스트 스튜디오"
                className="h-8 w-8 rounded-full flex items-center justify-center text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </nav>

            {/* 사용량 뱃지 */}
            {limitStatus && (
              <button
                onClick={() => {
                  if (limitStatus.unlocked || limitStatus.allowed) {
                    setDonateReason("voluntary");
                  } else {
                    setDonateReason("limit");
                  }
                  setDonateOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                aria-label="사용량 / 후원하기"
              >
                {limitStatus.unlocked ? (
                  <>
                    <span aria-hidden>♾️</span>
                    <span className="hidden sm:inline">24시간 무제한</span>
                    <span className="sm:hidden">무제한</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden>☕</span>
                    <span className="hidden sm:inline">
                      오늘 {limitStatus.limit - limitStatus.remaining}/
                      {limitStatus.limit}회 사용
                    </span>
                    <span className="sm:hidden">
                      {limitStatus.limit - limitStatus.remaining}/
                      {limitStatus.limit}
                    </span>
                  </>
                )}
              </button>
            )}

            {/* 새로 시작 버튼 */}
            {(file || result) && (
              <button
                onClick={onReset}
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 dark:bg-white px-4 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition shadow-sm"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                새로 시작
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-8">
        {/* 1) 업로드 영역 */}
        {(status === "idle" || status === "error") && !result && (
          <section className="space-y-6">
            <div className="text-center max-w-2xl mx-auto pt-4">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                이 로고, 어디서 본 것 같다면?
              </h2>
              <p className="mt-3 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                디자인한 로고를 업로드하면 AI가 유사한 실제 브랜드를 찾아내고,
                표절 위험 등급과 디자인 피드백까지 제공합니다.
              </p>
            </div>

            <label
              htmlFor="logo-upload"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`block cursor-pointer rounded-2xl border-2 border-dashed p-10 sm:p-16 text-center transition
                ${
                  dragOver
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                    : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20"
                }`}
            >
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
                <svg
                  className="h-7 w-7 text-indigo-600 dark:text-indigo-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
              </div>
              <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                로고 이미지를 끌어다 놓거나 클릭해서 선택하세요
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                PNG · JPG · WebP · 최대 10MB
              </p>
              <input
                id="logo-upload"
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>

            {/* 카메라 촬영 버튼 (모든 디바이스) */}
            <div className="flex justify-center">
              <button
                onClick={() => setShowCamera(true)}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.66-.9l.81-1.2A2 2 0 0110.07 4h3.86a2 2 0 011.66.9l.81 1.2a2 2 0 001.66.9H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                카메라로 촬영
              </button>
            </div>

            {status === "error" && errorMsg && (
              <div className="mx-auto max-w-2xl rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* 미리보기 + 분석 버튼 */}
            {file && previewUrl && (
              <div className="mx-auto max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
                <div className="aspect-square rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="업로드한 로고"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </div>
                <button
                  onClick={onAnalyze}
                  className="w-full rounded-xl bg-zinc-900 dark:bg-white py-3 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition"
                >
                  분석 시작
                </button>
              </div>
            )}
          </section>
        )}

        {/* 2) 분석 중 */}
        {status === "analyzing" && (
          <section className="flex flex-col items-center justify-center py-16 sm:py-24 space-y-8">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-200 dark:border-zinc-800" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                AI가 로고를 분석하고 있습니다
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                보통 10~30초 정도 걸립니다. 잠시만 기다려 주세요.
              </p>
            </div>
            {previewUrl && (
              <div className="h-24 w-24 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center opacity-60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="분석 중인 로고"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
            <ul className="text-sm text-zinc-500 dark:text-zinc-400 space-y-1.5 text-center">
              <li>① 이미지에서 형태·색상·타이포그래피 추출 중</li>
              <li>② 유사한 글로벌·한국 브랜드 매칭 중</li>
              <li>③ 표절 위험 등급 판정 및 리포트 작성 중</li>
            </ul>
          </section>
        )}

        {/* 3) 결과 */}
        {status === "result" && result && previewUrl && (
          <section className="space-y-6">
            {/* 상단: 이미지 + 위험 등급 */}
            <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
              <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="aspect-square rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="업로드한 로고"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 text-center">
                  업로드한 로고
                </p>
              </div>

              <div
                className={`rounded-2xl p-6 ring-1 ${
                  RISK_META[result.riskLevel].bg
                } ${RISK_META[result.riskLevel].ring}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  표절 위험 등급
                </div>
                <div
                  className={`mt-2 flex items-center gap-3 text-3xl font-bold ${
                    RISK_META[result.riskLevel].tone
                  }`}
                >
                  <span>{RISK_META[result.riskLevel].emoji}</span>
                  <span>{RISK_META[result.riskLevel].label}</span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {result.riskReason}
                </p>
              </div>
            </div>

            {/* 디자인 요소 분해 */}
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                디자인 요소 분석
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    색상
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.designElements.colors.map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-300"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    형태
                  </p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {result.designElements.shape}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    타이포그래피
                  </p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {result.designElements.typography}
                  </p>
                </div>
              </div>
            </div>

            {/* 유사 브랜드 Top 5 */}
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                유사한 실제 브랜드 Top {result.similarBrands.length}
              </h3>
              {result.similarBrands.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  유의미하게 유사한 기존 브랜드가 발견되지 않았습니다. 독창적
                  디자인일 가능성이 높습니다.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {result.similarBrands.map((b, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-950/40"
                    >
                      <div className="flex items-start gap-4">
                        <BrandLogo url={b.officialUrl} name={b.name} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {b.name}
                            </h4>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {b.industry} · {b.country} · {b.foundedYear}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                            {b.reasonForSimilarity}
                          </p>
                          {b.officialUrl && (
                            <a
                              href={b.officialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline break-all"
                            >
                              {b.officialUrl}
                              <svg
                                className="h-3 w-3 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </a>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                            {Math.round(b.similarityScore)}
                            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                              %
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-20 sm:w-24 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full bg-indigo-500"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, b.similarityScore)
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 디자인 피드백 */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40 border border-indigo-100 dark:border-indigo-900 p-6">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-indigo-600 dark:text-indigo-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                디자인 피드백
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                {result.educationalFeedback}
              </p>
            </div>

            {/* DIAD / Coloso 클래스 배너 */}
            <ClassBanner />

            {/* 자율 후원 카드 */}
            <SponsorCard
              onOpenDonate={() => {
                setDonateReason("voluntary");
                setDonateOpen(true);
              }}
            />

            {/* 액션 */}
            <div className="flex justify-center pt-2">
              <button
                onClick={onReset}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 dark:bg-white px-6 py-3 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition"
              >
                다른 로고 분석하기
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-8">
        <div className="mx-auto max-w-5xl px-6 py-6 flex flex-col items-center gap-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 text-center space-y-1">
            <p>
              Made by{" "}
              <a
                href="https://www.youtube.com/@wonchan"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-zinc-700 dark:text-zinc-300 hover:underline"
              >
                디고디원찬
              </a>{" "}
              · 디자이너의 고민을 들어주는 디자이너
            </p>
            <p>
              ⚠️ AI 분석 결과는 참고용입니다. 표절 여부에 대한 법적 판단은
              전문가 의뢰가 필요합니다.
            </p>
          </div>
        </div>
      </footer>

      {/* 카메라 촬영 모달 */}
      {showCamera && (
        <CameraCapture
          onCapture={(f) => {
            setShowCamera(false);
            handleFile(f);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* 후원 모달 */}
      <DonateModal
        open={donateOpen}
        onClose={() => setDonateOpen(false)}
        reason={donateReason}
        onUnlocked={(s) => setLimitStatus(s)}
      />
    </div>
  );
}
