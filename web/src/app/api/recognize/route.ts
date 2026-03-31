import { NextRequest, NextResponse } from "next/server";

type Candidate = {
  id: string;
  name: string;
  category: string;
};

type RecognitionResponse = {
  suggestedProductId: string | null;
  confidence: "alta" | "media" | "baja";
  reasoning: string;
  visualGuess: string | null;
  draftProduct: {
    name: string;
    brandName: string | null;
    category: string;
    subcategory: string | null;
    aliases: string[];
  } | null;
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
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not configured yet. The AI suggestion route is ready, but still inactive.",
      },
      { status: 503 },
    );
  }

  const { imageUrl, imageDataUrl, barcodeValue, candidates } = (await request.json()) as {
    imageUrl?: string;
    imageDataUrl?: string;
    barcodeValue?: string | null;
    candidates?: Candidate[];
  };

  if (!imageUrl && !imageDataUrl) {
    return NextResponse.json(
      { error: "Missing imageUrl or imageDataUrl for recognition." },
      { status: 400 },
    );
  }

  let dataUrl = imageDataUrl;

  if (!dataUrl && imageUrl) {
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
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

  const prompt = [
    "Analyze this uploaded grocery photo and suggest the single best product from the catalog below.",
    "If the product is not present in the catalog, return null for suggestedProductId and explain why.",
    "Always include visualGuess with the most likely common product name you see, even if it is outside the catalog.",
    "Do not invent origin facts. Focus only on visual candidate matching and visible produce cues.",
    barcodeValue && /^\d{4,5}$/.test(barcodeValue)
      ? `Visible or manual produce PLU code: ${barcodeValue}`
      : barcodeValue
        ? `Visible or manual barcode value: ${barcodeValue}`
        : "No barcode value provided.",
    candidates?.length ? "Catalog candidates:" : "There are currently no reliable catalog candidates for matching.",
    catalogText || "(empty catalog candidate list)",
    "If there is no catalog match, also propose a conservative draft product candidate suitable for admin review.",
    "For produce, prefer category=produce and a simple subcategory like fruit, vegetable, herb, citrus, chile, or unknown.",
    'Respond with strict JSON only: {"suggestedProductId": string | null, "confidence": "alta" | "media" | "baja", "reasoning": string, "visualGuess": string | null, "draftProduct": {"name": string, "brandName": string | null, "category": string, "subcategory": string | null, "aliases": string[] } | null}',
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

    return NextResponse.json(
      { error: `OpenAI request failed: ${errorText}` },
      { status: 502 },
    );
  }

  const payload = await llmResponse.json();
  const text = extractTextPayload(payload);

  try {
    const parsed = JSON.parse(text) as Partial<RecognitionResponse>;

    return NextResponse.json({
      suggestedProductId: parsed.suggestedProductId ?? null,
      confidence: parsed.confidence ?? "baja",
      reasoning: parsed.reasoning ?? "No reasoning was returned.",
      visualGuess: parsed.visualGuess ?? null,
      draftProduct: parsed.draftProduct
        ? {
            name: parsed.draftProduct.name ?? parsed.visualGuess ?? "Producto detectado por AI",
            brandName: parsed.draftProduct.brandName ?? null,
            category: parsed.draftProduct.category ?? "produce",
            subcategory: parsed.draftProduct.subcategory ?? null,
            aliases: Array.isArray(parsed.draftProduct.aliases)
              ? parsed.draftProduct.aliases.filter((alias): alias is string => typeof alias === "string")
              : [],
          }
        : null,
    } satisfies RecognitionResponse);
  } catch {
    return NextResponse.json(
      {
        error: "The AI response was not valid JSON.",
        raw: text,
      },
      { status: 502 },
    );
  }
}
