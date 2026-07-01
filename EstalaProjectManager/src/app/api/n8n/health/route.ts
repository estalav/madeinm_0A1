import { NextResponse } from "next/server";
import { getN8nWebhookUrl, getN8nCallbackSecret } from "@/lib/n8n";

export async function GET() {
  const webhookUrl = getN8nWebhookUrl();
  const callbackSecret = getN8nCallbackSecret();

  return NextResponse.json({
    ok: true,
    configured: Boolean(webhookUrl),
    webhookUrl,
    callbackSecretConfigured: Boolean(callbackSecret),
  });
}
