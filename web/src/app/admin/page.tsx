import Link from "next/link";
import { AdminConsole } from "./admin-console";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin | MadeinM",
  description: "Review AI-created draft products before they become public.",
};

export default function AdminPage() {
  return (
    <main className="scan-page">
      <div className="scan-nav">
        <Link href="/">Volver al inicio</Link>
      </div>
      <AdminConsole initialDrafts={[]} />
    </main>
  );
}
