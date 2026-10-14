import { cookies } from "next/headers";
import { verifyToken, type SessionPayload } from "./auth";

const COOKIE_NAME = "nmms_session";
/** 7 days in seconds */
const MAX_AGE = 60 * 60 * 24 * 7;

export async function setSessionCookie(token: string): Promise<void> {
  try {
    const store = await cookies();
    store.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: MAX_AGE,
      path: "/",
    });
  } catch {
    // Outside request context
  }
}

export async function clearSessionCookie(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(COOKIE_NAME);
  } catch {
    // Outside request context
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}
