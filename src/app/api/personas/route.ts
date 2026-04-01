import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Please login first." } },
        { status: 401 },
      );
    }

    const result = await queryPostgres<{
      id: string;
      name: string;
      avatar_url: string | null;
      occupation: string | null;
      city: string | null;
      is_active: boolean;
      created_at: string | null;
    }>(
      `
        select id, name, avatar_url, occupation, city, is_active, created_at
        from personas
        where is_active = true
        order by created_at asc nulls last
      `,
    );

    return NextResponse.json({ success: true, data: result.rows, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误（personas 列表）";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
