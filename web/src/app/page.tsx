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

export default async function Home() {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("product_summary")
    .select("id, name, category, origin_status, confidence_level, calories")
    .order("name", { ascending: true })
    .limit(6);

  const products = (data ?? []) as ProductRow[];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "56px 24px",
        background:
          "linear-gradient(180deg, #f6efe1 0%, #fffaf1 42%, #f3f8ec 100%)",
        color: "#1f2a1f",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          display: "grid",
          gap: 28,
        }}
      >
        <section
          style={{
            padding: 28,
            borderRadius: 24,
            background: "rgba(255,255,255,0.78)",
            border: "1px solid rgba(91, 110, 60, 0.15)",
            boxShadow: "0 12px 40px rgba(77, 64, 36, 0.08)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 14,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#7b3f00",
            }}
          >
            MadeinM pilot
          </p>
          <h1 style={{ margin: "12px 0 10px", fontSize: "2.6rem", lineHeight: 1.1 }}>
            Supabase connection check
          </h1>
          <p style={{ margin: 0, maxWidth: 680, fontSize: "1.05rem", lineHeight: 1.7 }}>
            This page is already querying your Supabase project and reading from the
            seeded <code>product_summary</code> view.
          </p>
        </section>

        <section
          style={{
            padding: 28,
            borderRadius: 24,
            background: "#fff",
            border: "1px solid rgba(91, 110, 60, 0.15)",
            boxShadow: "0 12px 40px rgba(77, 64, 36, 0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Starter products</h2>
              <p style={{ margin: "8px 0 0", color: "#4f5d44" }}>
                If this list renders, the project URL and anon key are working.
              </p>
            </div>
            <div
              style={{
                alignSelf: "start",
                padding: "8px 12px",
                borderRadius: 999,
                background: error ? "#fde7e7" : "#e8f3de",
                color: error ? "#972d2d" : "#2c5a1f",
                fontWeight: 600,
              }}
            >
              {error ? "Connection issue" : "Connected"}
            </div>
          </div>

          {error ? (
            <pre
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 16,
                background: "#fff6f6",
                color: "#8b1e1e",
                overflowX: "auto",
              }}
            >
              {error.message}
            </pre>
          ) : (
            <div
              style={{
                marginTop: 20,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {products.map((product) => (
                <article
                  key={product.id}
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    background: "#fcfbf7",
                    border: "1px solid rgba(123, 63, 0, 0.12)",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#6d7b4b",
                    }}
                  >
                    {product.category}
                  </p>
                  <h3 style={{ margin: "10px 0 8px", fontSize: "1.15rem" }}>
                    {product.name}
                  </h3>
                  <p style={{ margin: 0, color: "#4b4b4b" }}>
                    Origin: {product.origin_status ?? "unknown"}
                  </p>
                  <p style={{ margin: "6px 0 0", color: "#4b4b4b" }}>
                    Confidence: {product.confidence_level ?? "unknown"}
                  </p>
                  <p style={{ margin: "6px 0 0", color: "#4b4b4b" }}>
                    Calories: {product.calories ?? "n/a"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
