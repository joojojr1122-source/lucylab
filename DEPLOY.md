# Deploy Lucy Call

Lucy Call is a **real-time** product: the server holds long-lived WebRTC + SSE
connections (the Lucy 2.5 transform stream) and meters credits in Redis. That
means the **backend must run as a long-lived process** — it cannot run on
serverless platforms (Vercel Functions time out).

Recommended: **Railway** (or Render) for the backend, **Vercel** (optional) for
the web CDN. The server also serves the built web app, so a single Railway
service is enough for a working production site.

---

## Option A — Railway (recommended, one service)

1. Create a project at https://railway.app and link this GitHub repo
   (`joojojr1122-source/lucylab`).
2. Railway auto-detects `railway.json` and builds with the `Dockerfile`.
3. Add a **Redis** plugin: `New > Database > Redis`. Railway injects
   `REDIS_URL` automatically — the server picks it up for durable metering.
4. Set environment variables (Railway → your service → Variables):

   | Variable | Value |
   | --- | --- |
   | `PORT` | `8787` (Railway sets this automatically) |
   | `PUBLIC_SERVER_URL` | `https://<your-railway-domain>` |
   | `FAL_KEY` | from https://fal.ai/dashboard/keys |
   | `LIVEKIT_API_KEY` | from https://livekit.io |
   | `LIVEKIT_API_SECRET` | from https://livekit.io |
   | `LIVEKIT_URL` | `wss://<your-project>.livekit.cloud` |
   | `CREDIT_RATE_PER_SECOND` | `0.05` |
   | `FREE_CREDITS` | `10` |
   | `STRIPE_SECRET_KEY` | (optional) from Stripe |
   | `STRIPE_WEBHOOK_SECRET` | (optional) from Stripe webhook |

   `REDIS_URL` is provided by the Redis plugin — do **not** set it manually
   unless you use an external Redis.

5. **Generate domain**: Railway → Settings → Generate Domain. The server serves
   both the API (`/api/*`) and the web app (`/`) from this one URL.
6. (Optional) Payments: point a Stripe webhook at
   `https://<your-domain>/api/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET`.

That's it — open the domain and the app is live.

---

## Option B — Vercel (web frontend) + Railway (backend)

Use this if you want Vercel's CDN + preview URLs for the frontend.

1. **Backend**: deploy to Railway per Option A. Note the backend URL
   (e.g. `https://lucy-backend.up.railway.app`).
2. **Frontend**: import the repo into Vercel. `vercel.json` is already present.
   Set build env vars:

   | Variable | Value |
   | --- | --- |
   | `VITE_API_BASE` | `https://<your-railway-domain>` |
   | `VITE_STRIPE_PUBLISHABLE_KEY` | (optional) Stripe publishable key |

3. The web app calls the backend at `VITE_API_BASE`. No CORS config needed if
   you set it; otherwise the server allows same-origin requests.

---

## Option C — Render

`render.yaml` defines a static web service + a Docker server service + Redis.
Push to GitHub and use **New > Blueprint** in Render, then set the
`sync: false` env vars (same list as Option A) in the dashboard.

---

## Required external accounts (all plans)

| Service | Why | Free? |
| --- | --- | --- |
| fal.ai | Lucy 2.5 transform API | pay-per-use |
| LiveKit | multi-party call media | free tier / paid |
| Stripe | top-ups + KYC (optional) | per-transaction only |
| Redis | durable metering/consent | free add-on |

## Local production-like run (Docker Compose)

```bash
cp .env.example .env   # fill FAL_KEY + LiveKit keys
docker compose up --build
# web + API on http://localhost:8787 , Redis + Postgres included
```

## Notes

- `FAL_KEY`, LiveKit keys, and `STRIPE_SECRET_KEY` are **server-side only**
  and never shipped to the browser. `.env` is gitignored.
- Without `REDIS_URL`, metering/consent use an in-memory store that resets on
  restart — fine for dev, **not** for production.
- The server serves `packages/web/dist` in production, so one host = full app.
