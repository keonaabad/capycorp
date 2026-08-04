import { prisma } from "@/lib/prisma";

/**
 * Fixed-window rate limit backed by RateLimitHit. Counts hits for `key`
 * within the last `windowMs`; if that's already at `limit`, rejects
 * without recording anything. No cleanup of old rows — table stays small
 * at MVP traffic, revisit if that changes.
 */
export async function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): Promise<boolean> {
  const windowStart = new Date(Date.now() - opts.windowMs);
  const count = await prisma.rateLimitHit.count({
    where: { key, createdAt: { gte: windowStart } },
  });
  if (count >= opts.limit) {
    return false;
  }
  await prisma.rateLimitHit.create({ data: { key } });
  return true;
}

/** First entry of x-forwarded-for, or "unknown" (e.g. local dev). */
export function clientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}
