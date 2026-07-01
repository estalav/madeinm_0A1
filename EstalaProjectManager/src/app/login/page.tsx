import { LoginForm } from "@/components/login-form";
import { isAuthConfigured, isAuthenticatedCookieStore } from "@/server/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  if (!isAuthConfigured()) {
    redirect("/");
  }

  const cookieStore = await cookies();

  if (await isAuthenticatedCookieStore(cookieStore)) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7efe2_0%,#fdfaf5_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-md rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-8 shadow-[var(--shadow-lg)]">
        <p className="text-xs uppercase tracking-[0.24em] text-teal-800/75">
          Estala PM
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          Sign in to the workspace
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">
          Enter your configured username and password to open the protected
          project manager.
        </p>
        <LoginForm />
        <p className="mt-4 text-xs text-slate-500">
          Credentials are configured through environment variables. If access
          is not working, check your local auth settings.
        </p>
      </div>
    </main>
  );
}
