import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReviewPayload = {
  productId?: string;
  decision?: "approve" | "archive";
  originStatus?: "producido_en_mexico" | "hecho_en_mexico" | "empacado_en_mexico" | "importado" | "no_confirmado";
  confidenceLevel?: "verificado" | "alta" | "media" | "baja";
  countryCode?: string | null;
  summaryReason?: string | null;
  reviewNote?: string | null;
};

function getAdminAuthorization(request: NextRequest) {
  const expectedKey = process.env.ADMIN_REVIEW_KEY?.trim();
  const providedKey = request.headers.get("x-admin-key")?.trim();

  if (!expectedKey) {
    return { ok: false, status: 503, error: "ADMIN_REVIEW_KEY is not configured on the server." };
  }

  if (!providedKey || providedKey !== expectedKey) {
    return { ok: false, status: 401, error: "Unauthorized admin request." };
  }

  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  const auth = getAdminAuthorization(request);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server credentials for admin review." },
      { status: 503 },
    );
  }

  const payload = (await request.json()) as ReviewPayload;

  if (!payload.productId || !payload.decision) {
    return NextResponse.json({ error: "productId and decision are required." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const nextStatus = payload.decision === "approve" ? "active" : "archived";

  const { error: productError } = await supabase
    .from("products")
    .update({ status: nextStatus })
    .eq("id", payload.productId);

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 });
  }

  const { data: originRow, error: originLookupError } = await supabase
    .from("origins")
    .select("id")
    .eq("product_id", payload.productId)
    .limit(1)
    .maybeSingle();

  if (originLookupError) {
    return NextResponse.json({ error: originLookupError.message }, { status: 500 });
  }

  if (originRow?.id) {
    const { error: originError } = await supabase
      .from("origins")
      .update({
        origin_status: payload.originStatus ?? "no_confirmado",
        confidence_level: payload.confidenceLevel ?? "media",
        country_code: payload.countryCode?.trim() || null,
        summary_reason:
          payload.summaryReason?.trim() ||
          (payload.decision === "approve"
            ? "Draft product approved from admin review."
            : "Draft product archived from admin review."),
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", originRow.id);

    if (originError) {
      return NextResponse.json({ error: originError.message }, { status: 500 });
    }

    await supabase.from("origin_evidence").insert({
      product_id: payload.productId,
      origin_id: originRow.id,
      evidence_type: "manual_admin_review",
      evidence_value: payload.decision === "approve" ? "Draft approved" : "Draft archived",
      source_note:
        payload.reviewNote?.trim() ||
        (payload.decision === "approve"
          ? "Admin approved AI-created draft product."
          : "Admin archived AI-created draft product."),
      confidence_score: payload.decision === "approve" ? 0.9 : 0.5,
      is_supporting_origin: payload.decision === "approve",
      captured_by_type: "admin",
    });
  }

  return NextResponse.json({
    success: true,
    productId: payload.productId,
    status: nextStatus,
  });
}
