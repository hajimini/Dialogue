import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Admin access required." } },
        { status: user ? 403 : 401 },
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const { id } = await context.params;

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const personality =
      typeof body.personality === "string" ? body.personality.trim() : undefined;
    const speaking_style =
      typeof body.speaking_style === "string" ? body.speaking_style.trim() : undefined;

    const payload: Record<string, unknown> = {
      avatar_url: typeof body.avatar_url === "string" ? body.avatar_url : null,
      gender: typeof body.gender === "string" ? body.gender : null,
      age: typeof body.age === "number" ? body.age : null,
      occupation: typeof body.occupation === "string" ? body.occupation : null,
      city: typeof body.city === "string" ? body.city : null,

      default_relationship:
        typeof body.default_relationship === "string" ? body.default_relationship : null,
      forbidden_patterns:
        typeof body.forbidden_patterns === "string" ? body.forbidden_patterns : null,
      example_dialogues:
        typeof body.example_dialogues === "string" ? body.example_dialogues : null,

      emotional_traits:
        typeof body.emotional_traits === "string" ? body.emotional_traits : null,
      quirks: typeof body.quirks === "string" ? body.quirks : null,

      background_story:
        typeof body.background_story === "string" ? body.background_story : null,
      hobbies: typeof body.hobbies === "string" ? body.hobbies : null,
      daily_habits: typeof body.daily_habits === "string" ? body.daily_habits : null,
      family_info: typeof body.family_info === "string" ? body.family_info : null,

      is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
    };

    if (name) payload.name = name;
    if (personality) payload.personality = personality;
    if (speaking_style) payload.speaking_style = speaking_style;

    const result = await queryPostgres(
      `
        update personas
        set
          avatar_url = $1,
          gender = $2,
          age = $3,
          occupation = $4,
          city = $5,
          default_relationship = $6,
          forbidden_patterns = $7,
          example_dialogues = $8,
          emotional_traits = $9,
          quirks = $10,
          background_story = $11,
          hobbies = $12,
          daily_habits = $13,
          family_info = $14,
          is_active = $15,
          name = coalesce($16, name),
          personality = coalesce($17, personality),
          speaking_style = coalesce($18, speaking_style)
        where id = $19
        returning *
      `,
      [
        payload.avatar_url,
        payload.gender,
        payload.age,
        payload.occupation,
        payload.city,
        payload.default_relationship,
        payload.forbidden_patterns,
        payload.example_dialogues,
        payload.emotional_traits,
        payload.quirks,
        payload.background_story,
        payload.hobbies,
        payload.daily_habits,
        payload.family_info,
        payload.is_active,
        payload.name ?? null,
        payload.personality ?? null,
        payload.speaking_style ?? null,
        id,
      ],
    );
    const data = result.rows[0] ?? null;

    if (!data) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Persona not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误（编辑人设）";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Admin access required." } },
        { status: user ? 403 : 401 },
      );
    }

    const { id } = await context.params;
    const result = await queryPostgres<{ id: string }>(
      `
        update personas
        set is_active = false,
            updated_at = now()
        where id = $1
        returning id
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Persona not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: { id }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误（删除人设）";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
