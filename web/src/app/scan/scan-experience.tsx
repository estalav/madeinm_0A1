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
  const [guestGuess, setGuestGuess] = useState<string | null>(null);
  const [guestReasoning, setGuestReasoning] = useState<string | null>(null);
  const [guestConfidence, setGuestConfidence] = useState<string | null>(null);
  const [guestOriginAssessment, setGuestOriginAssessment] = useState<OriginAssessment | null>(null);
  const [guestOriginExplanation, setGuestOriginExplanation] = useState<string | null>(null);
  const [guestEvidenceNeeded, setGuestEvidenceNeeded] = useState<string[]>([]);
  const [guestCatalogMatch, setGuestCatalogMatch] = useState<string | null>(null);
  const [guestDraftCandidate, setGuestDraftCandidate] = useState<DraftProductCandidate | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);
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
    setGuestGuess(null);
    setGuestReasoning(null);
    setGuestConfidence(null);
    setGuestOriginAssessment(null);
    setGuestOriginExplanation(null);
    setGuestEvidenceNeeded([]);
    setGuestCatalogMatch(null);
    setGuestDraftCandidate(null);
    setDraftMessage(null);
    setDraftError(null);

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("product_summary")
          .select("id, name, category")
          .order("name", { ascending: true });

        if (error) {
          throw new Error(error.message);
        }

        const imageDataUrl = await fileToDataUrl(selectedFile);
        const response = await fetch("/api/recognize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageDataUrl,
            barcodeValue: barcodeValue || null,
            candidates: (data ?? []) as ProductCandidate[],
            marketContext: marketContext || null,
            vendorOriginHint: vendorOriginHint || null,
            observedTextHint: observedTextHint || null,
          }),
        });

        const payload = (await response.json()) as {
          error?: string;
          suggestedProductId?: string | null;
          confidence?: string;
          reasoning?: string;
          visualGuess?: string | null;
          originAssessment?: OriginAssessment;
          originExplanation?: string;
          evidenceNeeded?: string[];
          draftProduct?: DraftProductCandidate | null;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "We could not analyze this guest scan.");
        }

        const matchedProduct = ((data ?? []) as ProductCandidate[]).find(
          (candidate) => candidate.id === payload.suggestedProductId,
        );

        setGuestGuess(payload.visualGuess ?? null);
        setGuestReasoning(payload.reasoning ?? null);
        setGuestConfidence(payload.confidence ?? null);
        setGuestOriginAssessment(payload.originAssessment ?? "desconocido");
        setGuestOriginExplanation(payload.originExplanation ?? null);
        setGuestEvidenceNeeded(payload.evidenceNeeded ?? []);
        setGuestCatalogMatch(matchedProduct?.name ?? null);
        setGuestDraftCandidate(payload.draftProduct ?? null);

        if (matchedProduct) {
          setUploadMessage(
            `The guest recognizer suggests ${matchedProduct.name}. You can sign in later to save a real scan record.`,
          );
        } else if (payload.visualGuess) {
          setUploadMessage(
            `This looks like ${payload.visualGuess}, but it is not in the current pilot catalog yet.`,
          );
        } else {
          setUploadMessage(
            "We could not match this image confidently. Try a clearer photo or sign in later for the full saved flow.",
          );
        }
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Guest recognition failed.");
      } finally {
        setLoadingUpload(false);
      }
    })();
  }

  async function handleCreateDraftProduct() {
    if (!guestDraftCandidate) {
      setDraftError("There is no AI draft candidate available yet.");
      return;
    }

    setCreatingDraft(true);
    setDraftMessage(null);
    setDraftError(null);

    try {
      const response = await fetch("/api/draft-products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...guestDraftCandidate,
          barcodeValue: barcodeValue || null,
          reasoning: guestReasoning,
          visualGuess: guestGuess,
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
        setDraftMessage(`A matching product already exists: ${payload.name} (${payload.status}).`);
      } else {
        setDraftMessage(`Draft product created successfully: ${payload.name} (${payload.status}).`);
      }
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Draft creation failed.");
    } finally {
      setCreatingDraft(false);
    }
  }

  const isGuest = !userId && guestMode;

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

            {guestGuess || guestCatalogMatch ? (
              <div className="trust-card">
                <p className="eyebrow">Resultado invitado</p>
                <h3>{guestCatalogMatch ?? guestGuess ?? "Sin coincidencia"}</h3>
                {guestCatalogMatch ? (
                  <p className="trust-status">Coincidencia encontrada dentro del catalogo piloto</p>
                ) : guestGuess ? (
                  <p className="trust-status">
                    Parece ser {guestGuess}, pero aun no existe en el catalogo piloto
                  </p>
                ) : null}
                <p className="trust-confidence">
                  {guestConfidence ? `Confianza ${guestConfidence}` : "Sin confianza calculada"}
                </p>
                <p className="trust-status">{originAssessmentLabel(guestOriginAssessment)}</p>
                {guestOriginExplanation ? <p className="scan-copy">{guestOriginExplanation}</p> : null}
                {guestReasoning ? <p className="scan-copy">{guestReasoning}</p> : null}
                {guestEvidenceNeeded.length > 0 ? (
                  <div className="admin-aliases">
                    {guestEvidenceNeeded.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                ) : null}
                {!guestCatalogMatch && guestDraftCandidate ? (
                  <>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={handleCreateDraftProduct}
                      disabled={creatingDraft}
                    >
                      {creatingDraft ? "Creating draft..." : "Create draft product"}
                    </button>
                    {draftMessage ? <p className="status-ok">{draftMessage}</p> : null}
                    {draftError ? <p className="status-error">{draftError}</p> : null}
                  </>
                ) : null}
              </div>
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
