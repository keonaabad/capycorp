import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_AGENT_NAMES,
  ROLE_ORDER,
} from "@/lib/simulation/office-layout";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const { name, industry } =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedIndustry =
    typeof industry === "string" && industry.trim() ? industry.trim() : null;

  if (!normalizedName) {
    return NextResponse.json(
      { error: "A business name is required." },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const business = await prisma.$transaction(async (tx) => {
    const created = await tx.business.create({
      data: { userId, name: normalizedName, industry: normalizedIndustry },
    });
    for (const role of ROLE_ORDER) {
      await tx.agent.create({
        data: { businessId: created.id, name: DEFAULT_AGENT_NAMES[role], role },
      });
    }
    return created;
  });

  return NextResponse.json({ business: { id: business.id } }, { status: 201 });
}
