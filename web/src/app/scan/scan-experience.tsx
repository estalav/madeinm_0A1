"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ScanRecord = {
  id: string;
  barcode_value: string | null;
  explanation: string | null;
  review_status: string;
  created_at: string;
};

type ProductCandidate = {
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

type OriginAssessment = "confirmado_mexicano" | "probable_mexicano" | "desconocido";

type RecognitionItem = {
  suggestedProductId: string | null;
  confidence: string;
  reasoning: string;
  visualGuess: string | null;
  detectedText: string[];
  originAssessment: OriginAssessment;
  originExplanation: string;
  evidenceNeeded: string[];
  draftProduct: DraftProductCandidate | null;
};

type GuestResultItem = RecognitionItem & {
  catalogMatchName: string | null;
  resultKey: string;
};

type CorrectionState = {
  mode: "catalog" | "draft";
  selectedProductId: string;
  typedName: string;
  appliedLabel: string | null;
};

type BarcodeDetectorResult = {
  rawValue?: string;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<BarcodeDetectorResult[]>;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function safeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("We could not read this image file."));
    };

    reader.onerror = () => reject(new Error("We could not read this image file."));
    reader.readAsDataURL(file);
  });
}

async function compressImageForRecognition(file: File) {
  const dataUrl = await fileToDataUrl(file);

  return new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const maxDimension = 1400;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const targetWidth = Math.max(1, Math.round(image.width * scale));
      const targetHeight = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("We could not prepare this image for recognition."));
        return;
      }

      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.76));
    };

    image.onerror = () => reject(new Error("We could not prepare this image for recognition."));
    image.src = dataUrl;
  });
}

