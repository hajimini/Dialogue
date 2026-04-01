import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentAppUser();
    if (!user) {
      return NextResponse.json(
        { success: false, data: null, error: { message: "Please login first." } },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const result = await queryPostgres(
      `
        select *
        from personas
        where id = $1
        limit 1
      `,
      [id],
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
    const message = err instanceof Error ? err.message : "未知错误（persona 详情）";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
