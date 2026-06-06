"use client";

const CLASSES: {
  title: string;
  subtitle: string;
  image: string;
  href: string;
  badge?: string;
}[] = [
  {
    title: "DIAD 브랜딩 클래스",
    subtitle: "오프라인 · 총 10주 · 13가지 아이덴티티로 배우는 브랜딩 마스터",
    image: "/class-diad-branding.jpg",
    href: "https://smartstore.naver.com/dgod",
    badge: "오프라인",
  },
  {
    title: "DIAD 디자인기초 클래스",
    subtitle: "오프라인 · 총 10주 · 디자이너의 첫 발걸음을 위한 기초 워크숍",
    image: "/class-diad-basic.jpg",
    href: "https://smartstore.naver.com/dgod",
    badge: "오프라인",
  },
  {
    title: "Coloso · 브랜딩/패키지 디자인 마스터",
    subtitle: "온라인 VOD · 13가지 아이덴티티로 배우는 브랜딩과 패키지 디자인",
    image: "/class-coloso-branding.jpg",
    href: "https://bit.ly/49s2TQK",
    badge: "온라인",
  },
  {
    title: "Coloso · 디자인사조 + AI 활용 실무",
    subtitle: "온라인 VOD · 100년의 디자인 사조와 AI 활용 마스터",
    image: "/class-coloso-design.jpg",
    href: "http://bit.ly/4dY8HFz",
    badge: "온라인",
  },
];

export default function ClassBanner() {
  return (
    <section className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          더 깊은 브랜드 디자인 학습
        </h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          네카라쿠베 실무자도 수강하는 디고디원찬 클래스
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CLASSES.map((c) => (
          <a
            key={c.title}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group block overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-md transition"
          >
            <div className="relative aspect-[16/6] bg-zinc-900 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image}
                alt={c.title}
                className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
              />
              {c.badge && (
                <span className="absolute top-2 left-2 rounded-full bg-black/60 backdrop-blur px-2 py-0.5 text-[10px] font-medium text-white">
                  {c.badge}
                </span>
              )}
            </div>
            <div className="p-3">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                {c.title}
              </h4>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {c.subtitle}
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
