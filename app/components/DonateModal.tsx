"use client";

import { useState } from "react";
import { useTranslations } from 'next-intl';
import type { LimitStatus } from "../types";

type Method = "toss" | "kakao" | "naver" | "kofi" | "paypal" | "wechat" | "alipay";

export default function DonateModal({
  open,
  onClose,
  reason,
  onUnlocked,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  reason: "limit" | "voluntary";
  onUnlocked?: (status: LimitStatus) => void;
  locale: string;
}) {
  const t = useTranslations('donate');

  const METHODS: { id: Method; label: string; qr: string; color: string; textColor: string }[] =
    locale === 'ko'
      ? [
          { id: "toss", label: t('methods.toss'), qr: "/donate-toss.png", color: "bg-[#0064FF] hover:bg-[#0050cc]", textColor: "text-white" },
          { id: "kakao", label: t('methods.kakao'), qr: "/donate-kakao.png", color: "bg-[#FFE812] hover:bg-[#f0d800]", textColor: "text-zinc-900" },
          { id: "naver", label: t('methods.naver'), qr: "/donate-naver.png", color: "bg-[#03C75A] hover:bg-[#02a04a]", textColor: "text-white" },
        ]
      : locale === 'zh'
      ? [
          { id: "wechat", label: t('methods.wechat'), qr: "/donate-wechat.png", color: "bg-[#07C160] hover:bg-[#06a050]", textColor: "text-white" },
          { id: "alipay", label: t('methods.alipay'), qr: "/donate-alipay.png", color: "bg-[#1677FF] hover:bg-[#1366d9]", textColor: "text-white" },
        ]
      : [
          { id: "kofi", label: t('methods.kofi'), qr: "/donate-kofi.png", color: "bg-[#FF5E5B] hover:bg-[#e04a47]", textColor: "text-white" },
          { id: "paypal", label: t('methods.paypal'), qr: "/donate-paypal.png", color: "bg-[#003087] hover:bg-[#00246b]", textColor: "text-white" },
        ];

  const [selected, setSelected] = useState<Method>(METHODS[0].id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const onUnlockClick = async () => {
    if (reason !== "limit") { onClose(); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/unlock", { method: "POST", credentials: "include" });
      const data = (await res.json()) as LimitStatus;
      if (!res.ok) throw new Error(t('unlock'));
      onUnlocked?.(data); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('unlock'));
    } finally { setSubmitting(false); }
  };

  const current = METHODS.find((m) => m.id === selected)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl">
        <div className="px-6 pt-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{reason === "limit" ? t('limitTitle') : t('voluntaryTitle')}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{reason === "limit" ? t('limitDesc') : t('voluntaryDesc')}</p>
            </div>
            <button onClick={onClose} aria-label={t('close')} className="shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="px-6 pt-4">
          <div className={`grid gap-2 ${METHODS.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {METHODS.map((m) => (
              <button key={m.id} onClick={() => setSelected(m.id)}
                className={`rounded-lg py-2.5 text-sm font-semibold transition ${selected === m.id ? `${m.color} ${m.textColor} shadow` : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-xl bg-white border border-zinc-200 dark:border-zinc-700 p-3 flex items-center justify-center">
            <img src={current.qr} alt={`${current.label} QR`} className="max-h-72 w-auto object-contain" />
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 text-center leading-relaxed">
            {t('scanQR', { method: current.label })}
            <br />
            {t('recommendedAmount')}
          </p>
        </div>

        {reason === "limit" ? (
          <div className="px-6 pb-6 space-y-3">
            {error && <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{error}</div>}
            <button onClick={onUnlockClick} disabled={submitting} className="w-full rounded-xl bg-zinc-900 dark:bg-white py-3 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition disabled:opacity-50">
              {submitting ? "..." : t('unlock')}
            </button>
            <button onClick={onClose} className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">{t('comeBackTomorrow')}</button>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed">{t('trust')}</p>
          </div>
        ) : (
          <div className="px-6 pb-6">
            <button onClick={onClose} className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">{t('close')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
