import { NextResponse } from "next/server";
import { fallbackCatalog, fetchLiveCatalog } from "@/lib/routeFeed";

export const runtime = "nodejs";
// Re-validate the upstream feed every 10 minutes.
export const revalidate = 600;

/**
 * Serves the route catalog with advertised APYs sourced live from DefiLlama's
 * Mantle pools. On any upstream failure it returns the built-in catalog so the
 * console always has something to predict against.
 */
export async function GET() {
  try {
    const feed = await fetchLiveCatalog();
    return NextResponse.json(feed);
  } catch {
    return NextResponse.json(fallbackCatalog());
  }
}
