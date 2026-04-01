import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";

export async function POST(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Admin access required." } },
        { status: user ? 403 : 401 },
      );
    }

    const body = (await req.json()) as Record<string, unknown>;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const personality = typeof body.personality === "string" ? body.personality.trim() : "";
    const speaking_style =
      typeof body.speaking_style === "string" ? body.speaking_style.trim() : "";

    if (!name || !personality || !speaking_style) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "name / personality / speaking_style 为必填" },
        },
        { status: 400 },
      );
    }

    const payload = {
      name,
      avatar_url: typeof body.avatar_url === "string" ? body.avatar_url : null,
      gender: typeof body.gender === "string" ? body.gender : null,
      age: typeof body.age === "number" ? body.age : null,
      occupation: typeof body.occupation === "string" ? body.occupation : null,
      city: typeof body.city === "string" ? body.city : null,

      personality,
      speaking_style,
      background_story: typeof body.background_story === "string" ? body.background_story : null,
      hobbies: typeof body.hobbies === "string" ? body.hobbies : null,
      daily_habits: typeof body.daily_habits === "string" ? body.daily_habits : null,
      family_info: typeof body.family_info === "string" ? body.family_info : null,

      default_relationship:
        typeof body.default_relationship === "string" ? body.default_relationship : null,
      forbidden_patterns:
        typeof body.forbidden_patterns === "string" ? body.forbidden_patterns : null,
      example_dialogues:
        typeof body.example_dialogues === "string" ? body.example_dialogues : null,

      emotional_traits:
        typeof body.emotional_traits === "string" ? body.emotional_traits : null,
      quirks: typeof body.quirks === "string" ? body.quirks : null,

      is_active: typeof body.is_active === "boolean" ? body.is_active : true,
    };

    const result = await queryPostgres(
      `
        insert into personas (
          name,
          avatar_url,
          gender,
          age,
          occupation,
          city,
          personality,
          speaking_style,
          background_story,
          hobbies,
          daily_habits,
          family_info,
          default_relationship,
          forbidden_patterns,
          example_dialogues,
          emotional_traits,
          quirks,
          is_active
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
        returning *
      `,
      [
        payload.name,
        payload.avatar_url,
        payload.gender,
        payload.age,
        payload.occupation,
        payload.city,
        payload.personality,
        payload.speaking_style,
        payload.background_story,
        payload.hobbies,
        payload.daily_habits,
        payload.family_info,
        payload.default_relationship,
        payload.forbidden_patterns,
        payload.example_dialogues,
        payload.emotional_traits,
        payload.quirks,
        payload.is_active,
      ],
    );
    const data = result.rows[0] ?? null;

    return NextResponse.json({ success: true, data, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误（创建人设）";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
