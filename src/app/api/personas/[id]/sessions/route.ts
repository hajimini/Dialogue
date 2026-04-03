import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import {
  createSession,
  deletePersonaSessions,
  listPersonaSessions,
} from "@/lib/chat/sessions";

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
    const sessions = await listPersonaSessions(id, 20, { userId: user.id });

    return NextResponse.json({
      success: true,
      data: sessions,
      error: null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "未知错误（会话列表）";

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { message },
      },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
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
    const body = await req.json().catch(() => ({}));
    const characterId =
      typeof body.character_id === "string" ? body.character_id.trim() : "";

    if (!characterId) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "character_id is required." },
        },
        { status: 400 },
      );
    }

    const session = await createSession(id, { userId: user.id, characterId });

    return NextResponse.json({
      success: true,
      data: session,
      error: null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "未知错误（创建会话）";
    const status =
      message === "character_id is required." ? 400 :
      message === "Character not found." ? 404 : 500;

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { message },
      },
      { status },
    );
  }
}

export async function DELETE(
  req: Request,
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
    const { searchParams } = new URL(req.url);
    const purgeDerivedArtifacts =
      searchParams.get("purge") === "1" || searchParams.get("purge") === "true";
    const result = await deletePersonaSessions(id, {
      userId: user.id,
      purgeDerivedArtifacts,
    });

    return NextResponse.json({
      success: true,
      data: result,
      error: null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "未知错误（删除会话列表）";

    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { message },
      },
      { status: 500 },
    );
  }
}
