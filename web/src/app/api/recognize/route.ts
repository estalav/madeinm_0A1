import { NextRequest, NextResponse } from "next/server";
import { logAIUsage } from "@/lib/ai/logging";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Candidate = {
  id: string;
  name: string;
  category: string;
};

type DraftProductCandidate = {
  name: string;
  brandName: string | null;
  category: string;
  subcategory: string | null;
  aliases: string[];
};

type RecognitionItem = {
  suggestedProductId: string | null;
  confidence: "alta" | "media" | "baja";
  reasoning: string;
  visualGuess: string | null;
  detectedText: string[];
  originAssessment: "confirmado_mexicano" | "probable_mexicano" | "desconocido";
  originExplanation: string;
  evidenceNeeded: string[];
  draftProduct: DraftProductCandidate | null;
};

type RecognitionResponse = {
  detectedText: string[];
  items: RecognitionItem[];
};

function extractTextPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
      }>;
    }>;
  };

  if (typeof record.output_text === "string") {
    return record.output_text;
  }

  return (
    record.output
      ?.flatMap((item) => item.content ?? [])
      .map((item) => item.text ?? "")
      .join("\n") ?? ""
  );
}

function extractUsage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
    };
  }

  const record = payload as {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
  };

  return {
    inputTokens: record.usage?.input_tokens ?? null,
    outputTokens: record.usage?.output_tokens ?? null,
    totalTokens: record.usage?.total_tokens ?? null,
  };
}

