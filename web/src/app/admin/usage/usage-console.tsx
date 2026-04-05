"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

type UsageSummary = {
  requests: number;
  successes: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type UsageRow = {
  id: string;
  created_at: string;
  provider: string;
  model: string;
  route: string;
  request_kind: string;
  success: boolean;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  image_count: number | null;
  catalog_candidates: number | null;
  barcode_value: string | null;
  visual_guess: string | null;
  matched_product_name: string | null;
  error_message: string | null;
};

type UsageResponse = {
  error?: string;
  since?: string;
  summary?: UsageSummary;
  logs?: UsageRow[];
};

const usageWindows = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

export function AdminUsageConsole() {
  const [adminKey, setAdminKey] = useState("");
  const [selectedWindow, setSelectedWindow] = useState<(typeof usageWindows)[number]["value"]>("7d");
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [logs, setLogs] = useState<UsageRow[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const savedKey = window.localStorage.getItem("madeinm_admin_key");

    if (savedKey) {
      setAdminKey(savedKey);
    }
  }, []);

  const providerCounts = useMemo(() => {
    return logs.reduce<Record<string, number>>((counts, row) => {
      counts[row.provider] = (counts[row.provider] ?? 0) + 1;
      return counts;
    }, {});
  }, [logs]);

  function handleLoadUsage() {
    setStatusMessage(null);
    setStatusError(null);

    if (!adminKey.trim()) {
      setStatusError("Enter the admin review key first.");
      return;
    }

    startTransition(async () => {
      window.localStorage.setItem("madeinm_admin_key", adminKey.trim());

      const response = await fetch(`/api/admin/usage?since=${selectedWindow}`, {
        headers: {
          "x-admin-key": adminKey.trim(),
        },
      });

      const payload = (await response.json()) as UsageResponse;

      if (!response.ok) {
        setStatusError(payload.error ?? "Could not load AI usage.");
        return;
      }

      setSummary(payload.summary ?? null);
      setLogs(payload.logs ?? []);
      setStatusMessage(
        `Loaded ${payload.logs?.length ?? 0} AI usage log entries for ${selectedWindow}.`,
      );
    });
  }

  return (
    <div className="admin-shell">
      <section className="scan-hero">
        <div>
          <p className="eyebrow">Admin usage</p>
          <h1>Track AI requests, token totals, and recent recognizer activity.</h1>
          <p className="scan-copy">
            This view reads from <code>ai_usage_logs</code> in Supabase so you can see
            what the OpenAI dashboard may delay or hide.
          </p>
        </div>

        <div className="scan-highlight">
          <strong>What you can inspect</strong>
          <span>Requests, successes, and failures</span>
          <span>Input, output, and total tokens when available</span>
          <span>Matched products, visual guesses, and recent errors</span>
        </div>
      </section>

      <div className="admin-grid">
        <section className="scan-card">
          <h2>Load usage</h2>
          <div className="scan-form">
            <label className="field">
              <span>Admin review key</span>
              <input
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                placeholder="Enter the private admin key"
              />
            </label>

            <label className="field">
              <span>Time window</span>
              <select
                value={selectedWindow}
                onChange={(event) =>
                  setSelectedWindow(event.target.value as (typeof usageWindows)[number]["value"])
                }
              >
                {usageWindows.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="admin-actions">
              <button
                className="button button-primary"
                type="button"
                onClick={handleLoadUsage}
                disabled={isPending}
              >
                {isPending ? "Loading..." : "Load AI usage"}
              </button>

              <Link className="button button-secondary" href="/admin">
                Back to drafts
              </Link>
            </div>

            {statusMessage ? <p className="status-ok">{statusMessage}</p> : null}
            {statusError ? <p className="status-error">{statusError}</p> : null}

            {summary ? (
              <div className="trust-card">
                <p className="eyebrow">Summary</p>
                <div className="trust-facts">
                  <span>{formatNumber(summary.requests)} requests</span>
                  <span>{formatNumber(summary.successes)} successes</span>
                  <span>{formatNumber(summary.failures)} failures</span>
                  <span>{formatNumber(summary.inputTokens)} input tokens</span>
                  <span>{formatNumber(summary.outputTokens)} output tokens</span>
                  <span>{formatNumber(summary.totalTokens)} total tokens</span>
                </div>
              </div>
            ) : null}

            {Object.keys(providerCounts).length > 0 ? (
              <div className="trust-card">
                <p className="eyebrow">Providers</p>
                <div className="admin-aliases">
                  {Object.entries(providerCounts).map(([provider, count]) => (
                    <span key={provider}>
                      {provider}: {count}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="scan-card">
          <h2>Recent requests</h2>
          {logs.length === 0 ? (
            <div className="recent-item">
              <strong>No usage rows loaded yet</strong>
              <span>Load AI usage to inspect recent recognizer activity.</span>
            </div>
          ) : (
            <div className="recent-list">
              {logs.map((row) => (
                <div key={row.id} className="recent-item">
                  <strong>
                    {row.matched_product_name || row.visual_guess || "No match"}
                    {row.success ? "" : " · failed"}
                  </strong>
                  <span>
                    {row.request_kind} · {row.model} · {formatTimestamp(row.created_at)}
                  </span>
                  <small>
                    in {formatNumber(row.input_tokens)} · out {formatNumber(row.output_tokens)} · total{" "}
                    {formatNumber(row.total_tokens)}
                  </small>
                  <small>
                    images {formatNumber(row.image_count)} · candidates {formatNumber(row.catalog_candidates)}
                  </small>
                  {row.barcode_value ? <small>barcode {row.barcode_value}</small> : null}
                  {row.error_message ? <small>{row.error_message}</small> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
