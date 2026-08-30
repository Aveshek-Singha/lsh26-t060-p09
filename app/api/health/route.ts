import { NextResponse } from "next/server";

import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * Deployment smoke test: GET /api/health
 *
 * Confirms the running instance can actually reach its database, which is the
 * failure that otherwise only shows up as an error panel on every page.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const [owners, vehicles] = await Promise.all([
      db.collection("owners").countDocuments(),
      db.collection("vehicles").countDocuments(),
    ]);

    return NextResponse.json({
      status: "ok",
      database: db.databaseName,
      owners,
      vehicles,
      seeded: owners > 0 && vehicles > 0,
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        hasUri: Boolean(process.env.MONGODB_URI),
        dnsOverride: process.env.MONGODB_DNS_SERVERS ?? null,
        ms: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
