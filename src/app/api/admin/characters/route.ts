import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdminApiAccess();
    if (response) return response;

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "userId is required" },
        },
        { status: 400 }
      );
    }

    const charactersResult = await queryPostgres<{
      id: string;
      name: string;
      personality: string | null;
      avatar_url: string | null;
      bio: string | null;
      is_active: boolean;
      created_at: string | null;
    }>(
      `
        select id, name, personality, avatar_url, bio, is_active, created_at
        from user_characters
        where owner_id = $1 and is_active = true
        order by created_at desc nulls last
      `,
      [userId],
    );

    return NextResponse.json({
      success: true,
      data: { characters: charactersResult.rows },
    });
  } catch (error) {
    console.error("[admin/characters] Error:", error);
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
