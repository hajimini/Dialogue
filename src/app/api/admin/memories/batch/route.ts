import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdminApiAccess();
    if (response) return response;

    const body = (await request.json()) as {
      action: "delete" | "update_type" | "update_importance";
      memoryIds: string[];
      memoryType?: string;
      importance?: number;
    };

    const { action, memoryIds, memoryType, importance } = body;

    if (!memoryIds || memoryIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "未提供记忆ID" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    switch (action) {
      case "delete": {
        const { error } = await supabase
          .from("memories")
          .delete()
          .in("id", memoryIds);

        if (error) {
          throw new Error(`批量删除失败: ${error.message}`);
        }

        return NextResponse.json({
          success: true,
          data: { deleted_count: memoryIds.length },
        });
      }

      case "update_type": {
        if (!memoryType) {
          return NextResponse.json(
            { success: false, error: { message: "未提供记忆类型" } },
            { status: 400 },
          );
        }

        const { error } = await supabase
          .from("memories")
          .update({ memory_type: memoryType })
          .in("id", memoryIds);

        if (error) {
          throw new Error(`批量更新类型失败: ${error.message}`);
        }

        return NextResponse.json({
          success: true,
          data: { updated_count: memoryIds.length },
        });
      }

      case "update_importance": {
        if (importance === undefined) {
          return NextResponse.json(
            { success: false, error: { message: "未提供重要度" } },
            { status: 400 },
          );
        }

        const { error } = await supabase
          .from("memories")
          .update({ importance })
          .in("id", memoryIds);

        if (error) {
          throw new Error(`批量更新重要度失败: ${error.message}`);
        }

        return NextResponse.json({
          success: true,
          data: { updated_count: memoryIds.length },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: { message: "不支持的操作" } },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Batch operation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "批量操作失败",
        },
      },
      { status: 500 },
    );
  }
}
