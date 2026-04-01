import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function GET(request: NextRequest) {
  const auth = getAdminAuthorization(request);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server credentials for admin drafts." },
      { status: 503 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: drafts, error } = await supabase
    .from("products")
    .select(
      "id, name, category, subcategory, brand_name, description, status, created_at, product_aliases(alias), origins(id, origin_status, confidence_level, summary_reason, country_code)",
    )
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ drafts: drafts ?? [] });
}
