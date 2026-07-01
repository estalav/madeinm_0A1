import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "estala_pm_session";
export const AUTH_LOGIN_PATH = "/login";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

type AuthEnv = {
  username: string;
  password: string;
  secret: string;
};

function getAuthEnv(): AuthEnv | null {
  const username = process.env.APP_AUTH_USERNAME?.trim();
  const password = process.env.APP_AUTH_PASSWORD?.trim();
  const secret = process.env.APP_AUTH_SECRET?.trim();

  if (!username || !password || !secret) {
    return null;
  }

  return { username, password, secret };
}

function hexFromBuffer(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return hexFromBuffer(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
}

function parseCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";").map((part) => part.trim());

  for (const part of parts) {
    const [cookieName, ...cookieValueParts] = part.split("=");
    if (cookieName === name) {
      return cookieValueParts.join("=");
    }
  }

  return null;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export function isAuthConfigured() {
  return getAuthEnv() !== null;
}

export async function credentialsMatch(username: string, password: string) {
  const authEnv = getAuthEnv();

  if (!authEnv) {
    return false;
  }

  return username === authEnv.username && password === authEnv.password;
}

export async function createSessionToken(username: string) {
  const authEnv = getAuthEnv();

  if (!authEnv) {
    throw new Error("Authentication is not configured.");
  }

  const encodedUsername = encodeURIComponent(username);
  const expiresAt = Date.now() + SESSION_DURATION_SECONDS * 1000;
  const payload = `${encodedUsername}:${expiresAt}`;
  const signature = await signValue(payload, authEnv.secret);

  return `${encodedUsername}.${expiresAt}.${signature}`;
}

export async function verifySessionToken(token: string | null) {
  const authEnv = getAuthEnv();

  if (!authEnv || !token) {
    return false;
  }

  const [encodedUsername, expiresAtText, signature] = token.split(".");

  if (!encodedUsername || !expiresAtText || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtText);

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  const expectedSignature = await signValue(
    `${encodedUsername}:${expiresAt}`,
    authEnv.secret,
  );

  return expectedSignature === signature;
}

export async function isAuthenticatedRequest(
  request: Request | { headers: Headers },
) {
  const token = parseCookieValue(
    request.headers.get("cookie"),
    AUTH_COOKIE_NAME,
  );

  return verifySessionToken(token);
}

export async function isAuthenticatedCookieStore(
  cookieStore: Pick<ReadonlyRequestCookies, "get">,
) {
  return verifySessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null);
}

export async function withSessionCookie(response: NextResponse, username: string) {
  response.cookies.set(AUTH_COOKIE_NAME, await createSessionToken(username), cookieOptions());
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...cookieOptions(),
    maxAge: 0,
  });

  return response;
}

export function unauthorizedJson() {
  return NextResponse.json(
    { ok: false, message: "Authentication required." },
    { status: 401 },
  );
}
