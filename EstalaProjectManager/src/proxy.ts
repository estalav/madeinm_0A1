import { AUTH_LOGIN_PATH, isAuthConfigured, isAuthenticatedRequest } from "@/server/auth";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  AUTH_LOGIN_PATH,
  "/api/auth/login",
  "/api/auth/logout",
  "/api/n8n/callback",
]);

export async function proxy(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === AUTH_LOGIN_PATH && (await isAuthenticatedRequest(request))) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (await isAuthenticatedRequest(request)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, message: "Authentication required." },
      { status: 401 },
    );
  }

  const loginUrl = new URL(AUTH_LOGIN_PATH, request.url);
  const redirectTarget = `${pathname}${search}`;

  if (redirectTarget !== "/") {
    loginUrl.searchParams.set("redirect", redirectTarget);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
