import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/client";

// 获取记忆的标签
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

    const { data: relations, error } = await supabase
      .from("memory_tag_relations")
      .select("tag_id, memory_tags(*)")
      .eq("memory_id", memoryId);

    if (error) {
      throw new Error(`读取标签失败: ${error.message}`);
    }

    const tags = relations?.map((r) => r.memory_tags).filter(Boolean) || [];

    return NextResponse.json({
      success: true,
      data: { tags },
    });
  } catch (error) {
    console.error("Get memory tags error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "读取标签失败",
        },
      },
      { status: 500 },
    );
  }
}

// 为记忆添加标签
export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdminApiAccess();
    if (response) return response;

    const body = (await request.json()) as {
      memoryId: string;
      tagId: string;
    };

    const { memoryId, tagId } = body;

    if (!memoryId || !tagId) {
      return NextResponse.json(
        { success: false, error: { message: "缺少必要参数" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { error } = await supabase.from("memory_tag_relations").insert({
      memory_id: memoryId,
      tag_id: tagId,
    });

    if (error) {
      throw new Error(`添加标签失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error("Add memory tag error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "添加标签失败",
        },
      },
      { status: 500 },
    );
  }
}

// 移除记忆的标签
export async function DELETE(request: NextRequest) {
  try {
    const { response } = await requireAdminApiAccess();
    if (response) return response;

    const searchParams = request.nextUrl.searchParams;
    const memoryId = searchParams.get("memoryId");
    const tagId = searchParams.get("tagId");

    if (!memoryId || !tagId) {
      return NextResponse.json(
        { success: false, error: { message: "缺少必要参数" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { error } = await supabase
      .from("memory_tag_relations")
      .delete()
      .eq("memory_id", memoryId)
      .eq("tag_id", tagId);

    if (error) {
      throw new Error(`移除标签失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error("Remove memory tag error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "移除标签失败",
        },
      },
      { status: 500 },
    );
  }
}
