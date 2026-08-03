import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/chrome/sidebar";

/**
 * The one persistent app shell for every authenticated business page —
 * auth check and the business list live here now, not duplicated in
 * page.tsx and [id]/page.tsx the way they were before this milestone.
 * `main` is `overflow-hidden`: this is a full-height app shell where
 * individual panels (the office canvas, the right rail) own their own
 * scrolling, not the page itself — same model ChatGPT/Claude use.
 */
export default async function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const businesses = await prisma.business.findMany({
    where: { userId: session.user.id, archived: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, industry: true },
  });

  return (
    // Column below md so Sidebar's mobile top bar (an in-flow div — the
    // rest of Sidebar's markup at that width is `fixed`, out of flow)
    // stacks above `main` instead of sitting beside it; row at md+ where
    // Sidebar's <aside> becomes `static` and takes its normal place.
    <div className="flex h-screen flex-col bg-page text-ink md:flex-row">
      <Sidebar businesses={businesses} userEmail={session.user.email ?? ""} />
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
