import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAIUsage } from "@/lib/ai/logging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DraftProductInput = {
  name?: string;
  brandName?: string | null;
  category?: string | null;
  subcategory?: string | null;
  aliases?: string[];
  barcodeValue?: string | null;
  reasoning?: string | null;
  visualGuess?: string | null;
};

function normalizeAliases(input: string[] | undefined, name: string, visualGuess?: string | null) {
  const values = new Set<string>();

  for (const candidate of [name, visualGuess ?? null, ...(input ?? [])]) {
    if (!candidate) {
      continue;
    }

    const cleaned = candidate.trim().toLowerCase();

    if (cleaned) {
      values.add(cleaned);
    }
  }

  return Array.from(values).slice(0, 8);
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    await logAIUsage({
      provider: "internal",
      model: "draft-product-route",
      route: "/api/draft-products",
      requestKind: "draft-product-create",
      success: false,
      errorMessage: "SUPABASE_SERVICE_ROLE_KEY is not configured yet.",
    });

    return NextResponse.json(
      {
        error:
          "Draft creation is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY to web/.env.local to enable server-side draft writes.",
      },
      { status: 503 },
    );
  }

  const payload = (await request.json()) as DraftProductInput;
  const name = payload.name?.trim();

  if (!name) {
    await logAIUsage({
      provider: "internal",
      model: "draft-product-route",
      route: "/api/draft-products",
      requestKind: "draft-product-create",
      success: false,
      barcodeValue: payload.barcodeValue ?? null,
      visualGuess: payload.visualGuess ?? null,
      errorMessage: "Draft products require a name.",
    });

    return NextResponse.json({ error: "Draft products require a name." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: existingProduct } = await supabase
    .from("products")
    .select("id, name, status")
    .eq("name", name)
    .limit(1)
    .maybeSingle();

  if (existingProduct) {
    await logAIUsage({
      provider: "internal",
      model: "draft-product-route",
      route: "/api/draft-products",
      requestKind: "draft-product-create",
      success: true,
      barcodeValue: payload.barcodeValue ?? null,
      visualGuess: payload.visualGuess ?? null,
      matchedProductName: existingProduct.name,
      reasoning: payload.reasoning ?? null,
      metadata: {
        existing: true,
        status: existingProduct.status,
      },
    });

    return NextResponse.json({
      created: false,
      existing: true,
      productId: existingProduct.id,
      name: existingProduct.name,
      status: existingProduct.status,
    });
  }

  const category = payload.category?.trim() || "produce";
  const subcategory = payload.subcategory?.trim() || null;
  const brandName = payload.brandName?.trim() || null;

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      name,
      brand_name: brandName,
      category,
      subcategory,
      description: "AI-suggested draft product pending admin review.",
      is_packaged: Boolean(brandName),
      status: "draft",
    })
    .select("id, name, status")
    .single();

  if (productError || !product) {
    await logAIUsage({
      provider: "internal",
      model: "draft-product-route",
      route: "/api/draft-products",
      requestKind: "draft-product-create",
      success: false,
      barcodeValue: payload.barcodeValue ?? null,
      visualGuess: payload.visualGuess ?? null,
      errorMessage: productError?.message ?? "Could not create the draft product.",
    });

    return NextResponse.json(
      { error: productError?.message ?? "Could not create the draft product." },
      { status: 500 },
    );
  }

  const aliases = normalizeAliases(payload.aliases, name, payload.visualGuess);

  if (aliases.length > 0) {
    await supabase.from("product_aliases").insert(
      aliases.map((alias) => ({
        product_id: product.id,
        alias,
        locale: "es-MX",
      })),
    );
  }

  const { data: origin } = await supabase
    .from("origins")
    .insert({
      product_id: product.id,
      origin_status: "no_confirmado",
      confidence_level: "media",
      summary_reason: "AI-suggested draft product pending admin review before any origin claim is published.",
      last_verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  await supabase.from("origin_evidence").insert({
    product_id: product.id,
    origin_id: origin?.id ?? null,
    evidence_type: "image_analysis",
    evidence_value: payload.visualGuess ?? name,
    source_note:
      payload.reasoning ??
      "AI-suggested draft product created from guest scan flow and awaiting admin review.",
    confidence_score: 0.6,
    is_supporting_origin: false,
    captured_by_type: "agent",
  });

  if (payload.barcodeValue?.trim()) {
    await supabase.from("barcodes").insert({
      product_id: product.id,
      code_value: payload.barcodeValue.trim(),
      code_type: "other",
      source: "AI draft flow",
      is_verified: false,
    });
  }

  await logAIUsage({
    provider: "internal",
    model: "draft-product-route",
    route: "/api/draft-products",
    requestKind: "draft-product-create",
    success: true,
    barcodeValue: payload.barcodeValue ?? null,
    visualGuess: payload.visualGuess ?? null,
    matchedProductName: product.name,
    reasoning: payload.reasoning ?? null,
    metadata: {
      created: true,
      status: product.status,
      aliasCount: aliases.length,
    },
  });

  return NextResponse.json({
    created: true,
    existing: false,
    productId: product.id,
    name: product.name,
    status: product.status,
  });
}
