import { NextResponse } from "next/server";
import {
  credentialsMatch,
  isAuthConfigured,
  withSessionCookie,
} from "@/server/auth";

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Authentication is not configured." },
      { status: 503 },
    );
  }

  let payload: { username?: string; password?: string };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  if (!payload.username || !payload.password) {
    return NextResponse.json(
      { ok: false, message: "Username and password are required." },
      { status: 400 },
    );
  }

  if (!(await credentialsMatch(payload.username, payload.password))) {
    return NextResponse.json(
      { ok: false, message: "Invalid username or password." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  await withSessionCookie(response, payload.username);
  return response;
}
