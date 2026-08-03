import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const business = await prisma.business.findUnique({ where: { id } });
  // 404 (not 403) for both "doesn't exist" and "exists but not yours", to
  // avoid leaking id existence.
  if (!business || business.userId !== session.user.id) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => null);
  const { archived, name } =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const data: { archived?: boolean; name?: string } = {};
  if (typeof archived === "boolean") data.archived = archived;
  if (typeof name === "string" && name.trim()) data.name = name.trim();

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update." },
      { status: 400 },
    );
  }

  const updated = await prisma.business.update({ where: { id }, data });
  return NextResponse.json({
    business: {
      id: updated.id,
      name: updated.name,
      archived: updated.archived,
    },
  });
}
