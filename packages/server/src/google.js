function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

const CLIENT_ID = env("GOOGLE_CLIENT_ID", "");
const CLIENT_SECRET = env("GOOGLE_CLIENT_SECRET", "");
const PUBLIC_SERVER_URL = env("PUBLIC_SERVER_URL", "http://localhost:8787");
const REDIRECT_URI = `${PUBLIC_SERVER_URL}/api/auth/google/callback`;

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export function googleEnabled() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export function getGoogleAuthUrl(state = "") {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error("google token exchange failed");
  return res.json();
}

export async function getUserInfo(accessToken) {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("google userinfo failed");
  return res.json(); // { sub, email, email_verified, name, picture }
}
