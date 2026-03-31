import { ScanResult } from "./scan-result";

export const dynamic = "force-dynamic";

export default async function ScanResultPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;

  return (
    <main className="scan-page">
      <ScanResult scanId={scanId} />
    </main>
  );
}
