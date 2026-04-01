import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdminApiAccess();
    if (response) return response;

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const personaId = searchParams.get("personaId");
    const characterId = searchParams.get("characterId");
    const groupBy = searchParams.get("groupBy") || "day";

    if (!userId || !personaId) {
      return NextResponse.json(
        { success: false, error: { message: "缺少必要参数" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("memories")
      .select("id, content, memory_type, importance, created_at, updated_at, retrieval_count")
      .eq("user_id", userId)
      .eq("persona_id", personaId);

    if (characterId) {
      query = query.eq("character_id", characterId);
    }

    const { data: memories, error } = await query.order("created_at", { ascending: true });

    if (error) {
      throw new Error(`读取记忆失败: ${error.message}`);
    }

    if (!memories || memories.length === 0) {
      return NextResponse.json({
        success: true,
        data: { timeline: [], events: [] },
      });
    }

    // 按时间分组
    const grouped = memories.reduce(
      (acc, memory) => {
        const date = new Date(memory.created_at);
        let key: string;

        if (groupBy === "hour") {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:00`;
        } else if (groupBy === "day") {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        } else if (groupBy === "week") {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        }

        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(memory);
        return acc;
      },
      {} as Record<string, typeof memories>,
    );

    // 生成时间线数据
    const timeline = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([timestamp, items]) => ({
        timestamp,
        count: items.length,
        types: items.reduce(
          (acc, item) => {
            acc[item.memory_type] = (acc[item.memory_type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        avg_importance: items.reduce((sum, item) => sum + Number(item.importance), 0) / items.length,
      }));

    // 生成事件列表（重要事件）
    const events = memories
      .filter((m) => Number(m.importance) >= 0.7 || (m.retrieval_count ?? 0) >= 5)
      .map((m) => ({
        id: m.id,
        timestamp: m.created_at,
        content: m.content.slice(0, 150),
        memory_type: m.memory_type,
        importance: Number(m.importance),
        retrieval_count: m.retrieval_count ?? 0,
      }));

    return NextResponse.json({
      success: true,
      data: { timeline, events },
    });
  } catch (error) {
    console.error("Timeline error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "时间线生成失败",
        },
      },
      { status: 500 },
    );
  }
}
