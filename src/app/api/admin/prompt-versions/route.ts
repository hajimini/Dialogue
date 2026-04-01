import { NextResponse } from "next/server";
import { createPromptVersion, listPromptVersions } from "@/lib/ai/prompt-versions";
import { getCurrentAppUser } from "@/lib/auth/session";

function unauthorizedResponse(userRole?: string) {
  return NextResponse.json(
    { success: false, data: null, error: { message: "Admin access required." } },
    { status: userRole ? 403 : 401 },
  );
}

export async function GET() {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return unauthorizedResponse(user?.role);
    }

    const versions = await listPromptVersions();
    return NextResponse.json({ success: true, data: versions, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取 Prompt 版本失败。";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentAppUser();
    if (!user || user.role !== "admin") {
      return unauthorizedResponse(user?.role);
    }

    const body = (await req.json()) as Record<string, unknown>;
    const version = await createPromptVersion({
      label: typeof body.label === "string" ? body.label : "",
      instructions: typeof body.instructions === "string" ? body.instructions : "",
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });

    return NextResponse.json({ success: true, data: version, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建 Prompt 版本失败。";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
