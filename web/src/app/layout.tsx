import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MadeinM",
  description: "Hecho Aqui pilot app for discovering Mexican products.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
