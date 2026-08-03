import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// engineType = "client" (schema.prisma) drops the native query-engine
// binary entirely — Turbopack's bundling was breaking that binary's
// __dirname-relative lookup on Vercel even with a correct
// outputFileTracingIncludes; the driver-adapter path has no such lookup.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
