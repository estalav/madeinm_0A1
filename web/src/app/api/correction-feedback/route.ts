import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAIUsage } from "@/lib/ai/logging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CorrectionFeedbackInput = {
  sessionType?: "guest" | "authenticated";
  sourceSurface?: string;
  guessedProductId?: string | null;
  guessedProductName?: string | null;
  correctedProductId?: string | null;
  correctedProductName?: string | null;
  correctionMode?: "catalog" | "draft";
  visualGuess?: string | null;
  barcodeValue?: string | null;
  originAssessment?: string | null;
  originExplanation?: string | null;
  reasoning?: string | null;
  detectedText?: string[] | string | null;
  marketContext?: string | null;
  vendorOriginHint?: string | null;
  observedTextHint?: string | null;
  metadata?: Record<string, unknown> | null;
};

function normalizeTextList(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 20)
      .join(" | ");
  }

  return typeof value === "string" ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    await logAIUsage({
      provider: "internal",
      model: "correction-feedback-route",
      route: "/api/correction-feedback",
      requestKind: "recognition-feedback",
      success: false,
      errorMessage: "SUPABASE_SERVICE_ROLE_KEY is not configured yet.",
    });

    return NextResponse.json(
      {
        error:
          "Correction feedback is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY to enable feedback logging.",
      },
      { status: 503 },
    );
  }

  const payload = (await request.json()) as CorrectionFeedbackInput;

  if (!payload.correctedProductName?.trim() && !payload.correctedProductId) {
    return NextResponse.json(
      { error: "Correction feedback requires a corrected product." },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabase.from("recognition_feedback").insert({
    session_type: payload.sessionType ?? "guest",
    source_surface: payload.sourceSurface?.trim() || "web_scan_guest",
    guessed_product_id: payload.guessedProductId ?? null,
    guessed_product_name: payload.guessedProductName?.trim() || null,
    corrected_product_id: payload.correctedProductId ?? null,
    corrected_product_name: payload.correctedProductName?.trim() || null,
    correction_mode: payload.correctionMode ?? "catalog",
    visual_guess: payload.visualGuess?.trim() || null,
    barcode_value: payload.barcodeValue?.trim() || null,
    origin_assessment: payload.originAssessment?.trim() || null,
    origin_explanation: payload.originExplanation?.trim() || null,
    reasoning: payload.reasoning?.trim() || null,
    detected_text: normalizeTextList(payload.detectedText),
    market_context: payload.marketContext?.trim() || null,
    vendor_origin_hint: payload.vendorOriginHint?.trim() || null,
    observed_text_hint: payload.observedTextHint?.trim() || null,
    metadata: payload.metadata ?? {},
  });

  if (error) {
    await logAIUsage({
      provider: "internal",
      model: "correction-feedback-route",
      route: "/api/correction-feedback",
      requestKind: "recognition-feedback",
      success: false,
      barcodeValue: payload.barcodeValue ?? null,
      visualGuess: payload.visualGuess ?? null,
      matchedProductName: payload.correctedProductName ?? null,
      reasoning: payload.reasoning ?? null,
      errorMessage: error.message,
      metadata: payload.metadata ?? null,
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAIUsage({
    provider: "internal",
    model: "correction-feedback-route",
    route: "/api/correction-feedback",
    requestKind: "recognition-feedback",
    success: true,
    barcodeValue: payload.barcodeValue ?? null,
    visualGuess: payload.visualGuess ?? null,
    matchedProductName: payload.correctedProductName ?? null,
    reasoning: payload.reasoning ?? null,
    metadata: {
      correctionMode: payload.correctionMode ?? "catalog",
      sourceSurface: payload.sourceSurface ?? "web_scan_guest",
      guessedProductName: payload.guessedProductName ?? null,
      ...(payload.metadata ?? {}),
    },
  });

  return NextResponse.json({ saved: true });
}
