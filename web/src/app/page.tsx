import Link from "next/link";
import { headers } from "next/headers";
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

const isMadeinmHost = (host: string) => host.startsWith("madeinm.");

function EstalaHub() {
  return (
    <main className="estala-home">
      <section className="estala-hero estala-hero-background">
        <div className="estala-copy estala-copy-panel">
          <p className="estala-kicker">Welcome to Estala</p>
          <h1>
            The central home for
            <br />
            <span>products and projects</span>
          </h1>
          <p className="estala-intro">
            Estala connects our tools and work across product management and digital
            craftsmanship. One hub. Focused on building with clarity and care.
          </p>

          <div className="estala-actions">
            <a className="button button-primary" href="https://pm.estala.io">
              Open Project Manager
            </a>
            <a className="button button-secondary" href="https://madeinm.estala.io">
              Open MadeinM
            </a>
            <a className="button button-secondary" href="https://events.estala.io">
              Open Event Followers
            </a>
          </div>

          <div className="estala-explore-row">
            <span className="estala-explore-icon" aria-hidden="true">
              ◌
            </span>
            <p>
              Explore <a href="https://estala.com">estala.com</a> for art and visual work
            </p>
          </div>
        </div>
      </section>

      <section className="estala-projects">
        <article className="estala-project-card estala-project-card-dark">
          <div className="estala-project-icon">◫</div>
          <div className="estala-project-copy">
            <span>Project Manager</span>
            <h2>Estala Project Manager</h2>
            <p>
              Collaborative planning workspace for projects, tasks, and teams.
            </p>
          </div>
          <div className="estala-preview-grid estala-preview-grid-board" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <a className="estala-card-link" href="https://pm.estala.io">
            Open Project Manager
          </a>
        </article>

        <article className="estala-project-card estala-project-card-dark">
          <div className="estala-project-icon estala-project-icon-letter">M</div>
          <div className="estala-project-copy">
            <span>MadeinM</span>
            <h2>MadeinM</h2>
            <p>Tools and resources for building and scaling products.</p>
          </div>
          <div className="estala-preview-grid estala-preview-grid-chart" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <a className="estala-card-link" href="https://madeinm.estala.io">
            Open MadeinM
          </a>
        </article>

        <article className="estala-project-card estala-project-card-dark">
          <div className="estala-project-icon">◌</div>
          <div className="estala-project-copy">
            <span>Events</span>
            <h2>Event Followers</h2>
            <p>
              Event kiosk, live mosaic, and admin tools for capturing audience moments.
            </p>
          </div>
          <div className="estala-preview-grid estala-preview-grid-board" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <a className="estala-card-link" href="https://events.estala.io">
            Open Event Followers
          </a>
        </article>
      </section>

      <section className="estala-roadmap">
        <p className="estala-kicker">Domain structure</p>
        <div className="estala-roadmap-grid">
          <article>
            <strong>estala.io</strong>
            <p>This is the central hub that connects our products and projects.</p>
          </article>
          <article>
            <strong>pm.estala.io</strong>
            <p>Estala Project Manager lives here. Built for collaborative planning.</p>
          </article>
          <article>
            <strong>madeinm.estala.io</strong>
            <p>MadeinM is our resource hub for building and scaling products.</p>
          </article>
          <article>
            <strong>events.estala.io</strong>
            <p>Event Followers handles kiosk capture, live displays, and event operations.</p>
          </article>
        </div>
        <p className="estala-roadmap-footer">
          Art and visual work live on <a href="https://estala.com">estala.com</a>
        </p>
      </section>
    </main>
  );
}

type MadeinMHomeProps = {
  products: ProductRow[];
  errorMessage: string | null;
};

function MadeinMHome({ products, errorMessage }: MadeinMHomeProps) {
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
            <Link className="button button-secondary" href="/catalog">
              Ver catalogo
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

        {errorMessage ? (
          <div className="error-card">
            <h3>No pudimos cargar el catalogo</h3>
            <p>
              La pagina sigue lista, pero la consulta en Supabase no respondio en este
              momento.
            </p>
            <pre>{errorMessage}</pre>
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

export default async function Home() {
  const host = (await headers()).get("host") ?? "";

  if (!isMadeinmHost(host)) {
    return <EstalaHub />;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_summary")
    .select("id, name, category, origin_status, confidence_level, calories")
    .order("name", { ascending: true })
    .limit(6);

  const products = (data ?? []) as ProductRow[];

  return <MadeinMHome products={products} errorMessage={error?.message ?? null} />;
}
