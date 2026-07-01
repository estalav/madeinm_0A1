import { NextResponse } from "next/server";
import { deleteWorkspaceMember } from "@/server/member-store";
import { isAuthenticatedRequest, unauthorizedJson } from "@/server/auth";

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/admin/members/[memberId]">,
) {
  if (!(await isAuthenticatedRequest(request))) {
    return unauthorizedJson();
  }

  const { memberId } = await context.params;

  try {
    await deleteWorkspaceMember(memberId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to remove workspace member.",
      },
      { status: 500 },
    );
  }
}
