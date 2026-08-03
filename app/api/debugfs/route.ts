import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

function tryList(p: string) {
  try {
    return fs.readdirSync(p);
  } catch (e) {
    return `ERR: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function GET() {
  const cwd = process.cwd();
  let queryResult: unknown;
  try {
    queryResult = await prisma.$queryRaw`SELECT 1 as ok`;
  } catch (e) {
    queryResult = {
      ERR: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    };
  }
  return NextResponse.json({
    cwd,
    cwdListing: tryList(cwd),
    libListing: tryList(path.join(cwd, "lib")),
    generatedListing: tryList(path.join(cwd, "lib", "generated")),
    prismaListing: tryList(path.join(cwd, "lib", "generated", "prisma")),
    varTaskListing: tryList("/var/task"),
    varTaskLibGenerated: tryList("/var/task/lib/generated"),
    queryResult,
  });
}
