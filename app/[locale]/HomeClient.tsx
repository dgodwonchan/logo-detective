'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalysisResult, LimitStatus, RiskLevel } from '../types';
import CameraCapture from '../components/CameraCapture';
import BrandLogo from '../components/BrandLogo';
import DonateModal from '../components/DonateModal';
import SponsorCard from '../components/SponsorCard';
import ClassBanner from '../components/ClassBanner';
import { useRouter, usePathname } from '@/i18n/navigation';

export default function HomeClient({ locale }: { locale: string }) {
  const t = useTranslations();
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'result' | 'error'>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [limitStatus, setLimitStatus] = useState<LimitStatus | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [donateReason, setDonateReason] = useState<'limit' | 'voluntary'>('voluntary');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch('/api/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((s: LimitStatus) => setLimitStatus(s))
      .catch(() => {});
  }, []);

  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setErrorMsg(t('errors.imageOnly'));
      setStatus('error');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrorMsg(t('errors.fileTooLarge'));
      setStatus('error');
      return;
    }
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setStatus('idle');
    setResult(null);
    setErrorMsg('');
  }, [t]);

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const onAnalyze = async () => {
    if (!file) return;
    if (limitStatus && !limitStatus.allowed && !limitStatus.unlocked) {
      setDonateReason('limit');
      setDonateOpen(true);
      return;
    }
    setStatus('analyzing');
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('locale', locale);
      const res = await fetch('/api/analyze', { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (data?.limitStatus) setLimitStatus(data.limitStatus as LimitStatus);
      if (res.status === 429 && data?.rateLimited) {
        setDonateReason('limit');
        setDonateOpen(true);
        setStatus('idle');
        return;
      }
      if (!res.ok) throw new Error(data?.error || t('errors.analysisFailed'));
      setResult(data as AnalysisResult);
      setStatus('result');
    } catch (err) {
      const raw = err instanceof Error ? err.message : t('errors.analysisFailed');
      const friendly =
        raw === 'Load failed' || raw === 'Failed to fetch' || raw.includes('network')
          ? t('errors.networkError')
          : raw;
      setErrorMsg(friendly);
      setStatus('error');
    }
  };

  const onReset = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setStatus('idle');
    setResult(null);
    setErrorMsg('');
  };

  const switchLocale = (next: string) => {
    router.replace(pathname, { locale: next });
  };

  const RISK_META: Record<RiskLevel, { label: string; emoji: string; tone: string; bg: string; ring: string }> = {
    safe: { label: t('result.safe'), emoji: '🟢', tone: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40', ring: 'ring-emerald-200 dark:ring-emerald-900' },
    caution: { label: t('result.caution'), emoji: '🟡', tone: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/40', ring: 'ring-amber-200 dark:ring-amber-900' },
    danger: { label: t('result.danger'), emoji: '🔴', tone: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-950/40', ring: 'ring-rose-200 dark:ring-rose-900' },
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* 헤더 */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-xl overflow-hidden bg-black ring-1 ring-zinc-200 dark:ring-zinc-800">
              <img src="/logo.png" alt={t('header.title')} className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="flex items-center gap-1.5 text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                <span className="truncate">{t('header.title')}</span>
                <span className="shrink-0 text-xs font-medium text-zinc-400 dark:text-zinc-500">{t('header.by')}</span>
              </h1>
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 truncate">{t('header.subtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* 언어 전환 */}
            <div className="flex items-center gap-0.5 text-[11px] font-medium">
              {(['ko','en','zh'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => switchLocale(l)}
                  className={`px-1.5 py-0.5 rounded transition ${currentLocale === l ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {/* 소셜 아이콘 (sm 이상) */}
            <nav className="hidden sm:flex items-center gap-0.5" aria-label="Social channels">
              <a href="https://www.youtube.com/@wonchan" target="_blank" rel="noopener noreferrer" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition">
                <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
              </a>
              <a href="https://www.instagram.com/dgodwonchan" target="_blank" rel="noopener noreferrer" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-950/40 transition">
                <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
              </a>
              <a href="http://minimalist.kr/" target="_blank" rel="noopener noreferrer" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition">
                <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3" /></svg>
              </a>
            </nav>

            {/* 사용량 */}
            {limitStatus && (
              <button
                onClick={() => { setDonateReason(limitStatus.unlocked || limitStatus.allowed ? 'voluntary' : 'limit'); setDonateOpen(true); }}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                {limitStatus.unlocked ? (
                  <><span aria-hidden>♾️</span><span className="hidden sm:inline">{t('usage.unlimited')}</span><span className="sm:hidden">{t('usage.unlimitedShort')}</span></>
                ) : (
                  <><span aria-hidden>☕</span><span>{limitStatus.limit - limitStatus.remaining}/{limitStatus.limit}</span></>
                )}
              </button>
            )}

            {/* 새로 시작 */}
            {(file || result) && (
              <button onClick={onReset} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-900 dark:bg-white px-2.5 sm:px-4 py-1.5 text-[11px] sm:text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition shadow-sm" title={t('upload.replace')}>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                <span className="hidden sm:inline">{t('upload.replace')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-8">
        {(status === 'idle' || status === 'error') && !result && (
          <section className="space-y-6">
            <div className="text-center max-w-2xl mx-auto pt-4">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{t('hero.title')}</h2>
              <p className="mt-3 text-zinc-600 dark:text-zinc-400 leading-relaxed">{t('hero.description')}</p>
            </div>

            {file && previewUrl && (
              <div className="mx-auto max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
                <div className="aspect-square rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
                  <img src={previewUrl} alt={t('upload.uploaded')} className="max-h-full max-w-full object-contain" />
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{t('upload.fileInfo', { name: file.name, size: (file.size / 1024).toFixed(1) })}</div>
                <button onClick={onAnalyze} className="w-full rounded-xl bg-zinc-900 dark:bg-white py-3 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition">{t('upload.startAnalysis')}</button>
              </div>
            )}

            <label
              htmlFor="logo-upload"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`block cursor-pointer rounded-2xl border-2 border-dashed p-10 sm:p-16 text-center transition ${dragOver ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20'}`}
            >
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
                <svg className="h-7 w-7 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">{file ? t('upload.replace') : t('upload.drop')}</p>
              {!file && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('upload.recommendedSize')}</p>}
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t('upload.formats')}</p>
              <input id="logo-upload" ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
            </label>

            {!file && (
              <div className="flex justify-center">
                <button onClick={() => setShowCamera(true)} className="inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.66-.9l.81-1.2A2 2 0 0110.07 4h3.86a2 2 0 011.66.9l.81 1.2a2 2 0 001.66.9H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                  {t('upload.camera')}
                </button>
              </div>
            )}

            {status === 'error' && errorMsg && (
              <div className="mx-auto max-w-2xl rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{errorMsg}</div>
            )}
          </section>
        )}

        {status === 'analyzing' && (
          <section className="flex flex-col items-center justify-center py-16 sm:py-24 space-y-8">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-200 dark:border-zinc-800" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t('analyzing.title')}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('analyzing.subtitle')}</p>
            </div>
            {previewUrl && (
              <div className="h-24 w-24 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center opacity-60">
                <img src={previewUrl} alt="Analyzing" className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <ul className="text-sm text-zinc-500 dark:text-zinc-400 space-y-1.5 text-center">
              {t.raw('analyzing.steps').map((step: string, i: number) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </section>
        )}

        {status === 'result' && result && previewUrl && (
          <section className="space-y-6">
            <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
              <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="aspect-square rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
                  <img src={previewUrl} alt={t('upload.uploaded')} className="max-h-full max-w-full object-contain" />
                </div>
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 text-center">{t('upload.uploaded')}</p>
              </div>

              <div className={`rounded-2xl p-6 ring-1 ${RISK_META[result.riskLevel].bg} ${RISK_META[result.riskLevel].ring}`}>
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">📌 {t('result.riskLevel')}</div>
                <div className={`mt-2 flex items-center gap-3 text-3xl font-bold ${RISK_META[result.riskLevel].tone}`}>
                  <span>{RISK_META[result.riskLevel].emoji}</span>
                  <span>{RISK_META[result.riskLevel].label}</span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{result.riskReason}</p>
              </div>
            </div>

            {/* Web Detection */}
            {result.webDetection && (result.webDetection.matchingPages.length > 0 || result.webDetection.similarImages.length > 0 || result.webDetection.entities.length > 0) && (
              <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  🔎 {t('result.webDetection')} <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">{t('result.webDetectionSubtitle')}</span>
                </h3>
                {result.webDetection.entities.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">{t('result.keywords')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.webDetection.entities.slice(0, 8).map((e, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 px-2.5 py-1 text-xs text-blue-700 dark:text-blue-300">{e.description}</span>
                      ))}
                    </div>
                  </div>
                )}
                {result.webDetection.matchingPages.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">{t('result.matchingPages')}</p>
                    <ul className="space-y-2">
                      {result.webDetection.matchingPages.slice(0, 5).map((page, i) => (
                        <li key={i} className="flex items-start gap-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/40 px-3 py-2.5">
                          <div className="shrink-0 h-5 w-5 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mt-0.5">
                            <img src={`https://www.google.com/s2/favicons?sz=32&domain=${new URL(page.url).hostname}`} alt="" className="h-4 w-4 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{page.pageTitle}</p>
                            <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block">{page.url}</a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.webDetection.similarImages.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">{t('result.similarImages', { count: result.webDetection.similarImages.length })}</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {result.webDetection.similarImages.slice(0, 12).map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:ring-2 hover:ring-blue-400 transition group relative">
                          <img src={url} alt={`Similar ${i + 1}`} className="h-full w-full object-contain bg-white dark:bg-zinc-900" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
                            <svg className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </div>
                        </a>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{t('result.clickToOpen')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Design Elements */}
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">🎨 {t('result.designElements')}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t('result.colors')}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.designElements.colors.map((c, i) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-300">{c}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t('result.shape')}</p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{result.designElements.shape}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t('result.typography')}</p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{result.designElements.typography}</p>
                </div>
              </div>
            </div>

            {/* Similar Brands */}
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">🔗 {t('result.similarBrands', { count: result.similarBrands.length })}</h3>
              {result.similarBrands.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{t('result.noSimilarBrands')}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {result.similarBrands.map((b, i) => (
                    <li key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 bg-zinc-50/50 dark:bg-zinc-950/40">
                      <div className="flex gap-3 sm:gap-4">
                        <div className="shrink-0 flex flex-col items-center gap-1.5 pt-0.5">
                          <BrandLogo url={b.officialUrl} name={b.name} />
                          <div className="text-center">
                            <div className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-none">{Math.round(b.similarityScore)}<span className="text-[10px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400">%</span></div>
                            <div className="mt-1 h-1 w-14 sm:w-16 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, Math.max(0, b.similarityScore))}%` }} /></div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{b.name}</h4>
                            <span className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 break-keep">{b.industry} · {b.country} · {b.foundedYear}</span>
                          </div>
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed break-keep">{b.reasonForSimilarity}</p>
                          {b.officialUrl && (
                            <a href={b.officialUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline break-all">
                              {b.officialUrl}
                              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Design Feedback */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40 border border-indigo-100 dark:border-indigo-900 p-6">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">💡 {t('result.designFeedback')}</h3>
              {(() => {
                const fb = result.educationalFeedback;
                if (typeof fb === 'string') {
                  return <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-line">{fb}</p>;
                }
                const sections = [
                  { key: 'overall' as const, label: t('result.overall'), emoji: '🌐', bg: 'bg-white/70 dark:bg-zinc-900/40', border: 'border-indigo-200 dark:border-indigo-900' },
                  { key: 'pros' as const, label: t('result.pros'), emoji: '👍🏻', bg: 'bg-emerald-50/80 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-900' },
                  { key: 'cautions' as const, label: t('result.cautions'), emoji: '⚠️', bg: 'bg-amber-50/80 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-900' },
                  { key: 'improvements' as const, label: t('result.improvements'), emoji: '🛠', bg: 'bg-blue-50/80 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-900' },
                ];
                return (
                  <div className="mt-4 space-y-3">
                    {sections.map((s) => (
                      <div key={s.key} className={`rounded-xl border p-4 ${s.bg} ${s.border}`}>
                        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5"><span aria-hidden>{s.emoji}</span><span>{s.label}</span></div>
                        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-line">{fb[s.key]}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <ClassBanner />
            <SponsorCard onOpenDonate={() => { setDonateReason('voluntary'); setDonateOpen(true); }} />

            <div className="flex justify-center pt-2">
              <button onClick={onReset} className="inline-flex items-center gap-2 rounded-full bg-zinc-900 dark:bg-white px-6 py-3 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition">{t('result.analyzeAnother')}</button>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-8">
        <div className="mx-auto max-w-5xl px-6 py-6 flex flex-col items-center gap-4">
          <nav className="flex items-center gap-3" aria-label="Social channels">
            <a href="https://www.youtube.com/@wonchan" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition bg-zinc-100 dark:bg-zinc-800">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
            </a>
            <a href="https://www.instagram.com/dgodwonchan" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full flex items-center justify-center text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-950/40 transition bg-zinc-100 dark:bg-zinc-800">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
            </a>
            <a href="http://minimalist.kr/" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full flex items-center justify-center text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition bg-zinc-100 dark:bg-zinc-800">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3" /></svg>
            </a>
          </nav>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 text-center space-y-1">
            <p>{t('footer.madeBy')} <a href="https://www.youtube.com/@wonchan" target="_blank" rel="noopener noreferrer" className="font-medium text-zinc-700 dark:text-zinc-300 hover:underline">{t('footer.creator')}</a> · {t('footer.tagline')}</p>
            <p>⚠️ {t('footer.disclaimer')}</p>
          </div>
        </div>
      </footer>

      {showCamera && <CameraCapture onCapture={(f) => { setShowCamera(false); handleFile(f); }} onClose={() => setShowCamera(false)} />}
      <DonateModal open={donateOpen} onClose={() => setDonateOpen(false)} reason={donateReason} onUnlocked={(s) => setLimitStatus(s)} locale={locale} />
    </div>
  );
}
