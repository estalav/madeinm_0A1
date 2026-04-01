import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const expectedKey = process.env.ADMIN_REVIEW_KEY;
  const providedKey = request.headers.get("x-admin-key");

  return Boolean(expectedKey && providedKey && providedKey === expectedKey);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized admin request." }, { status: 401 });
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
