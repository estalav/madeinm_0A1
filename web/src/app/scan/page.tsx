import Link from "next/link";
import { ScanExperience } from "./scan-experience";

export const metadata = {
  title: "Escanear | MadeinM",
  description: "Sube fotos y crea registros de clasificacion para el piloto MadeinM.",
};

export default function ScanPage() {
  return (
    <main className="scan-page">
      <div className="scan-nav">
        <Link href="/">Volver al inicio</Link>
      </div>
      <ScanExperience />
    </main>
  );
}
