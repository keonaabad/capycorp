import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

function tryList(p: string) {
  try {
    return fs.readdirSync(p);
  } catch (e) {
    return `ERR: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function GET() {
  const cwd = process.cwd();
  return NextResponse.json({
    cwd,
    cwdListing: tryList(cwd),
    libListing: tryList(path.join(cwd, "lib")),
    generatedListing: tryList(path.join(cwd, "lib", "generated")),
    prismaListing: tryList(path.join(cwd, "lib", "generated", "prisma")),
    varTaskListing: tryList("/var/task"),
    varTaskLibGenerated: tryList("/var/task/lib/generated"),
  });
}
