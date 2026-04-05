import type { Metadata } from "next";
import Link from "next/link";
import packageJson from "../../package.json";
import "./globals.css";

export const metadata: Metadata = {
  title: "MadeinM",
  description: "Hecho Aqui pilot app for discovering Mexican products.",
};

const appVersion = packageJson.version;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX">
      <body>
        <div className="site-shell">
          <header className="site-header">
            <div className="site-header-inner">
              <Link className="site-brand" href="/">
                <span>MadeinM</span>
                <small>madeinm.estala.io</small>
              </Link>

              <nav className="site-menu" aria-label="Primary">
                <Link href="/">Home</Link>
                <Link href="/catalog">Catalog</Link>
                <Link href="/scan">Scan</Link>
                <Link href="/admin">Admin</Link>
              </nav>
            </div>
          </header>

          <div className="site-main">{children}</div>

          <footer className="site-footer">
            <div className="site-footer-inner">
              <div>
                <strong>MadeinM</strong>
                <p>
                  Powered by estala.io. All rights reserved in Mexico and the United States.
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
                <p>Pilot v{appVersion}</p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
