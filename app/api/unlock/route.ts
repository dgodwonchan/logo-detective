import { NextRequest } from "next/server";
import { getClientIp, unlock } from "@/app/lib/rateLimiter";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function signCookie(value: string, secret: string): string {
  const crypto = require("crypto");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(value);
  return hmac.digest("hex").slice(0, 16);
}

function makeUnlockCookie(unlockedUntil: number, secret: string): string {
  const payload = String(unlockedUntil);
  const sig = signCookie(payload, secret);
  return `${payload}:${sig}`;
}

/**
 * 신뢰 기반 잠금 해제 (Honor System)
 * - 사용자가 후원 QR로 송금 후 "후원 완료" 체크 시 호출
 * - 24시간 무제한 사용 권한 부여
 * - 서명된 쿠키도 함께 발급 (Vercel serverless 대비)
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const status = unlock(ip);

  const secret = process.env.UNLOCK_SECRET || process.env.GEMINI_API_KEY || "logo-detective-default-secret";
  if (status.unlockedUntil) {
    const cookieVal = makeUnlockCookie(status.unlockedUntil, secret);
    (await cookies()).set("ld_unlock", cookieVal, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });
  }

  return Response.json(status);
}
