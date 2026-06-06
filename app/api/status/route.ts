import { NextRequest } from "next/server";
import { getClientIp, getStatus, getUnlockFromHeaders } from "@/app/lib/rateLimiter";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const cookieUnlock = getUnlockFromHeaders(request.headers);
  return Response.json(getStatus(ip, cookieUnlock));
}
