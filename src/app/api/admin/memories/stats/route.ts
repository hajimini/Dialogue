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

    // 获取所有记忆
    let query = supabase
      .from("memories")
      .select("*")
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
        data: {
          total_count: 0,
          type_distribution: [],
          importance_distribution: [],
          retrieval_stats: {
            total_retrievals: 0,
            avg_retrievals: 0,
            most_retrieved: [],
          },
          feedback_stats: {
            total_accurate: 0,
            total_inaccurate: 0,
            accuracy_rate: 0,
          },
          growth_trend: [],
          quality_score: 0,
        },
      });
    }

    // 类型分布
    const typeDistribution = memories.reduce(
      (acc, memory) => {
        const type = memory.memory_type;
        if (!acc[type]) {
          acc[type] = { type, count: 0, avg_importance: 0, total_importance: 0 };
        }
        acc[type].count += 1;
        acc[type].total_importance += Number(memory.importance);
        return acc;
      },
      {} as Record<
        string,
        { type: string; count: number; avg_importance: number; total_importance: number }
      >,
    );

    const typeDistributionArray: Array<{
      type: string;
      count: number;
      avg_importance: number;
      total_importance: number;
    }> = Object.values(typeDistribution);

    typeDistributionArray.forEach((item) => {
      item.avg_importance = item.total_importance / item.count;
    });

    // 重要度分布
    const importanceRanges = [
      { label: "0.0-0.2", min: 0, max: 0.2, count: 0 },
      { label: "0.2-0.4", min: 0.2, max: 0.4, count: 0 },
      { label: "0.4-0.6", min: 0.4, max: 0.6, count: 0 },
      { label: "0.6-0.8", min: 0.6, max: 0.8, count: 0 },
      { label: "0.8-1.0", min: 0.8, max: 1.0, count: 0 },
    ];

    memories.forEach((memory) => {
      const importance = Number(memory.importance);
      const range = importanceRanges.find(
        (r) => importance >= r.min && importance < r.max,
      );
      if (range) {
        range.count += 1;
      } else if (importance === 1.0) {
        importanceRanges[importanceRanges.length - 1].count += 1;
      }
    });

    // 检索统计
    const totalRetrievals = memories.reduce(
      (sum, memory) => sum + (memory.retrieval_count ?? 0),
      0,
    );
    const avgRetrievals = totalRetrievals / memories.length;
    const mostRetrieved = memories
      .filter((memory) => (memory.retrieval_count ?? 0) > 0)
      .sort((a, b) => (b.retrieval_count ?? 0) - (a.retrieval_count ?? 0))
      .slice(0, 5)
      .map((memory) => ({
        id: memory.id,
        content: memory.content.slice(0, 100),
        retrieval_count: memory.retrieval_count ?? 0,
        memory_type: memory.memory_type,
      }));

    // 反馈统计
    const totalAccurate = memories.reduce(
      (sum, memory) => sum + (memory.feedback_count_accurate ?? 0),
      0,
    );
    const totalInaccurate = memories.reduce(
      (sum, memory) => sum + (memory.feedback_count_inaccurate ?? 0),
      0,
    );
    const totalFeedback = totalAccurate + totalInaccurate;
    const accuracyRate = totalFeedback > 0 ? totalAccurate / totalFeedback : 0;

    // 增长趋势（按月统计）
    const growthByMonth = memories.reduce(
      (acc, memory) => {
        const date = new Date(memory.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (!acc[monthKey]) {
          acc[monthKey] = 0;
        }
        acc[monthKey] += 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const growthTrend = Object.entries(growthByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    // 质量评分（综合指标）
    const qualityScore =
      (accuracyRate * 0.4 +
        (avgRetrievals / Math.max(memories.length, 1)) * 0.3 +
        (memories.filter((m) => Number(m.importance) >= 0.6).length / memories.length) *
          0.3) *
      100;

    return NextResponse.json({
      success: true,
      data: {
        total_count: memories.length,
        type_distribution: Object.values(typeDistribution),
        importance_distribution: importanceRanges,
        retrieval_stats: {
          total_retrievals: totalRetrievals,
          avg_retrievals: avgRetrievals,
          most_retrieved: mostRetrieved,
        },
        feedback_stats: {
          total_accurate: totalAccurate,
          total_inaccurate: totalInaccurate,
          accuracy_rate: accuracyRate,
        },
        growth_trend: growthTrend,
        quality_score: qualityScore,
      },
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "统计失败",
        },
      },
      { status: 500 },
    );
  }
}
