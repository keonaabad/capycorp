import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
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
  await prisma.waitlistEntry.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: { email: normalizedEmail },
  });

  return NextResponse.json({ ok: true });
}
