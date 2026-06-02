import { NextResponse } from "next/server";
import { getByrealMarket } from "@/lib/byrealClient";
import { unavailableMarket } from "@/lib/byrealTypes";

export const runtime = "nodejs";
// Spawn the Byreal CLI live on each request (don't prerender at build time).
export const dynamic = "force-dynamic";

/**
 * Returns a live snapshot of Byreal's agent-native DEX market, read from the
 * real Byreal Agent Skills CLI. Always 200 with `available: false` on failure
 * so the console can degrade to its local adapter without error handling.
 */
export async function GET() {
  try {
    return NextResponse.json(await getByrealMarket());
  } catch {
    return NextResponse.json(unavailableMarket());
  }
}
