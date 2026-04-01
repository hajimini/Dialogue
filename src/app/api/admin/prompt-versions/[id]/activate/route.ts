import { NextResponse } from "next/server";
import { activatePromptVersion } from "@/lib/ai/prompt-versions";
import { getCurrentAppUser } from "@/lib/auth/session";

export async function POST(
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
    const version = await activatePromptVersion(id);

    return NextResponse.json({ success: true, data: version, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "切换 Prompt 版本失败。";
    return NextResponse.json(
      { success: false, data: null, error: { message } },
      { status: 500 },
    );
  }
}
