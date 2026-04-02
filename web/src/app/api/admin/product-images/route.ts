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

function slugifyFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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
      { error: "Missing Supabase server credentials for admin image uploads." },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const productId = `${formData.get("productId") ?? ""}`.trim();
  const file = formData.get("file");
  const setAsPrimary = `${formData.get("setAsPrimary") ?? "true"}` === "true";

  if (!productId) {
    return NextResponse.json({ error: "productId is required." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A valid image file is required." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const safeName = slugifyFileName(file.name || "reference-image");
  const extension = safeName.includes(".") ? safeName.split(".").pop() : "jpg";
  const filePath = `${productId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(filePath, fileBuffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const publicUrl = supabase.storage.from("product-images").getPublicUrl(filePath).data.publicUrl;

  if (setAsPrimary) {
    await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
  }

  const { data: imageRow, error: insertError } = await supabase
    .from("product_images")
    .insert({
      product_id: productId,
      image_url: publicUrl,
      source_type: "admin",
      is_primary: setAsPrimary,
    })
    .select("id, image_url, is_primary, source_type")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, image: imageRow });
}
