import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CatalogProduct = {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  brand_name: string | null;
  description: string | null;
  default_image_url: string | null;
  product_aliases?: Array<{ alias: string }>;
  product_images?: Array<{
    image_url: string;
    is_primary: boolean | null;
    source_type: string | null;
  }>;
  origins?: Array<{
    origin_status: string;
    confidence_level: string;
    summary_reason: string | null;
    country_code: string | null;
    state_name: string | null;
  }>;
};

type MapMarker = {
  label: string;
  stateName: string;
  top: string;
  left: string;
  count: number;
  products: string[];
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

const mexicoStatePositions: Record<string, { top: string; left: string; label?: string }> = {
  "Estado de Mexico": { top: "52%", left: "48%", label: "Edo. Mex." },
  Colima: { top: "56%", left: "34%" },
  Michoacan: { top: "54%", left: "40%" },
  Veracruz: { top: "47%", left: "62%" },
  Chiapas: { top: "66%", left: "74%" },
};

function getReferenceImages(product: CatalogProduct) {
  const gallery = [...(product.product_images ?? [])].sort((left, right) => {
    if (left.is_primary === right.is_primary) {
      return 0;
    }

    return left.is_primary ? -1 : 1;
  });

  if (gallery.length > 0) {
    return gallery;
  }

  if (product.default_image_url) {
    return [
      {
        image_url: product.default_image_url,
        is_primary: true,
        source_type: "default",
      },
    ];
  }

  return [];
}

export default async function CatalogPage() {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, category, subcategory, brand_name, description, default_image_url, product_aliases(alias), product_images(image_url, is_primary, source_type), origins(origin_status, confidence_level, summary_reason, country_code, state_name)",
    )
    .eq("status", "active")
    .order("name", { ascending: true });

  const products = ((data ?? []) as CatalogProduct[]).map((product) => ({
    ...product,
    product_images: getReferenceImages(product),
  }));

  const originMarkers = products.reduce<MapMarker[]>((markers, product) => {
    const origin = product.origins?.[0];
    const stateName = origin?.state_name;

    if (!stateName) {
      return markers;
    }

    const position = mexicoStatePositions[stateName];

    if (!position) {
      return markers;
    }

    const existing = markers.find((marker) => marker.stateName === stateName);

    if (existing) {
      existing.count += 1;
      existing.products.push(product.name);
      return markers;
    }

    markers.push({
      label: position.label ?? stateName,
      stateName,
      top: position.top,
      left: position.left,
      count: 1,
      products: [product.name],
    });

    return markers;
  }, []);

  const pendingOrigins = products.filter((product) => !product.origins?.[0]?.state_name);

  return (
    <main className="scan-page">
      <nav className="scan-nav">
        <Link href="/">Volver al inicio</Link>
      </nav>

      <div className="scan-shell">
        <section className="scan-hero">
          <div>
            <p className="eyebrow">Catalogo vivo</p>
            <h1>Browse the pilot catalog and the reference photos behind recognition.</h1>
            <p className="scan-copy">
              This page shows the active product catalog, aliases, trust labels, and the
              reference photos available to support AI recognition. When a product has no
              photo yet, that gap is visible here so we can improve the catalog intentionally.
            </p>
          </div>

          <div className="scan-highlight">
            <strong>What the AI uses</strong>
            <span>Curated names and aliases</span>
            <span>Origin and confidence labels</span>
            <span>Reference photos stored for each product</span>
          </div>
        </section>

        <section className="scan-card">
          <div className="catalog-header">
            <div>
              <p className="eyebrow">Origin map</p>
              <h2>Where the pilot catalog currently traces product origin</h2>
            </div>

            <Link className="button button-secondary" href="/admin">
              Review drafts
            </Link>
          </div>

          <div className="origin-map-shell">
            <div className="origin-map-canvas">
              <div className="origin-map-shape" aria-hidden="true" />

              {originMarkers.map((marker) => (
                <div
                  key={marker.stateName}
                  className="origin-map-marker"
                  style={{ top: marker.top, left: marker.left }}
                  title={`${marker.label}: ${marker.products.join(", ")}`}
                >
                  <span>{marker.count}</span>
                  <strong>{marker.label}</strong>
                </div>
              ))}
            </div>

            <div className="origin-map-legend">
              <h3>Mapped origins</h3>
              <div className="recent-list">
                {originMarkers.map((marker) => (
                  <div key={marker.stateName} className="recent-item">
                    <strong>{marker.label}</strong>
                    <span>{marker.products.join(", ")}</span>
                  </div>
                ))}

                {pendingOrigins.length > 0 ? (
                  <div className="recent-item">
                    <strong>Pending origin confirmation</strong>
                    <span>{pendingOrigins.map((product) => product.name).join(", ")}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="scan-card">
          <div className="catalog-header">
            <div>
              <p className="eyebrow">Recognition references</p>
              <h2>Active products in the pilot catalog</h2>
            </div>

            <Link className="button button-secondary" href="/scan?mode=guest">
              Test a photo
            </Link>
          </div>

          {error ? (
            <div className="error-card">
              <h3>We could not load the catalog</h3>
              <p>The page is ready, but Supabase did not return the product list just now.</p>
              <pre>{error.message}</pre>
            </div>
          ) : (
            <div className="catalog-gallery">
              {products.map((product) => {
                const origin = product.origins?.[0];
                const aliases = product.product_aliases?.map(({ alias }) => alias) ?? [];
                const images = product.product_images ?? [];

                return (
                  <article key={product.id} className="catalog-gallery-card">
                    <div className="catalog-gallery-media">
                      {images.length > 0 ? (
                        <div className="catalog-gallery-strip">
                          {images.slice(0, 3).map((image, index) => (
                            <figure key={`${product.id}-${image.image_url}-${index}`} className="catalog-reference-shot">
                              <img
                                src={image.image_url}
                                alt={`${product.name} reference ${index + 1}`}
                                loading="lazy"
                              />
                              <figcaption>
                                {image.source_type === "default" ? "Default reference" : image.source_type || "Reference photo"}
                              </figcaption>
                            </figure>
                          ))}
                        </div>
                      ) : (
                        <div className="catalog-empty-shot">
                          <strong>No reference photo yet</strong>
                          <span>This product can still match by name or alias, but it needs visual references.</span>
                        </div>
                      )}
                    </div>

                    <div className="catalog-gallery-copy">
                      <div className="product-topline">
                        <span>{product.category}{product.subcategory ? ` · ${product.subcategory}` : ""}</span>
                        <span>{confidenceLabels[origin?.confidence_level ?? ""] ?? "Sin confianza"}</span>
                      </div>

                      <h3>{product.name}</h3>
                      <p className="product-origin">
                        {statusLabels[origin?.origin_status ?? ""] ?? "Origen no confirmado"}
                      </p>

                      <p className="catalog-gallery-description">
                        {product.description || "No description available yet."}
                      </p>

                      {origin?.summary_reason ? (
                        <p className="catalog-gallery-reason">{origin.summary_reason}</p>
                      ) : null}

                      <div className="catalog-gallery-meta">
                        <span>{images.length} photo{images.length === 1 ? "" : "s"}</span>
                        <span>{product.brand_name || "No brand"}</span>
                        <span>{origin?.state_name || "State pending"}</span>
                        <span>{origin?.country_code || "Country pending"}</span>
                      </div>

                      {aliases.length > 0 ? (
                        <div className="admin-aliases">
                          {aliases.map((alias) => (
                            <span key={`${product.id}-${alias}`}>{alias}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
