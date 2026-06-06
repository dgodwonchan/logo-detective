/**
 * IP 기반 레이트 리미터 (in-memory + 서명 쿠키 fallback)
 * - 한국 시간(KST) 기준 일일 카운트
 * - 24시간 잠금해제 (신뢰 기반)
 *
 * ⚠️ Vercel 배포 시: 서버리스 인스턴스마다 메모리가 분리되므로,
 *   unlock 상태는 서명된 쿠키(ld_unlock)에도 저장해 서버 전체에 공유.
 */

import { createHmac } from "crypto";

const FREE_LIMIT = 5;
const UNLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

// 서명용 secret (최소한의 무결성 검증용)
const COOKIE_SECRET =
  process.env.UNLOCK_SECRET || process.env.GEMINI_API_KEY || "logo-detective-default-secret";

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

function signCookie(value: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(value);
  return hmac.digest("hex").slice(0, 16);
}

function verifyCookie(cookieVal: string | undefined, secret: string): number | undefined {
  if (!cookieVal) return undefined;
  const [payload, sig] = cookieVal.split(":");
  if (!payload || !sig) return undefined;
  const expected = signCookie(payload, secret);
  if (expected !== sig || payload.length !== 13) return undefined; // epoch ms 문자열 13자리 확인
  const unlockedUntil = Number(payload);
  if (Number.isNaN(unlockedUntil) || unlockedUntil < Date.now()) return undefined;
  return unlockedUntil;
}

export function getUnlockFromHeaders(headers: Headers): number | undefined {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/ld_unlock=([^;]+)/);
  if (!match) return undefined;
  const val = decodeURIComponent(match[1]);
  return verifyCookie(val, COOKIE_SECRET);
}

function buildStatus(entry: Entry, cookieUnlock?: number): LimitStatus {
  const now = Date.now();
  const memUnlockValid = entry.unlockedUntil && entry.unlockedUntil > now;
  const cookieUnlockValid = cookieUnlock && cookieUnlock > now;
  if (memUnlockValid || cookieUnlockValid) {
    return {
      allowed: true,
      remaining: -1,
      unlocked: true,
      unlockedUntil: entry.unlockedUntil || cookieUnlock || undefined,
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

export function getStatus(ip: string, cookieUnlock?: number): LimitStatus {
  return buildStatus(getOrCreateEntry(ip), cookieUnlock);
}

/** 분석 1회 소비. 잠금해제 상태면 카운트하지 않음. */
export function consume(ip: string, cookieUnlock?: number): LimitStatus {
  const entry = getOrCreateEntry(ip);
  const now = Date.now();
  const memUnlockValid = entry.unlockedUntil && entry.unlockedUntil > now;
  const cookieUnlockValid = cookieUnlock && cookieUnlock > now;
  if (!memUnlockValid && !cookieUnlockValid) {
    entry.count += 1;
  }
  return buildStatus(entry, cookieUnlock);
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
