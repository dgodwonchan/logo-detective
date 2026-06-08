"use client";

import { useTranslations } from 'next-intl';

export default function SponsorCard({
  onOpenDonate,
}: {
  onOpenDonate: () => void;
}) {
  const t = useTranslations('sponsor');
  return (
    <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span aria-hidden>☕</span>
            {t('title')}
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('desc')}
          </p>
        </div>
        <button
          onClick={onOpenDonate}
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition"
        >
          {t('button')}
        </button>
      </div>
    </div>
  );
}
