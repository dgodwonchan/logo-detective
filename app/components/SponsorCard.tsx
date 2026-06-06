"use client";

export default function SponsorCard({
  onOpenDonate,
}: {
  onOpenDonate: () => void;
}) {
  return (
    <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span aria-hidden>☕</span>
            도움이 되셨나요?
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Logo Detective는 무료로 운영됩니다. AI 분석 비용과 서버 운영비가 발생해요.
            <br className="hidden sm:block" />
            커피 한 잔으로 프로젝트를 응원해 주세요.
          </p>
        </div>
        <button
          onClick={onOpenDonate}
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition"
        >
          후원하기
        </button>
      </div>
    </div>
  );
}
