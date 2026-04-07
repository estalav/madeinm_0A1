import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import packageJson from "../../package.json";
import "./globals.css";

const isMadeinmHost = (host: string) => host.startsWith("madeinm.");

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host") ?? "";

  if (isMadeinmHost(host)) {
    return {
      title: "MadeinM",
      description: "Hecho Aqui pilot app for discovering Mexican products.",
    };
  }

  return {
    title: "Estala",
    description: "A home for independent projects, images, and product experiments.",
  };
}

const appVersion = packageJson.version;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = (await headers()).get("host") ?? "";
  const madeinmHost = isMadeinmHost(host);

  return (
    <html lang="es-MX">
      <body>
        <div className={`site-shell${madeinmHost ? "" : " estala-site-shell"}`}>
          <header className="site-header">
            <div className="site-header-inner">
              <Link className="site-brand" href="/">
                <span>{madeinmHost ? "MadeinM" : "Estala"}</span>
                <small>{madeinmHost ? "madeinm.estala.io" : "estala.io"}</small>
              </Link>

              <nav className="site-menu" aria-label="Primary">
                {madeinmHost ? (
                  <>
                    <Link href="/">Home</Link>
                    <Link href="/catalog">Catalog</Link>
                    <Link href="/scan">Scan</Link>
                    <Link href="/admin">Admin</Link>
                  </>
                ) : (
                  <>
                    <Link href="/">Home</Link>
                    <Link href="/art">Art</Link>
                    <a href="https://madeinm.estala.io">MadeinM</a>
                  </>
                )}
              </nav>
            </div>
          </header>

          <div className="site-main">{children}</div>

          <footer className="site-footer">
            <div className="site-footer-inner">
              <div>
                <strong>{madeinmHost ? "MadeinM" : "Estala"}</strong>
                <p>
                  Powered by estala.com. All rights reserved in Mexico and the United States.
                </p>
              </div>

              <div>
                <strong>IP Notice</strong>
                <p>
                  Third-party trademarks, market data, retailer names, and external product
                  references remain the property of their respective owners. Official product
                  origin remains subject to evidence and review.
                </p>
              </div>

              <div>
                <strong>Version</strong>
                <p>{madeinmHost ? `Pilot v${appVersion}` : `Hub v${appVersion}`}</p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
