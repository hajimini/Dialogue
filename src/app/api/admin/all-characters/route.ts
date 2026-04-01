import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";

/**
 * GET /api/admin/all-characters
 * 获取所有活跃角色（用于管理员页面的筛选下拉）
 */
export async function GET() {
  try {
    const { response } = await requireAdminApiAccess();
    if (response) return response;

    const charactersResult = await queryPostgres<{
      id: string;
      name: string;
    }>(
      `
        select id, name
        from user_characters
        where is_active = true
        order by created_at desc nulls last
      `,
    );

    return NextResponse.json({
      success: true,
      data: { characters: charactersResult.rows },
    });
  } catch (error) {
    console.error("[admin/all-characters] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}
