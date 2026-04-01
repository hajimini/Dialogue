import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { memoryMetrics } from "@/lib/memory/metrics";

/**
 * GET /api/admin/memory-metrics
 * 
 * 返回记忆系统的性能统计数据
 * 仅管理员可访问
 */
export async function GET() {
  try {
    // 认证检查：仅admin可访问
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { 
          success: false, 
          data: null, 
          error: { message: "Admin access required." } 
        },
        { status: user ? 403 : 401 }
      );
    }

    // 获取所有性能统计
    const stats = memoryMetrics.getAllStats();

    return NextResponse.json({
      success: true,
      data: {
        metrics: stats,
        timestamp: new Date().toISOString(),
      },
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retrieve memory metrics";
    return NextResponse.json(
      { 
        success: false, 
        data: null, 
        error: { message } 
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "Admin access required." },
        },
        { status: user ? 403 : 401 },
      );
    }

    memoryMetrics.reset();

    return NextResponse.json({
      success: true,
      data: {
        reset: true,
        timestamp: new Date().toISOString(),
      },
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reset memory metrics";
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { message },
      },
      { status: 500 },
    );
  }
}
