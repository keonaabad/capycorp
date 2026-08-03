import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma's generator writes to a custom output path (lib/generated/prisma,
  // not the default node_modules/.prisma/client), so Next's file tracer
  // doesn't know the query engine binary belongs in the serverless bundle
  // and drops it — the client then throws "could not locate the Query
  // Engine for runtime ..." at request time even though the build
  // succeeds. Force it into every route's trace.
  outputFileTracingIncludes: {
    "/*": ["./lib/generated/prisma/**/*"],
  },
};

export default nextConfig;
