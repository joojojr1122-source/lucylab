import { AccessToken } from "livekit-server-sdk";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { getStore as getCreditStore, RATE_PER_SECOND, FREE_CREDITS } from "./store.js";
import { getStore as getUsers, bcrypt } from "./users.js";
import {
  getSessionToken,
  setSessionCookie,
  clearSessionCookie,
  requireUser,
} from "./auth.js";
import { googleEnabled, getGoogleAuthUrl, exchangeCode, getUserInfo } from "./google.js";
import { sendVerificationEmail } from "./email.js";

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

const PORT = Number(env("PORT", "8787"));
const LIVEKIT_URL = env("LIVEKIT_URL", "ws://localhost:7880");
const LIVEKIT_API_KEY = env("LIVEKIT_API_KEY", "");
const LIVEKIT_API_SECRET = env("LIVEKIT_API_SECRET", "");
const FAL_KEY = env("FAL_KEY", "");
const FAL_LUCY_ENDPOINT = env("FAL_LUCY_ENDPOINT", "decart/lucy-2-5/realtime");
const PUBLIC_SERVER_URL = env("PUBLIC_SERVER_URL", `http://localhost:${PORT}`);
const STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY", "");
const STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET", "");
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const credits = getCreditStore();
const users = await getUsers();
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// Pricing tiers (minutes -> USD).
const TOPUP_TIERS = { 10: 25, 30: 60, 60: 100, 120: 180 };

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Cookie",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  });
  res.end(data);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

function issueToken(room, identity, displayName) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: displayName,
    ttl: "2h",
  });
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true });
  return at.toJwt();
}

// Credit metering tick.
const sessions = new Map();
setInterval(async () => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    const used = (now - s.startedAt) / 1000;
    const bal = (await credits.get(s.identity)) - used;
    if (bal <= 0) {
      await credits.set(s.identity, 0);
      sessions.delete(id);
    } else {
      await credits.set(s.identity, bal);
      s.startedAt = now;
    }
  }
}, 1000).unref();

import { createServer } from "node:http";

