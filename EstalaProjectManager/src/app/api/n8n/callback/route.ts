import { NextResponse } from "next/server";
import { isValidCallbackSecret } from "@/lib/n8n";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "n8n callback",
    message: "Use POST to send workflow results back into the app.",
  });
}

export async function POST(request: Request) {
  const requestSecret = request.headers.get("x-estala-secret");

  if (!isValidCallbackSecret(requestSecret)) {
    return NextResponse.json(
      { ok: false, message: "Invalid n8n callback secret." },
      { status: 401 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    receivedAt: new Date().toISOString(),
    payload,
  });
}
