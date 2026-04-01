import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/client";

// 获取所有标签
export async function GET() {
  try {
    const { response } = await requireAdminApiAccess();
    if (response) return response;

    const supabase = getSupabaseServerClient();

    const { data: tags, error } = await supabase
      .from("memory_tags")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`读取标签失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: { tags: tags || [] },
    });
  } catch (error) {
    console.error("Get tags error:", error);
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

// 创建新标签
export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdminApiAccess();
    if (response) return response;

    const body = (await request.json()) as {
      name: string;
      color?: string;
      description?: string;
    };

    const { name, color, description } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: { message: "标签名称不能为空" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: tag, error } = await supabase
      .from("memory_tags")
      .insert({
        name,
        color: color || "#94a3b8",
        description,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`创建标签失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: { tag },
    });
  } catch (error) {
    console.error("Create tag error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "创建标签失败",
        },
      },
      { status: 500 },
    );
  }
}

// 删除标签
export async function DELETE(request: NextRequest) {
  try {
    const { response } = await requireAdminApiAccess();
    if (response) return response;

    const searchParams = request.nextUrl.searchParams;
    const tagId = searchParams.get("tagId");

    if (!tagId) {
      return NextResponse.json(
        { success: false, error: { message: "缺少标签ID" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();

    const { error } = await supabase.from("memory_tags").delete().eq("id", tagId);

    if (error) {
      throw new Error(`删除标签失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error("Delete tag error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "删除标签失败",
        },
      },
      { status: 500 },
    );
  }
}
