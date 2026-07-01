import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  return clearSessionCookie(response);
}