export function ScanExperience({ initialGuestMode = false }: { initialGuestMode?: boolean }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(initialGuestMode);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [barcodeMessage, setBarcodeMessage] = useState<string | null>(null);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [detectingBarcode, setDetectingBarcode] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [productCandidates, setProductCandidates] = useState<ProductCandidate[]>([]);
  const [guestDetectedText, setGuestDetectedText] = useState<string[]>([]);
  const [guestItems, setGuestItems] = useState<GuestResultItem[]>([]);
  const [draftMessages, setDraftMessages] = useState<Record<string, string>>({});
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [creatingDraftKeys, setCreatingDraftKeys] = useState<Record<string, boolean>>({});
  const [correctionOpenKeys, setCorrectionOpenKeys] = useState<Record<string, boolean>>({});
  const [corrections, setCorrections] = useState<Record<string, CorrectionState>>({});
  const [marketContext, setMarketContext] = useState("");
  const [vendorOriginHint, setVendorOriginHint] = useState("");
  const [observedTextHint, setObservedTextHint] = useState("");

  function originAssessmentLabel(value: OriginAssessment | null) {
    switch (value) {
      case "confirmado_mexicano":
        return "Confirmed Mexican";
      case "probable_mexicano":
        return "Likely Mexican";
      default:
        return "Unknown origin";
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const sessionResult = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        setUserId(sessionResult.data.session?.user.id ?? null);
        setSessionReady(true);
      } catch {
        if (!isMounted) {
          return;
        }

        setUserId(null);
        setSessionReady(true);
        setSessionMessage(
          "We could not load the session state on this device. You can still continue as guest or sign in with email.",
        );
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setSessionReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) {
      setRecentScans([]);
      return;
    }

    async function loadRecentScans() {
      const { data, error } = await supabase
        .from("classification_runs")
        .select("id, barcode_value, explanation, review_status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        setUploadError(error.message);
        return;
      }

      setRecentScans((data ?? []) as ScanRecord[]);
    }

    loadRecentScans();
  }, [supabase, userId]);

  async function handleMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendingLink(true);
    setEmailMessage(null);
    setUploadError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/scan`,
      },
    });

    setSendingLink(false);

    if (error) {
      setUploadError(error.message);
      return;
    }

    setEmailMessage("Te enviamos un magic link para entrar y activar tus cargas privadas.");
  }

  async function handleFileSelection(file: File | null) {
    setSelectedFile(file);
    setBarcodeMessage(null);

    if (!file) {
      return;
    }

    const BarcodeDetectorAPI = (window as Window & {
      BarcodeDetector?: BarcodeDetectorCtor;
    }).BarcodeDetector;

    if (!BarcodeDetectorAPI) {
      setBarcodeMessage(
        "Este navegador no ofrece lectura nativa de barcode. Puedes escribirlo manualmente si lo ves en la etiqueta.",
      );
      return;
    }

    try {
      setDetectingBarcode(true);
      const detector = new BarcodeDetectorAPI({
        formats: ["ean_13", "upc_a", "upc_e", "code_128", "qr_code"],
      });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      const detectedCode = codes.find((code) => code.rawValue)?.rawValue;

      if (detectedCode) {
        setBarcodeValue(detectedCode);
        setBarcodeMessage(`Barcode detectado automaticamente: ${detectedCode}`);
      } else {
        setBarcodeMessage(
          "No se detecto un barcode legible en la imagen. Puedes continuar o escribirlo manualmente.",
        );
      }
    } catch {
      setBarcodeMessage(
        "No pudimos leer el barcode desde esta imagen. Puedes seguir con confirmacion manual.",
      );
    } finally {
      setDetectingBarcode(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId || !selectedFile) {
      setUploadError("Necesitas iniciar sesion y seleccionar una imagen.");
      return;
    }

    setLoadingUpload(true);
    setUploadMessage(null);
    setUploadError(null);

    const path = `${userId}/${crypto.randomUUID()}-${safeFileName(selectedFile.name)}`;

    const { error: storageError } = await supabase.storage
      .from("scan-uploads")
      .upload(path, selectedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (storageError) {
      setLoadingUpload(false);
      setUploadError(storageError.message);
      return;
    }

    const { data: classificationRun, error: classificationError } = await (supabase
      .from("classification_runs") as any)
      .insert({
        user_id: userId,
        image_url: path,
        barcode_value: barcodeValue || null,
        explanation:
          "Carga inicial recibida. Pendiente de clasificacion automatica y revision de confianza.",
        review_status: "needs_review",
      })
      .select("id, barcode_value, explanation, review_status, created_at")
      .single();

    if (classificationError || !classificationRun) {
      setLoadingUpload(false);
      setUploadError(classificationError?.message ?? "No pudimos registrar la carga.");
      return;
    }

    const { error: userScanError } = await (supabase.from("user_scans") as any).insert({
      user_id: userId,
      uploaded_image_url: path,
      barcode_value: barcodeValue || null,
      classification_run_id: classificationRun.id,
      result_status: "needs_review",
    });

    if (userScanError) {
      setLoadingUpload(false);
      setUploadError(userScanError.message);
      return;
    }

    setRecentScans((current) => [classificationRun as ScanRecord, ...current].slice(0, 5));
    setSelectedFile(null);
    setBarcodeValue("");
    setUploadMessage("Imagen cargada y registro creado. El siguiente paso sera clasificar el producto.");
    setLoadingUpload(false);
    router.push(`/scan/${classificationRun.id}`);
  }

  function handleGuestContinue() {
    setGuestMode(true);
    setEmailMessage(null);
    setUploadError(null);
    router.replace("/scan?mode=guest");
  }

  function handleGuestPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setUploadError("Selecciona una imagen para probar el flujo como invitado.");
      return;
    }

    setLoadingUpload(true);
    setUploadError(null);
    setUploadMessage(null);
    setGuestDetectedText([]);
    setGuestItems([]);
    setDraftMessages({});
    setDraftErrors({});
    setCreatingDraftKeys({});

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("product_summary")
          .select("id, name, category")
          .order("name", { ascending: true });

        if (error) {
          throw new Error(error.message);
        }

        const candidates = (data ?? []) as ProductCandidate[];
        setProductCandidates(candidates);

        const imageDataUrl = await compressImageForRecognition(selectedFile);
        const response = await fetch("/api/recognize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageDataUrl,
            barcodeValue: barcodeValue || null,
            candidates,
            marketContext: marketContext || null,
            vendorOriginHint: vendorOriginHint || null,
            observedTextHint: observedTextHint || null,
          }),
        });

        const rawText = await response.text();
        const payload = (rawText ? JSON.parse(rawText) : {}) as {
          error?: string;
          detectedText?: string[];
          items?: RecognitionItem[];
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "We could not analyze this guest scan.");
        }

        setGuestDetectedText(payload.detectedText ?? []);
        const resultItems = (payload.items ?? []).map((item, index) => {
          const matchedProduct = candidates.find(
            (candidate) => candidate.id === item.suggestedProductId,
          );

          return {
            ...item,
            catalogMatchName: matchedProduct?.name ?? null,
            resultKey: `${item.suggestedProductId ?? item.visualGuess ?? "unknown"}-${index}`,
          };
        });

        setGuestItems(resultItems);
        setCorrections({});
        setCorrectionOpenKeys({});

        if (resultItems.length === 0) {
          setUploadMessage(
            "We could not match this image confidently. Try a clearer photo or sign in later for the full saved flow.",
          );
        } else if (resultItems.length === 1) {
          const item = resultItems[0];
          setUploadMessage(
            item.catalogMatchName
              ? `The guest recognizer suggests ${item.catalogMatchName}. You can sign in later to save a real scan record.`
              : `This looks like ${item.visualGuess ?? "an unidentified product"}, but it is not in the current pilot catalog yet.`,
          );
        } else {
          setUploadMessage(`Detected ${resultItems.length} products in this photo. Review each item below.`);
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          setUploadError("The server returned a non-JSON error, likely because the image was too large. Try a closer crop or smaller photo.");
          return;
        }

        setUploadError(error instanceof Error ? error.message : "Guest recognition failed.");
      } finally {
        setLoadingUpload(false);
      }
    })();
  }

  async function handleCreateDraftProduct(item: RecognitionItem & { resultKey: string }) {
    if (!item.draftProduct) {
      setDraftErrors((current) => ({
        ...current,
        [item.resultKey]: "There is no AI draft candidate available yet.",
      }));
      return;
    }

    setCreatingDraftKeys((current) => ({ ...current, [item.resultKey]: true }));
    setDraftMessages((current) => ({ ...current, [item.resultKey]: "" }));
    setDraftErrors((current) => ({ ...current, [item.resultKey]: "" }));

    try {
      const response = await fetch("/api/draft-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...item.draftProduct,
          barcodeValue: barcodeValue || null,
          reasoning: item.reasoning,
          visualGuess: item.visualGuess,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        created?: boolean;
        existing?: boolean;
        name?: string;
        status?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "We could not create the draft product.");
      }

      if (payload.existing) {
        setDraftMessages((current) => ({
          ...current,
          [item.resultKey]: `A matching product already exists: ${payload.name} (${payload.status}).`,
        }));
      } else {
        setDraftMessages((current) => ({
          ...current,
          [item.resultKey]: `Draft product created successfully: ${payload.name} (${payload.status}).`,
        }));
      }
    } catch (error) {
      setDraftErrors((current) => ({
        ...current,
        [item.resultKey]: error instanceof Error ? error.message : "Draft creation failed.",
      }));
    } finally {
      setCreatingDraftKeys((current) => ({ ...current, [item.resultKey]: false }));
    }
  }

  function setCorrectionState(resultKey: string, item: GuestResultItem) {
    setCorrections((current) => ({
      ...current,
      [resultKey]:
        current[resultKey] ?? {
          mode: "catalog",
          selectedProductId: item.suggestedProductId ?? "",
          typedName: item.visualGuess ?? "",
          appliedLabel: null,
        },
    }));
  }

  function handleOpenCorrection(item: GuestResultItem) {
    setCorrectionState(item.resultKey, item);
    setCorrectionOpenKeys((current) => ({
      ...current,
      [item.resultKey]: !current[item.resultKey],
    }));
  }

  function updateCorrection(resultKey: string, next: Partial<CorrectionState>) {
    setCorrections((current) => {
      const existing = current[resultKey] ?? {
        mode: "catalog" as const,
        selectedProductId: "",
        typedName: "",
        appliedLabel: null,
      };

      return {
        ...current,
        [resultKey]: {
          ...existing,
          ...next,
        },
      };
    });
  }

  async function persistRecognitionFeedback(
    item: GuestResultItem,
    correction: {
      correctionMode: "catalog" | "draft";
      correctedProductId?: string | null;
      correctedProductName: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const response = await fetch("/api/correction-feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionType: userId ? "authenticated" : "guest",
        sourceSurface: userId ? "web_scan_authenticated" : "web_scan_guest",
        guessedProductId: item.suggestedProductId,
        guessedProductName: item.catalogMatchName ?? item.visualGuess ?? null,
        correctedProductId: correction.correctedProductId ?? null,
        correctedProductName: correction.correctedProductName,
        correctionMode: correction.correctionMode,
        visualGuess: item.visualGuess,
        barcodeValue: barcodeValue || null,
        originAssessment: item.originAssessment,
        originExplanation: item.originExplanation,
        reasoning: item.reasoning,
        detectedText: item.detectedText.join("\n"),
        marketContext: marketContext.trim() || null,
        vendorOriginHint: vendorOriginHint.trim() || null,
        observedTextHint: observedTextHint.trim() || null,
        metadata: correction.metadata ?? {
          evidenceNeeded: item.evidenceNeeded,
        },
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? "We could not save this correction feedback.");
    }
  }

  async function applyCatalogCorrection(item: GuestResultItem) {
    const correction = corrections[item.resultKey];

    if (!correction?.selectedProductId) {
      setDraftErrors((current) => ({
        ...current,
        [item.resultKey]: "Choose the correct catalog product first.",
      }));
      return;
    }

    const selectedProduct = productCandidates.find(
      (candidate) => candidate.id === correction.selectedProductId,
    );

    if (!selectedProduct) {
      setDraftErrors((current) => ({
        ...current,
        [item.resultKey]: "We could not find that catalog product anymore.",
      }));
      return;
    }

    try {
      await persistRecognitionFeedback(item, {
        correctionMode: "catalog",
        correctedProductId: selectedProduct.id,
        correctedProductName: selectedProduct.name,
      });
    } catch (error) {
      setDraftErrors((current) => ({
        ...current,
        [item.resultKey]:
          error instanceof Error ? error.message : "We could not save this correction feedback.",
      }));
      return;
    }

    setGuestItems((current) =>
      current.map((entry) =>
        entry.resultKey === item.resultKey
          ? {
              ...entry,
              suggestedProductId: selectedProduct.id,
              catalogMatchName: selectedProduct.name,
            }
          : entry,
      ),
    );

    setDraftErrors((current) => ({ ...current, [item.resultKey]: "" }));
    setDraftMessages((current) => ({
      ...current,
      [item.resultKey]: `Marked as corrected: ${selectedProduct.name}.`,
    }));
    updateCorrection(item.resultKey, { appliedLabel: selectedProduct.name });
    setCorrectionOpenKeys((current) => ({ ...current, [item.resultKey]: false }));
  }

  async function applyDraftCorrection(item: GuestResultItem) {
    const correction = corrections[item.resultKey];
    const draftName = correction?.typedName.trim();

    if (!draftName) {
      setDraftErrors((current) => ({
        ...current,
        [item.resultKey]: "Type the correct product name first.",
      }));
      return;
    }

    setCreatingDraftKeys((current) => ({ ...current, [item.resultKey]: true }));
    setDraftErrors((current) => ({ ...current, [item.resultKey]: "" }));

    try {
      const response = await fetch("/api/draft-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: draftName,
          category: item.draftProduct?.category ?? "produce",
          subcategory: item.draftProduct?.subcategory ?? null,
          aliases: Array.from(
            new Set([
              draftName,
              ...(item.draftProduct?.aliases ?? []),
              ...(item.visualGuess ? [item.visualGuess] : []),
            ]),
          ),
          barcodeValue: barcodeValue || null,
          reasoning: item.reasoning,
          visualGuess: draftName,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        created?: boolean;
        existing?: boolean;
        name?: string;
        status?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "We could not create the corrected draft.");
      }

      await persistRecognitionFeedback(item, {
        correctionMode: "draft",
        correctedProductName: draftName,
        metadata: {
          draftCreated: Boolean(payload.created),
          existingCatalogProduct: Boolean(payload.existing),
          returnedName: payload.name ?? draftName,
          returnedStatus: payload.status ?? null,
        },
      });

      setDraftMessages((current) => ({
        ...current,
        [item.resultKey]: payload.existing
          ? `A matching product already exists: ${payload.name} (${payload.status}).`
          : `Draft product created successfully: ${payload.name} (${payload.status}).`,
      }));
      updateCorrection(item.resultKey, { appliedLabel: draftName });
      setCorrectionOpenKeys((current) => ({ ...current, [item.resultKey]: false }));
    } catch (error) {
      setDraftErrors((current) => ({
        ...current,
        [item.resultKey]:
          error instanceof Error ? error.message : "Corrected draft creation failed.",
      }));
    } finally {
      setCreatingDraftKeys((current) => ({ ...current, [item.resultKey]: false }));
    }
  }

  const isGuest = !userId && guestMode;
  const guestMatchedCount = guestItems.filter((item) => item.catalogMatchName).length;
  const guestUnmatchedCount = guestItems.length - guestMatchedCount;

  return (
    <div className="scan-shell">
      <section className="scan-hero">
        <div>
          <p className="eyebrow">Fase 1 · Escaneo privado con evidencia</p>
          <h1>Sube la foto de un producto y activa el flujo real de clasificacion.</h1>
          <p className="scan-copy">
            Esta pantalla ya usa tus politicas de seguridad reales. Las cargas se guardan
            en <code>scan-uploads</code> y los registros se escriben en{" "}
            <code>classification_runs</code>.
          </p>
        </div>

        <div className="scan-highlight">
          <strong>Estado actual</strong>
          <span>La carga funciona para usuarios autenticados</span>
          <span>El clasificador automatico sera el siguiente paso</span>
        </div>
      </section>

      {sessionMessage ? (
        <section className="scan-card">
          <p className="status-note">{sessionMessage}</p>
        </section>
      ) : null}

      {!sessionReady ? (
        <section className="scan-card">
          <p className="scan-copy">Checking session state...</p>
        </section>
      ) : userId ? (
        <div className="scan-grid">
          <section className="scan-card">
            <h2>Subir una imagen</h2>
            <p className="scan-copy">
              Tu imagen se guardara en una carpeta privada asociada a tu usuario.
            </p>

            <form className="scan-form" onSubmit={handleUpload}>
              <label className="field">
                <span>Foto del producto</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
                />
              </label>

              <label className="field">
                <span>Codigo de barras opcional</span>
                <input
                  type="text"
                  placeholder="Ejemplo: 7501234567890"
                  value={barcodeValue}
                  onChange={(event) => setBarcodeValue(event.target.value)}
                />
              </label>

              <button className="button button-primary" type="submit" disabled={loadingUpload}>
                {loadingUpload ? "Guardando..." : "Cargar y crear registro"}
              </button>
            </form>

            {selectedFile ? (
              <p className="status-note">Archivo seleccionado: {selectedFile.name}</p>
            ) : null}

            {detectingBarcode ? <p className="status-note">Intentando leer barcode...</p> : null}
            {barcodeMessage ? <p className="status-note">{barcodeMessage}</p> : null}

            {uploadMessage ? <p className="status-ok">{uploadMessage}</p> : null}
            {uploadError ? <p className="status-error">{uploadError}</p> : null}
          </section>

          <section className="scan-card">
            <h2>Escaneos recientes</h2>
            <p className="scan-copy">
              Aqui veras los registros creados mientras construimos la clasificacion automatica.
            </p>

            <div className="recent-list">
              {recentScans.length === 0 ? (
                <div className="recent-item">
                  <strong>Aun no hay escaneos</strong>
                  <span>Sube tu primera imagen para crear el primer registro.</span>
                </div>
              ) : (
                recentScans.map((scan) => (
                  <Link key={scan.id} className="recent-item recent-link" href={`/scan/${scan.id}`}>
                    <strong>{scan.barcode_value || "Sin barcode registrado"}</strong>
                    <span>{scan.explanation || "Sin explicacion disponible"}</span>
                    <small>
                      {scan.review_status} · {formatTimestamp(scan.created_at)}
                    </small>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      ) : isGuest ? (
        <div className="scan-grid">
          <section className="scan-card">
            <h2>Modo invitado</h2>
            <p className="scan-copy">
              Aqui puedes probar la experiencia visual sin guardar nada en Supabase. La
              imagen se queda solo en tu navegador.
            </p>

            <form className="scan-form" onSubmit={handleGuestPreview}>
              <label className="field">
                <span>Foto del producto</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
                />
              </label>

              <label className="field">
                <span>Codigo de barras opcional</span>
                <input
                  type="text"
                  placeholder="Ejemplo: 7501234567890"
                  value={barcodeValue}
                  onChange={(event) => setBarcodeValue(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Contexto del mercado o ubicacion</span>
                <input
                  type="text"
                  placeholder="Ejemplo: Central de Abasto CDMX o mercado de Guadalajara"
                  value={marketContext}
                  onChange={(event) => setMarketContext(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Pista del vendedor u origen</span>
                <input
                  type="text"
                  placeholder="Ejemplo: vendedor dice Puebla o producto de Mexico"
                  value={vendorOriginHint}
                  onChange={(event) => setVendorOriginHint(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Texto visible en caja, letrero o etiqueta</span>
                <textarea
                  rows={4}
                  placeholder="Ejemplo: Producto de Mexico, Chiapas, nombre del proveedor o marca de caja"
                  value={observedTextHint}
                  onChange={(event) => setObservedTextHint(event.target.value)}
                />
              </label>

              <button className="button button-primary" type="submit" disabled={loadingUpload}>
                {loadingUpload ? "Analizando..." : "Probar como invitado"}
              </button>
            </form>

            {selectedFile ? (
              <p className="status-note">Archivo seleccionado: {selectedFile.name}</p>
            ) : null}
            {detectingBarcode ? <p className="status-note">Intentando leer barcode...</p> : null}
            {barcodeMessage ? <p className="status-note">{barcodeMessage}</p> : null}
            {uploadMessage ? <p className="status-ok">{uploadMessage}</p> : null}
            {uploadError ? <p className="status-error">{uploadError}</p> : null}

            {guestDetectedText.length > 0 ? (
              <div className="trust-card">
                <p className="eyebrow">OCR evidence</p>
                <p className="scan-copy">
                  Visible text detected in the image. This evidence can strengthen product matching and origin confidence.
                </p>
                <div className="admin-aliases">
                  {guestDetectedText.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {guestItems.length > 0 ? (
              <>
                <div className="trust-card">
                  <p className="eyebrow">Scan summary</p>
                  <h3>{guestItems.length} items detected</h3>
                  <p className="scan-copy">
                    {guestMatchedCount} matched the pilot catalog and {guestUnmatchedCount} still need catalog curation or draft review.
                  </p>
                  <div className="admin-aliases">
                    <span>{guestMatchedCount} matched</span>
                    <span>{guestUnmatchedCount} unmatched</span>
                  </div>
                </div>

                <div className="recent-list">
                {guestItems.map((item, index) => (
                  <div key={item.resultKey} className="trust-card">
                    <p className="eyebrow">Detected item {index + 1}</p>
                    <h3>{item.catalogMatchName ?? item.visualGuess ?? "Sin coincidencia"}</h3>
                    {item.catalogMatchName ? (
                      <p className="trust-status">Coincidencia encontrada dentro del catalogo piloto</p>
                    ) : item.visualGuess ? (
                      <p className="trust-status">
                        Parece ser {item.visualGuess}, pero aun no existe en el catalogo piloto
                      </p>
                    ) : null}
                    <p className="trust-confidence">
                      {item.confidence ? `Confianza ${item.confidence}` : "Sin confianza calculada"}
                    </p>
                    <p className="trust-status">{originAssessmentLabel(item.originAssessment)}</p>
                    {item.originExplanation ? <p className="scan-copy">{item.originExplanation}</p> : null}
                    {item.detectedText.length > 0 ? (
                      <div className="admin-aliases">
                        {item.detectedText.map((value) => (
                          <span key={`${item.resultKey}-${value}`}>{value}</span>
                        ))}
                      </div>
                    ) : null}
                    {item.reasoning ? <p className="scan-copy">{item.reasoning}</p> : null}
                    {item.evidenceNeeded.length > 0 ? (
                      <div className="admin-aliases">
                        {item.evidenceNeeded.map((value) => (
                          <span key={`${item.resultKey}-${value}`}>{value}</span>
                        ))}
                      </div>
                    ) : null}
                    <div className="admin-actions">
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => handleOpenCorrection(item)}
                      >
                        {correctionOpenKeys[item.resultKey] ? "Close correction" : "Is this correct?"}
                      </button>
                    </div>
                    {correctionOpenKeys[item.resultKey] ? (
                      <div className="scan-form">
                        <label className="field">
                          <span>Correction mode</span>
                          <select
                            value={corrections[item.resultKey]?.mode ?? "catalog"}
                            onChange={(event) =>
                              updateCorrection(item.resultKey, {
                                mode: event.target.value === "draft" ? "draft" : "catalog",
                              })
                            }
                          >
                            <option value="catalog">Pick the correct catalog product</option>
                            <option value="draft">Type the correct product name</option>
                          </select>
                        </label>
                        {(corrections[item.resultKey]?.mode ?? "catalog") === "catalog" ? (
                          <>
                            <label className="field">
                              <span>Catalog product</span>
                              <select
                                value={corrections[item.resultKey]?.selectedProductId ?? ""}
                                onChange={(event) =>
                                  updateCorrection(item.resultKey, {
                                    selectedProductId: event.target.value,
                                  })
                                }
                              >
                                <option value="">Choose a product</option>
                                {productCandidates.map((candidate) => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {candidate.name} · {candidate.category}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              className="button button-secondary"
                              type="button"
                              onClick={() => void applyCatalogCorrection(item)}
                            >
                              Apply correction
                            </button>
                          </>
                        ) : (
                          <>
                            <label className="field">
                              <span>Correct product name</span>
                              <input
                                type="text"
                                value={corrections[item.resultKey]?.typedName ?? ""}
                                onChange={(event) =>
                                  updateCorrection(item.resultKey, {
                                    typedName: event.target.value,
                                  })
                                }
                                placeholder="Example: Papa blanca"
                              />
                            </label>
                            <button
                              className="button button-secondary"
                              type="button"
                              onClick={() => void applyDraftCorrection(item)}
                              disabled={Boolean(creatingDraftKeys[item.resultKey])}
                            >
                              {creatingDraftKeys[item.resultKey] ? "Saving..." : "Create corrected draft"}
                            </button>
                          </>
                        )}
                        {corrections[item.resultKey]?.appliedLabel ? (
                          <p className="status-ok">
                            Current correction: {corrections[item.resultKey]?.appliedLabel}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {!item.catalogMatchName && item.draftProduct ? (
                      <>
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => void handleCreateDraftProduct(item)}
                          disabled={Boolean(creatingDraftKeys[item.resultKey])}
                        >
                          {creatingDraftKeys[item.resultKey] ? "Creating draft..." : "Create draft product"}
                        </button>
                        {draftMessages[item.resultKey] ? (
                          <p className="status-ok">{draftMessages[item.resultKey]}</p>
                        ) : null}
                        {draftErrors[item.resultKey] ? (
                          <p className="status-error">{draftErrors[item.resultKey]}</p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ))}
                </div>
              </>
            ) : null}
          </section>

          <section className="scan-card">
            <h2>Entrar despues</h2>
            <p className="scan-copy">
              Cuando quieras guardar tus escaneos, comparar resultados o subir imagenes al
              bucket privado, puedes entrar con tu email desde esta misma pantalla.
            </p>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                setGuestMode(false);
                router.replace("/scan");
              }}
            >
              Cambiar a acceso con email
            </button>
          </section>
        </div>
      ) : (
        <div className="scan-grid">
          <section className="scan-card">
            <h2>Elige como entrar</h2>
            <p className="scan-copy">
              Puedes explorar primero como invitado o entrar con email para guardar
              escaneos privados y usar el flujo completo.
            </p>

            <div className="entry-actions">
              <Link className="button button-secondary" href="/scan?mode=guest" onClick={handleGuestContinue}>
                Continuar como invitado
              </Link>
            </div>

            <form className="scan-form" onSubmit={handleMagicLink}>
              <label className="field">
                <span>Correo electronico</span>
                <input
                  type="email"
                  placeholder="tu-correo@ejemplo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <button className="button button-primary" type="submit" disabled={sendingLink}>
                {sendingLink ? "Enviando..." : "Entrar con email"}
              </button>
            </form>

            {emailMessage ? <p className="status-ok">{emailMessage}</p> : null}
            {uploadError ? <p className="status-error">{uploadError}</p> : null}
          </section>

          <section className="scan-card">
            <h2>Por que pedimos sesion</h2>
            <div className="recent-list">
              <div className="recent-item">
                <strong>Bucket privado</strong>
                <span>Las fotos del usuario no quedan expuestas publicamente.</span>
              </div>
              <div className="recent-item">
                <strong>RLS activo</strong>
                <span>Solo el usuario propietario y admins autorizados pueden verlas.</span>
              </div>
              <div className="recent-item">
                <strong>Base lista para iOS</strong>
                <span>Este mismo flujo servira despues para la app en SwiftUI.</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
