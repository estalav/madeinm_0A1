import { createClient } from "@supabase/supabase-js";

type AIUsagePayload = {
  provider: string;
  model: string;
  route: string;
  requestKind: string;
  success: boolean;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  imageCount?: number | null;
  estimatedCatalogCandidates?: number | null;
  barcodeValue?: string | null;
  visualGuess?: string | null;
  matchedProductName?: string | null;
  reasoning?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
};

function safeString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function logAIUsage(payload: AIUsagePayload) {
  console.info("[ai-usage]", JSON.stringify(payload));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.from("ai_usage_logs").insert({
      provider: payload.provider,
      model: payload.model,
      route: payload.route,
      request_kind: payload.requestKind,
      success: payload.success,
      input_tokens: payload.inputTokens ?? null,
      output_tokens: payload.outputTokens ?? null,
      total_tokens: payload.totalTokens ?? null,
      image_count: payload.imageCount ?? null,
      catalog_candidates: payload.estimatedCatalogCandidates ?? null,
      barcode_value: safeString(payload.barcodeValue),
      visual_guess: safeString(payload.visualGuess),
      matched_product_name: safeString(payload.matchedProductName),
      reasoning: safeString(payload.reasoning),
      error_message: safeString(payload.errorMessage),
      metadata: payload.metadata ?? null,
    });

    if (error) {
      console.warn("[ai-usage-db]", error.message);
    }
  } catch (error) {
    console.warn(
      "[ai-usage-db]",
      error instanceof Error ? error.message : "Unknown error while logging AI usage.",
    );
  }
}
