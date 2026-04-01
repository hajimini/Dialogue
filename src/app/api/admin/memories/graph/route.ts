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

    if (!userId || !personaId) {
      return NextResponse.json(
        { success: false, error: { message: "缺少必要参数" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("memories")
      .select("id, content, memory_type, importance, created_at, retrieval_count")
      .eq("user_id", userId)
      .eq("persona_id", personaId);

    if (characterId) {
      query = query.eq("character_id", characterId);
    }

    const { data: memories, error } = await query;

    if (error) {
      throw new Error(`读取记忆失败: ${error.message}`);
    }

    if (!memories || memories.length === 0) {
      return NextResponse.json({
        success: true,
        data: { nodes: [], edges: [] },
      });
    }

    // 构建节点
    const nodes = memories.map((memory) => ({
      id: memory.id,
      label: memory.content.slice(0, 50) + (memory.content.length > 50 ? "..." : ""),
      type: memory.memory_type,
      importance: Number(memory.importance),
      retrieval_count: memory.retrieval_count ?? 0,
      created_at: memory.created_at,
    }));

    // 构建边（基于内容相似度和时间关系）
    const edges: Array<{
      source: string;
      target: string;
      weight: number;
      type: "temporal" | "semantic";
    }> = [];

    // 时间关系：相邻的记忆
    const sortedMemories = [...memories].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    for (let i = 0; i < sortedMemories.length - 1; i++) {
      const timeDiff =
        new Date(sortedMemories[i + 1].created_at).getTime() -
        new Date(sortedMemories[i].created_at).getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      // 如果两个记忆在24小时内创建，建立时间关系
      if (hoursDiff <= 24) {
        edges.push({
          source: sortedMemories[i].id,
          target: sortedMemories[i + 1].id,
          weight: 1 - hoursDiff / 24,
          type: "temporal",
        });
      }
    }

    // 语义关系：相同类型的记忆
    const typeGroups = memories.reduce(
      (acc, memory) => {
        if (!acc[memory.memory_type]) {
          acc[memory.memory_type] = [];
        }
        acc[memory.memory_type].push(memory);
        return acc;
      },
      {} as Record<string, typeof memories>,
    );

    Object.values(typeGroups).forEach((group) => {
      if (group.length > 1) {
        // 在同类型记忆之间建立语义关系
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < Math.min(i + 3, group.length); j++) {
            // 简单的文本相似度
            const words1 = new Set(group[i].content.toLowerCase().split(/\s+/));
            const words2 = new Set(group[j].content.toLowerCase().split(/\s+/));
            const intersection = new Set([...words1].filter((word) => words2.has(word)));
            const union = new Set([...words1, ...words2]);
            const similarity = intersection.size / union.size;

            if (similarity >= 0.2) {
              edges.push({
                source: group[i].id,
                target: group[j].id,
                weight: similarity,
                type: "semantic",
              });
            }
          }
        }
      }
    });

    // 按权重排序并限制边的数量
    edges.sort((a, b) => b.weight - a.weight);
    const limitedEdges = edges.slice(0, Math.min(edges.length, memories.length * 2));

    return NextResponse.json({
      success: true,
      data: {
        nodes,
        edges: limitedEdges,
      },
    });
  } catch (error) {
    console.error("Graph error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "关系图生成失败",
        },
      },
      { status: 500 },
    );
  }
}
