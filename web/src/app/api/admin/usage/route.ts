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
      { error: "Missing Supabase server credentials for admin usage." },
      { status: 503 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const since = request.nextUrl.searchParams.get("since")?.trim() || "7d";
  const windowStart = (() => {
    const now = new Date();

    if (since === "24h") {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    }

    if (since === "30d") {
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  })();

  const { data: logs, error } = await supabase
    .from("ai_usage_logs")
    .select(
      "id, created_at, provider, model, route, request_kind, success, input_tokens, output_tokens, total_tokens, image_count, catalog_candidates, barcode_value, visual_guess, matched_product_name, error_message",
    )
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = logs ?? [];
  const summary = rows.reduce(
    (accumulator, row) => {
      accumulator.requests += 1;
      accumulator.successes += row.success ? 1 : 0;
      accumulator.failures += row.success ? 0 : 1;
      accumulator.inputTokens += row.input_tokens ?? 0;
      accumulator.outputTokens += row.output_tokens ?? 0;
      accumulator.totalTokens += row.total_tokens ?? 0;
      return accumulator;
    },
    {
      requests: 0,
      successes: 0,
      failures: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
  );

  return NextResponse.json({
    since,
    summary,
    logs: rows,
  });
}