function normalizeDetectedText(values: unknown) {
  return Array.isArray(values)
    ? values.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizeDraftProduct(
  draftProduct: Partial<DraftProductCandidate> | null | undefined,
  fallbackGuess: string | null | undefined,
): DraftProductCandidate | null {
  if (!draftProduct) {
    return null;
  }

  return {
    name: draftProduct.name ?? fallbackGuess ?? "Producto detectado por AI",
    brandName: draftProduct.brandName ?? null,
    category: draftProduct.category ?? "produce",
    subcategory: draftProduct.subcategory ?? null,
    aliases: Array.isArray(draftProduct.aliases)
      ? draftProduct.aliases.filter((alias): alias is string => typeof alias === "string")
      : [],
  };
}

function normalizeRecognitionItem(item: Partial<RecognitionItem>): RecognitionItem {
  return {
    suggestedProductId: item.suggestedProductId ?? null,
    confidence: item.confidence ?? "baja",
    reasoning: item.reasoning ?? "No reasoning was returned.",
    visualGuess: item.visualGuess ?? null,
    detectedText: normalizeDetectedText(item.detectedText),
    originAssessment:
      item.originAssessment === "confirmado_mexicano" ||
      item.originAssessment === "probable_mexicano" ||
      item.originAssessment === "desconocido"
        ? item.originAssessment
        : "desconocido",
    originExplanation:
      item.originExplanation ?? "Origin cannot be confirmed from the current evidence alone.",
    evidenceNeeded: Array.isArray(item.evidenceNeeded)
      ? item.evidenceNeeded.filter((value): value is string => typeof value === "string")
      : [],
    draftProduct: normalizeDraftProduct(item.draftProduct, item.visualGuess),
  };
}

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";

  return NextResponse.json({
    enabled: Boolean(apiKey),
    model,
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";

  if (!apiKey) {
    await logAIUsage({
      provider: "openai",
      model,
      route: "/api/recognize",
      requestKind: "catalog-recognition",
      success: false,
      imageCount: 1,
      estimatedCatalogCandidates: 0,
      errorMessage: "OPENAI_API_KEY is not configured yet.",
    });

    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not configured yet. The AI suggestion route is ready, but still inactive.",
      },
      { status: 503 },
    );
  }

  const {
    imageUrl,
    imageDataUrl,
    barcodeValue,
    candidates,
    marketContext,
    vendorOriginHint,
    observedTextHint,
  } = (await request.json()) as {
    imageUrl?: string;
    imageDataUrl?: string;
    barcodeValue?: string | null;
    candidates?: Candidate[];
    marketContext?: string | null;
    vendorOriginHint?: string | null;
    observedTextHint?: string | null;
  };

  if (!imageUrl && !imageDataUrl) {
    await logAIUsage({
      provider: "openai",
      model,
      route: "/api/recognize",
      requestKind: "catalog-recognition",
      success: false,
      imageCount: 0,
      estimatedCatalogCandidates: candidates?.length ?? 0,
      barcodeValue: barcodeValue ?? null,
      errorMessage: "Missing imageUrl or imageDataUrl for recognition.",
    });

    return NextResponse.json(
      { error: "Missing imageUrl or imageDataUrl for recognition." },
      { status: 400 },
    );
  }

  let dataUrl = imageDataUrl;

  if (!dataUrl && imageUrl) {
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      await logAIUsage({
        provider: "openai",
        model,
        route: "/api/recognize",
        requestKind: "catalog-recognition",
        success: false,
        imageCount: 1,
        estimatedCatalogCandidates: candidates?.length ?? 0,
        barcodeValue: barcodeValue ?? null,
        errorMessage: "Could not download the uploaded image for recognition.",
      });

      return NextResponse.json(
        { error: "Could not download the uploaded image for recognition." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const mimeType = imageResponse.headers.get("content-type") ?? "image/jpeg";
    dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
  }

  const catalogText = (candidates ?? [])
    .map((candidate) => `- ${candidate.name} (${candidate.category}) [${candidate.id}]`)
    .join("\n");

  const contextLines = [
    marketContext?.trim() ? `Market context: ${marketContext.trim()}` : "Market context: none provided.",
    vendorOriginHint?.trim()
      ? `Vendor or seller origin hint: ${vendorOriginHint.trim()}`
      : "Vendor or seller origin hint: none provided.",
    observedTextHint?.trim()
      ? `Observed nearby text, sticker, sign, box, or label text: ${observedTextHint.trim()}`
      : "Observed nearby text, sticker, sign, box, or label text: none provided.",
  ].join("\n");

  const prompt = [
    "Analyze this uploaded grocery photo and detect the distinct grocery or produce items visible in the image.",
    "The image may contain multiple objects. Return up to 8 distinct line items and avoid duplicates.",
    "If two units of the same product appear, treat them as one item and mention the quantity in reasoning if useful.",
    "For each detected item, suggest the single best product from the catalog below.",
    "If a product is not present in the catalog, return null for suggestedProductId and explain why.",
    "Always include visualGuess with the most likely common product name you see, even if it is outside the catalog.",
    "Also extract any visible text from the image itself, such as stickers, labels, signs, crate marks, or handwritten notes.",
    "Return that extracted text as a top-level detectedText array for the whole image and also as per-item detectedText when relevant.",
    "Separate product identification from origin inference.",
    "The photo may help identify the product, but it usually cannot prove country of origin on its own.",
    "Do not invent origin facts. Use the visual scene only as one signal.",
    "For origin, combine visible clues with the provided market, vendor, and text context.",
    "Use this 3-level origin result only: confirmado_mexicano, probable_mexicano, desconocido.",
    "Only use confirmado_mexicano if the evidence is explicit, such as text saying Mexico, a Mexican state, or a trusted vendor hint.",
    "Use probable_mexicano when context strongly suggests Mexican/local origin but there is not explicit proof.",
    "Use desconocido when the image/context is not enough to support a Mexican-origin claim.",
    barcodeValue && /^\d{4,5}$/.test(barcodeValue)
      ? `Visible or manual produce PLU code: ${barcodeValue}`
      : barcodeValue
        ? `Visible or manual barcode value: ${barcodeValue}`
        : "No barcode value provided.",
    contextLines,
    candidates?.length ? "Catalog candidates:" : "There are currently no reliable catalog candidates for matching.",
    catalogText || "(empty catalog candidate list)",
    "If there is no catalog match, also propose a conservative draft product candidate suitable for admin review.",
    "For produce, prefer category=produce and a simple subcategory like fruit, vegetable, herb, citrus, chile, or unknown.",
    "Always include a short originExplanation and a small evidenceNeeded array naming the next evidence that would improve trust, such as market location, box label photo, sticker text, or vendor origin note.",
    'Respond with strict JSON only: {"detectedText": string[], "items": [{"suggestedProductId": string | null, "confidence": "alta" | "media" | "baja", "reasoning": string, "visualGuess": string | null, "detectedText": string[], "originAssessment": "confirmado_mexicano" | "probable_mexicano" | "desconocido", "originExplanation": string, "evidenceNeeded": string[], "draftProduct": {"name": string, "brandName": string | null, "category": string, "subcategory": string | null, "aliases": string[] } | null}]}',
  ].join("\n\n");

  const llmResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: dataUrl },
          ],
        },
      ],
    }),
  });

  if (!llmResponse.ok) {
    const errorText = await llmResponse.text();

    await logAIUsage({
      provider: "openai",
      model,
      route: "/api/recognize",
      requestKind: "catalog-recognition",
      success: false,
      imageCount: 1,
      estimatedCatalogCandidates: candidates?.length ?? 0,
      barcodeValue: barcodeValue ?? null,
      errorMessage: errorText,
    });

    return NextResponse.json(
      { error: `OpenAI request failed: ${errorText}` },
      { status: 502 },
    );
  }

  const payload = await llmResponse.json();
  const text = extractTextPayload(payload);
  const usage = extractUsage(payload);

  try {
    const parsed = JSON.parse(text) as Partial<RecognitionResponse & RecognitionItem>;
    const items = Array.isArray(parsed.items)
      ? parsed.items.map((item) => normalizeRecognitionItem(item))
      : [normalizeRecognitionItem(parsed)];

    const result: RecognitionResponse = {
      detectedText: normalizeDetectedText(parsed.detectedText),
      items: items.filter((item) => item.visualGuess || item.suggestedProductId || item.draftProduct),
    };

    await logAIUsage({
      provider: "openai",
      model,
      route: "/api/recognize",
      requestKind: "catalog-recognition",
      success: true,
      imageCount: 1,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimatedCatalogCandidates: candidates?.length ?? 0,
      barcodeValue: barcodeValue ?? null,
      visualGuess: result.items.map((item) => item.visualGuess).filter(Boolean).join(" | ") || null,
      matchedProductName:
        result.items
          .map((item) => candidates?.find((candidate) => candidate.id === item.suggestedProductId)?.name ?? null)
          .filter(Boolean)
          .join(" | ") || null,
      reasoning: result.items.map((item) => item.reasoning).join("\n\n"),
      metadata: {
        usedImageUrl: Boolean(imageUrl),
        usedImageDataUrl: Boolean(imageDataUrl),
        draftSuggested: result.items.some((item) => Boolean(item.draftProduct)),
        marketContext: marketContext?.trim() || null,
        vendorOriginHint: vendorOriginHint?.trim() || null,
        observedTextHint: observedTextHint?.trim() || null,
        detectedText: result.detectedText,
        items: result.items,
      },
    });

    return NextResponse.json(result);
  } catch {
    await logAIUsage({
      provider: "openai",
      model,
      route: "/api/recognize",
      requestKind: "catalog-recognition",
      success: false,
      imageCount: 1,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimatedCatalogCandidates: candidates?.length ?? 0,
      barcodeValue: barcodeValue ?? null,
      errorMessage: "The AI response was not valid JSON.",
      metadata: {
        raw: text,
      },
    });

    return NextResponse.json(
      {
        error: "The AI response was not valid JSON.",
        raw: text,
      },
      { status: 502 },
    );
  }
}
