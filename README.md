# Lucy Call

Commercial real-time video product with **live Lucy 2.5** avatar transformation and
background changing. Each participant's webcam is transformed in real time by
[Decart Lucy 2.5 Realtime](https://fal.ai/lucy-2-5) (video-to-video over WebRTC).

It ships in two modes from one web/desktop app, reached via a marketing **landing page**:

- **Broadcast** — single-user streaming tool (LucyStream-style). Your webcam is
  transformed by Lucy and shown full-screen; capture the app window in OBS, or publish
  to a real virtual camera via the desktop app. No LiveKit, no other participants.
- **Call** — multi-party video call. The *transformed* stream is published into a
  LiveKit room so every other caller sees the AI-edited version.

**Accounts are required.** Users register/log in, then verify their identity (Stripe
Identity: ID + selfie) before they can broadcast or call. This prevents impersonation
and is suitable for commercial launch.

## Architecture

```
  Browser / Electron desktop
    ├─ auth (register/login) → session cookie
    ├─ identity verification (Stripe Identity) → verified flag
    ├─ getUserMedia()  → raw camera
    ├─ LucyRealtime    → fal Lucy-2-5 WebRTC  → transformed stream
    └─ (Broadcast) show full-screen, capture in OBS / virtual camera
            or
    └─ (Call) LiveKit client → publishes transformed video + raw audio into the room
                                     ▲
                                LiveKit SFU (multi-party, recording, TURN)
    └─ Server (Node)
         ├─ /api/auth/*          → register / login / logout / me (sessions)
         ├─ /api/identity/*      → start Stripe Identity verification session
         ├─ /api/config          → endpoint + urls + stripeEnabled + identityEnabled
         ├─ /api/status          → which integrations are configured
         ├─ /api/token           → LiveKit join token (requires auth + verified)
         ├─ /api/fal-credentials → proxies FAL_KEY (auth + verified only)
         ├─ /api/usage/*         → credit metering (per user)
         └─ /api/stripe/webhook  → grants credits + marks identity verified
```

Why this split: the **FAL_KEY** and **LiveKit API secret** never leave the server. The browser
opens the Lucy WebRTC stream to fal directly (low latency), and gets its credential from the
server at call time. Access requires an authenticated, identity-verified account.

## Packages

| Package | Purpose |
| --- | --- |
| `packages/web` | React + Vite app: landing, auth, identity verification, Broadcast/Call, transforms, credits, Stripe top-up, legal |
| `packages/desktop` | Electron wrapper + OBS Virtual Camera bridge (preload IPC) |
| `packages/server` | Auth + sessions, identity (Stripe), token issuance, fal key proxy, credit metering, Stripe |
| `packages/shared` | Shared types & default transforms |

## Prerequisites

1. **fal.ai account** → get `FAL_KEY` at https://fal.ai/dashboard/keys
2. **LiveKit project** → get `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL` at https://livekit.io
3. **Stripe account** (payments + Identity KYC) → `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` + enable Identity
4. **Postgres** (accounts) → `DATABASE_URL` (or run in-memory for dev)
5. Node >= 20.

## Setup (local)

```bash
cp .env.example .env        # fill FAL_KEY, LiveKit, Stripe, DATABASE_URL
npm install
npm run dev:server          # :8787
npm run dev:web             # :5173
```

Open http://localhost:5173 → **Launch Lucy** → register → **verify identity** (Stripe Identity)
→ use Broadcast / Call.

## Accounts & identity

- `POST /api/auth/register` / `/login` / `/logout` / `/me` — email+password, httpOnly session cookie.
- `POST /api/identity/start` — creates a Stripe Identity verification session (document + selfie),
  redirects to Stripe-hosted flow; `return_url` comes back to `/app?verify=1`.
- `POST /api/stripe/webhook` — on `identity.verification_session.verified` sets the user `verified`;
  on `payment_intent.succeeded` grants credits.
- All `/api/fal-credentials`, `/api/token`, and `/api/usage/start` require an authenticated **and
  verified** user (401 if not logged in, 403 if not verified).
- User store: **Postgres** when `DATABASE_URL` is set (commercial-grade, durable), else in-memory.

## Credits / metering

Lucy is billed per streamed second by fal. Metering is per authenticated user
(`packages/server/src/store.js`):

- `GET  /api/usage` — balance (seconds) + rate + tiers (auth required)
- `POST /api/usage/start` — open a metering session (auth + verified), returns `sessionId`
- `POST /api/usage/stop` — close session, deduct elapsed seconds
- `POST /api/usage/topup` — create a Stripe PaymentIntent for a minutes tier
- `POST /api/stripe/webhook` — grant credits on `payment_intent.succeeded`

Env: `CREDIT_RATE_PER_SECOND` (default 0.05), `FREE_CREDITS` (minutes, default 10).
Credit store uses **Redis** when `REDIS_URL` is set, otherwise in-memory.

## Consent

The Terms + no-impersonation clause is part of the verification/ToS flow; verified users are
considered consented. Impersonating real people without consent is prohibited.

## Virtual camera (desktop)

In **Broadcast** mode the desktop app can publish the transformed stream to a real
virtual camera device other apps can select, by driving OBS's Virtual Camera over
obs-websocket (`packages/desktop/src/virtualCamera.js` + `preload.js`):

1. Install OBS with Virtual Camera enabled (obs-websocket on `ws://127.0.0.1:4455`).
2. Desktop: Broadcast → **Start virtual camera**.
3. In Zoom/Meet/OBS pick the "OBS Virtual Camera" source.

If OBS isn't running, the UI falls back to manual **Window Capture** of the Lucy window
(the LucyStream-style workflow). The web-only build shows a hint that virtual camera
is desktop-only.

## Docker

`docker-compose.yml` runs **Postgres + Redis + server**. Build the web app first, then:

```bash
npm run build:web
docker compose up --build
# server on :8787, Postgres on :5432, Redis on :6379
```

Env for production: `FAL_KEY`, `LIVEKIT_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`DATABASE_URL`, `REDIS_URL`, `PUBLIC_SERVER_URL`, `VITE_STRIPE_PUBLISHABLE_KEY` (web build).

## Commercial notes

- **Billing:** Lucy 2.5 is billed per streamed second by fal. Metering + Stripe top-ups are
  implemented; point a Stripe webhook at `/api/stripe/webhook` before GA.
- **Identity:** Stripe Identity (ID + selfie) gates broadcasting; satisfies "verify your identity"
  for a commercial product. Requires Stripe Identity enabled on your account.
- **Audio:** only the *raw* mic is published; Lucy transforms video only.
- **Recording:** LiveKit Egress can record the transformed room for compliance/audit.
- **Privacy:** transformed video frames are processed by fal per their terms
  (https://fal.ai/legal/terms-of-service). Disclose processing in your privacy policy.
- **Scaling:** LiveKit SFU handles many participants; fal cost scales with concurrent transformed
  streams, so gate transforms behind plan tiers.

## API reference

- Lucy 2.5 realtime: https://docs.platform.decart.ai/models/realtime/lucy-2-5
- fal client: https://fal.ai/lucy-2-5
- LiveKit JS: https://docs.livekit.io/client-sdk-js/
- Stripe: https://stripe.com/docs
- Stripe Identity: https://stripe.com/docs/identity
