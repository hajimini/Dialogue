import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth/session";

export async function POST() {
  const response = new NextResponse(null, {
    status: 307,
    headers: {
      Location: "/login",
    },
  });
  return clearAuthCookie(response);
}
