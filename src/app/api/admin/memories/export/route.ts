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
    const format = searchParams.get("format") || "json";

    if (!userId || !personaId) {
      return NextResponse.json(
        { success: false, error: { message: "缺少必要参数" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("memories")
      .select("*")
      .eq("user_id", userId)
      .eq("persona_id", personaId);

    if (characterId) {
      query = query.eq("character_id", characterId);
    }

    const { data: memories, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw new Error(`读取记忆失败: ${error.message}`);
    }

    if (format === "csv") {
      // 生成CSV
      const headers = [
        "id",
        "content",
        "memory_type",
        "importance",
        "created_at",
        "updated_at",
        "retrieval_count",
        "feedback_count_accurate",
        "feedback_count_inaccurate",
      ];

      const csvRows = [headers.join(",")];

      memories?.forEach((memory) => {
        const row = [
          memory.id,
          `"${memory.content.replace(/"/g, '""')}"`,
          memory.memory_type,
          memory.importance,
          memory.created_at,
          memory.updated_at,
          memory.retrieval_count ?? 0,
          memory.feedback_count_accurate ?? 0,
          memory.feedback_count_inaccurate ?? 0,
        ];
        csvRows.push(row.join(","));
      });

      const csv = csvRows.join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="memories_${userId}_${personaId}_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // 默认JSON格式
    const json = JSON.stringify(
      {
        export_date: new Date().toISOString(),
        user_id: userId,
        persona_id: personaId,
        total_count: memories?.length ?? 0,
        memories: memories?.map((memory) => ({
          id: memory.id,
          content: memory.content,
          memory_type: memory.memory_type,
          importance: memory.importance,
          created_at: memory.created_at,
          updated_at: memory.updated_at,
          retrieval_count: memory.retrieval_count ?? 0,
          feedback_count_accurate: memory.feedback_count_accurate ?? 0,
          feedback_count_inaccurate: memory.feedback_count_inaccurate ?? 0,
        })),
      },
      null,
      2,
    );

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="memories_${userId}_${personaId}_${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "导出失败",
        },
      },
      { status: 500 },
    );
  }
}
