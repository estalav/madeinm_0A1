import Link from "next/link";
import { ScanExperience } from "./scan-experience";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Escanear | MadeinM",
  description: "Sube fotos y crea registros de clasificacion para el piloto MadeinM.",
};

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialGuestMode = resolvedSearchParams.mode === "guest";

  return (
    <main className="scan-page">
      <div className="scan-nav">
        <Link href="/">Volver al inicio</Link>
      </div>
      <ScanExperience initialGuestMode={initialGuestMode} />
    </main>
  );
}
