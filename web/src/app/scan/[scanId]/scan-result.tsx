"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ScanResultRecord = {
  id: string;
  user_id: string | null;
  image_url: string | null;
  barcode_value: string | null;
  explanation: string | null;
  review_status: string;
  origin_status_result: string | null;
  confidence_level_result: string | null;
  matched_product_id: string | null;
  created_at: string;
};

type ProductOption = {
  id: string;
  name: string;
  category: string;
  origin_status: string | null;
  confidence_level: string | null;
  calories: number | null;
};

const statusLabels: Record<string, string> = {
  hecho_en_mexico: "Hecho en Mexico",
  producido_en_mexico: "Producido en Mexico",
  empacado_en_mexico: "Empacado en Mexico",
  importado: "Importado",
  no_confirmado: "Origen no confirmado",
};

const confidenceLabels: Record<string, string> = {
  verificado: "Verificado",
  alta: "Alta confianza",
  media: "Confianza media",
  baja: "Baja confianza",
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ScanResult({ scanId }: { scanId: string }) {
  const supabase = createSupabaseBrowserClient();
  const [scan, setScan] = useState<ScanResultRecord | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [suggestedProductId, setSuggestedProductId] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [aiConfidence, setAiConfidence] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function loadPage() {
      setPageError(null);

      const { data: scanData, error: scanError } = await supabase
        .from("classification_runs")
        .select(
          "id, user_id, image_url, barcode_value, explanation, review_status, origin_status_result, confidence_level_result, matched_product_id, created_at",
        )
        .eq("id", scanId)
        .single();

      if (scanError || !scanData) {
        setPageError(scanError?.message ?? "No pudimos cargar este escaneo.");
        return;
      }

      const typedScan = scanData as ScanResultRecord;
      setScan(typedScan);
      setSelectedProductId(typedScan.matched_product_id ?? "");

      const { data: productData, error: productError } = await supabase
        .from("product_summary")
        .select("id, name, category, origin_status, confidence_level, calories")
        .order("name", { ascending: true });

      if (productError) {
        setPageError(productError.message);
        return;
      }

      setProducts((productData ?? []) as ProductOption[]);

      if (typedScan.barcode_value) {
        const { data: barcodeMatch } = await (supabase
          .from("barcodes") as any)
          .select("product_id")
          .eq("code_value", typedScan.barcode_value)
          .limit(1)
          .maybeSingle();

        if (barcodeMatch?.product_id && !typedScan.matched_product_id) {
          setSuggestedProductId(barcodeMatch.product_id);
          setSelectedProductId(barcodeMatch.product_id);
        }
      }

      if (typedScan.image_url) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("scan-uploads")
          .createSignedUrl(typedScan.image_url, 60 * 10);

        if (signedError) {
          setPageError(signedError.message);
          return;
        }

        setImageUrl(signedData.signedUrl);
      }
    }

    loadPage();
  }, [scanId, supabase]);

  useEffect(() => {
    async function loadAIStatus() {
      const response = await fetch("/api/recognize", { method: "GET" });

      if (!response.ok) {
        setAiEnabled(false);
        return;
      }

      const payload = (await response.json()) as {
        enabled?: boolean;
        model?: string;
      };

      setAiEnabled(Boolean(payload.enabled));
      setAiModel(payload.model ?? null);
    }

    loadAIStatus();
  }, []);

  const matchedProduct = useMemo(
    () => products.find((product) => product.id === (selectedProductId || scan?.matched_product_id)),
    [products, scan?.matched_product_id, selectedProductId],
  );

  const suggestedProduct = useMemo(
    () => products.find((product) => product.id === suggestedProductId),
    [products, suggestedProductId],
  );

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) =>
      `${product.name} ${product.category}`.toLowerCase().includes(query),
    );
  }, [productQuery, products]);

  async function handleConfirmMatch() {
    if (!scan || !selectedProductId) {
      setPageError("Selecciona un producto antes de confirmar.");
      return;
    }

    const chosenProduct = products.find((product) => product.id === selectedProductId);

    if (!chosenProduct) {
      setPageError("No encontramos el producto elegido.");
      return;
    }

    setPageError(null);
    setStatusMessage(null);

    startTransition(async () => {
      const explanation = `Coincidencia seleccionada manualmente por el usuario para ${chosenProduct.name}.`;

      const { error: classificationError } = await (supabase
        .from("classification_runs") as any)
        .update({
          matched_product_id: chosenProduct.id,
          origin_status_result: chosenProduct.origin_status ?? "no_confirmado",
          confidence_level_result: chosenProduct.confidence_level ?? "media",
          explanation,
          review_status: "admin_confirmed",
        })
        .eq("id", scan.id);

      if (classificationError) {
        setPageError(classificationError.message);
        return;
      }

      const { error: scanUpdateError } = await (supabase.from("user_scans") as any)
        .update({
          matched_product_id: chosenProduct.id,
          result_status: "matched",
        })
        .eq("classification_run_id", scan.id);

      if (scanUpdateError) {
        setPageError(scanUpdateError.message);
        return;
      }

      setScan((current) =>
        current
          ? {
              ...current,
              matched_product_id: chosenProduct.id,
              origin_status_result: chosenProduct.origin_status,
              confidence_level_result: chosenProduct.confidence_level,
              explanation,
              review_status: "admin_confirmed",
            }
          : current,
      );
      setStatusMessage("Producto asociado correctamente. Ya puedes ver las etiquetas de confianza.");
    });
  }

  async function handleAISuggestion() {
    if (!imageUrl || !products.length) {
      setPageError("Todavia no tenemos suficiente informacion para intentar la sugerencia AI.");
      return;
    }

    setPageError(null);
    setStatusMessage(null);
    setAiReasoning(null);
    setAiConfidence(null);

    startTransition(async () => {
      const response = await fetch("/api/recognize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl,
          barcodeValue: scan?.barcode_value ?? null,
          candidates: products.map((product) => ({
            id: product.id,
            name: product.name,
            category: product.category,
          })),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        suggestedProductId?: string | null;
        confidence?: string;
        reasoning?: string;
      };

      if (!response.ok) {
        setPageError(payload.error ?? "No pudimos obtener una sugerencia AI.");
        return;
      }

      if (payload.suggestedProductId) {
        setSuggestedProductId(payload.suggestedProductId);
        setSelectedProductId(payload.suggestedProductId);
        setStatusMessage("La sugerencia AI ya se aplico como coincidencia propuesta.");
      } else {
        setStatusMessage("La AI no encontro una coincidencia con confianza suficiente.");
      }

      setAiConfidence(payload.confidence ?? null);
      setAiReasoning(payload.reasoning ?? null);
    });
  }

  return (
    <div className="result-shell">
      <div className="scan-nav">
        <Link href="/scan">Volver a escanear</Link>
      </div>

      {pageError ? (
        <section className="scan-card">
          <h1>Resultado del escaneo</h1>
          <p className="status-error">{pageError}</p>
        </section>
      ) : (
        <div className="result-grid">
          <section className="scan-card">
            <p className="eyebrow">Escaneo cargado</p>
            <h1 className="result-title">Convierte la carga en un resultado confiable.</h1>
            <p className="scan-copy">
              Este paso permite elegir un producto del catalogo inicial y reflejar origen,
              confianza y explicacion de forma clara.
            </p>

            <div className="result-meta">
              <div>
                <strong>Escaneo</strong>
                <span>{scan ? formatTimestamp(scan.created_at) : "Cargando..."}</span>
              </div>
              <div>
                <strong>Barcode</strong>
                <span>{scan?.barcode_value || "Sin barcode registrado"}</span>
              </div>
              <div>
                <strong>Revision</strong>
                <span>{scan?.review_status || "Pendiente"}</span>
              </div>
            </div>

            {imageUrl ? (
              <div className="scan-image-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Producto cargado por el usuario" className="scan-image" />
              </div>
            ) : (
              <div className="scan-image-placeholder">La imagen cargada aparecera aqui.</div>
            )}
          </section>

          <section className="scan-card">
            <h2>Elegir coincidencia</h2>
            <p className="scan-copy">
              Por ahora la seleccion es manual para validar el flujo. Despues la haremos
              automatica con ayuda del clasificador.
            </p>

            <label className="field">
              <span>Pista del producto</span>
              <input
                type="text"
                placeholder="Ejemplo: mango, limon, aguacate"
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
              />
            </label>

            {productQuery ? (
              <p className="status-note">
                Coincidencias filtradas: <strong>{filteredProducts.length}</strong>
              </p>
            ) : null}

            <label className="field">
              <span>Producto del catalogo</span>
              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
              >
                <option value="">Selecciona un producto</option>
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            {suggestedProduct ? (
              <p className="status-note">
                Sugerencia automatica por barcode: <strong>{suggestedProduct.name}</strong>
              </p>
            ) : scan?.barcode_value ? (
              <p className="status-note">
                Barcode detectado: <strong>{scan.barcode_value}</strong>, pero aun no existe una
                coincidencia exacta en el catalogo.
              </p>
            ) : null}

            {aiEnabled === false ? (
              <p className="status-note">
                La sugerencia AI todavia no esta activa. Agrega <code>OPENAI_API_KEY</code> en
                tu archivo local <code>web/.env.local</code> para habilitarla.
              </p>
            ) : aiEnabled ? (
              <p className="status-note">
                AI lista con modelo <strong>{aiModel ?? "configurado"}</strong>.
              </p>
            ) : (
              <p className="status-note">Comprobando si la sugerencia AI esta disponible...</p>
            )}

            <button
              className="button button-secondary"
              type="button"
              onClick={handleAISuggestion}
              disabled={isPending || !imageUrl || !aiEnabled}
            >
              {isPending ? "Analizando..." : "Intentar sugerencia AI"}
            </button>

            {aiReasoning ? (
              <div className="status-note">
                <strong>AI</strong>
                <div>{aiConfidence ? `Confianza: ${aiConfidence}` : null}</div>
                <div>{aiReasoning}</div>
              </div>
            ) : null}

            <button
              className="button button-primary"
              type="button"
              disabled={!selectedProductId || isPending}
              onClick={handleConfirmMatch}
            >
              {isPending ? "Guardando..." : "Confirmar coincidencia"}
            </button>

            {statusMessage ? <p className="status-ok">{statusMessage}</p> : null}
            {pageError ? <p className="status-error">{pageError}</p> : null}

            <div className="trust-card">
              <p className="eyebrow">Resultado actual</p>
              <h3>{matchedProduct?.name || "Aun sin producto confirmado"}</h3>
              <p className="trust-status">
                {statusLabels[scan?.origin_status_result ?? ""] ?? "Origen no confirmado"}
              </p>
              <p className="trust-confidence">
                {confidenceLabels[scan?.confidence_level_result ?? ""] ?? "Sin confianza calculada"}
              </p>
              <p className="scan-copy">
                {scan?.explanation || "Todavia no hay explicacion registrada para este escaneo."}
              </p>
              {matchedProduct ? (
                <div className="trust-facts">
                  <span>{matchedProduct.category}</span>
                  <span>
                    {matchedProduct.calories
                      ? `${matchedProduct.calories} kcal por 100 g`
                      : "Calorias por confirmar"}
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
