"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type DraftRow = {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  brand_name: string | null;
  description: string | null;
  status: string;
  created_at: string;
  product_aliases?: Array<{ alias: string }>;
  origins?: Array<{
    id: string;
    origin_status: string;
    confidence_level: string;
    summary_reason: string | null;
    country_code: string | null;
  }>;
};

type AdminConsoleProps = {
  initialDrafts: DraftRow[];
};

const originOptions = [
  "no_confirmado",
  "producido_en_mexico",
  "hecho_en_mexico",
  "empacado_en_mexico",
  "importado",
] as const;

const confidenceOptions = ["verificado", "alta", "media", "baja"] as const;

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminConsole({ initialDrafts }: AdminConsoleProps) {
  const [adminKey, setAdminKey] = useState("");
  const [drafts, setDrafts] = useState<DraftRow[]>(initialDrafts);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(initialDrafts[0]?.id ?? null);
  const [originStatus, setOriginStatus] = useState<string>("no_confirmado");
  const [confidenceLevel, setConfidenceLevel] = useState<string>("media");
  const [countryCode, setCountryCode] = useState("");
  const [summaryReason, setSummaryReason] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const savedKey = window.localStorage.getItem("madeinm_admin_key");

    if (savedKey) {
      setAdminKey(savedKey);
    }
  }, []);

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraftId) ?? null,
    [drafts, selectedDraftId],
  );

  useEffect(() => {
    if (!selectedDraft) {
      return;
    }

    const origin = selectedDraft.origins?.[0];
    setOriginStatus(origin?.origin_status ?? "no_confirmado");
    setConfidenceLevel(origin?.confidence_level ?? "media");
    setCountryCode(origin?.country_code ?? "");
    setSummaryReason(origin?.summary_reason ?? "");
    setReviewNote("");
  }, [selectedDraft]);

  async function handleLoadDrafts() {
    setStatusMessage(null);
    setStatusError(null);

    if (!adminKey.trim()) {
      setStatusError("Enter the admin review key first.");
      return;
    }

    startTransition(async () => {
      window.localStorage.setItem("madeinm_admin_key", adminKey.trim());

      const response = await fetch("/api/admin/drafts", {
        headers: {
          "x-admin-key": adminKey.trim(),
        },
      });

      const payload = (await response.json()) as {
        error?: string;
        drafts?: DraftRow[];
      };

      if (!response.ok) {
        setStatusError(payload.error ?? "Could not load draft products.");
        return;
      }

      setDrafts(payload.drafts ?? []);
      setSelectedDraftId(payload.drafts?.[0]?.id ?? null);
      setStatusMessage(`Loaded ${payload.drafts?.length ?? 0} draft products.`);
    });
  }

  async function handleReview(decision: "approve" | "archive") {
    if (!selectedDraft) {
      setStatusError("Select a draft product first.");
      return;
    }

    if (!adminKey.trim()) {
      setStatusError("Enter the admin review key first.");
      return;
    }

    setStatusMessage(null);
    setStatusError(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey.trim(),
        },
        body: JSON.stringify({
          productId: selectedDraft.id,
          decision,
          originStatus,
          confidenceLevel,
          countryCode: countryCode || null,
          summaryReason,
          reviewNote,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        success?: boolean;
      };

      if (!response.ok) {
        setStatusError(payload.error ?? "Could not submit the admin review.");
        return;
      }

      setDrafts((current) => current.filter((draft) => draft.id !== selectedDraft.id));
      setSelectedDraftId((current) => {
        if (current !== selectedDraft.id) {
          return current;
        }

        const remaining = drafts.filter((draft) => draft.id !== selectedDraft.id);
        return remaining[0]?.id ?? null;
      });

      setStatusMessage(
        decision === "approve"
          ? `${selectedDraft.name} was approved and activated.`
          : `${selectedDraft.name} was archived.`,
      );
    });
  }

  return (
    <div className="admin-shell">
      <section className="scan-hero">
        <div>
          <p className="eyebrow">Admin review</p>
          <h1>Review AI-created draft products before they go live.</h1>
          <p className="scan-copy">
            This screen is for approving or archiving draft products created from AI-assisted
            recognition. Identity can be suggested by AI, but origin stays under human review.
          </p>
        </div>

        <div className="scan-highlight">
          <strong>Security</strong>
          <span>Requires your private admin review key</span>
          <span>All writes still happen server-side through the service role</span>
        </div>
      </section>

      <div className="admin-grid">
        <section className="scan-card">
          <h2>Access</h2>
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

            <button
              className="button button-primary"
              type="button"
              onClick={handleLoadDrafts}
              disabled={isPending}
            >
              {isPending ? "Loading..." : "Load draft products"}
            </button>
          </div>

          {statusMessage ? <p className="status-ok">{statusMessage}</p> : null}
          {statusError ? <p className="status-error">{statusError}</p> : null}

          <div className="recent-list">
            {drafts.length === 0 ? (
              <div className="recent-item">
                <strong>No drafts available</strong>
                <span>Once AI creates new draft products, they will show up here.</span>
              </div>
            ) : (
              drafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  className={`recent-item admin-draft-button${selectedDraftId === draft.id ? " admin-draft-active" : ""}`}
                  onClick={() => setSelectedDraftId(draft.id)}
                >
                  <strong>{draft.name}</strong>
                  <span>{draft.category}{draft.subcategory ? ` · ${draft.subcategory}` : ""}</span>
                  <small>{formatTimestamp(draft.created_at)}</small>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="scan-card">
          <h2>Review draft</h2>

          {selectedDraft ? (
            <>
              <div className="trust-card">
                <p className="eyebrow">Draft details</p>
                <h3>{selectedDraft.name}</h3>
                <p className="scan-copy">
                  {selectedDraft.description || "No description available yet."}
                </p>
                <div className="trust-facts">
                  <span>{selectedDraft.category}</span>
                  <span>{selectedDraft.subcategory || "No subcategory"}</span>
                  <span>{selectedDraft.brand_name || "No brand"}</span>
                </div>
                <div className="admin-aliases">
                  {(selectedDraft.product_aliases ?? []).map((alias) => (
                    <span key={alias.alias}>{alias.alias}</span>
                  ))}
                </div>
              </div>

              <div className="scan-form">
                <label className="field">
                  <span>Origin status</span>
                  <select value={originStatus} onChange={(event) => setOriginStatus(event.target.value)}>
                    {originOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Confidence</span>
                  <select
                    value={confidenceLevel}
                    onChange={(event) => setConfidenceLevel(event.target.value)}
                  >
                    {confidenceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Country code</span>
                  <input
                    type="text"
                    value={countryCode}
                    onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
                    placeholder="Example: MX"
                  />
                </label>

                <label className="field">
                  <span>Summary reason</span>
                  <textarea
                    rows={4}
                    value={summaryReason}
                    onChange={(event) => setSummaryReason(event.target.value)}
                    placeholder="Why should this product be approved and how certain is its origin?"
                  />
                </label>

                <label className="field">
                  <span>Review note</span>
                  <textarea
                    rows={3}
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Optional internal note for the audit trail"
                  />
                </label>

                <div className="admin-actions">
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => handleReview("approve")}
                    disabled={isPending}
                  >
                    {isPending ? "Saving..." : "Approve and activate"}
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => handleReview("archive")}
                    disabled={isPending}
                  >
                    {isPending ? "Saving..." : "Archive draft"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="scan-copy">Select a draft product from the list to review it.</p>
          )}
        </section>
      </div>
    </div>
  );
}