const http = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "OPTIONS") return send(res, 204, {});

  // ---------------- public config ----------------
  if (url.pathname === "/api/config") {
    return send(res, 200, {
      falEndpoint: FAL_LUCY_ENDPOINT,
      publicServerUrl: PUBLIC_SERVER_URL,
      livekitUrl: LIVEKIT_URL,
      stripeEnabled: Boolean(stripe),
      identityEnabled: true,
      googleEnabled: googleEnabled(),
    });
  }

  if (url.pathname === "/api/status") {
    return send(res, 200, {
      fal: Boolean(FAL_KEY),
      livekit: Boolean(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL),
      stripe: Boolean(stripe),
      redis: Boolean(env("REDIS_URL", "")),
      database: Boolean(env("DATABASE_URL", "")),
      identity: Boolean(stripe),
      google: googleEnabled(),
    });
  }

  // ---------------- Google OAuth ----------------
  if (url.pathname === "/api/auth/google" && req.method === "GET") {
    if (!googleEnabled()) return send(res, 501, { error: "Google login not configured" });
    return redirect(res, getGoogleAuthUrl());
  }

  if (url.pathname === "/api/auth/google/callback" && req.method === "GET") {
    try {
      const code = url.searchParams.get("code");
      if (!code) return redirect(res, `${PUBLIC_SERVER_URL}/app?google=error`);
      const { access_token } = await exchangeCode(code);
      const profile = await getUserInfo(access_token);
      if (!profile.email) return redirect(res, `${PUBLIC_SERVER_URL}/app?google=error`);
      let user = await users.findByGoogleSub(profile.sub);
      if (!user) user = await users.findByEmail(profile.email);
      if (!user) user = await users.createGoogleUser(profile.email, profile.sub, profile.name);
      else if (!user.google_sub) await users.linkGoogle?.(user.id, profile.sub);
      const token = await users.createSession(user.id);
      setSessionCookie(res, token);
      return redirect(res, `${PUBLIC_SERVER_URL}/app`);
    } catch (e) {
      return redirect(res, `${PUBLIC_SERVER_URL}/app?google=error`);
    }
  }

  // ---------------- email verification ----------------
  if (url.pathname === "/api/auth/confirm" && req.method === "GET") {
    const token = url.searchParams.get("token");
    const user = token ? await users.findByEmailToken(token) : null;
    if (user) await users.setEmailVerified(user.id);
    return redirect(res, `${PUBLIC_SERVER_URL}/app?confirmed=${user ? "1" : "0"}`);
  }

  // ---------------- auth ----------------
  if (url.pathname === "/api/auth/register" && req.method === "POST") {
    try {
      const { email, password } = await readBody(req);
      if (!email || !password || password.length < 8)
        return send(res, 400, { error: "email + password (>=8 chars) required" });
      if (await users.findByEmail(email)) return send(res, 409, { error: "email already registered" });
      const hash = await bcrypt.hash(password, 10);
      const user = await users.createUser(email, hash);
      await sendVerificationEmail(user.email, user.emailToken);
      return send(res, 200, { id: user.id, email: user.email, emailVerified: false, verified: false });
    } catch (e) {
      return send(res, 400, { error: String(e.message || e) });
    }
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    try {
      const { email, password } = await readBody(req);
      const user = await users.findByEmail(email);
      if (!user || !user.password_hash || !(await bcrypt.compare(password || "", user.password_hash)))
        return send(res, 401, { error: "invalid credentials" });
      if (!user.emailVerified)
        return send(res, 403, { error: "verify your email first", emailUnverified: true });
      const token = await users.createSession(user.id);
      setSessionCookie(res, token);
      return send(res, 200, { id: user.id, email: user.email, verified: user.verified });
    } catch {
      return send(res, 400, { error: "invalid request" });
    }
  }

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    const token = getSessionToken(req);
    if (token) await users.deleteSession(token);
    clearSessionCookie(res);
    return send(res, 200, { ok: true });
  }

  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    const user = await requireUser(users, req);
    if (!user) return send(res, 401, { error: "unauthenticated" });
    return send(res, 200, {
      id: user.id,
      email: user.email,
      verified: user.verified,
      emailVerified: Boolean(user.emailVerified),
      verificationStatus: user.verificationStatus,
    });
  }

  // ---------------- identity verification (Stripe Identity) ----------------
  if (url.pathname === "/api/identity/start" && req.method === "POST") {
    const user = await requireUser(users, req);
    if (!user) return send(res, 401, { error: "unauthenticated" });
    if (!user.emailVerified) return send(res, 403, { error: "verify your email first" });
    if (!stripe) return send(res, 501, { error: "Stripe not configured" });
    try {
      const vs = await stripe.identity.verificationSessions.create({
        type: "document",
        metadata: { userId: user.id },
        return_url: `${PUBLIC_SERVER_URL}/app?verify=1`,
      });
      await users.setVerification(user.id, "pending", vs.id);
      return send(res, 200, { url: vs.url, client_secret: vs.client_secret });
    } catch (e) {
      return send(res, 500, { error: String(e?.message || e) });
    }
  }

  if (url.pathname === "/api/identity/status" && req.method === "GET") {
    const user = await requireUser(users, req);
    if (!user) return send(res, 401, { error: "unauthenticated" });
    return send(res, 200, {
      verified: user.verified,
      status: user.verificationStatus,
      emailVerified: Boolean(user.emailVerified),
    });
  }

  // ---------------- protected: fal credentials ----------------
  if (url.pathname === "/api/fal-credentials" && req.method === "POST") {
    const user = await requireUser(users, req);
    if (!user) return send(res, 401, { error: "unauthenticated" });
    if (!user.verified) return send(res, 403, { error: "identity verification required" });
    if (!FAL_KEY) return send(res, 500, { error: "FAL_KEY not configured" });
    return send(res, 200, { key: FAL_KEY });
  }

  // ---------------- LiveKit token (requires auth + verified) ----------------
  if (url.pathname === "/api/token" && req.method === "POST") {
    const user = await requireUser(users, req);
    if (!user) return send(res, 401, { error: "unauthenticated" });
    if (!user.verified) return send(res, 403, { error: "identity verification required" });
    try {
      const body = await readBody(req);
      const room = String(body.room || "").trim();
      const displayName = String(body.displayName || "Guest").trim() || "Guest";
      if (!room) return send(res, 400, { error: "room is required" });
      const identity = user.id;
      const token = issueToken(room, identity, displayName);
      return send(res, 200, { url: LIVEKIT_URL, token });
    } catch {
      return send(res, 400, { error: "invalid request" });
    }
  }

  // ---------------- credit usage (per authenticated user) ----------------
  if (url.pathname === "/api/usage" && req.method === "GET") {
    const user = await requireUser(users, req);
    if (!user) return send(res, 401, { error: "unauthenticated" });
    return send(res, 200, {
      identity: user.id,
      secondsRemaining: Math.max(0, await credits.get(user.id)),
      ratePerSecond: RATE_PER_SECOND,
      topupTiers: TOPUP_TIERS,
    });
  }

  if (url.pathname === "/api/usage/start" && req.method === "POST") {
    const user = await requireUser(users, req);
    if (!user) return send(res, 401, { error: "unauthenticated" });
    if (!user.verified) return send(res, 403, { error: "identity verification required", verifyRequired: true });
    if ((await credits.get(user.id)) <= 0)
      return send(res, 402, { error: "out of credits", secondsRemaining: 0 });
    const sessionId = randomUUID();
    sessions.set(sessionId, { identity: user.id, startedAt: Date.now() });
    return send(res, 200, { sessionId, secondsRemaining: await credits.get(user.id) });
  }

  if (url.pathname === "/api/usage/stop" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const sessionId = String(body.sessionId || "");
      const s = sessions.get(sessionId);
      if (s) {
        const used = (Date.now() - s.startedAt) / 1000;
        await credits.set(s.identity, Math.max(0, (await credits.get(s.identity)) - used));
        sessions.delete(sessionId);
      }
      return send(res, 200, { ok: true });
    } catch {
      return send(res, 400, { error: "invalid request" });
    }
  }

  if (url.pathname === "/api/usage/topup" && req.method === "POST") {
    try {
      const user = await requireUser(users, req);
      if (!user) return send(res, 401, { error: "unauthenticated" });
      const body = await readBody(req);
      const minutes = Number(body.minutes || 0);
      const amount = TOPUP_TIERS[minutes];
      if (!amount) return send(res, 400, { error: "unknown tier", tiers: TOPUP_TIERS });
      if (!stripe) return send(res, 501, { error: "Stripe not configured" });
      const pi = await stripe.paymentIntents.create({
        amount: amount * 100,
        currency: "usd",
        metadata: { userId: user.id, minutes: String(minutes) },
        automatic_payment_methods: { enabled: true },
      });
      return send(res, 200, { clientSecret: pi.client_secret, amount });
    } catch (e) {
      return send(res, 500, { error: String(e?.message || e) });
    }
  }

  // ---------------- consent (per authenticated user) ----------------
  if (url.pathname === "/api/consent" && req.method === "GET") {
    const user = await requireUser(users, req);
    if (!user) return send(res, 401, { error: "unauthenticated" });
    return send(res, 200, { accepted: user.verified });
  }
  if (url.pathname === "/api/consent" && req.method === "POST") {
    const user = await requireUser(users, req);
    if (!user) return send(res, 401, { error: "unauthenticated" });
    return send(res, 200, { accepted: user.verified });
  }

  // ---------------- Stripe webhooks (credits + identity) ----------------
  if (url.pathname === "/api/stripe/webhook" && req.method === "POST") {
    if (!stripe) return send(res, 501, { error: "Stripe not configured" });
    const sig = req.headers["stripe-signature"];
    if (!sig || !STRIPE_WEBHOOK_SECRET)
      return send(res, 400, { error: "missing signature or webhook secret" });
    const raw = await new Promise((resolve, rej) =>
      req.on("data", (c) => (raw += c)).once("end", () => resolve(raw)).on("error", rej)
    );
    let event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
    } catch (e) {
      return send(res, 400, { error: `webhook error: ${e.message}` });
    }
    if (event.type === "payment_intent.succeeded") {
      const { userId, minutes } = event.data.object.metadata;
      if (userId && minutes) await credits.add(userId, Number(minutes) * 60);
    }
    if (event.type === "identity.verification_session.verified") {
      const userId = event.data.object.metadata?.userId;
      if (userId) await users.setVerification(userId, "verified");
    }
    if (event.type === "identity.verification_session.requires_input") {
      const userId = event.data.object.metadata?.userId;
      if (userId) await users.setVerification(userId, "failed");
    }
    return send(res, 200, { received: true });
  }

  // Serve the built web app in production (if present).
  // Repo root is 4 segments up from packages/server/src/index.js
  // (index.js -> src -> server -> packages -> root).
  const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../../../");
  const WEB_DIST = path.join(REPO_ROOT, "packages", "web", "dist");
  if (req.method === "GET" && !req.url.startsWith("/api/")) {
    if (fs.existsSync(WEB_DIST)) {
      const urlPath = decodeURIComponent(req.url.split("?")[0]);
      const safe = urlPath.replace(/\.\.+/g, "");
      let filePath = path.resolve(WEB_DIST, safe === "/" ? "index.html" : safe);
      if (!filePath.startsWith(WEB_DIST)) return send(res, 403, { error: "forbidden" });
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        filePath = path.join(WEB_DIST, "index.html");
      }
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
        res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
        return fs.createReadStream(filePath).pipe(res);
      }
    }
  }

  send(res, 404, { error: "not found" });
});

http.listen(PORT, () => {
  console.log(`[lucy-call] server listening on http://localhost:${PORT}`);
  if (!FAL_KEY) console.warn("[lucy-call] WARNING: FAL_KEY is not set");
  if (!LIVEKIT_API_KEY) console.warn("[lucy-call] WARNING: LiveKit keys not set");
  if (!stripe) console.warn("[lucy-call] WARNING: STRIPE_SECRET_KEY not set (payments + identity disabled)");
  if (!googleEnabled()) console.warn("[lucy-call] WARNING: GOOGLE_CLIENT_ID not set (Google login disabled)");
});
