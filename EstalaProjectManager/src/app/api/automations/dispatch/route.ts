import { NextResponse } from "next/server";
import { isAuthenticatedRequest, unauthorizedJson } from "@/server/auth";
import {
  dispatchAutomationEvent,
  type AutomationEventPayload,
} from "@/lib/n8n";

export async function POST(request: Request) {
  if (!(await isAuthenticatedRequest(request))) {
    return unauthorizedJson();
  }

  let payload: AutomationEventPayload;

  try {
    payload = (await request.json()) as AutomationEventPayload;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  if (!payload?.project?.id || !payload?.task?.id || !payload?.eventType) {
    return NextResponse.json(
      {
        ok: false,
        message: "Expected eventType, project, and task fields.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await dispatchAutomationEvent(payload);

    return NextResponse.json(
      {
        ok: result.ok,
        configured: result.configured,
        status: result.status,
        workflowResponse: result.workflowResponse,
      },
      {
        status: result.ok ? 200 : Math.max(result.status, 400),
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach n8n.";

    return NextResponse.json(
      { ok: false, configured: true, message },
      { status: 502 },
    );
  }
}
