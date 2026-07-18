import { parse, serialize } from "cookie";

export const SESSION_COOKIE = "lucy_session";

export function getSessionToken(req) {
  const cookies = parse(req.headers.cookie || "");
  return cookies[SESSION_COOKIE] || null;
}

export function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    serialize(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    serialize(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 })
  );
}

// Resolve the authenticated user from the request, or null.
export async function requireUser(users, req) {
  const token = getSessionToken(req);
  if (!token) return null;
  const session = await users.getSession(token);
  if (!session) return null;
  return users.findById(session.userId);
}
