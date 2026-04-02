import { NextResponse } from "next/server";
import { memoryContextCache } from "@/lib/memory/memory-context-cache";

export async function POST() {
  try {
    memoryContextCache.clear();

    return NextResponse.json({
      success: true,
      message: "Memory context cache cleared successfully",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to clear cache";
    return NextResponse.json(
      { success: false, error: { message } },
      { status: 500 },
    );
  }
}
