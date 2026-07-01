export type AutomationTask = {
  id: string;
  title: string;
  owner: string;
  due: string;
  status: string;
  priority: string;
  lane: string;
  summary: string;
};

export type AutomationProject = {
  id: string;
  name: string;
  client: string;
  phase: string;
  health: string;
  progress: number;
};

export type AutomationEventPayload = {
  eventType: "task.selected" | "task.status_changed" | "task.sent_to_n8n";
  source: "estala-project-manager";
  occurredAt: string;
  project: AutomationProject;
  task: AutomationTask;
};

export type N8nDispatchResult = {
  ok: boolean;
  configured: boolean;
  status: number;
  workflowResponse: unknown;
};

const LOCAL_N8N_WEBHOOK_URL = "http://localhost:5678/webhook/estala-project-events";

export function getN8nWebhookUrl() {
  return process.env.N8N_WEBHOOK_URL?.trim() || LOCAL_N8N_WEBHOOK_URL;
}

export function getN8nCallbackSecret() {
  return process.env.N8N_CALLBACK_SECRET?.trim() || "";
}

export function isN8nConfigured() {
  return Boolean(getN8nWebhookUrl());
}

export async function dispatchAutomationEvent(
  payload: AutomationEventPayload,
): Promise<N8nDispatchResult> {
  const webhookUrl = getN8nWebhookUrl();

  if (!webhookUrl) {
    return {
      ok: false,
      configured: false,
      status: 503,
      workflowResponse: {
        message: "Missing N8N_WEBHOOK_URL configuration.",
      },
    };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-estala-source": "estala-project-manager",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const workflowResponse = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return {
    ok: response.ok,
    configured: true,
    status: response.status,
    workflowResponse,
  };
}

export function isValidCallbackSecret(requestSecret: string | null) {
  const configuredSecret = getN8nCallbackSecret();

  if (!configuredSecret) {
    return true;
  }

  return requestSecret === configuredSecret;
}
