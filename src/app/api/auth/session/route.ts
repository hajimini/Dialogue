import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentAppUser();

  return NextResponse.json({
    success: true,
    data: {
      user,
      authenticated: Boolean(user),
    },
    error: null,
  });
}
