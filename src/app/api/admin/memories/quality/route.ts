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
        data: { scored_memories: [], summary: null },
      });
    }

    // 计算每个记忆的质量评分
    const scoredMemories = memories.map((memory) => {
      const importance = Number(memory.importance);
      const retrievalCount = memory.retrieval_count ?? 0;
      const feedbackAccurate = memory.feedback_count_accurate ?? 0;
      const feedbackInaccurate = memory.feedback_count_inaccurate ?? 0;
      const totalFeedback = feedbackAccurate + feedbackInaccurate;

      // 计算各项指标
      const importanceScore = importance * 100;
      const usageScore = Math.min((retrievalCount / 10) * 100, 100);
      const accuracyScore =
        totalFeedback > 0 ? (feedbackAccurate / totalFeedback) * 100 : 50;

      // 计算内容质量（基于长度和结构）
      const contentLength = memory.content.length;
      const contentScore =
        contentLength >= 20 && contentLength <= 500
          ? 100
          : contentLength < 20
            ? (contentLength / 20) * 100
            : Math.max(100 - (contentLength - 500) / 10, 50);

      // 计算时效性（越新越好）
      const daysSinceCreation =
        (Date.now() - new Date(memory.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const freshnessScore = Math.max(100 - daysSinceCreation / 3, 20);

      // 综合评分（加权平均）
      const qualityScore =
        importanceScore * 0.3 +
        usageScore * 0.25 +
        accuracyScore * 0.2 +
        contentScore * 0.15 +
        freshnessScore * 0.1;

      // 评级
      let grade: "A" | "B" | "C" | "D" | "F";
      if (qualityScore >= 80) grade = "A";
      else if (qualityScore >= 70) grade = "B";
      else if (qualityScore >= 60) grade = "C";
      else if (qualityScore >= 50) grade = "D";
      else grade = "F";

      // 建议
      const suggestions: string[] = [];
      if (importanceScore < 50) suggestions.push("重要度较低，考虑提升或删除");
      if (usageScore < 30 && daysSinceCreation > 30)
        suggestions.push("长期未使用，可能已过时");
      if (accuracyScore < 50 && totalFeedback >= 3)
        suggestions.push("准确率低，需要更新内容");
      if (contentLength < 20) suggestions.push("内容过短，缺少细节");
      if (contentLength > 500) suggestions.push("内容过长，考虑拆分");

      return {
        id: memory.id,
        content: memory.content.slice(0, 100),
        memory_type: memory.memory_type,
        quality_score: Math.round(qualityScore),
        grade,
        breakdown: {
          importance: Math.round(importanceScore),
          usage: Math.round(usageScore),
          accuracy: Math.round(accuracyScore),
          content: Math.round(contentScore),
          freshness: Math.round(freshnessScore),
        },
        suggestions,
        created_at: memory.created_at,
      };
    });

    // 按质量评分排序
    scoredMemories.sort((a, b) => b.quality_score - a.quality_score);

    // 生成摘要统计
    const avgScore =
      scoredMemories.reduce((sum, m) => sum + m.quality_score, 0) / scoredMemories.length;

    const gradeDistribution = scoredMemories.reduce(
      (acc, m) => {
        acc[m.grade] = (acc[m.grade] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const lowQualityCount = scoredMemories.filter((m) => m.quality_score < 50).length;
    const highQualityCount = scoredMemories.filter((m) => m.quality_score >= 80).length;

    return NextResponse.json({
      success: true,
      data: {
        scored_memories: scoredMemories,
        summary: {
          total_count: memories.length,
          avg_score: Math.round(avgScore),
          grade_distribution: gradeDistribution,
          high_quality_count: highQualityCount,
          low_quality_count: lowQualityCount,
          high_quality_rate: (highQualityCount / memories.length) * 100,
          low_quality_rate: (lowQualityCount / memories.length) * 100,
        },
      },
    });
  } catch (error) {
    console.error("Quality scoring error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "质量评分失败",
        },
      },
      { status: 500 },
    );
  }
}
