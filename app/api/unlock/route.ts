import { NextRequest } from "next/server";
import { getClientIp, unlock } from "@/app/lib/rateLimiter";

export const runtime = "nodejs";

/**
 * 신뢰 기반 잠금 해제 (Honor System)
 * - 사용자가 후원 QR로 송금 후 "후원 완료" 체크 시 호출
 * - 24시간 무제한 사용 권한 부여
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const status = unlock(ip);
  return Response.json(status);
}
