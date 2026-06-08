"use client";

import { useTranslations } from 'next-intl';

const CLASSES: {
  image: string;
  href: string;
  type: "offline" | "online";
}[] = [
  { image: "/class-diad-branding.jpg", href: "https://smartstore.naver.com/dgod", type: "offline" },
  { image: "/class-diad-basic.jpg", href: "https://smartstore.naver.com/dgod", type: "offline" },
  { image: "/class-coloso-branding.jpg", href: "https://bit.ly/49s2TQK", type: "online" },
  { image: "/class-coloso-design.jpg", href: "http://bit.ly/4dY8HFz", type: "online" },
];

export default function ClassBanner() {
  const t = useTranslations('classes');
  const items = t.raw('items') as { title: string; subtitle: string }[];

  return (
    <section className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t('heading')}
        </h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {t('subtitle')}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CLASSES.map((c, i) => (
          <a
            key={c.image}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group block overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-md transition"
          >
            <div className="relative aspect-[16/6] bg-zinc-900 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image}
                alt={items[i]?.title ?? ''}
                className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
              />
              <span className="absolute top-2 left-2 rounded-full bg-black/60 backdrop-blur px-2 py-0.5 text-[10px] font-medium text-white">
                {c.type === "offline" ? t('badgeOffline') : t('badgeOnline')}
              </span>
            </div>
            <div className="p-3">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                {items[i]?.title}
              </h4>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {items[i]?.subtitle}
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
