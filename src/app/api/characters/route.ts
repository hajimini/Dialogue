import { NextRequest, NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";

// 获取当前用户的所有角色
export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "未登录" } },
        { status: 401 },
      );
    }

    const userId = user.id;

    const charactersResult = await queryPostgres(
      `
        select *
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
    console.error("Get characters error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "读取角色失败",
        },
      },
      { status: 500 },
    );
  }
}

// 创建新角色
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "未登录" } },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      name: string;
      personality?: string;
      avatar_url?: string;
      bio?: string;
    };

    const { name, personality, avatar_url, bio } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "角色名称不能为空" } },
        { status: 400 },
      );
    }

    const userId = user.id;

    const result = await queryPostgres(
      `
        insert into user_characters (
          owner_id,
          name,
          personality,
          avatar_url,
          bio
        )
        values ($1, $2, $3, $4, $5)
        returning *
      `,
      [
        userId,
        name.trim(),
        personality?.trim() || null,
        avatar_url?.trim() || null,
        bio?.trim() || null,
      ],
    );
    const character = result.rows[0] ?? null;

    return NextResponse.json({
      success: true,
      data: { character },
    });
  } catch (error) {
    console.error("Create character error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "创建角色失败",
        },
      },
      { status: 500 },
    );
  }
}

// 更新角色
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "未登录" } },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      id: string;
      name?: string;
      personality?: string;
      avatar_url?: string;
      bio?: string;
    };

    const { id, name, personality, avatar_url, bio } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "缺少角色ID" } },
        { status: 400 },
      );
    }

    const userId = user.id;

    const existingResult = await queryPostgres<{ id: string }>(
      `
        select id
        from user_characters
        where id = $1 and owner_id = $2
        limit 1
      `,
      [id, userId],
    );
    const existing = existingResult.rows[0] ?? null;

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "角色不存在或无权限" } },
        { status: 404 },
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name.trim();
    if (personality !== undefined) updates.personality = personality.trim() || null;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url.trim() || null;
    if (bio !== undefined) updates.bio = bio.trim() || null;

    const result = await queryPostgres(
      `
        update user_characters
        set
          updated_at = $1,
          name = coalesce($2, name),
          personality = $3,
          avatar_url = $4,
          bio = $5
        where id = $6
        returning *
      `,
      [
        updates.updated_at,
        updates.name ?? null,
        updates.personality ?? null,
        updates.avatar_url ?? null,
        updates.bio ?? null,
        id,
      ],
    );
    const character = result.rows[0] ?? null;

    return NextResponse.json({
      success: true,
      data: { character },
    });
  } catch (error) {
    console.error("Update character error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "更新角色失败",
        },
      },
      { status: 500 },
    );
  }
}

// 删除角色
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "未登录" } },
        { status: 401 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "缺少角色ID" } },
        { status: 400 },
      );
    }

    const userId = user.id;

    const result = await queryPostgres<{ id: string }>(
      `
        update user_characters
        set is_active = false
        where id = $1 and owner_id = $2
        returning id
      `,
      [id, userId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "角色不存在或无权限" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error("Delete character error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "删除角色失败",
        },
      },
      { status: 500 },
    );
  }
}
