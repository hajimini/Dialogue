import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdminApiAccess();
    if (response) return response;

    const searchParams = request.nextUrl.searchParams;
    const memoryId = searchParams.get("memoryId");

    if (!memoryId) {
      return NextResponse.json(
        { success: false, error: { message: "缺少记忆ID" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    // 获取当前记忆
    const { data: currentMemory, error: memoryError } = await supabase
      .from("memories")
      .select("*")
      .eq("id", memoryId)
      .single();

    if (memoryError || !currentMemory) {
      throw new Error("记忆不存在");
    }

    // 获取版本历史
    const { data: versions, error: versionsError } = await supabase
      .from("memory_versions")
      .select("*")
      .eq("memory_id", memoryId)
      .order("version_timestamp", { ascending: false });

    if (versionsError) {
      throw new Error(`读取版本历史失败: ${versionsError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        current: currentMemory,
        versions: versions || [],
      },
    });
  } catch (error) {
    console.error("Version history error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "读取版本历史失败",
        },
      },
      { status: 500 },
    );
  }
}

// 创建新版本
export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdminApiAccess();
    if (response) return response;

    const body = (await request.json()) as {
      memoryId: string;
      content: string;
      importance: number;
      memoryType: string;
      changeReason?: string;
      changedBy?: string;
    };

    const { memoryId, content, importance, memoryType, changeReason, changedBy } = body;

    if (!memoryId || !content || importance === undefined || !memoryType) {
      return NextResponse.json(
        { success: false, error: { message: "缺少必要参数" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    // 获取当前版本号
    const { data: latestVersion } = await supabase
      .from("memory_versions")
      .select("version_number")
      .eq("memory_id", memoryId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

    // 创建新版本记录
    const { error: versionError } = await supabase.from("memory_versions").insert({
      memory_id: memoryId,
      content,
      importance,
      memory_type: memoryType,
      change_type: "updated",
      change_reason: changeReason,
      changed_by: changedBy,
      version_number: nextVersionNumber,
    });

    if (versionError) {
      throw new Error(`创建版本失败: ${versionError.message}`);
    }

    // 更新记忆
    const { error: updateError } = await supabase
      .from("memories")
      .update({
        content,
        importance,
        memory_type: memoryType,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memoryId);

    if (updateError) {
      throw new Error(`更新记忆失败: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: { version_number: nextVersionNumber },
    });
  } catch (error) {
    console.error("Create version error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "创建版本失败",
        },
      },
      { status: 500 },
    );
  }
}

// 恢复到指定版本
export async function PUT(request: NextRequest) {
  try {
    const { response } = await requireAdminApiAccess();
    if (response) return response;

    const body = (await request.json()) as {
      memoryId: string;
      versionId: string;
      changedBy?: string;
    };

    const { memoryId, versionId, changedBy } = body;

    if (!memoryId || !versionId) {
      return NextResponse.json(
        { success: false, error: { message: "缺少必要参数" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    // 获取目标版本
    const { data: targetVersion, error: versionError } = await supabase
      .from("memory_versions")
      .select("*")
      .eq("id", versionId)
      .single();

    if (versionError || !targetVersion) {
      throw new Error("版本不存在");
    }

    // 获取当前版本号
    const { data: latestVersion } = await supabase
      .from("memory_versions")
      .select("version_number")
      .eq("memory_id", memoryId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

    // 创建恢复版本记录
    const { error: createError } = await supabase.from("memory_versions").insert({
      memory_id: memoryId,
      content: targetVersion.content,
      importance: targetVersion.importance,
      memory_type: targetVersion.memory_type,
      change_type: "updated",
      change_reason: `恢复到版本 ${targetVersion.version_number}`,
      changed_by: changedBy,
      version_number: nextVersionNumber,
    });

    if (createError) {
      throw new Error(`创建恢复版本失败: ${createError.message}`);
    }

    // 更新记忆
    const { error: updateError } = await supabase
      .from("memories")
      .update({
        content: targetVersion.content,
        importance: targetVersion.importance,
        memory_type: targetVersion.memory_type,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memoryId);

    if (updateError) {
      throw new Error(`恢复记忆失败: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: { version_number: nextVersionNumber },
    });
  } catch (error) {
    console.error("Restore version error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "恢复版本失败",
        },
      },
      { status: 500 },
    );
  }
}
