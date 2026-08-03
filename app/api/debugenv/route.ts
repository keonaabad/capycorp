import { NextResponse } from "next/server";

function redact(raw: string | undefined) {
  if (!raw) return { present: false };
  try {
    const u = new URL(raw);
    return {
      present: true,
      length: raw.length,
      startsWithQuote: raw.startsWith('"') || raw.startsWith("'"),
      startsWithKeyPrefix: raw.startsWith("DATABASE_URL="),
      protocol: u.protocol,
      host: u.host,
      pathname: u.pathname,
      search: u.search,
      hasUsername: Boolean(u.username),
      hasPassword: Boolean(u.password),
    };
  } catch (e) {
    return {
      present: true,
      length: raw.length,
      startsWithQuote: raw.startsWith('"') || raw.startsWith("'"),
      startsWithKeyPrefix: raw.startsWith("DATABASE_URL="),
      first20: raw.slice(0, 20),
      parseError: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: redact(process.env.DATABASE_URL),
  });
}
