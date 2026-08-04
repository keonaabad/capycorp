import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  const allowed = await checkRateLimit(`waitlist:${clientIp(request)}`, {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts — try again in a few minutes." },
      { status: 429 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const email =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).email
      : undefined;

  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : null;
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400 },
    );
  }

  // Upsert with an empty update rather than checking existence first —
  // resubmitting the same email is a success either way, not an error,
  // and this avoids leaking whether an email is already on the list.
  const startedAt = Date.now();
  await prisma.waitlistEntry.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: { email: normalizedEmail },
  });
  console.error(`[timing] waitlist upsert took ${Date.now() - startedAt}ms`);

  return NextResponse.json({ ok: true });
}
