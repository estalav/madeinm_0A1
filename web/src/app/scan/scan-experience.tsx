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

export function ScanExperience() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(false);
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

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setUserId(session?.user.id ?? null);
      setSessionReady(true);
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
  }

  function handleGuestPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setUploadError("Selecciona una imagen para probar el flujo como invitado.");
      return;
    }

    setUploadError(null);
    setUploadMessage(
      "Estas en modo invitado. Puedes probar la lectura local del barcode y luego entrar con email para guardar cargas privadas.",
    );
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

      {!sessionReady ? (
        <section className="scan-card">
          <p className="scan-copy">Cargando estado de sesion...</p>
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

              <button className="button button-primary" type="submit">
                Probar como invitado
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
            <h2>Entrar despues</h2>
            <p className="scan-copy">
              Cuando quieras guardar tus escaneos, comparar resultados o subir imagenes al
              bucket privado, puedes entrar con tu email desde esta misma pantalla.
            </p>
            <button className="button button-secondary" type="button" onClick={() => setGuestMode(false)}>
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
              <button className="button button-secondary" type="button" onClick={handleGuestContinue}>
                Continuar como invitado
              </button>
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
