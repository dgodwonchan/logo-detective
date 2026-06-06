/**
 * IP 기반 레이트 리미터 (in-memory)
 * - 한국 시간(KST) 기준 일일 카운트
 * - 24시간 잠금해제 (신뢰 기반: 후원 완료 체크 시 풀림)
 *
 * ⚠️ Vercel 배포 시: 서버리스 인스턴스마다 메모리가 분리되므로,
 *   본격 운영 시 Vercel KV / Upstash Redis 로 교체 필요.
 *   현재는 dev 및 단일 인스턴스 환경 가정.
 */

const FREE_LIMIT = 5;
const UNLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

type Entry = {
  count: number;
  dayKey: string; // YYYY-MM-DD (KST)
  unlockedUntil?: number; // epoch ms
};

declare global {
  var __logoDetectiveRateStore: Map<string, Entry> | undefined;
}

// hot-reload에서도 store 유지
const store = (globalThis.__logoDetectiveRateStore ??= new Map<string, Entry>());

function getKoreaDayKey(now = Date.now()): string {
  const kst = new Date(now + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export interface LimitStatus {
  allowed: boolean;
  remaining: number; // -1 = 무제한 (unlocked)
  unlocked: boolean;
  unlockedUntil?: number;
  limit: number;
}

function getOrCreateEntry(ip: string): Entry {
  const today = getKoreaDayKey();
  let entry = store.get(ip);
  if (!entry || entry.dayKey !== today) {
    entry = {
      count: 0,
      dayKey: today,
      // 잠금해제는 24h 절대 시간이므로 날짜가 바뀌어도 유지
      unlockedUntil: entry?.unlockedUntil,
    };
    store.set(ip, entry);
  }
  return entry;
}

function buildStatus(entry: Entry): LimitStatus {
  const now = Date.now();
  if (entry.unlockedUntil && entry.unlockedUntil > now) {
    return {
      allowed: true,
      remaining: -1,
      unlocked: true,
      unlockedUntil: entry.unlockedUntil,
      limit: FREE_LIMIT,
    };
  }
  return {
    allowed: entry.count < FREE_LIMIT,
    remaining: Math.max(0, FREE_LIMIT - entry.count),
    unlocked: false,
    limit: FREE_LIMIT,
  };
}

export function getStatus(ip: string): LimitStatus {
  return buildStatus(getOrCreateEntry(ip));
}

/** 분석 1회 소비. 잠금해제 상태면 카운트하지 않음. */
export function consume(ip: string): LimitStatus {
  const entry = getOrCreateEntry(ip);
  const now = Date.now();
  if (!(entry.unlockedUntil && entry.unlockedUntil > now)) {
    entry.count += 1;
  }
  return buildStatus(entry);
}

/** 24시간 잠금 해제 (후원 완료 신고 시) */
export function unlock(ip: string): LimitStatus {
  const entry = getOrCreateEntry(ip);
  entry.unlockedUntil = Date.now() + UNLOCK_DURATION_MS;
  return buildStatus(entry);
}

/** 요청 헤더에서 클라이언트 IP 추출 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  return "local";
}

export const FREE_LIMIT_PER_DAY = FREE_LIMIT;
