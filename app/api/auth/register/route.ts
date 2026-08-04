import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  const allowed = await checkRateLimit(`register:${clientIp(request)}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts — try again later." },
      { status: 429 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const { email, password, name } =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : null;
  const normalizedPassword = typeof password === "string" ? password : null;
  const normalizedName =
    typeof name === "string" && name.trim() ? name.trim() : null;

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400 },
    );
  }
  if (!normalizedPassword || normalizedPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(normalizedPassword, 12);
  const user = await prisma.user.create({
    data: { email: normalizedEmail, passwordHash, name: normalizedName },
    select: { id: true, email: true, name: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
