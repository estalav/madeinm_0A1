import { NextRequest, NextResponse } from "next/server";

type Candidate = {
  id: string;
  name: string;
  category: string;
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

  const { imageUrl, barcodeValue, candidates } = (await request.json()) as {
    imageUrl?: string;
    barcodeValue?: string | null;
    candidates?: Candidate[];
  };

  if (!imageUrl || !candidates?.length) {
    return NextResponse.json(
      { error: "Missing imageUrl or catalog candidates for recognition." },
      { status: 400 },
    );
  }

  const imageResponse = await fetch(imageUrl);

  if (!imageResponse.ok) {
    return NextResponse.json(
      { error: "Could not download the uploaded image for recognition." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  const mimeType = imageResponse.headers.get("content-type") ?? "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const catalogText = candidates
    .map((candidate) => `- ${candidate.name} (${candidate.category}) [${candidate.id}]`)
    .join("\n");

  const prompt = [
    "Analyze this uploaded grocery photo and suggest the single best product from the catalog below.",
    "If there is not enough evidence, return null for suggestedProductId and explain why.",
    "Do not invent origin facts. Focus only on visual candidate matching.",
    barcodeValue ? `Visible or manual barcode value: ${barcodeValue}` : "No barcode value provided.",
    "Catalog candidates:",
    catalogText,
    'Respond with strict JSON only: {"suggestedProductId": string | null, "confidence": "alta" | "media" | "baja", "reasoning": string}',
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
    const parsed = JSON.parse(text) as {
      suggestedProductId: string | null;
      confidence: "alta" | "media" | "baja";
      reasoning: string;
    };

    return NextResponse.json(parsed);
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
