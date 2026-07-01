"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = searchParams.get("redirect") || "/";

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, password }),
          });

          const result = (await response.json()) as { ok?: boolean; message?: string };

          if (!response.ok || !result.ok) {
            setError(result.message || "Login failed.");
            return;
          }

          router.push(redirectTo);
          router.refresh();
        } catch {
          setError("Unable to reach the login service.");
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <label className="block space-y-2 text-sm text-slate-700">
        <span className="font-medium text-slate-900">Username</span>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
          autoComplete="username"
          required
        />
      </label>

      <label className="block space-y-2 text-sm text-slate-700">
        <span className="font-medium text-slate-900">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-[16px] border border-[var(--line)] bg-white px-4 py-3 outline-none ring-0"
          autoComplete="current-password"
          required
        />
      </label>

      {error ? (
        <div className="rounded-[16px] bg-orange-50 px-4 py-3 text-sm text-orange-900">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-[#17313c] px-5 py-3 text-sm font-semibold text-[#f8f1e6] disabled:cursor-wait disabled:opacity-70"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
