import { NextResponse } from "next/server";
import { runPromptDryTest } from "@/lib/ai/testing";
import { getCurrentAppUser } from "@/lib/auth/session";
import { queryPostgres } from "@/lib/postgres";
import type { Persona } from "@/lib/supabase/types";

type BatchCase = {
  id?: string;
  message?: string;
  expected?: string;
};

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
    const rawCases = Array.isArray(body.cases) ? (body.cases as BatchCase[]) : [];

    if (!personaId || rawCases.length === 0) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { message: "personaId and cases are required." },
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

    const cases = rawCases
      .map((item, index) => ({
        id: item.id?.trim() || `Case-${index + 1}`,
        message: item.message?.trim() || "",
        expected: item.expected?.trim() || "",
      }))
      .filter((item) => Boolean(item.message))
      .slice(0, 20);

    const results = [];

    for (const item of cases) {
      const result = await runPromptDryTest({
        persona: persona as Persona,
        message: item.message,
        promptVersionId:
          typeof body.promptVersionId === "string" ? body.promptVersionId : undefined,
        modelProviderId:
          typeof body.modelProviderId === "string" ? body.modelProviderId : undefined,
        userId: typeof body.userId === "string" ? body.userId : undefined,
      });

      results.push({
        ...item,
        reply: result.reply,
        promptVersion: result.promptVersion,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        persona: {
          id: (persona as Persona).id,
          name: (persona as Persona).name,
        },
        results,
      },
      error: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch test failed.";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
