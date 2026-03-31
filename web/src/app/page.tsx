import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProductRow = {
  id: string;
  name: string;
  category: string;
  origin_status: string | null;
  confidence_level: string | null;
  calories: number | null;
};

export const dynamic = "force-dynamic";

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

export default async function Home() {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("product_summary")
    .select("id, name, category, origin_status, confidence_level, calories")
    .order("name", { ascending: true })
    .limit(6);

  const products = (data ?? []) as ProductRow[];

  return (
    <main className="home-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Mercados locales · Orgullo mexicano · Compra con confianza</p>
          <h1>Descubre lo que nace aqui y apoya lo Hecho en Mexico.</h1>
          <p className="hero-text">
            MadeinM ayuda a identificar productos del mercado por foto, codigo o busqueda,
            mostrando origen, confianza, nutricion y recetas para impulsar el consumo local
            con informacion honesta.
          </p>

          <div className="hero-actions">
            <Link className="button button-primary" href="/scan">
              Probar escaneo
            </Link>
            <Link className="button button-secondary" href="#como-funciona">
              Como funciona
            </Link>
          </div>

          <div className="hero-points">
            <div>
              <strong>CDMX piloto</strong>
              <span>Central de Abasto</span>
            </div>
            <div>
              <strong>Fase 1</strong>
              <span>Foto + barcode + confianza</span>
            </div>
            <div>
              <strong>Principio clave</strong>
              <span>Nunca fingir informacion</span>
            </div>
          </div>
        </div>

        <div className="hero-panel">
          <div className="hero-panel-card">
            <span className="panel-label">Escaneo inteligente</span>
            <h2>Foto, origen y contexto</h2>
            <p>
              El sistema combina imagen, texto visible, productos curados y reglas de
              confianza para ayudarte a decidir con claridad.
            </p>

            <ul className="feature-list">
              <li>Clasificacion de origen con evidencia</li>
              <li>Recetas y calorias por producto</li>
              <li>Comparacion inicial con supermercado</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mission-band">
        <div>
          <span className="band-label">Mision</span>
          <p>
            Fortalecer la identidad de consumo local para que mas personas compren con
            orgullo lo producido en Mexico.
          </p>
        </div>
        <div>
          <span className="band-label">Confianza</span>
          <p>
            Cada resultado debe explicar por que el sistema cree algo y cuando no tiene
            certeza suficiente.
          </p>
        </div>
        <div>
          <span className="band-label">Expansion</span>
          <p>
            Empezamos con CDMX y crecemos hacia Estado de Mexico, Morelos, Michoacan y
            otros mercados regionales.
          </p>
        </div>
      </section>

      <section className="how-it-works" id="como-funciona">
        <div className="section-heading">
          <p className="eyebrow">Como funciona</p>
          <h2>Una experiencia pensada para mercado, cocina y decision diaria.</h2>
        </div>

        <div className="steps-grid">
          <article>
            <span>01</span>
            <h3>Escanea o sube una foto</h3>
            <p>
              Toma una foto del producto, busca por nombre o usa codigo de barras cuando
              exista.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Ve origen y confianza</h3>
            <p>
              El resultado muestra si el producto es hecho, producido, empacado en Mexico
              o si el origen no esta confirmado.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Decide mejor y regresa</h3>
            <p>
              Consulta calorias, recetas, precios de referencia y gana puntos por apoyar
              el mercado local.
            </p>
          </article>
        </div>
      </section>

      <section className="catalog-section" id="catalogo">
        <div className="section-heading">
          <p className="eyebrow">Catalogo piloto</p>
          <h2>Primeros productos curados del piloto en Central de Abasto CDMX.</h2>
        </div>

        {error ? (
          <div className="error-card">
            <h3>No pudimos cargar el catalogo</h3>
            <p>
              La pagina sigue lista, pero la consulta en Supabase no respondio en este
              momento.
            </p>
            <pre>{error.message}</pre>
          </div>
        ) : (
          <div className="catalog-grid">
            {products.map((product) => (
              <article key={product.id} className="product-card">
                <div className="product-topline">
                  <span>{product.category}</span>
                  <span>
                    {confidenceLabels[product.confidence_level ?? ""] ?? "Sin confianza"}
                  </span>
                </div>
                <h3>{product.name}</h3>
                <p className="product-origin">
                  {statusLabels[product.origin_status ?? ""] ?? "Origen no confirmado"}
                </p>
                <p className="product-meta">
                  {product.calories ? `${product.calories} kcal por 100 g` : "Calorias por confirmar"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="future-section">
        <div className="future-copy">
          <p className="eyebrow">Lo que sigue</p>
          <h2>La base ya esta lista para construir el flujo real de escaneo.</h2>
          <p>
            El backend ya cuenta con esquema, seguridad, almacenamiento y politica de
            confianza. El siguiente paso es conectar la experiencia de foto, subida y
            resultados.
          </p>
        </div>

        <div className="future-checklist">
          <div>Home con marca</div>
          <div>Catalogo conectado</div>
          <div>Supabase protegido</div>
          <div>Storage configurado</div>
          <div>Escaneo visual activo</div>
        </div>
      </section>
    </main>
  );
}
