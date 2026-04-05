import Link from "next/link";
import { AdminUsageConsole } from "./usage-console";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Usage | MadeinM",
  description: "Inspect AI usage, token totals, and recent recognition requests.",
};

export default function AdminUsagePage() {
  return (
    <main className="scan-page">
      <div className="scan-nav">
        <Link href="/admin">Back to admin</Link>
      </div>
      <AdminUsageConsole />
    </main>
  );
}
