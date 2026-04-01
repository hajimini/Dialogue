import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth/session";

export async function POST(req: Request) {
  const response = NextResponse.redirect(new URL("/login", req.url));
  return clearAuthCookie(response);
}
