import { NextResponse } from "next/server";
import { runPromptDryTest } from "@/lib/ai/testing";
import { getCurrentAppUser } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";
import type { Persona } from "@/lib/supabase/types";

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
    const personaId =
      typeof body.personaId === "string" ? body.personaId.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!personaId || !message) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "personaId and message are required." },
        },
        { status: 400 },
      );
    }

    const personaResult = await queryPostgres<Persona>(
      `
        select *
        from personas
        where id = $1
        limit 1
      `,
      [personaId],
    );
    const persona = personaResult.rows[0] ?? null;

    if (!persona) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "Persona not found." },
        },
        { status: 404 },
      );
    }

    const result = await runPromptDryTest({
      persona: persona as Persona,
      message,
      promptVersionId:
        typeof body.promptVersionId === "string" ? body.promptVersionId : undefined,
      modelProviderId:
        typeof body.modelProviderId === "string" ? body.modelProviderId : undefined,
      userId: typeof body.userId === "string" ? body.userId : undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        memoryStats: {
          summaries: result.memoryContext.recentSummaries.length,
          memories: result.memoryContext.relevantMemories.length,
          hasProfile: Boolean(result.memoryContext.userProfile),
        },
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quick test failed.";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
