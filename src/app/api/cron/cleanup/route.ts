import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/services/cleanup.service";

/**
 * GET /api/cron/cleanup
 *
 * Vercel Cron Job endpoint — invoked every minute via vercel.json.
 * Releases all expired pending reservations back to available stock.
 *
 * Protected by CRON_SECRET to prevent unauthorized invocations.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the cron secret in production
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const releasedCount = await releaseExpiredReservations();

    return NextResponse.json({
      success: true,
      releasedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[GET /api/cron/cleanup] Error:", error);
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 }
    );
  }
}
